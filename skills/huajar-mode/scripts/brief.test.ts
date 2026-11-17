import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, expect, test } from "bun:test";

const script = join(import.meta.dir, "brief.mjs");
let dir: string;
let head: string;

const brief = (args: string[], input = "") =>
	spawnSync("node", [script, ...args], { cwd: dir, input, encoding: "utf8" });

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), "brief-test-"));
	const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
	git("init", "-q", "-b", "main");
	git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "x");
	head = git("rev-parse", "HEAD").stdout.trim();
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("write fills the full SHA and the branch from git", () => {
	const out = join(dir, "nested", "a.brief.md");
	const result = brief(["write", out], "head {{sha:HEAD}}\n{{topology}}\n");
	expect(result.status).toBe(0);
	const text = readFileSync(out, "utf8");
	expect(text).toContain(`head ${head}`);
	expect(text).toContain("branch main");
});

test("write by absolute path resolves the project's SHA, not the script's repo", () => {
	const scriptHead = spawnSync("git", ["rev-parse", "HEAD"], { cwd: import.meta.dir, encoding: "utf8" }).stdout.trim();
	const out = join(dir, "project.brief.md");
	expect(brief(["write", out], "{{sha:HEAD}}").status).toBe(0);
	const text = readFileSync(out, "utf8");
	expect(text).toBe(head);
	expect(text).not.toBe(scriptHead);
});

test("write fails and leaves no file when the cwd is not a git repo", () => {
	const bare = mkdtempSync(join(tmpdir(), "brief-bare-"));
	const out = join(bare, "a.brief.md");
	const result = spawnSync("node", [script, "write", out], {
		cwd: bare,
		input: "{{sha:HEAD}}",
		encoding: "utf8",
		env: { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() },
	});
	const written = existsSync(out);
	rmSync(bare, { recursive: true, force: true });
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("not a git repository");
	expect(written).toBe(false);
});

test("write fails and leaves no file on an empty template", () => {
	const out = join(dir, "empty.brief.md");
	writeFileSync(out, "stale");
	expect(brief(["write", out], "  \n").status).toBe(1);
	expect(existsSync(out)).toBe(false);
});

test("write fails and leaves no file on an unknown placeholder or ref", () => {
	const out = join(dir, "bad.brief.md");
	expect(brief(["write", out], "{{nope}}").status).toBe(1);
	expect(brief(["write", out], "{{sha:no-such-ref}}").status).toBe(1);
	expect(existsSync(out)).toBe(false);
});

test("write fails on a path that is not absolute", () => {
	const mangled = "UsersuserAppDataLocalTemphuajar-stackbrief.md";
	const written = brief(["write", mangled], "x");
	expect(written.status).toBe(1);
	expect(written.stderr).toContain("not absolute");
	expect(existsSync(join(dir, mangled))).toBe(false);
});
