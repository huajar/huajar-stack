#!/bin/sh
# Prints one half of the Claude Code map when a huajar-stack skill starts
# and the map is not already in context since the last compaction.
# $1 is "head" or "tail". $2 is the hook event: PostToolUse needs the text wrapped in JSON,
# and SessionStart after a compaction looks in the transcript, since no skill starts then.
input=$(cat)
root="$(dirname "$0")/.."
half=$1
event=$2
# A typed command arrives resolved to its plugin, as "command_name":"huajar-stack:tdd" for /tdd,
# and the transcript records it as <command-name>/huajar-stack:tdd. A bare Skill call keeps its
# bare commandName, so a bare name counts only for a skill the model may call. All are fixed strings.
set -- -e '"command_name":"huajar-stack:' -e '"commandName":"huajar-stack:' -e '<command-name>/huajar-stack:'
while IFS= read -r file; do
  dir=${file%/SKILL.md}
  [ -n "$file" ] && set -- "$@" -e "\"commandName\":\"${dir##*/}\""
done <<EOF
$(grep -L '^disable-model-invocation: true' "$root"/skills/*/SKILL.md)
EOF
transcript=$(printf '%s' "$input" | sed -n 's/.*"transcript_path": *"\([^"]*\)".*/\1/p' | sed 's/\\\\/\//g')
if [ "$event" = SessionStart ]; then
  grep -qF "$@" "$transcript" 2>/dev/null || exit 0
else
  printf '%s' "$input" | grep -qF "$@" || exit 0
  if [ -f "$transcript" ] && ! awk '/"subtype":"compact_boundary"/ { seen = 0 }
      /"hookName":"/ && /# huajar-stack in Claude Code/ { seen = 1 }
      END { exit seen }' "$transcript"; then
    exit 0
  fi
fi
map="$root/docs/harness/claude-code.md"
print_half() {
  if [ "$half" = head ]; then sed '/^## Paths/,$d' "$map"; else sed -n '/^## Paths/,$p' "$map"; fi | tr -d '\r'
}
if [ "$event" = PostToolUse ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"'
  print_half | awk '{ gsub(/\\/, "\\\\"); gsub(/"/, "\\\""); printf "%s\\n", $0 }'
  printf '"}}\n'
else
  print_half
fi
