// Fails when shipped text names a Cursor path that no row of the Claude Code map translates.
// Usage: node .github/scripts/check-cursor-paths.mjs [repo root]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? ".";
const MAP = "docs/harness/claude-code.md";
const HIT = /(?:~\/)?(?:Library\/)?(?:\.cursor\/[^\s`'")\]|,]*|Application Support\/Cursor)/g;
const normalize = (p) => p.replace(/^~\//, "").replace(/^Library\//, "");

const prefixes = readFileSync(join(root, MAP), "utf8")
	.split("\n")
	.filter((line) => line.startsWith("| "))
	.flatMap((line) => line.split(" | ")[0].match(/`[^`]+`/g) ?? [])
	.map((token) => token.slice(1, -1))
	.filter((token) => /\.cursor\/|Application Support\/Cursor/.test(token))
	.map((token) => normalize(token).split(/[*<]/)[0]);

const files = execFileSync("git", ["-C", root, "ls-files", "skills", "agents", "hooks", "docs/guide"], { encoding: "utf8" })
	.split("\n")
	.filter((f) => f.endsWith(".md"));

let failed = 0;
for (const file of files) {
	readFileSync(join(root, file), "utf8").split("\n").forEach((text, i) => {
		for (const [hit] of text.matchAll(HIT)) {
			if (prefixes.some((p) => normalize(hit).startsWith(p))) continue;
			failed++;
			console.log(`::error file=${file},line=${i + 1}::${hit} is a Cursor path that no row of ${MAP} maps. Add a row to its Paths table, or write the Claude Code path.`);
		}
	});
}
console.log(failed ? `${failed} unmapped Cursor path(s).` : `Every Cursor path in ${files.length} files has a map row.`);
process.exit(failed ? 1 : 0);
