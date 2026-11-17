#!/usr/bin/env bash
git fetch -q origin main 2>/dev/null
main=$(MSYS_NO_PATHCONV=1 git show origin/main:.claude-plugin/plugin.json 2>/dev/null | tr -d '\r\n' | sed -n 's/.*"version": *"\([^"]*\)".*/\1/p')
installed=$(cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/installed_plugins.json" 2>/dev/null | tr -d '\r\n' |
  sed -n 's/.*"huajar-stack@huajar-stack": *\[ *{[^}]*"version": *"\([^"]*\)".*/\1/p')
[ -n "$main" ] && [ -n "$installed" ] && [ "$main" != "$installed" ] || exit 0
cat <<EOF
The installed huajar-stack is $installed, but main is $main. Skills and playbooks read from the installed copy are stale. Tell the operator to run these commands, then /reload-plugins in this session:
  claude plugin marketplace update huajar-stack
  claude plugin update huajar-stack@huajar-stack
EOF
