---
name: setup-huajar-stack
description: Configure which models huajar-stack uses per role, at what reasoning budget, and the Local ceiling. Detects your available models and writes an always-applied rule that overrides the skill defaults. Use for /huajar-stack:setup-huajar-stack, "configure huajar-stack models", "huajar-stack budget", or changing huajar-stack's model choices.
---

# Setup huajar-stack

In Claude Code, read [the Claude Code adapter](../../docs/harness/claude-code.md) once per session before you follow this skill. It maps the Cursor names in pstack skills to Claude Code.

Write `~/.claude/rules/huajar-stack-models.md`, an always-applied rule that sets huajar-stack's model per role and the Local ceiling.

## Steps

### 1. Detect available models

Enumerate the model slugs you can run as an `Agent` subagent in this session. `Agent` takes a model alias and an effort level as two parameters. A slug joins the model ID that your system prompt gives for an alias with an effort level that `Agent` accepts, so `opus` and `xhigh` make `claude-opus-5-5-xhigh`. That is the dependable source. If you cannot detect any, ask the user to paste the slugs they have access to. Never write a real slug you have not confirmed is available. The aliases `inherit-parent` and `auto` are always valid even though they are not detected slugs.

### 2. Load current state

The default role-to-model mapping is the rule shape shown in step 6 below. If `~/.claude/rules/huajar-stack-models.md` already exists, read it and treat its `# budget` and `# local ceiling` lines and its role values as the current choices. Otherwise start from those defaults. A line whose role is not in step 6, such as `hardest tasks`, `architect runners`, `reflect tooling`, or `why investigators`, is from a retired role. Drop it. A `# quota cap` line is from a retired setting. Drop it too.

A rule without the `# defaults: 3` line comes from an older setup. That setup wrote a line for every role, so some of its values are old defaults, not choices. Before step 3, replace these values:

- A `claude-sonnet-*` value in `feature, refactoring`, `bug-fix`, `perf-issue`, or `hillclimb` takes the role's step 6 default.
- An `arena runners` list of exactly one `claude-opus-*` entry and one `claude-haiku-*` entry, or an `interrogate reviewers` list of exactly one `claude-opus-*` entry and one `claude-sonnet-*` entry, in either order, takes the role's step 6 list.
- A `# budget: unlimited` line becomes `large`, because no role runs above `xhigh`.

Every other value is the user's choice and stays, including every `inherit-parent` or `auto` value. Tell the user which values you replaced.

### 3. Budget, map, and confirm

**(a) Ask for a budget.** Prefer AskUserQuestion over free text. Offer these three options with these exact labels, and name the current budget when the rule records one. With no rule, say that `medium` matches the skill defaults.

- `large — xhigh reasoning`
- `medium — medium reasoning`
- `small — low reasoning`

**(b) Apply it.** Build the working table from the skill defaults, and on a re-run keep any role you changed by family, list, or alias (`inherit-parent`, `auto`). Families are the ones Phase A of the **arena** skill defines, so Fable is its own family. `large`, `medium`, and `small` set the effort token of every real slug, panel entries included, to `xhigh`, `medium`, or `low`. No role runs above `xhigh`. The effort token is the last token, in the order `xhigh` > `high` > `medium` > `low`. If the result is not a detected slug, use the same family's detected slug with the highest effort at or below the target, else mark the role as needing a choice. `inherit-parent` and `auto` do not change. So `large` turns `claude-opus-5-5-medium` into `claude-opus-5-5-xhigh`, `medium` keeps the defaults, and `small` turns them into `claude-opus-5-5-low`, `claude-fable-5-2-low`, and `claude-sonnet-5-5-low`.

**(c) Show the roles and confirm.** Show every role with its model, marking any real slug not in the detected set as needing a choice. Also list each line step 2 dropped. Ask whether to accept as-is or change specific roles, offering the detected models at `xhigh` or below plus `inherit-parent` and `auto` as the options. Both mean the role runs on the parent chat model. Prefer AskUserQuestion over free text. For panel roles (arena runners, interrogate reviewers) the value is a list, and one subagent runs per entry, alias entries included, so the list length sets the count. `arena cross-judge pool` is also a list. Its default is one Opus entry, which runs the cross-judge. `swarm workers` is the default model for every worker unless a race or comparison assigns another model per arm.

### 4. Set the Local ceiling

The Local ceiling is the most full Claude Code sessions that the machine runs at once. A skill that starts local workers never starts more than this.

If the rule already has a `# local ceiling` line, keep its number and skip the suggestion, unless the user asks to change it. Otherwise read the machine with Node, which runs the same on Windows, macOS, and Linux:

```
node -e "const os=require('os'),c=os.cpus().length,g=os.totalmem()/2**30;console.log(c+' CPUs, '+g.toFixed(2)+' GiB, suggest '+Math.max(1,Math.min(Math.floor(c/2),Math.floor(g/4))))"
```

It prints the logical CPUs, the total memory, and the suggestion: the smaller of half the CPUs and a quarter of the GiB, rounded down, and at least 1. The margin covers builds, tests, and services such as Docker, not only the ~0.5 GB of each session. A machine with 12 CPUs and 31.65 GiB suggests `min(6, 7) = 6`.

If you did not keep the number, ask in one AskUserQuestion call whether to accept the suggestion or lower it, and show the three numbers. Keep the number for step 6.

### 5. Validate

Every real slug written must be in the detected set and at `xhigh` or below. `inherit-parent` and `auto` always pass. If a chosen real slug is not available, stop and ask again.

### 6. Write the rule

Write `~/.claude/rules/huajar-stack-models.md` with no frontmatter, a `# budget` line with the chosen label and its target effort, a `# local ceiling` line with the number from step 4 under it, and one line per role, using the same labels huajar-mode uses. Claude Code loads a rule without `paths` frontmatter in every session. Overwrite the whole file so re-runs stay idempotent. Shape:

```
# huajar-stack model configuration. One line per role. Delete a line to fall back to the skill default.
# `inherit-parent` or `auto` as a value: the role runs on the parent chat model (omit Agent `model` and `effort`). Alias entries in a panel list still count toward its fan-out.
# A slug is `claude-<family>-<version>-<effort>`. Pass `<family>` as Agent `model` and `<effort>` as Agent `effort`; the version is not used.
# defaults: 3
# budget: medium (medium)
# local ceiling: 6
feature, refactoring: claude-opus-5-5-medium
bug-fix: claude-opus-5-5-medium
perf-issue: claude-opus-5-5-medium
hillclimb: claude-opus-5-5-medium
judgment and prose: claude-opus-5-5-medium
arena runners: claude-fable-5-2-medium, claude-opus-5-5-medium, claude-sonnet-5-5-medium
arena cross-judge pool: claude-opus-5-5-medium
swarm workers: claude-opus-5-5-medium
interrogate reviewers: claude-fable-5-2-medium, claude-opus-5-5-medium, claude-sonnet-5-5-medium
```

### 7. Confirm

Tell the user the rule was written and that it applies to new sessions. Re-running this skill updates it.

### 8. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /huajar-stack:create-verification-skill." On yes, invoke `/huajar-stack:create-verification-skill` (resolves wherever huajar-stack is installed: workspace, user, or plugin). On no, move on without pushing.

### 9. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill (a project skill that runs a model checker, a proof, or another verifier against the code). If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with /huajar-stack:create-formal-verification-skill." On yes, invoke `/huajar-stack:create-formal-verification-skill` (resolves wherever huajar-stack is installed: workspace, user, or plugin). On no, move on without pushing.
