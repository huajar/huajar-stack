import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const MAP = "# huajar-stack in Claude Code";

type Event = { event: string; input: Record<string, unknown> };
type Entry = { matcher?: string; hooks: { command: string }[] };

// Runs every hook that hooks.json registers for each event, as Claude Code would, and joins their output.
function fire(events: Event[], transcript = "", root = ROOT) {
	const config: Record<string, Entry[]> = JSON.parse(readFileSync(join(root, "hooks/hooks.json"), "utf8")).hooks;
	const dir = mkdtempSync(join(tmpdir(), "print-map-"));
	try {
		const path = join(dir, "transcript.jsonl");
		if (transcript) writeFileSync(path, transcript);
		let out = "";
		for (const { event, input } of events) {
			const key = String(input.tool_name ?? input.source ?? input.command_name ?? "");
			for (const entry of config[event] ?? []) {
				if (entry.matcher && !new RegExp(`^(${entry.matcher})$`).test(key)) continue;
				for (const { command } of entry.hooks) {
					const stdin = JSON.stringify({ transcript_path: path, hook_event_name: event, ...input });
					const env = { ...process.env, CLAUDE_PLUGIN_ROOT: root };
					out += spawnSync("sh", ["-c", command], { input: stdin, encoding: "utf8", env }).stdout;
				}
			}
		}
		return out;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

// A typed line fires UserPromptSubmit with the text as typed. A slash command then fires
// UserPromptExpansion with the name Claude Code resolved it to, such as huajar-stack:tdd for /tdd.
function typed(text: string, resolved?: string, transcript = "") {
	const events: Event[] = [{ event: "UserPromptSubmit", input: { prompt: text } }];
	if (resolved) {
		const args = text.replace(/^\/\S*\s?/, "");
		const prompt = `/${resolved}${args ? ` ${args}` : ""}`;
		const input = { expansion_type: "slash_command", command_name: resolved, command_args: args, command_source: "plugin", prompt };
		events.push({ event: "UserPromptExpansion", input });
	}
	return fire(events, transcript);
}

// A Skill call reports the name it loaded in tool_response.commandName. A bare call stays bare.
const skillEvent = (input: string, loaded = input): Event => ({
	event: "PostToolUse",
	input: { tool_name: "Skill", tool_input: { skill: input }, tool_response: { success: true, commandName: loaded } },
});
const skill = (input: string, loaded = input) => fire([skillEvent(input, loaded)]);
const compact = (transcript: string) => fire([{ event: "SessionStart", input: { source: "compact" } }], transcript);

test.each([
	["/huajar-stack:huajar-help", "huajar-stack:huajar-help"],
	["/huajar-help", "huajar-stack:huajar-help"],
	["/huajar-help what next", "huajar-stack:huajar-help"],
	["/huajar-mode\nGoal: x", "huajar-stack:huajar-mode"],
	["/tdd", "huajar-stack:tdd"],
])("the typed command %p, resolved to %p, prints the map", (text, resolved) => {
	expect(typed(text, resolved)).toContain(MAP);
});

test.each([
	["/tdd", "mattpocock-skills:tdd"],
	["/deslop", "other-plugin:deslop"],
	["/other-plugin:huajar-help", "other-plugin:huajar-help"],
	["/commit", "commit"],
	["Explain what /huajar-help does", undefined],
	["hello", undefined],
])("the typed line %p, resolved to %p, prints nothing", (text, resolved) => {
	expect(typed(text, resolved)).toBe("");
});

test.each([
	["huajar-stack:setup-huajar-stack", "huajar-stack:setup-huajar-stack"],
	["setup-huajar-stack", "setup-huajar-stack"],
	["deslop", "deslop"],
])("the Skill call %p, loading %p, prints the map as JSON", (input, loaded) => {
	const [head, tail] = skill(input, loaded).trim().split("\n").map((line) => JSON.parse(line).hookSpecificOutput);
	expect(head.additionalContext).toContain(MAP);
	expect(tail.hookEventName).toBe("PostToolUse");
});

test.each([
	["tdd", "tdd"],
	["mattpocock-skills:tdd", "mattpocock-skills:tdd"],
	["other-plugin:setup-huajar-stack", "other-plugin:setup-huajar-stack"],
	["setup-huajar-stack-extra", "setup-huajar-stack-extra"],
	["commit", "commit"],
])("the Skill call %p, loading %p, prints nothing", (input, loaded) => {
	expect(skill(input, loaded)).toBe("");
});

const userLine = (content: string) => `${JSON.stringify({ type: "user", message: { content } })}\n`;
const skillLines = (name: string) =>
	`${JSON.stringify({ message: { content: [{ type: "tool_use", name: "Skill", input: { skill: name } }] } })}\n` +
	`${JSON.stringify({ toolUseResult: { success: true, commandName: name } })}\n`;

test.each([
	userLine("<command-name>/huajar-stack:huajar-help</command-name>"),
	userLine("<command-name>/huajar-stack:tdd</command-name>"),
	skillLines("setup-huajar-stack"),
	skillLines("huajar-stack:deslop"),
])("after a compaction, the transcript %p prints the map", (transcript) => {
	expect(compact(transcript)).toContain(MAP);
});

test.each([
	userLine("<command-name>/mattpocock-skills:tdd</command-name>"),
	userLine("<command-name>/commit</command-name>"),
	userLine("Explain what /huajar-help does"),
	skillLines("tdd"),
	skillLines("other-plugin:deslop"),
])("after a compaction, the transcript %p prints nothing", (transcript) => {
	expect(compact(transcript)).toBe("");
});

test("a command prints nothing when the map is already in context", () => {
	const transcript = `{"attachment":{"hookName":"UserPromptExpansion","content":"${MAP}"}}\n`;
	expect(typed("/huajar-help", "huajar-stack:huajar-help", transcript)).toBe("");
});

// A plugin copy whose skills/ holds folders named with ERE metacharacters.
function pluginWith(names: string[]) {
	const root = mkdtempSync(join(tmpdir(), "print-map-root-"));
	cpSync(join(ROOT, "hooks"), join(root, "hooks"), { recursive: true });
	mkdirSync(join(root, "docs/harness"), { recursive: true });
	cpSync(join(ROOT, "docs/harness/claude-code.md"), join(root, "docs/harness/claude-code.md"));
	for (const name of names) {
		mkdirSync(join(root, "skills", name), { recursive: true });
		writeFileSync(join(root, "skills", name, "SKILL.md"), `---\nname: ${name}\n---\n`);
	}
	return root;
}

test.each([
	["c(x", "c(x", true],
	["c.x", "cyx", false],
	["c+", "cc", false],
])("with a skill folder %p, the bare Skill call %p prints the map: %p", (folder, name, prints) => {
	const root = pluginWith(["huajar-help", folder]);
	try {
		const out = fire([skillEvent(name)], "", root);
		if (prints) expect(out).toContain(MAP);
		else expect(out).toBe("");
		expect(fire([skillEvent("huajar-stack:huajar-help")], "", root)).toContain(MAP);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
