# huajar-stack

These are the words that agents and docs in this repo use. Use each word as defined here, and avoid the words listed under _Avoid_.

## Language

### This repo

**huajar-stack**:
A Claude Code plugin. Its mode matches each task to a playbook, and the playbook runs the task to a check that passes or fails. It builds on pstack and needs no pstack install.
_Avoid_: fork, layer (for the stack as a whole), my pstack

**huajar-mode**:
huajar-stack's mode, the skill a task starts from. pstack's counterpart is poteto-mode.
_Avoid_: personal mode, my mode

**Reference**:
pstack, plus the cursor-team-kit skills it calls (`deslop`, `control-cli`, and `control-ui`) and `verify-this`, which `control-ui` names, at the one pinned commit of `cursor/plugins` that huajar-stack follows, `9e278fe` (pstack 0.15.46). It is never installed. A maintainer moves the pin by hand.
_Avoid_: base, upstream, parent

**Adaptation**:
A difference from the Reference that the environment forces, because pstack targets Cursor on macOS. huajar-stack runs in Claude Code in place of Cursor, with the Herdr app and `hc` for agy and codex seats, and on Windows with Git Bash. `.github/reference/adaptations.json` lists each Adaptation in a file taken from pstack.
_Avoid_: customization, tweak

**Map**:
The tables in `docs/harness/claude-code.md` that map each Cursor name in a skill from pstack to Claude Code and the Herdr app. It extends pstack's Claude Code adapter. Its last table lists the pstack pieces huajar-stack leaves out.
_Avoid_: translation layer. pstack calls it the Claude Code adapter, and the line in each skill keeps that name.

**Seat**:
A role entry written `<agent>:<model>-<effort>`, run as that agent CLI, agy or codex, in its own `hc` terminal. Every other role runs as an `Agent` subagent.
_Avoid_: external worker

### Concepts

**pstack**:
Lauren Tan's (poteto) plugin of skills, playbooks, principles, and subagents, routed by poteto-mode and published in `cursor/plugins`.
_Avoid_: poteto stack

**Budget**:
The effort every role starts at, picked when you run `setup-huajar-stack`: `large`, `medium`, or `small`.
_Avoid_: plan

**Layer**:
One of the parts the stack is organized into: mode, playbooks, skills, principles, subagents, model roles, verification skill, make it yours, and automations.
_Avoid_: level, module, tier

**Mode**:
The routing skill a task starts from. It matches a goal, plus a way to check it, to a playbook, and calls other skills as the steps need them.
_Avoid_: router, orchestrator

**Model family**:
The kind of Claude model a role runs on: Opus, Sonnet, Haiku, or Fable, as in `claude-opus-5-5-xhigh`. Two roles on different families give a second opinion.
_Avoid_: vendor, provider

**Playbook**:
A step list for one kind of task, which a mode copies into its todo list.
_Avoid_: workflow, recipe

**Principle**:
A skill named `principle-<title>` that holds one engineering rule, so an agent can be steered by naming it.
_Avoid_: guideline, rule file

**Proven finding**:
A defect reported with the evidence that proves it, such as a red test or a command with its output.
_Avoid_: observation

**Review bot**:
An automated reviewer that comments on every pull request on its own, on every push, one inline thread per finding. Bugbot is pstack's. Babysit triages what it leaves.
_Avoid_: PR bot, auto-reviewer

**Role**:
A job that a skill gives to a subagent, such as `swarm workers` or `arena runners`. It has a default model, which the model-roles rule can override.
_Avoid_: slot, agent type

**Store**:
The folder where a huajar-mode session keeps what its agents share: plans, decision trails, and orchestration files. It lives in the project, outside git.
_Avoid_: scratchpad, temp folder

**Verification skill**:
A project-local skill named `verify-<app>` that drives an app the way a user does, so agents can prove their work. Each project has its own. huajar-stack never ships one.
_Avoid_: test suite, e2e skill
