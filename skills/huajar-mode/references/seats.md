# Seats

Use this reference when a role entry is written `<agent>:<model>-<effort>`, with `agent` `agy` or `codex`. Such an entry runs as a seat: that CLI in its own `hc` terminal, with a brief and a report, under the rules of [`worker.md`](../worker.md). The Herdr app shows the seat once, as a sub-agent of the terminal that started it. A seat's vendor is its model's, so `agy:claude-opus-5-5-medium` counts as Claude in a vendor check. Every other role runs as an `Agent` call, per the map. This reference was measured on Windows only. Read IDs from each command's JSON result. Never predict them.

## Contents

- [1. herdr check](#1-herdr-check)
- [2. Folder](#2-folder)
- [3. Brief](#3-brief)
- [4. agy and codex seats](#4-agy-and-codex-seats)
- [5. Waiting](#5-waiting)
- [6. Cleanup](#6-cleanup)

## 1. herdr check

```
test -n "${HC_TERMINAL_ID:-}"
```

In PowerShell, the check is `-not [string]::IsNullOrEmpty($env:HC_TERMINAL_ID)`. If it fails, a seat cannot start. Run the role as an `Agent` call on the role's default instead, and say "seats need the Herdr app: open this session in a Herdr app terminal".

## 2. Folder

`<run>` is a short unique ID for this run, such as the first 8 characters of `$CLAUDE_CODE_SESSION_ID` in the shell. `<temp>` is the system temp directory as an absolute path, from `node -p "require('os').tmpdir()"`.

A seat that writes gets its own git worktree, created from the main checkout:

```
git -C '<main checkout>' worktree add -b <branch> '<path>' <base>
```

`<path>` is `<home>/.herdr/worktrees/<repo>/<branch slug>`, the root the Herdr app's `worktree` mod uses. `<home>` is the absolute path from `node -p "require('os').homedir()"`, `<repo>` is the main checkout's folder name, and `<branch slug>` is the branch with each `/` replaced by `-`. Quote both paths, as in `'C:\Users\me\.herdr\worktrees\app\243-fix'` on Windows. git does not copy untracked state, such as an env file or dependencies, so prep the worktree before the seat starts.

A seat that only reads, such as a reviewer or a judge, gets the folder `<temp>/huajar-stack/<run>/<unit>/`.

In either one, write `.huajar/.gitignore` holding `*`, then the brief at `.huajar/brief.md`. The `.gitignore` keeps both files out of `git add -A`.

## 3. Brief

Write the brief with the Write tool, with every field its playbook's brief names. Its first line points to [`worker.md`](../worker.md) by absolute path. It names `.huajar/report.md` as its report, and the actions the seat must not take, such as starting workers, routines, or scheduled tasks. agy and codex read the whole disk, so the brief names every other file by its absolute path.

- Never type an SHA or a branch from memory. In the same turn that writes the brief, run `git rev-parse --verify <ref>` for each full SHA, `git branch --show-current` and `git worktree list` for the topology, and copy their output.
- Never paste an issue or PR body into the brief. Save it to a file next to the brief and have the brief name that path: `gh issue view <n> --repo <owner/name> --json title,body,comments > '<folder>/.huajar/issue-<n>.json'`. Never read an issue or PR with bare `--comments`, which prints nothing when stdout is not a terminal.
- Write each path into a command in full and single-quoted, never through a shell variable. Git Bash strips the backslashes from an unquoted `C:\...` path, and a variable inside single quotes reaches the seat unexpanded.
- Join the commands the brief gives with `;`, never `&&`. A codex seat runs them in Windows PowerShell 5, which rejects `&&`. `;` runs the next command after one fails, so when a later command depends on an earlier one, the brief tells the seat to check each exit code before it runs the next.
- Before you send the brief, run each check command it gives, as written, and confirm it does what the brief says. A command that only looks right, such as `bun test .github/x.test.ts`, which bun reads as a name filter, fails every seat the same way.
- Put the `hc send` line, if the brief has one, as its own step that says "Run this alone, as its own command". A codex seat that folds it into a script runs it inside its sandbox, where `hc` is out of reach.

## 4. agy and codex seats

**Before the first codex seat.** Check that `~/.codex/config.toml` sets `prefer_mxc = true` under `[features]` and that `~/.codex/rules/hc.rules` holds `prefix_rule(pattern=["hc", "send"], decision="allow")`. The rule lets a command that starts with `hc send` leave the sandbox, because `hc`'s pipe is outside it. If either is missing, tell the user and drop the seat. Never edit codex's config yourself.

`<name>` is `<run>-<unit>`, matches `[a-z][a-z0-9_-]{0,31}`, and is unique among the terminals in `hc ls --all --json`. The seat gets no `herdr.space` or `herdr.tab` label, so it shows once, as a sub-agent in the coordinator's tree, and starts with recovery off. The `huajar.*` labels let a Herdr layout show runs, units, and reports, so keep their names. `--outlive-parent` keeps the seat running when the coordinator's program ends, and `--rm` lets step 6's `hc kill` remove the terminal.

**Start an agy seat.** The model is the entry's text after `agy:`, which `agy models` lists whole, such as `gemini-4-neon-xhigh`:

```
hc run --bg --json --rm --outlive-parent --name <name> --cwd '<path>' --label 'huajar.run=<run>' --label 'huajar.unit=<unit>' --label 'huajar.role=seat' --label 'huajar.report=<path>/.huajar/report.md' -- agy --model <model> --settings '<temp>/huajar-stack/<run>/<unit>.agy.json'
```

Write the settings file first, with Write, never with `echo` or `printf`, which turn `\\` into `\` and leave invalid JSON: `{"trustedWorkspaces":["<path>"]}`, with the path in Windows form and each `\` written `\\`. With invalid JSON, agy exits at start with `exit_code` 1. It trusts the folder for this session only, so agy shows no trust dialog and saves nothing. Never answer the dialog with `hc keys`, which trusts the folder for good.

**Start a codex seat.** Split the entry at its last `-`, so `codex:gpt-6.2-sol-high` is model `gpt-6.2-sol` with effort `high`. `codex debug models` lists each model's efforts:

```
hc run --bg --json --rm --outlive-parent --name <name> --cwd '<path>' --label 'huajar.run=<run>' --label 'huajar.unit=<unit>' --label 'huajar.role=seat' --label 'huajar.report=<path>/.huajar/report.md' -- codex --no-daemon -m <model> -c model_reasoning_effort=<effort> -c check_for_update_on_startup=false -a never -c "permissions.hcseat={extends=\":workspace\", network={enabled=true}, filesystem={'<G>\\worktrees\\<wt>'=\"write\", '<G>\\objects'=\"write\", '<G>\\refs'=\"write\", '<G>\\logs'=\"write\"}}" -c 'default_permissions="hcseat"'
```

- `<G>` is the main checkout's `.git`, from `git -C '<path>' rev-parse --path-format=absolute --git-common-dir`, and `<wt>` is the last part of `git -C '<path>' rev-parse --git-dir`. codex ignores a path written with `/`, and it says nothing, so `<G>` takes `\`. Inside the double-quoted `-c` value, the shell reads `\\` as one `\`, so write each `\` of `<G>` as `\\`, as the separators above are.
- `extends=":workspace"` keeps codex's default sandbox. The seat reads the whole disk, writes only in its folder, and runs no command outside it. The sandbox keeps `.git` read-only, and a linked worktree's git data sits outside the folder. So the four entries open the `.git` subfolders that a commit writes. Never add `--sandbox`, which turns the profile off.
- Every commit prints `error: Unable to create '<G>/packed-refs.lock': Permission denied`. The commit and the branch update land anyway.
- A seat that only reads drops the `filesystem` entries.

**Send the brief.** Start the seat with no prompt, because `hc` reads a seat that got its prompt at start as idle before it begins. Run `hc wait <name> --timeout 120 --json` until it shows a status, then:

```
hc send <name> "Read .huajar/brief.md and do what it says."
```

agy submits the message. codex does not, so run `hc keys <name> enter`, wait 5 seconds, and read `status.state` from `hc get <name> --json`. It can flash `idle` right after it starts, so read it once more before you act. If it still reads `idle`, send `enter` a second time. If it reads `idle` after that, read the screen with `hc read <name> --lines 120`.

## 5. Waiting

Run one `hc wait <name> --timeout 3600 --json` per seat in the background (`run_in_background: true`), never in a detached `( ... & )` subshell, which outlives the run and holds the folder open. Never poll. When a wait returns, read `reason`, `status`, and `exit_code` from its JSON. `ended` means the wait ended, not that the seat exited, so never branch on it. An agy seat keeps `turn` 0 while it works.

- `status` is `done` or `idle`: read the report at `<path>/.huajar/report.md`. If it is missing, read the screen with `hc read <name> --lines 120`. If the screen shows a question or a dialog, which `hc` can report as `idle`, handle it as `blocked`. Once the report is recorded, clean up the seat right away, per step 6.
- `status` is `blocked`: tell the user which terminal needs them, by its name and its folder. Wait again once they answer.
- `status` is `error`: read the screen with `hc read <name> --lines 120`, and handle it as `blocked`.
- `reason` is `message`: a message reached the coordinator's terminal, such as the seat's own `hc send` report or another seat's, and the seat still runs. Read the message, then wait again.
- `reason` is `timeout`: the seat still runs. Wait again.
- `exit_code` is not null, `reason` is `exit`, or the wait fails with `not_found`: the seat exited, and `--rm` removed its terminal, so there is no screen to read. Read the report. If it is missing, the seat failed, so say so in the run's report with its `exit_code`, if the JSON has one.

## 6. Cleanup

1. Run `hc kill <name>`. It started with `--rm`, so the kill also removes its terminal. A `not_found` error or a terminal that already ended counts as done.
2. Delete the settings file and a read-only seat's folder.
3. For a seat with a worktree, run `git -C '<main checkout>' worktree list --porcelain`. If it prints no `worktree <path>` line, the worktree is already removed. git prints the path with `/`, such as `C:/Users/me/.herdr/worktrees/app/243-fix`. Otherwise run `git -C '<main checkout>' worktree remove '<path>'`, then confirm the directory is gone. On Windows an open handle makes the removal fail halfway, so kill the terminal first. If git refuses because the worktree `contains modified or untracked files`, keep the worktree and report its path, since it may hold the seat's only copy of its work. If the directory survives for another reason, find what still holds it, free it, delete the directory, and run `git worktree prune`. Never add `--force` to a worktree with unpushed work.

Never close or delete anything the run did not create.
