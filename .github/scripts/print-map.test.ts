import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "../../hooks/print-map.sh");
const MAP = "# huajar-stack in Claude Code";

function run(event: string, input: Record<string, unknown>, transcript = "") {
	const dir = mkdtempSync(join(tmpdir(), "print-map-"));
	try {
		const path = join(dir, "transcript.jsonl");
		if (transcript) writeFileSync(path, transcript);
		const args = event === "UserPromptSubmit" ? [SCRIPT, "head"] : [SCRIPT, "head", event];
		const stdin = JSON.stringify({ transcript_path: path, hook_event_name: event, ...input });
		return spawnSync("sh", args, { input: stdin, encoding: "utf8" }).stdout;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

const prompt = (text: string) => run("UserPromptSubmit", { prompt: text });
const skill = (name: string) => run("PostToolUse", { tool_name: "Skill", tool_input: { skill: name } });
const compact = (transcript: string) => run("SessionStart", { source: "compact" }, transcript);

test.each(["/huajar-stack:huajar-help", "/huajar-help", "/huajar-help what next", "/huajar-mode\nGoal: x"])(
	"the prompt %p prints the map",
	(text) => expect(prompt(text)).toContain(MAP),
);

test.each(["/other-plugin:huajar-help", "/huajar-helpful", "/commit", "Explain what /huajar-help does", "hello"])(
	"the prompt %p prints nothing",
	(text) => expect(prompt(text)).toBe(""),
);

test.each(["huajar-stack:setup-huajar-stack", "setup-huajar-stack"])("the Skill call %p prints the map", (name) => {
	const out = skill(name);
	expect(JSON.parse(out).hookSpecificOutput.additionalContext).toContain(MAP);
});

test.each(["other-plugin:setup-huajar-stack", "setup-huajar-stack-extra", "commit"])(
	"the Skill call %p prints nothing",
	(name) => expect(skill(name)).toBe(""),
);

test.each([
	'{"message":{"content":"<command-name>/huajar-help</command-name>"}}\n',
	'{"message":{"content":"<command-name>/huajar-stack:huajar-mode</command-name>"}}\n',
	'{"message":{"content":[{"name":"Skill","input":{"skill":"setup-huajar-stack"}}]}}\n',
])("after a compaction, the transcript %p prints the map", (transcript) => {
	expect(compact(transcript)).toContain(MAP);
});

test.each([
	'{"message":{"content":"<command-name>/other-plugin:huajar-help</command-name>"}}\n',
	'{"message":{"content":"<command-name>/commit</command-name>"}}\n',
	'{"message":{"content":"Explain what /huajar-help does"}}\n',
])("after a compaction, the transcript %p prints nothing", (transcript) => {
	expect(compact(transcript)).toBe("");
});

test("a prompt prints nothing when the map is already in context", () => {
	const transcript = `{"hookName":"UserPromptSubmit","content":"${MAP}"}\n`;
	expect(run("UserPromptSubmit", { prompt: "/huajar-help" }, transcript)).toBe("");
});
