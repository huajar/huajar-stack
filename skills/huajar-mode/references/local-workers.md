# Local workers

Use this reference when a playbook or skill starts a Local worker on the Local path. A Local worker is a full Claude Code session in its own git worktree and its own `hc` terminal, which the Herdr app shows once, as a sub-agent of the terminal that started it, with the worker contract: one brief, its own worktree and branch, VERIFY, a push, and a report, under the rules of [`worker.md`](../worker.md). Every command below runs the same in Git Bash, PowerShell, macOS, and Linux unless a step says otherwise. In Git Bash, prefix every command you run, not only the ones below, with `MSYS_NO_PATHCONV=1` when an argument has a colon after a ref, such as `git show <ref>:<path>`, or starts with `/` and is not a drive path such as `/c/Users`. Otherwise Git Bash rewrites the argument as a Windows path. Leave the prefix off a command that passes a drive path and no ref, because the prefix stops Git Bash from converting `/c/Users` to `C:/Users`. A command with a ref and a drive path takes the prefix, so write that path as `C:/Users`. Read IDs from each command's JSON result. Never predict them.

## Contents

- [1. herdr check](#1-herdr-check)
- [2. What runs where](#2-what-runs-where)
- [3. Capacity](#3-capacity)
- [4. Layout](#4-layout)
- [5. Brief](#5-brief)
- [6. Report](#6-report)
- [7. Waiting](#7-waiting)
- [8. Raising the Local in-flight cap](#8-raising-the-local-in-flight-cap)
- [9. Cleanup](#9-cleanup)

## 1. herdr check

```
test -n "${HC_TERMINAL_ID:-}"
```

In PowerShell, the check is `-not [string]::IsNullOrEmpty($env:HC_TERMINAL_ID)`. If it fails, stop and say: "the local path needs the Herdr app: open this session in a Herdr app terminal". Single-session skills and native subagents are not affected, so they run as usual.

## 2. What runs where

- **A Local worker, counted against the Local in-flight cap.** A worker with the worker contract: its own worktree and branch, VERIFY, a push, and a report. Also any lane that loads the machine: gates, live, and perf.
- **A native subagent, not counted.** Everything else: delegates that edit in the parent's checkout, explorers, reviewers, judges, and audits.

## 3. Capacity

- The Local ceiling is the number on the `# local ceiling: N` line of `~/.claude/rules/huajar-stack-models.md`. If the rule has no such line, treat the ceiling as 2 and suggest `/huajar-stack:setup-huajar-stack`.
- The project's Local in-flight cap is the one number in `<main checkout>/.claude/huajar-stack/local-cap`, where the main checkout is the one the Store row of [the Claude Code map](../../../docs/harness/claude-code.md) names. It is 2 when the file is missing, and it is never above the ceiling.
- The quota cap is the number on the `# quota cap: N` line of the same rule. If the rule has no such line, treat the quota cap as 2, say that this default applies, and suggest `/huajar-stack:setup-huajar-stack`. It counts every full session this coordinator holds in flight, local and cloud, per step 3 of [the cloud workers reference](cloud-workers.md).
- Every full local session counts against the Local in-flight cap: workers, verifiers, stackers, and babysitters. An Autopilot-full or Autopilot-stack owner on the Local path also leaves a place under the cap for the swarm of its step 4. A babysitter can hold a place under the cap for hours, so say so before you start one.
- Two coordinators on one machine cannot see each other's runs. Before you start a worker, count every live agent on the machine, other coordinators included: the terminals in `hc ls --json` whose `agent` is a coding agent, `claude-code`, `claude`, or `pi`, except `$HC_TERMINAL_ID`, the coordinator's own terminal. A Claude terminal reports `claude` until Claude Code reports a status, such as while the folder trust dialog holds it. A shell (`pwsh.exe`, `pwsh`) or another program, such as a dev server's `node`, does not count. The run's workers stay in the count. Start at most the Local in-flight cap minus the full local sessions this run holds, at most the quota cap minus every full session this run holds, local and cloud, and at most the ceiling minus that machine count. A Local worker has to fit all three. A Cloud worker has to fit the quota cap only. When that is fewer than a skill asks for, or makes a worker wait, say so in the run's report and name the limit.
- **Rolling window.** A fan-out larger than these limits allow still runs every worker, at most as many at a time as fit. Each time a worker's report is recorded and the worker is cleaned up, start the next pending one that fits. A held owner that the root or the operator released resumes before any pending unit starts, because it already keeps its brief and its PR. Under the operator's stop (Autopilot-full step 7), the window starts no pending unit and resumes no owner until the operator releases the hold, because the stop is a zero-writes order for the whole run. Never wait for a whole batch to finish. This holds for Local workers and Cloud workers. A swarm race keeps all its arms and a partition keeps all its slices. A `first pass` race stops the window at the first arm that passes and does not start the remaining arms.
- A worker that runs the app also counts against `Parallel instances: N` from the project's `verify-<app>` skill. Run at most `min(Local in-flight cap, N)` of them at once. A missing line or skill means 1. An instance another run started counts too. Each port from the verification skill that has a listener is one instance.
- Act only on PRs this run opened, unless the user names others. Another coordinator's PRs are not yours to merge, retarget, or close.

## 4. Layout

One git worktree per worker. `<run>` is a short unique ID for this run, such as the first 8 characters of `$CLAUDE_CODE_SESSION_ID` in the shell. An `hc` terminal does not inherit that variable, but a nested `claude -p` does, so unset it there. Create each worktree from the main checkout:

```
git -C '<main checkout>' worktree add -b <branch> '<path>' <base>
```

`<path>` is `<home>/.herdr/worktrees/<repo>/<branch slug>`, the root the Herdr app's `worktree` mod uses. `<home>` is the absolute path from `node -p "require('os').homedir()"`, `<repo>` is the main checkout's folder name, and `<branch slug>` is the branch with each `/` replaced by `-`. Quote both paths, as in `'C:\Users\me\.herdr\worktrees\app\243-fix'` on Windows.

Prep the worktree before you start anything in it, because git does not copy untracked state. That state is the env file and its port, local settings, dependencies, and the code index. First check that nothing listens on the port you plan to use, because a port derived from an issue number can collide with a server that already runs. This prints `taken` for a port with a listener:

```
node -e "require('net').connect(<port>, 'localhost').on('connect', () => { console.log('taken'); process.exit(1) }).on('error', () => console.log('free'))"
```

Then run the worktree prep helper that the project's verification skill names, in the worktree, with the checked port. The helper must be safe to rerun. If the skill names none, do the same steps by hand and suggest a helper.

When the lane runs the app, the worker owns its dev server, and its brief says so with these commands. The worker starts the server from its own terminal, so `hc` records the worker as the server's parent. The Herdr app nests the server under the worker, the server's exit note reaches the worker, and the server ends when the worker's Claude ends:

```
hc run --bg --json --name <name>-dev --cwd '<path>' --label 'huajar.run=<run>' --label 'huajar.unit=<unit>' --label 'huajar.role=server' -- <dev command> && hc wait <name>-dev --output '<ready text>' --timeout 10 --json
```

- `<name>` is the worker's name from step 5. The coordinator cannot start the server under the worker, because `hc run --parent` fails with `not_found` on a terminal that does not exist yet, and the worker gets its brief at start.
- The server runs with the port, data dir, and profile that the project's verification skill gives each instance. When the skill gives no port, the server picks a free one and the worker reads it from the ready line.
- `hc wait --output` matches only output printed after the wait starts, so it can miss a ready line the server printed first, even with both commands in one shell call. So the wait is short. When it returns `reason` `output`, the server is up. When it returns `reason` `timeout`, the worker reads the screen with `hc read <name>-dev --lines 120`. If the ready text is there, the server is up. If not, it runs `hc wait <name>-dev --output '<ready text>' --timeout 10 --json` again and repeats, up to 12 waits in all.
- Run the dev command in the foreground of its terminal. A launcher that detaches the real process leaves it outside `hc`, where `hc kill` misses it.
- The server starts without `--rm`, so its screen stays readable if it exits. If the wait returns `reason` `exit` before the ready text, the worker reads the screen with `hc read <name>-dev --lines 120` and reports the failure. If the twelfth wait times out with no ready text on screen, the server still runs but never came up, so the worker reports the failure.
- Before it writes its report, the worker runs `hc kill <name>-dev` and `hc rm <name>-dev`.

## 5. Brief

Write the brief, with every field its playbook's brief names, to `<temp>/huajar-stack/<run>/<unit>.brief.md` (`<temp>` is as in step 6). Run `brief.mjs` by its absolute path, `<skill dir>/scripts/brief.mjs`, from the project's main checkout or worktree. It reads SHAs and worktrees from its cwd, and the installed skill directory is not a git repo. Pass the text on stdin in a form that expands nothing. Quote the path, because Git Bash strips the backslashes from an unquoted `C:\...` path. In Git Bash, use a quoted heredoc:

```
node '<skill dir>/scripts/brief.mjs' write '<brief path>' --repo <owner/name> <<'EOF'
<brief text>
EOF
```

In PowerShell, which has no heredoc, use a single-quoted here-string. Keep the brief ASCII, because Windows PowerShell 5.1 pipes text as ASCII and turns `é` into `?`:

```
@'
<brief text>
'@ | node '<skill dir>/scripts/brief.mjs' write '<brief path>' --repo <owner/name>
```

- `write` creates the folder, prints the brief's path, and exits nonzero, leaving no brief, when the path is not absolute, the text is empty, or a placeholder fails. Never type an SHA or a branch from memory. Write `{{sha:<ref>}}` for a full SHA, `{{topology}}` for the current branch and worktrees, and `{{issue:<n>}}` or `{{pr:<n>}}` for an issue or PR read with `--json`. Never read an issue or PR with bare `--comments`, which prints nothing when stdout is not a terminal.

Then start Claude in its own terminal, from the coordinator's terminal, with the brief in its first prompt:

```
hc run --bg --json --rm --outlive-parent --name <name> --cwd '<path>' --label 'huajar.run=<run>' --label 'huajar.unit=<unit>' --label 'huajar.role=worker' --label 'huajar.report=<report path>' -- claude --strict-mcp-config --permission-mode auto --model <family> --effort <effort> "/huajar-stack:huajar-mode Read <brief path> and do what it says."
hc wait <name> --timeout 90 --json
hc get <name> --json
```

- The first prompt starts with `/huajar-stack:huajar-mode`, so the worker loads the mode, as a Cloud worker does. A slash command loads it only as the session's first prompt typed in this way. A `/huajar-stack:huajar-mode` line inside the brief file, a prompt sent later with `hc send`, which wraps the text in `<hc from=...>`, and `claude --agent huajar-stack:huajar-agent` all leave the worker without the mode. The brief path must hold no `"`.
- `<name>` is `<run>-<unit>`, matches `[a-z][a-z0-9_-]{0,27}`, so `<name>-dev` stays within the 32 characters `hc run --name` takes, and is unique among the terminals in `hc ls --all --json`, such as `run4-unit3`.
- The worker gets no `herdr.space` or `herdr.tab` label. `hc` records the coordinator's terminal as its parent, so the Herdr app shows it once, as a sub-agent in the coordinator's tree, with its status. A space label adds a second entry, a space with its own pane, and makes the app turn recovery on. The `huajar.*` labels let a Herdr layout show runs, units, and reports, so keep their names. `<report path>` is the report's path from step 6.
- `--outlive-parent` keeps the worker running when the coordinator's program ends, because `hc` records the coordinator's terminal as the worker's parent. `--rm` lets step 9's `hc kill` remove the terminal.
- `hc get <name> --json` must show `"keep":false`. With recovery on, hc replaces a lost Claude with a shell in the same live terminal, so step 7's wait never sees an exit and a later `hc send` types into the shell. A terminal with no space label starts with recovery off and keeps it. If it shows `"keep":true`, run `hc keep <name> --off` and `hc get <name> --json` once more. If `hc get` fails with `not_found`, Claude already exited, so go to the exit case below.
- `<family>` and `<effort>` come from the role's line or default, per the mode's Subagents section. For a role on `auto` or `inherit-parent`, they are the parent chat's model and effort. A project skill, project memory, or the operator can override the model, the Local in-flight cap, or the permission mode. No override raises the Local in-flight cap above the Local ceiling or sets the permission mode to `bypassPermissions`. Name each override and its source in the reply.
- `--strict-mcp-config` skips the "New MCP server found" dialog. The dialog comes from a `.mcp.json` in a folder above the worktree, such as the home folder, and Claude Code asks about it once per new project path (inferred).
- The flag drops every MCP server that `--mcp-config` does not name (per `claude --help`). It also drops the claude.ai connectors and the user-scope servers, such as `codegraph`. When a worker needs a server, write that server to a JSON file and add `--mcp-config <file>` right after `--strict-mcp-config`.
- The worker has its brief when the start wait returns any status, whether with `"reason":"status"` or with `"reason":"timeout"` and `"status":"working"`, which means it is still on its first turn at 90 seconds. Go on to step 7. A `"reason":"timeout"` with a null `status` means a dialog holds Claude before it reports a status, such as the folder trust dialog in a folder Claude Code does not trust. Read the screen with `hc read <name> --lines 120` and ask the user. Never answer a dialog blindly. Once the user answers, run the start wait again. Right after an answered trust dialog, the wait can return `"status":"idle","turn":0`, and the worker then runs its first prompt on its own. So an `idle` at `turn` 0 there is not the end: run the wait once more. If the worker still sits at `turn` 0 with no prompt on the screen, run `hc kill <name>` and start it again with the same `hc run`. The folder no longer asks.
- Any other result, such as `reason` `exit` or a `not_found` error, means Claude exited at start, for example on an invalid `--mcp-config` file or `--permission-mode`. `--rm` removed its terminal, so there is no screen to read. Run `hc run` once more without `--rm`, then the start wait. If the wait returns a status, the first failure was transient. Treat this terminal as the worker and run `hc get` as above. It has no `--rm`, so step 9 runs `hc rm <name>` after `hc kill <name>`. Otherwise read the screen with `hc read <name> --lines 120`, then run `hc kill <name>` and `hc rm <name>`, and report the error the screen shows.
- Workers start in auto mode, never `bypassPermissions`.
- The brief names the actions the worker must not take, such as starting workers, cloud sessions, routines, or scheduled tasks. The brief's first line points to [`worker.md`](../worker.md) by absolute path.

## 6. Report

The brief tells the worker to write its report to `<temp>/huajar-stack/<run>/<unit>.md`, creating the folder. `<temp>` is the system temp directory as an absolute path, from `node -p "require('os').tmpdir()"`. The report stays out of the Store, because `.claude` is a protected path and a write there can stop the worker on a prompt.

The run names each report's path in its own report. Check each report against the pushed branch: `git ls-remote origin <branch>` must print the head SHA the report names.

## 7. Waiting

Run one `hc wait <name> --timeout 3600 --json` per worker in the background (`run_in_background: true`), never in a detached `( ... & )` subshell, which outlives the run and holds the worktree's directory open. Never poll. When a wait returns, read `reason`, `status`, and `exit_code` from its JSON. `ended` means the wait ended, not that Claude exited. A wait whose condition is met returns `"ended":true` with the terminal still live. Never branch on it.

- `status` is `done` or `idle`: read the report. If it is missing, read the screen with `hc read <name> --lines 120`. If the screen shows a question or a dialog, which `hc` can report as `idle`, handle it as `blocked`. Once the report is recorded and its branch is checked, clean up that worker right away, per step 9, so finished sessions and worktrees do not pile up past the Local in-flight cap. Then start the next pending unit of the rolling window, per step 3.
- `status` is `blocked`: tell the user which terminal needs them, by its name and its worktree path. Wait again once they answer.
- `status` is `error`: read the screen with `hc read <name> --lines 120`, and handle it as `blocked`.
- `reason` is `timeout`: the worker still runs. Wait again. If `status` is null, read the screen with `hc read <name> --lines 120` first. A live terminal whose status stays null and whose screen shows a shell prompt is a lost worker. Claude is gone, and a shell took its place. Run `hc kill <name>` and handle it as the `exit` case below.
- `exit_code` is not null, `reason` is `exit`, `reason` is `status` with a null `status`, or the wait fails with `not_found`: Claude exited, and `--rm` removed its terminal, so there is no screen to read. A Claude killed mid-turn returns `"reason":"status","status":null,"exit_code":1`, and the next `hc wait` fails with `not_found`. Read the report. If it is missing, the worker failed, so say so in the run's report with its `exit_code`, if the JSON has one, and handle its worktree per step 9.

If the coordinator's terminal ends first, its workers keep running, because they started with `--outlive-parent`, but they leave the Herdr app window, which draws a sub-agent only under a live parent. `hc ls --json --label huajar.run=<run>` still lists them, and `hc read`, `hc wait`, and `hc kill` work as before. Clicking a worker's row in the Agents list shows it without a tab. `herdr-app do terminal.keep --terminal <address>` gives it a tab in the window's active space, adds space labels, and turns recovery on, so run `hc keep <name> --off` after it.

## 8. Raising the Local in-flight cap

A run is healthy when every worker finished without blocking or failing. After a healthy run, offer a raise only when the Local in-flight cap was the limit that bound the run. That means the run used the whole Local in-flight cap, the quota cap still had room, and the Local in-flight cap is below the ceiling. Then offer to raise it from N to N+1, and write `local-cap` only if the user agrees. When the quota cap bound the run, name the quota cap as the limit and point to `/huajar-stack:setup-huajar-stack`, which sets it. Never raise either cap unasked. If `.claude/huajar-stack/.gitignore` is missing, write it with `*`, so git ignores `local-cap`. If the user says no, show the absolute path of `local-cap`, so they can change it later.

## 9. Cleanup

If the run keeps a decision log, keep every path and ref it cites before step 7 or this step removes a worktree, a branch, or a run file, per the Rules of [show-me-your-work](../../show-me-your-work/SKILL.md). Step 7 cleans up each worker as it finishes. Remove a worktree in this order, because on Windows an open handle makes the removal fail halfway and leaves an unregistered folder:

1. Run `hc kill <name>` for the worker. It started with `--rm`, so the kill also removes its terminal. If it is step 5's rerun without `--rm`, run `hc rm <name>` after the kill. If it had a dev server, run `hc kill <name>-dev`, then `hc rm <name>-dev`, in case the worker did not. For `hc kill`, a `not_found` error or a terminal that already ended counts as done, and `hc rm <name>-dev` still runs. For `hc rm`, a `not_found` error counts as done. Stop every other process the run started in the worktree, such as a waiter. Match by path with a boundary, the worktree path followed by a separator or the end, so `wt/8` never matches `wt/85`. Never match by process name.
2. Run `git -C '<main checkout>' worktree list --porcelain`. If it prints no `worktree <path>` line, the worktree is already removed, so this step is done. git prints the path with `/`, such as `C:/Users/me/.herdr/worktrees/app/243-fix`. Otherwise run `git -C '<main checkout>' worktree remove '<path>'`.
3. Confirm the directory is gone (`test ! -e <path>`, or `Test-Path <path>` returns `False` in PowerShell). If it survives, find what still holds it, free it, delete the directory, and run `git worktree prune`.

At the end of the run, handle the leftovers: any terminal the run started or worktree it created that is still open. Never add `--force` to a worktree with unpushed work. A worker that failed or never pushed: ask the user before removing its worktree. If `worktree remove` refuses because of untracked files and `git ls-remote` matches the worktree's HEAD, use `--force`. List the branches the run pushed with `git ls-remote --heads origin <branch>...`, and delete each one whose PR merged (`gh pr list --head <branch> --state merged`) with `git push origin --delete <branch>`. Then run `git fetch --prune`, and run `git branch -D` on each local branch the run created whose PR merged and whose upstream reads `[gone]` in `git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads`. Report each branch still left, and why. Never close or delete anything the run did not create. Asked whether anything is left over, answer from `hc ls --all --json`, `git worktree list`, and the run's open PRs.
