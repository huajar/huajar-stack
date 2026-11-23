import { expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SCRIPT = join(import.meta.dir, "check-cursor-paths.mjs");
const MAP = "| `~/.cursor/skills/` | `~/.claude/skills/` |\n";

function check(files: Record<string, string>) {
	const root = mkdtempSync(join(tmpdir(), "check-cursor-paths-"));
	try {
		for (const [path, text] of Object.entries({ "docs/harness/claude-code.md": MAP, ...files })) {
			mkdirSync(dirname(join(root, path)), { recursive: true });
			writeFileSync(join(root, path), text);
		}
		execFileSync("git", ["init", "-q", root]);
		execFileSync("git", ["-C", root, "add", "-A"]);
		return spawnSync("node", [SCRIPT, root], { encoding: "utf8" });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test("an uppercase .MD file with a mapped Cursor path passes", () => {
	const run = check({ "skills/demo/NOTES.MD": "See ~/.cursor/skills/demo for more.\n" });
	expect(run.stdout).toContain("No unmapped Cursor path");
	expect(run.status).toBe(0);
});

test("a script file with a mapped Cursor path still fails", () => {
	const run = check({ "skills/demo/run.sh": "cat ~/.cursor/skills/demo\n" });
	expect(run.stdout).toContain("runs without");
	expect(run.status).toBe(1);
});

test("a tracked file with a non-ASCII name is read", () => {
	const run = check({ "skills/demo/ñandú.md": "hola\n" });
	expect(run.stdout).toContain("No unmapped Cursor path");
	expect(run.status).toBe(0);
});
