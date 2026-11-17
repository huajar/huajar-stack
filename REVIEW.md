# Review rules

Quote the rule you flag.

- Everything under `skills/`, `agents/`, and `hooks/` ships to every install. Flag content there that names a specific project, a local path, or an account.
- Do not add a dependency on pstack or cursor-team-kit: no install step, import, or link they must provide at run time.
- When a pull request changes what ships, it also updates README.md's Repository layout to match.
