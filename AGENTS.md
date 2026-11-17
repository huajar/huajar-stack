# AGENTS.md

Rules for agents that change this repository. [README.md](README.md) says what huajar-stack is and how to install it. [CONTEXT.md](CONTEXT.md) defines the words to use and lists the words to avoid.

## Invariants

- Write everything in English.
- Never install pstack or cursor-team-kit, and never depend on them.
- Keep the notices of pstack and Cursor in `LICENSE`.
- Add nothing before a change needs it. No empty folders, no placeholders.
- The repo root is the plugin root. Anything under `skills/`, `agents/`, or `hooks/` ships to every install, so it names no specific project, local path, or account.
- README.md describes only what exists. Update its Repository layout in the same pull request as the change.
- Do not create a CLAUDE.md. Claude Code reads AGENTS.md only when no CLAUDE.md exists, and `claude plugin validate` warns about one at the plugin root.

## Files taken from pstack

Files taken from pstack follow the Reference, pstack at `2f87c85`. A difference between such a file and the Reference is an Adaptation.

- Take a file with `.github/scripts/sync-reference.mjs`. It writes the Reference's text with huajar names.
- In the same pull request, list each Adaptation under the file in `.github/reference/adaptations.json`. Put each sentence the file adds in `sentences` and each pstack sentence it drops in `dropped`. Give each entry a group whose reason is written once in `groups` and is true for that sentence.
- A file with no Reference counterpart takes a `whole` entry when it is at any depth under `agents/`, `docs/guide/`, or a skill folder pstack has.
- Prefer leaving pstack's text alone. Put a Claude Code translation in [the map](docs/harness/claude-code.md) when a row can express it.

`.github/scripts/check-reference.mjs` diffs each file with the Reference in order. It fails on any of these:

- an added or dropped sentence that is not listed
- an entry the diff does not use
- a group with no reason or no entry
- a listed file that does not exist
- a Reference file with no local file, unless the map leaves out its skill
- a skill the map leaves out that exists

Run it locally against a clone of `cursor/plugins` that holds the pinned commit:

```sh
node .github/scripts/check-reference.mjs --reference <clone> --checks reference,toc,map
```

To move the Reference to a later pstack commit, change the commit everywhere it appears (`adaptations.json`, `map-copies.json`, `sync-reference.mjs`, the map, and `.github/workflows/validate.yml`), sync the changed files, and update their entries in one pull request.

## Workflow

- Work on a branch created from `main`, in its own git worktree.
- Land each unit of work as its own pull request into `main`. Stack a pull request on another only when it builds on that one.

## Before you commit

1. `claude plugin validate .` reports no errors.
2. The check-reference command above passes.

## The bump PR

Open a separate `chore: bump to <version>` pull request when what the plugin ships has changed since the last bump and installs should get it. Bump `version` in `.claude-plugin/plugin.json` once. Installs from GitHub update only when the version changes. Never set `version` in `marketplace.json`.
