#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const USAGE = `Usage:
  node brief.mjs write <brief> [--repo <owner/name>] < template`;

const run = (cmd, args) =>
	execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

const fail = (message) => {
	console.error(message);
	process.exit(1);
};

const absolute = (file) => (path.isAbsolute(file) ? file : fail(`brief path is not absolute: ${file}`));

const number =(n) => (/^\d+$/.test(n) ? n : fail(`not a number: ${n}`));

const fields = (repo) => {
	const forge = repo ? ["-R", repo] : [];
	return {
		sha: (ref) => run("git", ["rev-parse", "--verify", `${ref}^{commit}`]),
		topology: () =>
			`branch ${run("git", ["branch", "--show-current"])}\n${run("git", ["worktree", "list"])}`,
		issue: (n) => run("gh", ["issue", "view", number(n), ...forge, "--json", "title,body,comments"]),
		pr: (n) =>
			run("gh", ["pr", "view", number(n), ...forge, "--json", "title,body,comments,headRefOid"]),
	};
};

const expand = (template, repo) => {
	const known = fields(repo);
	return template.replace(/\{\{(\w+)(?::([^}]*))?\}\}/g, (match, name, arg) =>
		known[name] ? known[name](arg) : fail(`unknown placeholder: ${match}`),
	);
};

const [command, ...rest] = process.argv.slice(2);
const repoAt = rest.indexOf("--repo");
const repo = repoAt >= 0 ? rest[repoAt + 1] : undefined;
const positional = rest.filter((arg, i) => !arg.startsWith("--") && (repoAt < 0 || i !== repoAt + 1));

try {
	if (command === "write" && positional.length === 1) {
		const out = absolute(positional[0]);
		fs.rmSync(out, { force: true });
		const text = expand(fs.readFileSync(0, "utf8"), repo);
		if (!text.trim()) fail("empty brief");
		fs.mkdirSync(path.dirname(out), { recursive: true });
		fs.writeFileSync(out, text);
		console.log(out);
	} else {
		fail(USAGE);
	}
} catch (error) {
	fail(error.message);
}
