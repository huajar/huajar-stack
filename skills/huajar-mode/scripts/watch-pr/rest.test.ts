import { describe, expect, it } from "bun:test";
import { resolveChecks, resolveReviewThreads } from "./github.ts";
import { fakeReader } from "./fakes.test-helper.ts";
import {
  GRAPHQL_BLOCKED_MESSAGE,
  RestGitHubReader,
  SelectingGitHubReader,
  graphqlIsBlocked,
  type GhApi,
} from "./rest.ts";
import { parsePrNumber } from "./types.ts";

const context = { owner: "o", repo: "r", number: parsePrNumber(7) };
const pull = (extra: Record<string, unknown> = {}) => ({
  state: "open",
  merged: false,
  merged_at: null,
  draft: false,
  mergeable: true,
  mergeable_state: "clean",
  head: { ref: "feature", sha: "sha2", repo: { full_name: "o/r" } },
  base: { ref: "main" },
  ...extra,
});

function fakeApi(routes: Record<string, unknown>): GhApi & { calls: string[] } {
  const calls: string[] = [];
  const api = async (path: string) => {
    calls.push(path);
    if (!(path in routes)) throw new Error(`unexpected path ${path}`);
    return routes[path];
  };
  return Object.assign(api, { calls });
}

describe("REST review threads", () => {
  const api = fakeApi({
    "repos/o/r/pulls/7/ccr/review_threads?per_page=100": [
      [
        { resolved: true, outdated: false, path: "a.ts", line: 3, comment_ids: [10] },
        { resolved: false, outdated: false, path: "b.ts", line: 9, comment_ids: [20, 21] },
        { resolved: false, outdated: true, path: "c.ts", line: null, comment_ids: [30] },
      ],
    ],
    "repos/o/r/pulls/7/comments?per_page=100": [
      [
        { id: 10, user: { login: "alice" }, body: "resolved nit", created_at: "t1" },
        { id: 20, user: { login: "cursor-bugbot[bot]" }, body: "**High**: off by one", created_at: "t2" },
        { id: 21, user: { login: "bob" }, body: "reply", created_at: "t3" },
        { id: 30, user: { login: "carol" }, body: "stale", created_at: "t4" },
      ],
    ],
  });

  it("drops resolved threads and maps authors through comment_ids", async () => {
    const threads = await resolveReviewThreads(new RestGitHubReader(api), context);
    expect(threads).toEqual([
      {
        id: "20",
        isBugbot: true,
        bugbotReviewPasses: 1,
        firstComment: {
          authorLogin: "cursor-bugbot",
          body: "**High**: off by one",
          path: "b.ts",
          line: 9,
          createdAt: "t2",
        },
      },
      {
        id: "30",
        isBugbot: false,
        bugbotReviewPasses: 1,
        firstComment: {
          authorLogin: "carol",
          body: "stale",
          path: "c.ts",
          line: null,
          createdAt: "t4",
        },
      },
    ]);
  });
});

describe("REST checks", () => {
  const sha = "repos/o/r/commits/sha2";
  const api = fakeApi({
    "repos/o/r/pulls/7": pull(),
    [`${sha}/check-runs?per_page=100`]: [
      {
        total_count: 3,
        check_runs: [
          { name: "build", status: "completed", conclusion: "success", details_url: "u1" },
          { name: "test", status: "completed", conclusion: "failure", details_url: "u2" },
          { name: "lint", status: "in_progress", conclusion: null as string | null, details_url: "u3" },
        ],
      },
    ],
    [`${sha}/status?per_page=100`]: [
      { state: "failure", statuses: [{ context: "ci/legacy", state: "failure", target_url: "u4", description: "broke" }] },
    ],
  });

  it("classifies check runs and commit statuses", async () => {
    const read = await resolveChecks(new RestGitHubReader(api), context);
    expect(read.checks.map((c) => [c.name, c.kind, c.reportedState, c.link])).toEqual([
      ["build", "passed", "SUCCESS", "u1"],
      ["test", "failed", "FAILURE", "u2"],
      ["lint", "pending", "PENDING", "u3"],
      ["ci/legacy", "failed", "FAILURE", "u4"],
    ]);
  });
});

describe("REST pull request facts", () => {
  const reviews = (states: [string, string, string?][]) =>
    states.map(([state, login, association = "MEMBER"]) => ({
      state,
      user: { login },
      author_association: association,
    }));
  const reader = (extra: Record<string, unknown>, review: unknown[] = []) =>
    new RestGitHubReader(
      fakeApi({
        "repos/o/r/pulls/7": pull(extra),
        "repos/o/r/pulls/7/reviews?per_page=100": [review],
      })
    );

  it("reports a dirty merge state as CONFLICTING and DIRTY", async () => {
    const facts = await reader({ mergeable: false, mergeable_state: "dirty" }).pullRequest(context);
    expect([facts.mergeable, facts.mergeStateStatus, facts.state, facts.headRefOid]).toEqual([
      "CONFLICTING",
      "DIRTY",
      "OPEN",
      "sha2",
    ]);
  });

  it("reports a merged PR as MERGED with mergedAt", async () => {
    const facts = await reader({
      state: "closed",
      merged: true,
      merged_at: "2026-10-29T14:21:19Z",
      mergeable: null,
      mergeable_state: "unknown",
    }).pullRequest(context);
    expect([facts.state, facts.mergedAt, facts.mergeable]).toEqual([
      "MERGED",
      "2026-10-29T14:21:19Z",
      "UNKNOWN",
    ]);
  });

  it("derives the review decision from each reviewer's latest verdict", async () => {
    const facts = await reader(
      {},
      reviews([["CHANGES_REQUESTED", "a"], ["COMMENTED", "a"], ["APPROVED", "b"]])
    ).pullRequest(context);
    expect(facts.reviewDecision).toBe("CHANGES_REQUESTED");
    const cleared = await reader(
      {},
      reviews([["CHANGES_REQUESTED", "a"], ["APPROVED", "a"]])
    ).pullRequest(context);
    expect(cleared.reviewDecision).toBe("APPROVED");
  });
});

describe("REST review decision and head", () => {
  const reviews = (rows: [string, string, string][]) =>
    rows.map(([state, login, association]) => ({
      state,
      user: { login },
      author_association: association,
    }));

  it("ignores a CHANGES_REQUESTED review from a reviewer branch protection does not count", async () => {
    for (const association of ["NONE", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR"]) {
      const api = fakeApi({
        "repos/o/r/pulls/7": pull(),
        "repos/o/r/pulls/7/reviews?per_page=100": [
          reviews([
            ["CHANGES_REQUESTED", "some-bot[bot]", association],
            ["APPROVED", "maintainer", "MEMBER"],
          ]),
        ],
      });
      expect((await new RestGitHubReader(api).pullRequest(context)).reviewDecision).toBe(
        "APPROVED"
      );
    }
  });

  it("counts CHANGES_REQUESTED from an owner, member or collaborator", async () => {
    for (const association of ["OWNER", "MEMBER", "COLLABORATOR"]) {
      const api = fakeApi({
        "repos/o/r/pulls/7": pull(),
        "repos/o/r/pulls/7/reviews?per_page=100": [
          reviews([["CHANGES_REQUESTED", "dev", association]]),
        ],
      });
      expect((await new RestGitHubReader(api).pullRequest(context)).reviewDecision).toBe(
        "CHANGES_REQUESTED"
      );
    }
  });

  it("reads pulls/N once for the facts, the checks and the rollups", async () => {
    const sha = "repos/o/r/commits/sha2";
    const api = fakeApi({
      "repos/o/r/pulls/7": pull(),
      "repos/o/r/pulls/7/reviews?per_page=100": [[]],
      "repos/o/r/pulls/7/commits?per_page=100": [[{ sha: "sha1" }, { sha: "sha2" }]],
      "repos/o/r/commits/sha1/check-runs?per_page=100": [{ check_runs: [] }],
      "repos/o/r/commits/sha1/status?per_page=100": [{ statuses: [] }],
      [`${sha}/check-runs?per_page=100`]: [
        { check_runs: [{ name: "build", status: "completed", conclusion: "success", details_url: "u" }] },
      ],
      [`${sha}/status?per_page=100`]: [{ statuses: [] }],
    });
    const reader = new RestGitHubReader(api);
    await reader.pullRequest(context);
    await resolveChecks(reader, context);
    await reader.commitRollups(context);
    expect(api.calls.filter((path) => path === "repos/o/r/pulls/7")).toHaveLength(1);
  });
});

describe("REST commit rollups", () => {
  it("covers the last 50 commits so an old passing run still counts", async () => {
    const oids = Array.from({ length: 60 }, (_, index) => `c${index}`);
    const head = oids[59];
    const routes: Record<string, unknown> = {
      "repos/o/r/pulls/7": pull({ head: { ref: "feature", sha: head, repo: { full_name: "o/r" } } }),
      "repos/o/r/pulls/7/commits?per_page=100": [oids.map((sha) => ({ sha }))],
    };
    for (const oid of oids) {
      const root = `repos/o/r/commits/${oid}`;
      routes[`${root}/check-runs?per_page=100`] = [
        {
          check_runs: [
            {
              name: "build",
              status: "completed",
              conclusion: oid === "c10" ? "success" : "failure",
              details_url: "u",
            },
          ],
        },
      ];
      routes[`${root}/status?per_page=100`] = [{ statuses: [] }];
    }
    const rollups = await new RestGitHubReader(fakeApi(routes)).commitRollups(context);
    expect(rollups.map((rollup) => rollup.oid)).toEqual(oids.slice(10));
    expect(rollups.find((rollup) => rollup.oid === "c10")?.state).toBe("SUCCESS");
    expect(rollups.at(-1)?.oid).toBe(head);
  });
});

describe("REST commit rollup cost across ticks", () => {
  it("rereads only the head's checks on the next read", async () => {
    const oids = ["c0", "c1", "c2"];
    const routes: Record<string, unknown> = {
      "repos/o/r/pulls/7": pull({ head: { ref: "feature", sha: "c2", repo: { full_name: "o/r" } } }),
      "repos/o/r/pulls/7/commits?per_page=100": [oids.map((sha) => ({ sha }))],
    };
    for (const oid of oids) {
      routes[`repos/o/r/commits/${oid}/check-runs?per_page=100`] = [
        { check_runs: [{ name: "build", status: "completed", conclusion: "success", details_url: "u" }] },
      ];
      routes[`repos/o/r/commits/${oid}/status?per_page=100`] = [{ statuses: [] }];
    }
    const api = fakeApi(routes);
    const reader = new RestGitHubReader(api);
    const first = await reader.commitRollups(context);
    api.calls.length = 0;
    const second = await reader.commitRollups(context);
    expect(second).toEqual(first);
    expect(api.calls.filter((path) => path.includes("/commits/c0/"))).toEqual([]);
    expect(api.calls.filter((path) => path.includes("/commits/c2/"))).toHaveLength(2);
  });
});

const green = [
  { check_runs: [{ name: "build", status: "completed", conclusion: "success", details_url: "u" }] },
];
const red = [
  { check_runs: [{ name: "build", status: "completed", conclusion: "failure", details_url: "u" }] },
];
const noRuns = [{ check_runs: [] }];
const running = [
  { check_runs: [{ name: "build", status: "in_progress", conclusion: null as string | null, details_url: "u" }] },
];

function commitApi(
  oids: string[],
  runs: (oid: string) => unknown
): GhApi & { calls: string[] } {
  const calls: string[] = [];
  const api = async (path: string) => {
    calls.push(path);
    if (path === "repos/o/r/pulls/7")
      return pull({ head: { ref: "feature", sha: oids.at(-1), repo: { full_name: "o/r" } } });
    if (path === "repos/o/r/pulls/7/commits?per_page=100") return [oids.slice(0, 250).map((sha) => ({ sha }))];
    if (path === "repos/o/r/pulls/7/reviews?per_page=100") return [[]];
    const match = /commits\/([^/]+)\/(check-runs|status)\?/.exec(path);
    if (match === null) throw new Error(`unexpected path ${path}`);
    return match[2] === "status" ? [{ statuses: [] }] : runs(match[1]);
  };
  return Object.assign(api, { calls });
}
const readsOf = (calls: string[], oid: string) =>
  calls.filter((path) => path.includes(`/commits/${oid}/`)).length;

describe("REST rerun of an earlier commit", () => {
  it("reports SUCCESS once a failed earlier commit is rerun green", async () => {
    let state = red;
    const api = commitApi(["c0", "c1"], (oid) => (oid === "c0" ? state : green));
    const reader = new RestGitHubReader(api);
    expect((await reader.commitRollups(context))[0].state).toBe("FAILURE");
    state = green;
    let seen = "FAILURE";
    for (let tick = 0; tick < 5 && seen !== "SUCCESS"; tick += 1)
      seen = (await reader.commitRollups(context))[0].state ?? "null";
    expect(seen).toBe("SUCCESS");
  });
});

describe("REST earlier commits without checks", () => {
  it("turns an earlier commit green when its checks register after the first read", async () => {
    let registered = false;
    const api = commitApi(["c0", "c1"], (oid) => (oid === "c0" && !registered ? noRuns : green));
    const reader = new RestGitHubReader(api);
    expect((await reader.commitRollups(context))[0].state).toBeNull();
    registered = true;
    expect((await reader.commitRollups(context))[0].state).toBe("SUCCESS");
  });

  it("stops rereading a commit that stays without checks", async () => {
    const api = commitApi(["c0", "c1"], (oid) => (oid === "c0" ? noRuns : green));
    const reader = new RestGitHubReader(api);
    for (let tick = 0; tick < 4; tick += 1) await reader.commitRollups(context);
    expect(readsOf(api.calls, "c0")).toBe(4);
  });
});

describe("REST budget with failing earlier commits", () => {
  it("stops reading unsettled earlier commits once one is SUCCESS", async () => {
    const api = commitApi(["c0", "c1", "c2"], (oid) => (oid === "c0" ? green : red));
    const reader = new RestGitHubReader(api);
    await reader.commitRollups(context);
    api.calls.length = 0;
    const second = await reader.commitRollups(context);
    expect(readsOf(api.calls, "c1")).toBe(0);
    expect(second.map((rollup) => rollup.state)).toEqual(["SUCCESS", "FAILURE", "FAILURE"]);
  });

  it("rereads failed earlier commits only every fifth tick", async () => {
    const api = commitApi(["c0", "c1", "c2"], (oid) => (oid === "c2" ? green : red));
    const reader = new RestGitHubReader(api);
    for (let tick = 0; tick < 10; tick += 1) await reader.commitRollups(context);
    expect(readsOf(api.calls, "c0")).toBe(2 * 2);
    expect(readsOf(api.calls, "c2")).toBe(2 * 10);
  });

  it("rereads pending earlier commits only every fifth tick", async () => {
    const api = commitApi(["c0", "c1", "c2"], (oid) => (oid === "c2" ? green : running));
    const reader = new RestGitHubReader(api);
    for (let tick = 0; tick < 10; tick += 1) await reader.commitRollups(context);
    expect(readsOf(api.calls, "c0")).toBe(2 * 2);
  });

  it("reports SUCCESS within five ticks once a pending earlier commit turns green", async () => {
    let state = running;
    const api = commitApi(["c0", "c1"], (oid) => (oid === "c0" ? state : green));
    const reader = new RestGitHubReader(api);
    expect((await reader.commitRollups(context))[0].state).toBe("PENDING");
    state = green;
    let seen = "PENDING";
    for (let tick = 0; tick < 5 && seen !== "SUCCESS"; tick += 1)
      seen = (await reader.commitRollups(context))[0].state ?? "null";
    expect(seen).toBe("SUCCESS");
  });
});

describe("REST head past the commit list", () => {
  it("reads the head when pulls/N/commits stops before it", async () => {
    const oids = Array.from({ length: 250 }, (_, index) => `c${index}`);
    const api = commitApi(oids, () => green);
    const reader = new RestGitHubReader(
      Object.assign(
        async (path: string) =>
          path === "repos/o/r/pulls/7"
            ? pull({ head: { ref: "feature", sha: "late", repo: { full_name: "o/r" } } })
            : api(path),
        { calls: api.calls }
      )
    );
    const rollups = await reader.commitRollups(context);
    expect(rollups.at(-1)).toEqual({ oid: "late", state: "SUCCESS" });
  });
});

describe("REST head checks per tick", () => {
  it("reuses the checks read for the fast path when it rolls up the head", async () => {
    const api = commitApi(["c0", "c1"], () => green);
    const reader = new RestGitHubReader(api);
    await reader.pullRequest(context);
    await resolveChecks(reader, context);
    await reader.commitRollups(context);
    expect(readsOf(api.calls, "c1")).toBe(2);
  });

  it("does not reuse head checks from an earlier tick", async () => {
    const api = commitApi(["c0", "c1"], () => green);
    const reader = new RestGitHubReader(api);
    await resolveChecks(reader, context);
    await reader.pullRequest(context);
    await reader.commitRollups(context);
    expect(readsOf(api.calls, "c1")).toBe(4);
  });
});

describe("REST stack discovery", () => {
  it("marks a fork head as cross-repository", async () => {
    const api = fakeApi({
      "repos/o/r/pulls?state=open&per_page=100": [
        [
          { number: 1, head: { ref: "a", repo: { full_name: "O/R" } }, base: { ref: "main" } },
          { number: 2, head: { ref: "main", repo: { full_name: "fork/r" } }, base: { ref: "a" } },
          { number: 3, head: { ref: "gone", repo: null }, base: { ref: "a" } },
        ],
      ],
    });
    expect(await new RestGitHubReader(api).openPullRequests(context)).toEqual([
      { number: parsePrNumber(1), isCrossRepository: false, headRefName: "a", baseRefName: "main" },
      { number: parsePrNumber(2), isCrossRepository: true, headRefName: "main", baseRefName: "a" },
      { number: parsePrNumber(3), isCrossRepository: true, headRefName: "gone", baseRefName: "a" },
    ]);
  });
});

describe("reader choice on the GraphQL 403", () => {
  const blocked = {
    code: 1,
    output: `gh: ${GRAPHQL_BLOCKED_MESSAGE}; use the REST API (HTTP 403)`,
  };

  it("recognizes only the 403 with the cloud message", () => {
    expect(graphqlIsBlocked(blocked)).toBe(true);
    expect(graphqlIsBlocked({ code: 1, output: "gh: Bad credentials (HTTP 401)" })).toBe(false);
    expect(graphqlIsBlocked({ code: 1, output: "gh: Forbidden (HTTP 403)" })).toBe(false);
    expect(graphqlIsBlocked({ code: 0, output: "{}" })).toBe(false);
  });

  it("uses REST once on the 403 and never retries the probe", async () => {
    let probes = 0;
    const graphql = fakeReader();
    const rest = fakeReader({ facts: { headRefName: "from-rest" } });
    const selecting = new SelectingGitHubReader(graphql, rest, async () => {
      probes += 1;
      return blocked;
    });
    expect((await selecting.pullRequest(context)).headRefName).toBe("from-rest");
    await selecting.commitRollups(context);
    expect(probes).toBe(1);
    expect(rest.calls).toEqual(["pullRequest", "commitRollups"]);
    expect(graphql.calls).toEqual([]);
  });

  it("keeps GraphQL when the probe succeeds or fails for another reason", async () => {
    for (const probe of [
      async () => ({ code: 0, output: "{}" }),
      async () => ({ code: 1, output: "gh: network down" }),
      async () => {
        throw new Error("spawn gh ENOENT");
      },
    ]) {
      const graphql = fakeReader();
      const rest = fakeReader();
      await new SelectingGitHubReader(graphql, rest, probe).pullRequest(context);
      expect(graphql.calls).toEqual(["pullRequest"]);
      expect(rest.calls).toEqual([]);
    }
  });
});
