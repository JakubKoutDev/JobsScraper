import got from "got";
import * as cheerio from "cheerio";
import {CheerioAPI} from "cheerio";
import {csv2json, json2csv} from 'json-2-csv';
import fs from 'fs';
import {exec} from "node:child_process";
import {
    allJobsCsvFilePath,
    excludeJobsKeywords,
    headers,
    scrapeUrlWithoutPageQueryParam,
    searchCriteria,
    uniqueJobsCsvFilePath
} from "./constants/constants";
import {AnyNode} from "domhandler";


export type Job = { id: number, title: string; url: string, locality: string }

async function runScraper() {
    const scrapedJobs = await scrapeAllPages()
    const existingJobs = await readAllExistingJobsCsv(allJobsCsvFilePath)
    const newJobsNormalized = normalizeNewJobsData(scrapedJobs)
    const newJobsFiltered = applySearchCriteria(newJobsNormalized)
    const uniqueJobs = findUniqueJobs(newJobsFiltered, existingJobs)
    const merged = [...existingJobs, ...uniqueJobs]
    await saveToCsv(merged, uniqueJobs)
    exec(`open -a "Microsoft Excel" ${uniqueJobsCsvFilePath}`);
}

async function scrapeAllPages() {

    let page = 1;
    let html: string = "";
    let consecutiveFailures = 0
    const collectedJobs: Job[] = [];

    while (true) {
        try {
            log("INFO", "Fetching page: " + page)
            html = await fetchHtml(page);
            consecutiveFailures = 0
        } catch (err) {
            log("ERROR", `Could not fetch ${page} page. Error: ${err}. Trying again`);
            consecutiveFailures++
            if (consecutiveFailures >= 3) {
                log("ERROR", `Too many consecutive failures fetching the HTML page. Aborting...`);
                // Throwing error instead of "break", because partial data is worse than no data in this case
                throw new Error("Fatal scrape failure")
            }

            await sleepWithJitterBetweenPages(3000)
            continue
        }


        const $ = cheerio.load(html);

        const jobsOnPage = getJobsOnCurrentPage($);
        collectedJobs.push(...jobsOnPage);

        // Purpose here is to check the first page. If there is zero listings on the first page, there is something seriously wrong, since it
        // is expected that every single page contains listings
        if (collectedJobs.length === 0) {
            log("ERROR", `No jobs found for this page`);
            throw new Error("No jobs found for this page");
        }

        log("INFO", "Collected and stored all listings on page: " + page)

        if (isLastPage($)) break;

        page++;

        if (page===5) return collectedJobs
        await sleepWithJitterBetweenPages(700)

        log("INFO", "Preparing to fetch page: " + page)
    }

    return collectedJobs;
}

// Push into an array only these new jobs that match the search criteria
function applySearchCriteria(newJobsNormalized: Job[]) {
    return filterForbiddenJobs(
        newJobsNormalized.filter(job =>
            searchCriteria.some(criteria =>
                job.title.includes(criteria.toLowerCase())
            )
        )
    );
}

async function readAllExistingJobsCsv(filePath: string): Promise<Job[]> {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        log("WARN", "No CSV file found yet — starting fresh.")
        return [];
    }
    // Read file content
    const csv = await fs.promises.readFile(filePath, "utf8").then(value => value.trim());
    // If the file is empty or has only whitespace, skip parsing
    if (!csv) {
        log("WARN", "CSV file is empty — nothing to parse yet.")
        return [];
    }
    // Parse safely
    try {
        return csv2json(csv) as Job[];
    } catch (err) {
        log("ERROR", `Failed to parse csv: ${filePath}. Error: ${err}`);
        return [];
    }
}

// Find whether the new scrape contains jobs that were already scraped in the past - filter them out
function findUniqueJobs(newJobsFiltered: Job[], existingJobs: Job[]): Job[] {
    // Read the content of the file containing entire scrape history and convert to JSON (in-memory)
    // const allAlreadyScrapedJobs = readJobsCsv(allJobsCsvFilePath)
    // Creates a simple Set of job IDs that is used to determine unique jobs below
    const existingIds = new Set(existingJobs.map(job => {
        return job.id
    }));

    return newJobsFiltered.filter(job => {
        return !existingIds.has(job.id)
    });
}

async function saveToCsv(allJobs: Job[], uniqueJobs: Job[]) {
    await fs.promises.writeFile(allJobsCsvFilePath, '\uFEFF' + json2csv(allJobs), {encoding: "utf-8"})
    await fs.promises.writeFile(uniqueJobsCsvFilePath, '\uFEFF' + json2csv(uniqueJobs), {encoding: "utf-8"})
}

async function fetchHtml(page: number) {
    let scrapeURL = `${scrapeUrlWithoutPageQueryParam}${page}`
    // const ddd = await async (url, options, n) => {}
    return got(scrapeURL, {
        timeout: {request: 10000},
        headers: headers,
        retry: {
            limit: 3,
            statusCodes: [500, 502, 503, 504],
            errorCodes: ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'],
            methods: ["GET"]
        }
    },).text();
}

function sleepWithJitterBetweenPages(base: number) {
    const jitter = Math.random() * 300;
    return new Promise(resolve => setTimeout(resolve, base + jitter));

}

// Gets jobs listings on every page iteration and populates the jobs array with these listings
function getJobsOnCurrentPage($: CheerioAPI): Job[] {
    const $listing = $(".SearchResultCard")
    const jobs: Job[] = []

    $listing.each((_, listing) => {
        const listingData = getListingDataFromHtml($, listing)
        if (!listingData.jobId) return; // skip if missing

        const id = Number(listingData.jobId);

        if (Number.isNaN(id)) return; // skip if invalid

        jobs.push({
            id,
            title: listingData.listingTitle,
            url: listingData.link ?? "No link found",
            locality: listingData.locality ?? "No locality found"
        })
    })


    return jobs;
}

function getListingDataFromHtml($: CheerioAPI, listing: AnyNode) {
    const $listingTitle = $(listing).find(".SearchResultCard__header").find(".SearchResultCard__title").text().trim()
    const $link = $(listing).find(".SearchResultCard__title a").first().attr("href");
    const $jobId = $(listing).find(".SearchResultCard__title a").first().attr("data-jobad-id");
    const $locality = $(listing).find(".SearchResultCard__footerList").find("li").eq(1).text().trim();

    return {listingTitle: $listingTitle, link: $link, jobId: $jobId, locality: $locality};
}

function isLastPage($: CheerioAPI) {
    const $nextPageButton = $(".Pagination__button--next")
    if ($nextPageButton.length === 0) {
        log("INFO", "Page overflow or last page")
        return true
    } else return false

}

// Goes through the whole jobs array and normalizes values
function normalizeNewJobsData(jobs: Job[]) {
    return jobs.map(job => {
        return {
            ...job,
            title: job.title.trim().toLowerCase(),
            url: job.url.trim(),
            locality: job.locality.trim(),
        } as Job
    })
}

function filterForbiddenJobs(jobsFiltered: Job[]) {
    return jobsFiltered.filter(job => {
        const containsForbiddenKeyword = excludeJobsKeywords.some(keyword => {
            return job.title.includes(keyword.toLowerCase())
        })
        return !containsForbiddenKeyword
    })
}

function log(level: "INFO" | "WARN" | "ERROR", message: string) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${level} ${message}`);
}

runScraper().catch(console.error);