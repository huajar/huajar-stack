// Guards each file moved from pstack against the Reference, in both directions, and each copy in map-copies.json against the text it copies.
// Usage: node .github/scripts/check-reference.mjs --reference <cursor/plugins clone> [--checks reference,toc,map]
// The clone holds the commit of adaptations.json's "reference".
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { diff, parseArgs } from "node:util";

const REPO = join(import.meta.dirname, "../..");
const HARNESS = "harness/pstack/claude-code";
// huajar names back to pstack's. Order matters: the longer names go first.
const RENAMES = [
  [/\/huajar-stack:/g, "/"],
  [/huajar-stack:huajar-agent/g, "poteto-agent"],
  [/huajar-agent/g, "poteto-agent"],
  [/huajar-mode/g, "poteto-mode"],
  [/huajar-help/g, "poteto-help"],
  [/setup-huajar-stack/g, "setup-pstack"],
  [/@huajar-stack\//g, "@cursor-skill/"],
  [/huajar-stack/g, "pstack"],
];

const { values } = parseArgs({ options: { reference: { type: "string" }, checks: { type: "string", default: "reference,toc" } } });
const checks = values.checks.split(",");
const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const failures = [];

const normalize = (s) => RENAMES.reduce((t, [from, to]) => t.replace(from, to), s);
const sentences = (text) =>
  text.split("\n").flatMap((line) => {
    line = line.trim();
    return line ? line.split(/(?<=[.!?])\s+(?=[A-Z`*(\[])/).map((s) => s.trim()) : [];
  });

if (checks.includes("reference")) {
  if (!values.reference) throw new Error("--reference <cursor/plugins clone> is required for the reference check");
  const { reference: pin, groups, files: adaptations } = JSON.parse(read(join(REPO, ".github/reference/adaptations.json")));
  const git = (...args) => execFileSync("git", ["-C", values.reference, ...args], { encoding: "utf8" });
  const commit = pin.match(/\/tree\/([0-9a-f]{40})\//)[1];
  const tree = new Set(git("ls-tree", "-r", "--name-only", commit, HARNESS).split("\n"));
  const show = (path) => (tree.has(path) ? git("cat-file", "blob", `${commit}:${path}`).replace(/\r\n/g, "\n") : null);
  const pstackPath = (file) => file.replace(/huajar-(mode|help|agent)/g, "poteto-$1").replace("setup-huajar-stack", "setup-pstack");
  const huajarPath = (file) => file.replace(/poteto-(mode|help|agent)/g, "huajar-$1").replace("setup-pstack", "setup-huajar-stack");
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).filter((e) => e.name !== "node_modules").flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

  const used = new Set();
  const useGroup = (where, group) => {
    used.add(group);
    if (!Object.hasOwn(groups, group)) failures.push(`${where}: group ${JSON.stringify(group)} is not in "groups" of adaptations.json`);
  };
  for (const [group, reason] of Object.entries(groups)) {
    if (typeof reason !== "string" || !reason.trim()) failures.push(`group ${group}: reason is empty or missing in "groups" of adaptations.json`);
  }
  for (const [file, entry] of Object.entries(adaptations)) {
    if (!existsSync(join(REPO, file))) failures.push(`${file}: listed in adaptations.json, but the file does not exist`);
    if (entry.whole !== undefined) useGroup(`${file}: whole`, entry.whole);
    for (const list of ["sentences", "dropped"]) {
      for (const { sentence, group } of entry[list] ?? []) useGroup(`${file}: ${list} entry ${JSON.stringify(sentence)}`, group);
    }
  }
  for (const group of Object.keys(groups)) {
    if (!used.has(group)) failures.push(`group ${group}: no entry in adaptations.json uses it`);
  }

  const leftOutTable = read(join(REPO, "docs/harness/claude-code.md")).split("\n## Left out of huajar-stack\n")[1]?.split("\n## ")[0] ?? "";
  const leftOut = new Set([...leftOutTable.matchAll(/^\| [^|]*\|/gm)].flatMap(([cell]) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1])));
  const local = ["skills", "agents", "docs/guide"].flatMap((dir) => walk(join(REPO, dir))).map((f) => relative(REPO, f).split(sep).join("/"));
  const localSet = new Set(local);
  const referenceFiles = [...tree].filter((p) => /^(skills|agents|docs\/guide)\//.test(p.slice(HARNESS.length + 1))).map((p) => p.slice(HARNESS.length + 1));
  const referenceDirs = new Set(referenceFiles.flatMap((f) => f.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))));
  for (const skill of leftOut) {
    if (referenceDirs.has(`skills/${skill}`) && existsSync(join(REPO, "skills", skill))) failures.push(`skills/${skill}: the map leaves out this skill, but the folder exists`);
  }
  for (const file of referenceFiles) {
    const skill = file.match(/^skills\/([^/]+)\//)?.[1];
    if (!localSet.has(huajarPath(file)) && !leftOut.has(skill)) {
      failures.push(`${huajarPath(file)}: in the Reference, but the file does not exist${skill ? " and the map does not leave out its skill" : ""}`);
    }
  }
  const moved = [];
  for (const file of local) {
    if (tree.has(`${HARNESS}/${pstackPath(file)}`)) moved.push(file);
    else if (referenceDirs.has(pstackPath(file).match(/^(skills\/[^/]+|agents|docs\/guide)\//)?.[1]) && adaptations[file]?.whole === undefined) {
      failures.push(`${file}: not in the Reference, under a skill or folder pstack has, and no "whole" entry in adaptations.json`);
    }
  }

  for (const file of moved) {
    const allowed = adaptations[file] ?? {};
    if (allowed.whole !== undefined) continue;
    const ours = sentences(read(join(REPO, file)));
    const theirs = sentences(show(`${HARNESS}/${pstackPath(file)}`));
    const unused = { 1: [...(allowed.sentences ?? [])], [-1]: [...(allowed.dropped ?? [])] };
    const hunkGroups = new Set();
    const missing = [];
    let i = 0;
    let j = 0;
    const flush = () => {
      const group = hunkGroups.size === 1 ? [...hunkGroups][0] : "?";
      for (const s of missing) failures.push(`${file}: Reference sentence not in the file or "dropped" of adaptations.json. The entry, with its hunk's group or "?":\n  ${JSON.stringify({ sentence: s, group })}`);
      hunkGroups.clear();
      missing.length = 0;
    };
    for (const [op] of diff(ours.map(normalize), theirs.map(normalize))) {
      if (op === 0) {
        flush();
        i++;
        j++;
        continue;
      }
      const s = op === 1 ? ours[i++] : theirs[j++];
      const k = unused[op].findIndex((a) => a.sentence === s);
      if (k >= 0) {
        if (op === 1) hunkGroups.add(unused[op][k].group);
        unused[op].splice(k, 1);
      } else if (op === 1) failures.push(`${file}: sentence not in the Reference at this place, or in "sentences" of adaptations.json\n  ${s}`);
      else missing.push(s);
    }
    flush();
    for (const [op, list] of [[1, "sentences"], [-1, "dropped"]]) {
      for (const { sentence } of unused[op]) failures.push(`${file}: "${list}" entry that the diff with the Reference does not use\n  ${sentence}`);
    }
  }
}

if (checks.includes("toc")) {
  const slug = (h) => h.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s/g, "-");
  for (const skill of readdirSync(join(REPO, "skills"))) {
    const dir = join(REPO, "skills", skill, "references");
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const file = `skills/${skill}/references/${f}`;
      const lines = read(join(dir, f)).trimEnd().split("\n");
      if (lines.length <= 100) continue;
      let fenced = false;
      const anchors = [];
      for (const l of lines) {
        if (l.startsWith("```")) fenced = !fenced;
        else if (!fenced && l.startsWith("## ") && l !== "## Contents") anchors.push(slug(l.slice(3)));
      }
      const start = lines.slice(0, 15).indexOf("## Contents");
      const links = [];
      for (let i = start + 1; start >= 0 && i < lines.length; i++) {
        const link = lines[i].match(/^- \[.+\]\(#(.+)\)$/);
        if (link) links.push(link[1]);
        else if (lines[i] !== "" || links.length) break;
      }
      if (start < 0 || links.join() !== anchors.join()) {
        failures.push(`${file}: ${lines.length} lines and no table of contents in its first 15 lines (a "## Contents" list linking each ## heading in order)`);
      }
    }
  }
}

if (checks.includes("map")) {
  const rows = JSON.parse(read(join(REPO, ".github/reference/map-copies.json")));
  rows.forEach(({ in: copyFile = "docs/harness/claude-code.md", map: mapText, file, text, why }, i) => {
    if (!read(join(REPO, copyFile)).includes(mapText)) failures.push(`map-copies.json row ${i + 1}: ${copyFile} no longer has\n  ${mapText}\n  It copies ${file}: ${why}. Re-read ${file}, then update the row and ${copyFile} together.`);
    if (!existsSync(join(REPO, file))) failures.push(`map-copies.json row ${i + 1}: ${file} is missing\n  The copy it feeds in ${copyFile} is\n  ${mapText}\n  Find where ${file} moved, then update the row and ${copyFile} together.`);
    else if (!read(join(REPO, file)).includes(text)) failures.push(`map-copies.json row ${i + 1}: ${file} no longer has\n  ${text}\n  The copy it feeds in ${copyFile} is\n  ${mapText}\n  Re-read that copy, then update the row and the source together.`);
  });
  const ruleShape = read(join(REPO, "skills/setup-huajar-stack/SKILL.md")).split("### 6. Write the rule")[1].split("```")[1];
  for (const line of ruleShape.split("\n").filter((l) => /^[^#\s][^:]*: /.test(l))) {
    if (!rows.some((r) => !r.in && r.text === line)) failures.push(`skills/setup-huajar-stack/SKILL.md step 6: no map-copies.json row for the map ties to\n  ${line}\n  Name this role's default model in the Models table of docs/harness/claude-code.md, and add a row that ties it to this line.`);
  }
}

for (const f of failures) console.log(f);
console.log(`check-reference (${checks.join(",")}): ${failures.length ? `${failures.length} failure(s)` : "pass"}`);
process.exit(failures.length ? 1 : 0);
