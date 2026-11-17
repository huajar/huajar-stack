import { spawn } from "node:child_process";
import {
  WatcherQueryError,
  mapRollupNode,
  parsePullRequest,
} from "./github.ts";
import type * as T from "./types.ts";
import { parsePrNumber } from "./types.ts";

export const GRAPHQL_BLOCKED_MESSAGE =
  "GitHub GraphQL is not available from Claude Code sessions";
const COMMITS_CHECKED = 50;
const FAILED_REREAD_EVERY = 5;
const NULL_READS_TO_SETTLE = 2;
const COUNTED_REVIEWERS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export type GhApi = (path: string) => Promise<unknown>;
export interface ProbeResult {
  readonly code: number;
  readonly output: string;
}

function exec(
  command: string,
  args: readonly string[]
): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      output += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      output += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({ code: code ?? -1, output: code === 0 ? stdout : output })
    );
  });
}

export const ghApi: GhApi = async (path) => {
  const result = await exec("gh", ["api", "--paginate", "--slurp", path]);
  if (result.code !== 0)
    throw new WatcherQueryError({
      kind: "command-exit",
      retryable: true,
      code: result.code,
      detail: `gh api ${path}: ${result.output.trim().split(/\r?\n/, 1)[0]?.slice(0, 240) ?? ""}`,
    });
  try {
    return JSON.parse(result.output);
  } catch (error) {
    throw new WatcherQueryError({
      kind: "json-parse",
      retryable: true,
      detail: `gh api ${path}: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
};

export const probeGraphql = (): Promise<ProbeResult> =>
  exec("gh", ["api", "graphql", "-f", "query={viewer{login}}"]);

export const graphqlIsBlocked = (probe: ProbeResult): boolean =>
  probe.code !== 0 &&
  probe.output.includes("HTTP 403") &&
  probe.output.includes(GRAPHQL_BLOCKED_MESSAGE);

function missing(path: string, value?: unknown): never {
  throw new WatcherQueryError({
    kind: "missing-key",
    retryable: true,
    detail:
      value === undefined
        ? `missing ${path}`
        : `invalid ${path}: ${JSON.stringify(value)}`,
  });
}
function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    missing(path, value);
  return value as Record<string, unknown>;
}
function str(value: unknown, path: string): string {
  if (typeof value !== "string") missing(path, value);
  return value;
}
// `gh api --slurp` wraps every page in one array. Paged endpoints return an
// array per page, or an object holding the array under `key`.
function items(slurped: unknown, path: string, key?: string): unknown[] {
  if (!Array.isArray(slurped)) missing(path, slurped);
  return slurped.flatMap((page) => {
    const rows = key === undefined ? page : record(page, path)[key];
    if (!Array.isArray(rows)) missing(path, rows);
    return rows;
  });
}
const one = (slurped: unknown, path: string): Record<string, unknown> =>
  record(Array.isArray(slurped) ? slurped[0] : slurped, path);

// GraphQL reports a bot author without the "[bot]" suffix REST adds.
const login = (user: unknown, path: string): string | null =>
  user === null || user === undefined
    ? null
    : str(record(user, path).login, `${path}.login`).replace(/\[bot\]$/, "");

const headKey = (c: T.PrContext) => `${c.owner}/${c.repo}#${c.number}`;
const pulls = (c: T.Repository) => `repos/${c.owner}/${c.repo}/pulls`;

function reviewDecision(reviews: unknown[]): T.ReviewDecision {
  const latest = new Map<string, string>();
  for (const item of reviews) {
    const review = record(item, "review");
    const state = str(review.state, "review.state");
    const user = login(review.user, "review.user");
    if (user === null || state === "COMMENTED" || state === "PENDING") continue;
    if (!COUNTED_REVIEWERS.has(str(review.author_association, "review.author_association")))
      continue;
    if (state === "DISMISSED") latest.delete(user);
    else latest.set(user, state);
  }
  const states = [...latest.values()];
  if (states.includes("CHANGES_REQUESTED")) return "CHANGES_REQUESTED";
  return states.includes("APPROVED") ? "APPROVED" : null;
}

export function rollupState(checks: readonly T.Check[]): T.RollupState {
  if (checks.length === 0) return null;
  if (checks.some((check) => check.kind === "failed")) return "FAILURE";
  if (checks.some((check) => check.kind === "pending")) return "PENDING";
  return "SUCCESS";
}

interface EarlierRead {
  readonly state: T.RollupState;
  readonly readAt: number;
  readonly nullReads: number;
}

export class RestGitHubReader implements T.GitHubReader {
  private readonly heads = new Map<string, string>();
  private readonly earlier = new Map<string, EarlierRead>();
  private readonly headChecks = new Map<string, readonly T.Check[]>();
  private tick = 0;
  constructor(
    private readonly api: GhApi = ghApi,
    private readonly git: (args: readonly string[]) => Promise<string | null> =
      async (args) => {
        const result = await exec("git", args).catch(() => null);
        return result === null || result.code !== 0 ? null : result.output;
      }
  ) {}

  async originRepo(): Promise<T.Repository | null> {
    const remote = await this.git(["remote", "get-url", "origin"]);
    const match = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\s*$/.exec(
      remote ?? ""
    );
    return match === null ? null : { owner: match[1], repo: match[2] };
  }

  async currentPr(pr: T.PrNumber | null): Promise<T.PrContext> {
    const origin = await this.originRepo();
    if (origin === null)
      missing("origin remote: run inside a GitHub checkout or pass --owner/--repo");
    if (pr !== null) return { ...origin, number: pr };
    const branch = (await this.git(["rev-parse", "--abbrev-ref", "HEAD"]))?.trim();
    if (!branch) missing("current branch");
    const found = items(
      await this.api(
        `${pulls(origin)}?state=open&head=${origin.owner}:${branch}`
      ),
      "pulls"
    );
    if (found.length === 0) missing(`open PR for branch ${branch}`);
    return {
      ...origin,
      number: parsePrNumber(record(found[0], "pull").number, "current PR.number"),
    };
  }

  async pullRequest(context: T.PrContext): Promise<T.PullRequestFacts> {
    const base = `${pulls(context)}/${context.number}`;
    const pull = one(await this.api(base), "pull request");
    const reviews = items(await this.api(`${base}/reviews?per_page=100`), "reviews");
    const mergeable = pull.mergeable;
    this.heads.set(headKey(context), str(record(pull.head, "head").sha, "head.sha"));
    this.headChecks.clear();
    return parsePullRequest(
      {
        mergeable:
          mergeable === true
            ? "MERGEABLE"
            : mergeable === false
              ? "CONFLICTING"
              : "UNKNOWN",
        mergeStateStatus: str(pull.mergeable_state, "mergeable_state").toUpperCase(),
        reviewDecision: reviewDecision(reviews),
        headRefOid: record(pull.head, "head").sha,
        headRefName: record(pull.head, "head").ref,
        baseRefName: record(pull.base, "base").ref,
        state:
          pull.merged === true || pull.merged_at != null
            ? "MERGED"
            : str(pull.state, "state").toUpperCase(),
        mergedAt: pull.merged_at ?? null,
        isDraft: pull.draft,
      },
      context
    );
  }

  async openPullRequests(
    repository: T.Repository
  ): Promise<readonly T.OpenPullRequest[]> {
    const open = items(
      await this.api(`${pulls(repository)}?state=open&per_page=100`),
      "open PRs"
    );
    return open.map((item, index) => {
      const pull = record(item, `open PRs[${index}]`);
      const head = record(pull.head, "head");
      const repo = head.repo === null ? null : record(head.repo, "head.repo");
      return {
        number: parsePrNumber(pull.number, `open PRs[${index}].number`),
        isCrossRepository:
          repo === null ||
          str(repo.full_name, "head.repo.full_name").toLowerCase() !==
            `${repository.owner}/${repository.repo}`.toLowerCase(),
        headRefName: str(head.ref, "head.ref"),
        baseRefName: str(record(pull.base, "base").ref, "base.ref"),
      };
    });
  }

  private async commitChecks(
    context: T.Repository,
    sha: string
  ): Promise<readonly T.Check[]> {
    const root = `repos/${context.owner}/${context.repo}/commits/${sha}`;
    const runs = items(
      await this.api(`${root}/check-runs?per_page=100`),
      "check-runs",
      "check_runs"
    ).map((run) => {
      const r = record(run, "check run");
      return mapRollupNode({
        __typename: "CheckRun",
        name: r.name,
        status: r.status,
        conclusion: r.conclusion,
        detailsUrl: r.details_url,
      });
    });
    const statuses = items(
      await this.api(`${root}/status?per_page=100`),
      "status",
      "statuses"
    ).map((status) => {
      const s = record(status, "status");
      return mapRollupNode({
        __typename: "StatusContext",
        context: s.context,
        state: s.state,
        targetUrl: s.target_url,
        description: s.description,
      });
    });
    return [...runs, ...statuses].filter(
      (check): check is T.Check => check !== null
    );
  }

  private async headSha(context: T.PrContext): Promise<string> {
    const known = this.heads.get(headKey(context));
    if (known !== undefined) return known;
    const pull = one(await this.api(`${pulls(context)}/${context.number}`), "pull request");
    return str(record(pull.head, "head").sha, "head.sha");
  }

  async checksFastPath(context: T.PrContext): Promise<T.ChecksFastPath> {
    const sha = await this.headSha(context);
    const checks = await this.commitChecks(context, sha);
    this.headChecks.set(`${headKey(context)}@${sha}`, checks);
    return { kind: "checks", checks };
  }

  async checkRollupPage(): Promise<T.RollupPage> {
    return { checks: [], endCursor: null };
  }

  async reviewThreadPage(context: T.PrContext): Promise<T.ReviewThreadPage> {
    const base = `${pulls(context)}/${context.number}`;
    const threads = items(
      await this.api(`${base}/ccr/review_threads?per_page=100`),
      "review threads"
    );
    const comments = new Map<number, Record<string, unknown>>();
    for (const item of items(
      await this.api(`${base}/comments?per_page=100`),
      "review comments"
    )) {
      const comment = record(item, "review comment");
      comments.set(Number(comment.id), comment);
    }
    return {
      endCursor: null,
      threads: threads.map((item, index) => {
        const thread = record(item, `review threads[${index}]`);
        if (typeof thread.resolved !== "boolean")
          missing(`review threads[${index}].resolved`, thread.resolved);
        if (!Array.isArray(thread.comment_ids) || thread.comment_ids.length === 0)
          missing(`review threads[${index}].comment_ids`, thread.comment_ids);
        const first = comments.get(Number(thread.comment_ids[0]));
        return {
          id: String(thread.comment_ids[0]),
          resolved: thread.resolved,
          firstComment:
            first === undefined
              ? null
              : {
                  authorLogin: login(first.user, "review comment.user"),
                  body: str(first.body, "review comment.body"),
                  path: typeof thread.path === "string" ? thread.path : null,
                  line: typeof thread.line === "number" ? thread.line : null,
                  createdAt: str(first.created_at, "review comment.created_at"),
                },
        };
      }),
    };
  }

  async commitRollups(
    context: T.PrContext
  ): Promise<readonly T.CommitRollup[]> {
    const head = await this.headSha(context);
    const commits = items(
      await this.api(`${pulls(context)}/${context.number}/commits?per_page=100`),
      "commits"
    ).map((item) => str(record(item, "commit").sha, "commit.sha"));
    if (!commits.includes(head)) commits.push(head);
    const window = commits.slice(-COMMITS_CHECKED);
    const keyOf = (oid: string) => `${context.owner}/${context.repo}@${oid}`;
    this.tick += 1;
    let passed = window.some(
      (oid) => oid !== head && this.earlier.get(keyOf(oid))?.state === "SUCCESS"
    );
    const rollups: T.CommitRollup[] = [];
    for (const oid of window) {
      if (oid === head) {
        const cached = this.headChecks.get(`${headKey(context)}@${oid}`);
        this.headChecks.delete(`${headKey(context)}@${oid}`);
        rollups.push({
          oid,
          state: rollupState(cached ?? (await this.commitChecks(context, oid))),
        });
        continue;
      }
      const seen = this.earlier.get(keyOf(oid));
      if (seen !== undefined && !this.isDue(seen, passed)) {
        rollups.push({ oid, state: seen.state });
        continue;
      }
      const state = rollupState(await this.commitChecks(context, oid));
      const nullReads = state === null ? (seen?.nullReads ?? 0) + 1 : 0;
      this.earlier.set(keyOf(oid), { state, readAt: this.tick, nullReads });
      if (state === "SUCCESS") passed = true;
      rollups.push({ oid, state });
    }
    return rollups;
  }

  private isDue(seen: EarlierRead, passed: boolean): boolean {
    if (seen.state === "SUCCESS" || passed) return false;
    if (seen.state === null) return seen.nullReads < NULL_READS_TO_SETTLE;
    return this.tick - seen.readAt >= FAILED_REREAD_EVERY;
  }
}

// Picks the reader once, on first use. The GraphQL 403 is a property of the
// session, so it is probed one time and never retried.
export class SelectingGitHubReader implements T.GitHubReader {
  private chosen: Promise<T.GitHubReader> | null = null;
  constructor(
    private readonly graphql: T.GitHubReader,
    private readonly rest: T.GitHubReader,
    private readonly probe: () => Promise<ProbeResult> = probeGraphql
  ) {}
  private reader(): Promise<T.GitHubReader> {
    this.chosen ??= this.probe().then(
      (result) => (graphqlIsBlocked(result) ? this.rest : this.graphql),
      () => this.graphql
    );
    return this.chosen;
  }
  async originRepo() {
    return (await this.reader()).originRepo();
  }
  async currentPr(pr: T.PrNumber | null) {
    return (await this.reader()).currentPr(pr);
  }
  async pullRequest(context: T.PrContext) {
    return (await this.reader()).pullRequest(context);
  }
  async openPullRequests(repository: T.Repository) {
    return (await this.reader()).openPullRequests(repository);
  }
  async checksFastPath(context: T.PrContext) {
    return (await this.reader()).checksFastPath(context);
  }
  async checkRollupPage(context: T.PrContext, after: string | null) {
    return (await this.reader()).checkRollupPage(context, after);
  }
  async reviewThreadPage(context: T.PrContext, after: string | null) {
    return (await this.reader()).reviewThreadPage(context, after);
  }
  async commitRollups(context: T.PrContext) {
    return (await this.reader()).commitRollups(context);
  }
}
