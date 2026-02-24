#!/bin/bash
# Stop hook: Log session end to session activity log
# Matcher: (empty - matches all)

dir="/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR/.agents/work-sessions/$(date '+%Y-%m-%d')"
mkdir -p "$dir"
echo "[$(date '+%Y-%m-%d %H:%M IST')] Agent session ended" >> "$dir/session-activity.log"
