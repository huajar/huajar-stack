#!/bin/sh
# Prints one half of the Claude Code map when a huajar-stack skill is in the session
# and the map is not already in context since the last compaction.
# $1 is "head" or "tail". $2 is the hook event: PostToolUse needs the text wrapped in JSON,
# and SessionStart after a compaction looks in the transcript, since the new prompt names no skill.
input=$(cat)
transcript=$(printf '%s' "$input" | sed -n 's/.*"transcript_path": *"\([^"]*\)".*/\1/p' | sed 's/\\\\/\//g')
if [ "$2" = SessionStart ]; then
  grep -Eq '<command-name>/huajar-stack:|"skill": *"huajar-stack:' "$transcript" 2>/dev/null || exit 0
else
  printf '%s' "$input" | grep -Eq '"prompt": *"/huajar-stack:|"skill": *"huajar-stack:' || exit 0
  if [ -f "$transcript" ] && ! awk '/"subtype":"compact_boundary"/ { seen = 0 }
      /"hookName":"/ && /# huajar-stack in Claude Code/ { seen = 1 }
      END { exit seen }' "$transcript"; then
    exit 0
  fi
fi
map="$(dirname "$0")/../docs/harness/claude-code.md"
half() {
  if [ "$1" = head ]; then sed '/^## Paths/,$d' "$map"; else sed -n '/^## Paths/,$p' "$map"; fi | tr -d '\r'
}
if [ "$2" = PostToolUse ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"'
  half "$1" | awk '{ gsub(/\\/, "\\\\"); gsub(/"/, "\\\""); printf "%s\\n", $0 }'
  printf '"}}\n'
else
  half "$1"
fi
