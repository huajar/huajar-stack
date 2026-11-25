// Writes the Reference's text over huajar-stack files, with huajar names.
// Usage: node .github/scripts/sync-reference.mjs --reference <cursor/plugins clone> <repo path>...
// Each path takes the file from the Claude Code tree pstack generates, harness/pstack/claude-code/.
// check-reference.mjs maps the names back, so a synced file passes it with nothing listed.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const REPO = join(import.meta.dirname, "../..");
const PIN = "9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc";
const { values, positionals } = parseArgs({ options: { reference: { type: "string" } }, allowPositionals: true });
if (!values.reference || !positionals.length) throw new Error("usage: sync-reference.mjs --reference <clone> <repo path>...");

const skills = new Set(readdirSync(join(REPO, "skills")).map((s) => s.replace(/^huajar-/, "poteto-").replace("setup-huajar-stack", "setup-pstack")));
const huajar = (text) =>
  text
    .replace(/(?<=[`\s(])\/([a-z][a-z-]*)(?![\w/-]|\.\w)/g, (m, name) => (skills.has(name) ? `/pstack:${name}` : m))
    .replace(/poteto-agent/g, "huajar-agent")
    .replace(/poteto-mode/g, "huajar-mode")
    .replace(/poteto-help/g, "huajar-help")
    .replace(/(?<!\w)pstack/g, "huajar-stack")
    .replace(/@cursor-skill\//g, "@huajar-stack/");

for (const file of positionals) {
  const source = `harness/pstack/claude-code/${file.replace(/huajar-(mode|help|agent)/g, "poteto-$1").replace("setup-huajar-stack", "setup-pstack")}`;
  const text = execFileSync("git", ["-C", values.reference, "cat-file", "blob", `${PIN}:${source}`], { encoding: "utf8" }).replace(/\r\n/g, "\n");
  mkdirSync(dirname(join(REPO, file)), { recursive: true });
  writeFileSync(join(REPO, file), huajar(text));
}
