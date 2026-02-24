#!/bin/bash
# UserPromptSubmit hook: Log user prompts to session activity log
# Matcher: (empty - matches all)

dir="/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR/.agents/work-sessions/$(date '+%Y-%m-%d')"
mkdir -p "$dir"
echo "[$(date '+%Y-%m-%d %H:%M IST')] User prompt received" >> "$dir/session-activity.log" 2>/dev/null
