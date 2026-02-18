#!/bin/zsh
set -euo pipefail

# Directory of your script
BASE_DIR="$HOME/WebstormProjects/jobs_scrape"

# Track last run date in a small file
LAST_RUN_FILE="$BASE_DIR/.last_run_date"

TODAY=$(date +"%Y-%m-%d")

# ------ Once-per-day guard (run at most once per calendar day)
if [[ -f "$LAST_RUN_FILE" ]]; then
  LAST_RUN=$(cat "$LAST_RUN_FILE")
  if [[ "$LAST_RUN" == "$TODAY" ]]; then
    echo "Already ran today ($TODAY). Exiting."
    exit 0
  fi
fi

# ------ Time window guard (run only between xx:xx and xx:xx)
HOUR=$(date +%H)        # 00..23 (local time)
MIN=$(date +%M)         # 00..59 (not strictly needed, but available)
if [[ "$HOUR" -lt 17 || "$HOUR" -gt 23 ]]; then
  echo "[$(date)] Outside allowed window (17:00–23:59). Skipping." >> "$LOG"
  exit 0
fi

# Record today's date before running
echo "$TODAY" > "$LAST_RUN_FILE"


# ---- Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use --silent 23.4.0   # or whatever version you use

PROJECT="$HOME/WebstormProjects/jobs_scrape"
LOG="$PROJECT/schedule.log"
OUT_ALL="$PROJECT/jobs.csv"
OUT_UNIQUE="$PROJECT/unique_jobs.csv"

cd "$PROJECT"

{
  echo "=== $(date) ==="
  echo "node: $(command -v node)  v$(node -v)"
  echo "cwd:  $(pwd)"

  # run the scraper (pick one)
  # npx ts-node scrape.ts
  /usr/bin/env npx ts-node scrape.ts

  # small summary (optional; adjust to your script's real counts)
  UNIQUE_COUNT=$( (wc -l < "$OUT_UNIQUE" || echo 0) | tr -d ' ' )
  echo "Unique rows (approx, including header if any): $UNIQUE_COUNT"

  # --- macOS notification
  osascript -e "display notification \"Unique: $UNIQUE_COUNT\" with title \"JobScraper\" subtitle \"Daily scrape done\""

} >> "$LOG" 2>&1

