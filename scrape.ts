import got from "got";
import * as cheerio from "cheerio";
import {csv2json, json2csv} from 'json-2-csv';
import fs from 'fs';
import {exec} from "node:child_process";
import {CheerioAPI} from "cheerio";


let page = 1

let scrapeURL = `https://www.jobs.cz/prace/?q%5B%5D=angular&q%5B%5D=web&q%5B%5D=v%C3%BDvoj%C3%A1%C5%99&q%5B%5D=react&q%5B%5D=web%20developer&q%5B%5D=data%20analyst&q%5B%5D=data&q%5B%5D=sql&q%5B%5D=mac&profession%5B%5D=201100249&profession%5B%5D=201100619&profession%5B%5D=201100271&page=${page}`

type Job = { id: number, title: string; url: string, locality: string }

const jobs: Job[] = [];
let jobsFilteredTemp: Job[] = [];

const searchCriteria = ["Angular", "Programátor", "Vývojář", "React", "Web developer", "Developer", "Software Developer", "HTML", "Javascript", "Typescript", "Software Engineer", "Frontend", "Datový analytik", "Data analyst", "Databáze", "SQL", "SW", "Backend", "Řidič", "IT Konzultant", "Data engineer"]
const excludeJobsKeywords = [ ".NET", "C#", "Senior", "PLC", "Embedded", "C++", "Experienced",]

let assignPageQueryParamToURL = () => {
    scrapeURL = `https://www.jobs.cz/prace/?q%5B%5D=angular&q%5B%5D=web&q%5B%5D=v%C3%BDvoj%C3%A1%C5%99&q%5B%5D=react&q%5B%5D=web%20developer&q%5B%5D=data%20analyst&q%5B%5D=data&q%5B%5D=sql&q%5B%5D=mac&profession%5B%5D=201100249&profession%5B%5D=201100619&profession%5B%5D=201100271&page=${page}`
};

async function scrape() {
    // Get the HTML of the page
    const html = await fetchHtml();

    // Load the HTML as a Cheerio object
    const $ = cheerio.load(html);

    getJobs($);

    // If next page button is missing, the current page is the last page
    if (isLastPage($)) {
        await applySearchCriteria()
    } else return

    incrementPage()
}

function incrementPage() {
    page++
    assignPageQueryParamToURL()
    scrape().catch(console.error);
}

async function applySearchCriteria() {
    const newJobsNormalized: Job[] = jobs.map(job => {
        return {
            id: job.id,
            title: job.title.toLowerCase(),
            url: job.url,
            locality: job.locality
        }
    })

    newJobsNormalized.forEach(job => {
        searchCriteria.forEach(criteria => {
            const criteriaNormalized = criteria.toLowerCase()
            if (job.title.includes(criteriaNormalized)) {
                jobsFilteredTemp.push(job)
            }
        })
    })

    const jobsFilteredForbiddenJobs = jobsFilteredTemp.filter(job => {
        const containsForbiddenKeyword = excludeJobsKeywords.some(keyword => {
            return job.title.includes(keyword.toLowerCase())
        })
        return !containsForbiddenKeyword
    })

    await findUniqueJobsAndSaveToCsv(jobsFilteredForbiddenJobs)
}

function readJobsCsv(filePath: string): Job[] {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        console.log("No CSV file found yet — starting fresh.");
        return [];
    }
    // Read file content
    const csv = fs.readFileSync(filePath, "utf8").trim();
    // If the file is empty or has only whitespace, skip parsing
    if (!csv) {
        console.log("CSV file is empty — nothing to parse yet.");
        return [];
    }
    // Parse safely
    try {
        const parsed = csv2json(csv) as Job[];
        console.log(`Loaded ${parsed.length} previously scraped jobs.`);
        return parsed;
    } catch (err) {
        console.error("Failed to parse jobs.csv:", err);
        return [];
    }
}

// Finds unique jobs, saves them to dedicated CSV and to the CSV that contains all historically scraped relevant jobs
async function findUniqueJobsAndSaveToCsv(newJobsFiltered: Job[]) {
    // Read the content of the file containing entire scrape history and convert to JSON (in-memory)
    const allAlreadyScrapedJobs = readJobsCsv("jobs.csv")
    // Creates a simple Set of job IDs that is used to determine unique jobs below
    const existingIds = new Set(allAlreadyScrapedJobs.map(job => {
        return job.id
    }));
    // Gets the unique jobs
    const uniqueJobs = findUniqueJobs(newJobsFiltered, existingIds)
    // Merge the new, unseen jobs to all seen jobs records and save -- the current content of jobs.csv (all historically scraped relevant records)
    // must be first pulled into the memory, converted into JSON, merged with the new unique records and saved back to the jobs.csv,
    // which will now contain the updated historical records
    const mergeNewJobsToAlreadyScrapedJobs = allAlreadyScrapedJobs.concat(uniqueJobs)
    saveToCsv(mergeNewJobsToAlreadyScrapedJobs, uniqueJobs)
    // Opens excel spreadsheet with the unique jobs
    exec('open -a "Microsoft Excel" "unique_jobs.csv"');
}

// Find whether the new scrape contains jobs that were already scraped in the past - filter them out
function findUniqueJobs(newJobsFiltered: Job[], existingIds: Set<number>){
    return newJobsFiltered.filter(job => {
        return !existingIds.has(job.id)
    });
}

function saveToCsv(allJobs: Job[], uniqueJobs: Job[]) {
    fs.writeFileSync("jobs.csv", '\uFEFF' + json2csv(allJobs), {encoding: "utf-8"})
    fs.writeFileSync("unique_jobs.csv", '\uFEFF' + json2csv(uniqueJobs), {encoding: "utf-8"})
}

async function fetchHtml(){
    return got(scrapeURL, {
        headers: {
            "user-agent": "Mozilla/5.0 (JobScraper/1.0)",
            "accept-language": "cs,en;q=0.9",
        },
    }).text();
}

function getJobs($: CheerioAPI){
    const $listing = $(".SearchResultCard")

    $listing.each((_, listing) => {
        const $listingTitle = $(listing).find(".SearchResultCard__header").find(".SearchResultCard__title").text().trim()
        const $link = $(listing).find(".SearchResultCard__header").find(".SearchResultCard__title").find("a").first().attr("href");
        const $jobId = $(listing).find(".SearchResultCard__header").find(".SearchResultCard__title").find("a").first().attr("data-jobad-id");
        let locality = ""
        jobs.push({
            id: parseInt($jobId as string) ? parseInt($jobId as string) : 0,
            title: $listingTitle,
            url: $link ? $link : "No link found",
            locality: locality
        })
    })

}

function isLastPage($: CheerioAPI){
    const $nextPageButton = $(".Pagination__button--next")

    if ($nextPageButton.length === 0) {
        console.log("Page overflow or last page")
        return true
    }else return false

}

scrape().catch(console.error);
