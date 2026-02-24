#!/bin/bash
# PostToolUse hook: Auto-lint JS files with ESLint after edits
# Matcher: Edit|Write

input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [[ "$file" == *.js ]] && [[ -f "$file" ]]; then
  cd "/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR"
  result=$(npx eslint "$file" 2>&1)
  if [ $? -ne 0 ]; then
    echo "ESLint issues in $(basename "$file"):"
    echo "$result"
  fi
fi
