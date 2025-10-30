**JobScraper**

A lightweight Node.js + TypeScript web scraper that automatically collects job listings from jobs.cz
, filters them by keywords, and exports the results into CSV/Excel files.

*Features*

Scrapes job listings from jobs.cz (configurable URL)
Keyword filtering — only keeps listings that include desired terms
Exclusion filtering — removes jobs containing unwanted words
Exports results to jobs.csv and unique_jobs.csv
Duplicate detection — only keeps unique jobs based on job ID

Built with:
- TypeScript
- Cheerio
 for HTML parsing
- Got
 for HTTP requests
- json-2-csv
- xlsx
 for Excel output

Optional macOS Automator app integration — run with a double-click.

Project structure

jobs_scrape/
│
├── scrape.ts          # Main scraping script
├── package.json       # Project metadata and dependencies
├── tsconfig.json      # TypeScript compiler configuration
├── jobs.csv           # All scraped jobs (auto-generated)
├── unique_jobs.csv    # New/unique jobs only (auto-generated)
└── .gitignore

Installation

Clone the repo:

git clone https://github.com/<your-username>/JobScraper.git
cd JobScraper

Install dependencies:

npm install

(Optional) Compile TypeScript:

npx tsc

Usage

Run with ts-node
npx ts-node scrape.ts

Or use the NPM script
npm run scrape


The script will:

Fetch job listings from jobs.cz
Filter by your defined search criteria and exclusions
Write results to jobs.csv and unique_jobs.csv
If configured, it will also open the results automatically in Excel (macOS only).

Configuration

Inside scrape.ts:

searchCriteria — an array of terms that must appear in the job title
excludeJobsKeywords — an array of words to exclude
scrapeURL — base URL for scraping (includes query params like keywords or city)
Pagination is handled automatically using the page parameter in the URL.

Example:

const searchCriteria = ["Senior", "React", "Angular"];
const excludeJobsKeywords = ["Junior", "Intern"];

Output files:
jobs.csv	Contains all jobs that matched your criteria
unique_jobs.csv	Contains only new (previously unseen) jobs

Both files are written with UTF-8 encoding and can be opened in Excel.

Automator Integration (macOS only)

You can run the scraper automatically using a macOS Automator app.

Example Automator shell script:

#!/bin/zsh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use --silent 20
cd "/Users/<you>/WebstormProjects/jobs_scrape"
npx ts-node scrape.ts
open "unique_jobs.csv"

Save it as an Automator Application → double-click to run your scraper anytime.

Notes

The scraper is designed for personal research/automation — avoid excessive request rates.

You can schedule periodic scraping using macOS Automator or cron.
