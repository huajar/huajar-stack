# huajar-stack in Claude Code

huajar-stack skills come from pstack and use Cursor names. In Claude Code, read this file once per session, then map each Cursor name in a skill with the tables below. `<pstack>` and `<huajar-stack>` mean the plugin root, the folder that holds `skills/` and `docs/`. `${CLAUDE_PLUGIN_ROOT}` names it. If a Cursor field has no row, drop it and say so. Never pass a field or value the tool schema rejects.

It extends pstack's adapter at `9e278fe`, the pstack commit that huajar-stack follows.

## Names

| pstack | huajar-stack |
| --- | --- |
| `poteto-mode`, `poteto-help`, `setup-pstack` | `huajar-mode`, `huajar-help`, `setup-huajar-stack` |
| `/pstack:<name>`, `/<name>` | `/huajar-stack:<name>` |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | `https://github.com/huajar/huajar-stack/blob/main/<path>`, when you give the user a link. See Paths for reading it. |
| `control-ui`, `control-cli`, `deslop`, or `verify-this` "from `cursor-team-kit`" | The skill of the same name in `<huajar-stack>/skills/`. |

Files keep huajar-stack's names.

## Tools

| Cursor | Claude Code |
| --- | --- |
| `Task` | `Agent` |
| `AskQuestion` | `AskUserQuestion`, with at most 4 options per question and `multiSelect` for `allow_multiple`. In `-p` mode it is absent, so ask in plain text. |
| The `mcps/` directory or the available-tools map that lists MCP servers | The `mcp__<server>__<tool>` names in the session's tools, including deferred tools listed by name only. |
| `mcp_auth` | The server's `authenticate` tool when it has one. Otherwise ask the user to sign in with `/mcp`. |
| Open a todolist, or copy steps into the todolist tool | Use `TodoWrite` if the session offers it, or `TaskCreate` and `TaskUpdate` where the session offers them in its place. Otherwise keep the list in your reply and update it at each phase. |
| Run another pstack skill (`/name` or "the **name** skill") | `Read` `<huajar-stack>/skills/<name>/SKILL.md` and follow it. The `Skill` tool refuses most huajar-stack skills, because they set `disable-model-invocation: true`. When you tell the user to type it, write `/huajar-stack:<name>`. |
| `Grep`, `Glob` | `Bash` with `rg` when the session has no `Grep` or `Glob`. |
| "A skill counts as used" when the transcript shows a `Read` of its `SKILL.md`, a `Task` prompt naming its path, or a tool call | Also when it shows a `Skill` tool call, or a slash command such as `/huajar-stack:<name>`, which the transcript records with a "Base directory for this skill" line. A `Read` under the plugin's own folder counts too, when the plugin loads in place, as with `--plugin-dir`. |
| Cursor's `/loop` command | Claude Code's bundled `/loop` skill. |
| Cursor's `/visualize` command, for a chart or diagram | A Mermaid diagram or chart, such as `xychart-beta` or `pie`. Claude Code has no `/visualize`. |
| The **create-skill** skill | Claude Code's skill docs (https://code.claude.com/docs/en/skills) and Anthropic's skill authoring best practices. |
| Cursor's built-in babysit skill | None. The **Babysit** playbook is the only match. |

## Subagent fields

| Cursor | Claude Code |
| --- | --- |
| `subagent_type: generalPurpose` | `subagent_type: "general-purpose"` |
| `poteto-agent`, `comment-sicko` | `huajar-stack:huajar-agent`, `huajar-stack:comment-sicko` |
| The `model:` line in `poteto-agent`'s file | huajar-agent's file has none. Pass `model` and `effort` on every `Agent` call that spawns `huajar-stack:huajar-agent`, mapped with the Models table. |
| `readonly: true` | `subagent_type: "Explore"`. It keeps `Bash`, so the brief says "do not edit files", and you check `git status` after. |
| `readonly: false` | `general-purpose`. It keeps the session's MCP servers. |
| `environment: "cloud"` | `isolation: "worktree"`. Name the branch or commit the worker checks out. |
| `environment: "local"` | Omit. |
| `cloud_base_branch: <b>` | Tell the worker to start its own branch from `origin/<b>` first, such as `git switch -c <its branch> origin/<b>`. A plain `git checkout <b>` fails in a worktree when another worktree, such as the coordinator's, holds `<b>`. |
| `run_in_background: true` | The same, when the `Agent` tool has the field. Otherwise omit it, since subagents then run in the background. |
| `resume` | `SendMessage` to the agent's ID when the session offers it. Otherwise spawn a new agent and paste the earlier result into its brief. |
| `file_attachments` | List the paths in the brief. |

## Models

| Cursor | Claude Code |
| --- | --- |
| `claude-<family>-<version>-<effort>[-fast]`, such as `claude-opus-5-5-xhigh` | `model: "opus"` and `effort: "xhigh"`. `model` takes only `opus`, `sonnet`, `haiku`, `fable`. Drop `-fast`. |
| Pick a subagent's "fast or standard speed" | Pick only the reasoning level. Claude Code sets no speed per subagent. |
| A skill's default slug for a role | The role's default in the rule shape of `<huajar-stack>/skills/setup-huajar-stack/SKILL.md`, step 5: Opus for the code roles, `judgment and prose`, `swarm workers`, and `arena cross-judge pool`, and Fable, Opus, and Sonnet, in that order, for `arena runners` and `interrogate reviewers`, all at `medium`. This holds for pstack's `-fast`, `high`, `xhigh`, and `gemini-*` defaults too. |
| A `gemini-*`, `grok-*`, `gpt-*`, or other non-Claude slug that is not a role's default, for a verifier, a judge, or a lane that asks for a different model family or vendor | The first `arena cross-judge pool` entry from a vendor other than the work's. With none, `model: "opus"`. |
| The arena judge's vendor check, "never from the parent's vendor" | Run it. An entry's vendor is its model's. With no entry from another vendor, the first entry judges, and say the check did not run. |
| A role entry `<agent>:<model>-<effort>`, such as `agy:gemini-4-neon-xhigh` | An `hc` seat per `<huajar-stack>/skills/huajar-mode/references/seats.md`, never an `Agent` call. |
| The `swarm workers` line, for a slice whose brief fixes the result, a check proves it, and no design choice is left | The `swarm mechanical code` or `swarm mechanical text` line, by whether the slice changes code or prose, when the rule has it. Otherwise, or in doubt, `swarm workers`. |
| Any other `gemini-*`, `grok-*`, `gpt-*`, or non-Claude slug, such as one the user names | Omit `model` so the agent runs on the session model, and say so. |
| `auto` or `inherit-parent` | Omit `model` and `effort`. |
| The `pstack-models.mdc` rule, `~/.cursor/rules/pstack-models.mdc`, written `huajar-stack-models.mdc` in huajar-stack's copy | `~/.claude/rules/huajar-stack-models.md`, already in context. If it is not, read it. If the file or the role's line is missing, use the skill's default slug. |
| A role value `<model> <effort>`, such as `opus high` | `model: "opus"` and `effort: "high"`. |

## setup-pstack

Follow `<huajar-stack>/skills/setup-huajar-stack/SKILL.md`, not pstack's `setup-pstack`. Its rule adds the budget ladder.

## Paths

| Cursor | Claude Code |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | `.claude/skills/`, `~/.claude/skills/` |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | `~/.claude/plugins/`, `.claude-plugin/plugin.json` |
| `.cursor/rules/*.mdc`, always-applied rules | `CLAUDE.md`, or `AGENTS.md` when no `CLAUDE.md` exists. Claude Code never reads `.mdc` files. The model rule is the exception. See Models. |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | `<huajar-stack>/<path>` when that file exists. Read the local copy and never fetch it. |
| Read a playbook, a script, or a skill "from trunk" | Read the installed copy in `<huajar-stack>` by absolute path. Trunk can be ahead of it. |
| A repo path that starts with `pstack/`, written `huajar-stack/` in huajar-stack's copy, such as `bash huajar-stack/skills/huajar-mode/scripts/worktree-audit.sh` or `git show origin/main:huajar-stack/<path>` | `<huajar-stack>/<path>`. Read the installed copy by absolute path, and never fetch it. |
| `.cursor/worktrees/<repo>/<name>` | `<repo>/.claude/worktrees/<name>` |
| Cursor's app data, `~/Library/Application Support/Cursor`, such as `state.vscdb.backup` and `snapshots/roots/<root>` | `~/.claude/file-history/`, Claude Code's checkpoint snapshots. Never clear Cursor's app data from a Claude Code run, because it belongs to another app. |
| Pinned or active chats | Pinned or active sessions, as the user names them. |
| Transcripts in `~/.cursor/projects/<slug>/agent-transcripts/` | `~/.claude/projects/<slug>/<session>.jsonl`, with each `/` and `.` of the workspace path changed to `-` in the slug. The newest is the current session, and `<session>/subagents/` holds subagent transcripts. Read only this workspace's folder. |
| The agent store and the Project store | The Store, `.claude/huajar-stack/<session id>/` under the main checkout's root, the folder that holds the `.git` directory that `git rev-parse --git-common-dir` names. `<session id>` is this session's ID, the value of `CLAUDE_CODE_SESSION_ID` in the shell tool. Hook output and files you read leave `${CLAUDE_SESSION_ID}` unfilled, and the shell does not set it, so never use that name in a path. When you create it, also write `.claude/huajar-stack/.gitignore` holding `*`. Claude Code treats `.claude` as a protected path, so writes there are prompted in `default` and `acceptEdits`, reviewed by the classifier in `auto`, denied in `dontAsk`, and allowed in `bypassPermissions`, and `permissions.allow` rules do not pre-approve them. A run in `dontAsk` mode works without a store. Subagents use the root agent's store, so put its absolute path in every prompt that needs it. |
| `/tmp/<path>` | `<temp>/<path>`, where `<temp>` is the system temp directory as an absolute path. Git Bash on Windows has no shared `/tmp`. |

## Windows

pstack assumes macOS. On Windows, huajar-stack runs its commands in Git Bash.

| pstack | Claude Code on Windows |
| --- | --- |
| A command with a ref and a path, such as `git show <ref>:<path>`, or an argument that starts with `/` | Prefix it with `MSYS_NO_PATHCONV=1` when an argument has a colon after a ref or starts with `/` and is not a drive path such as `/c/Users`, because Git Bash otherwise rewrites it as a Windows path. With the prefix, write a drive path as `C:/Users`. |
| A macOS-only tool, such as a spindump | Name the Windows tool next to it. |
| A tmux or PTY session that drives a CLI or TUI | Inside a Herdr app terminal (`HC_TERMINAL_ID` is set), an `hc` terminal, one per drive, because tmux and `pty` do not run on Windows. |

## Cursor-only features

Claude Code has no Cursor Automations, Bugbot, Cursor cloud agents, or built-in PR tool. When a step needs one and no row below replaces it, put one line in your reply, `Skipped in Claude Code: <step>. <reason>.`, then go on to the next step. Do not stop, ask, or retry. When a later step needs what the skipped step made, such as a URL or a key, leave a placeholder and name it in the line.

| Cursor | Claude Code |
| --- | --- |
| Cursor Automations: routines, `update_state` routine calls, `api2.cursor.sh/automations` webhooks, routine wakes, and `SendToUser` secret requests | Skip with the line. |
| Bugbot | Any review bot. Triage its threads per `<huajar-stack>/skills/huajar-mode/references/bugbot-triage.md`. Skip a step that starts, waits for, or configures a review bot when the PR has no review bot check or comment. |
| Cursor cloud agents | `environment: "cloud"` maps to a worktree, as in Subagent fields. Skip a step that needs the cloud agent itself, such as its dashboard status or its own machine. |
| A built-in PR tool | Use the forge command that the step gives, such as `gh pr create`. That is not a skip, so write no line. |

## Left out of huajar-stack

These pstack pieces are not in huajar-stack. When a step needs one, skip it with the line from Cursor-only features.

| pstack | Reason |
| --- | --- |
| The `make-bot-ui` skill | No concrete use yet. |
| The benny automation pack, `automations/benny` | It runs on a review bot, and huajar-stack ships none. |
