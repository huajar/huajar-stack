<img src="assets/logo.svg" alt="huajar-stack logo" width="80">

# huajar-stack

huajar-stack is a Claude Code plugin that runs each task to a check. You give it a goal and a check that can pass or fail. Its mode, huajar-mode, picks the playbook that fits the task, runs the steps with skills and subagents, and reports with the evidence. When a task fans out, it starts parallel workers from the Herdr app, each in its own terminal and worktree, on this machine or in Claude's cloud.

## Install

```sh
claude plugin marketplace add huajar/huajar-stack
claude plugin install huajar-stack@huajar-stack
```

Then, in a Claude Code session, pick the model and reasoning effort for each role:

```text
/huajar-stack:setup-huajar-stack
```

## Use

Start each task with the mode, the goal, and the check:

```text
/huajar-stack:huajar-mode the export drops rows with empty names. fix it. done when the new test passes and the export of fixtures/users.csv has 120 rows.
```

When you can't tell which skill fits, ask `/huajar-stack:huajar-help`. It answers with a prompt to send and the file the answer came from.

[The guide](docs/guide/README.md) covers the rest in ten short pages.

## Requirements

Claude Code. Some playbooks also call these tools:

- [Bun](https://bun.com/docs/installation), for `watch-pr`
- [jq](https://jqlang.org/download/), for `worktree-audit.sh`
- `gh`, the GitHub CLI, for both
- the Herdr app, with `hc` on `PATH`, for parallel workers. Open the session in a Herdr app terminal, and the mode starts, watches, and cleans up each worker there.

## For agents

- Read [AGENTS.md](AGENTS.md) before you change this repo.
- Read [the map](docs/harness/claude-code.md) before you follow a skill. Skills taken from pstack use Cursor names, and the map gives the Claude Code name for each. The plugin's hooks print it into the session when a huajar-stack skill starts there.
- Use the words in [CONTEXT.md](CONTEXT.md).

## Repository layout

```text
skills/huajar-mode/           the mode, its playbooks, its worker references, and its scripts
skills/<name>/                every other skill: situational skills, principles, setup, and help
agents/                       huajar-agent, which every delegate runs as, and comment-sicko
hooks/                        prints the map when a huajar-stack skill starts
docs/harness/claude-code.md   the map
docs/guide/                   the guide
.github/                      CI, the check that keeps files taken from pstack in line with it, and the Cursor path check
```

## Credits

huajar-stack builds on [pstack](https://github.com/cursor/plugins/tree/2f87c854fe3e2fcda44ca86b46ede35aad3c46b7/pstack) by Lauren Tan ([@poteto](https://x.com/poteto)), and follows it at a pinned commit, `2f87c85`. It runs its parallel workers on the Herdr app and its `hc` CLI. Files taken from pstack and its companion plugin cursor-team-kit keep their MIT notices in [LICENSE](LICENSE).
