import got from "got";
import * as cheerio from "cheerio";
import {json2csv} from 'json-2-csv';
import {csv2json} from 'json-2-csv';
import fs from 'fs';
import {exec} from "node:child_process";

type Job = { id: number, title: string; url: string }

let page = 1

const jobs: Job[] = [];
let jobsFiltered: Job[] = [];

const searchCriteria = ["Angular", "Programátor", "Vývojář", "React", "Web developer", "Developer", "Software Developer", "HTML", "Javascript", "Typescript", "Software Engineer", "Frontend"]
const excludeJobsKeywords = ["Salesforce", "Java", ".NET", "C#", "Senior", "Kotlin", "PLC", "Embedded", "C++", "Shopify", "Experienced",]
let scrapeURL = `https://www.jobs.cz/prace/praha/programator/?q%5B0%5D=angular&q%5B1%5D=web&q%5B2%5D=v%C3%BDvoj%C3%A1%C5%99&q%5B3%5D=react&q%5B4%5D=web%20developer&locality%5Bcode%5D=R200000&locality%5Blabel%5D=Praha&locality%5Bcoords%5D=50.08455,14.41778&locality%5Bradius%5D=0&profession%5B0%5D=201100249&page=${page}`

let assignPageQueryParamToURL = (p: number) => {
    scrapeURL = `https://www.jobs.cz/prace/praha/programator/?q%5B0%5D=angular&q%5B1%5D=web&q%5B2%5D=v%C3%BDvoj%C3%A1%C5%99&q%5B3%5D=react&q%5B4%5D=web%20developer&locality%5Bcode%5D=R200000&locality%5Blabel%5D=Praha&locality%5Bcoords%5D=50.08455,14.41778&locality%5Bradius%5D=0&profession%5B0%5D=201100249&page=${p}`
};

async function scrape() {
    // Get the HTML of the page
    const html = await got(scrapeURL, {
        headers: {
            "user-agent": "Mozilla/5.0 (JobScraper/1.0)",
            "accept-language": "cs,en;q=0.9",
        },
    }).text();
    // Load the HTML as a Cheerio object
    const $ = cheerio.load(html);
    // Get the selector of the job listing titles
    const $listingTitleElements = $(".SearchResultCard__title")
    // Get the ID, title and job listing detail URL and add it to the array of found jobs
    $listingTitleElements.each((_, listing) => {
        const $listingTitle = $(listing).text().trim();
        const $link = $(listing).find("a").first().attr("href");
        const $jobId = $(listing).find("a").first().attr("data-jobad-id");
        jobs.push({
            id: parseInt($jobId as string) ? parseInt($jobId as string) : 0,
            title: $listingTitle,
            url: $link ? $link : "No link found"
        });
    })

    const $nextPageButton = $(".Pagination__button--next")
    // If next page button is missing, the current page is the last page
    if ($nextPageButton.length === 0) {
        console.log("Page overflow or last page")
        await applySearchCriteria()
        return
    }
    incrementPage()
}

function incrementPage() {
    page++
    assignPageQueryParamToURL(page)
    scrape().catch(console.error);
}

async function applySearchCriteria() {
    let jobsFilteredTemp: Job[] = []
    // Normalize the job.title to lowercase
    const newJobsNormalized: Job[] = jobs.map(job => {
        return {
            id: job.id,
            title: job.title.toLowerCase(),
            url: job.url
        }
    })
    // Apply the search criteria
    newJobsNormalized.forEach(job => {
        searchCriteria.forEach(criteria => {
            const criteriaNormalized = criteria.toLowerCase()
            if (job.title.includes(criteriaNormalized)) {
                jobsFiltered.push(job)
            }
        })
    })
    // Filter out jobs that contain forbidden keyword from the array
    const ggg = jobsFiltered.filter(job => {
        console.log("SSSSSSSSSSSSSSS")
        const containsForbiddenKeyword = excludeJobsKeywords.some(keyword => {
            console.log("MMMMMMMMMMMMMMMMMMMMM")
            console.log(keyword, job.title, job.title.includes(keyword.toLowerCase()))
            return job.title.includes(keyword.toLowerCase())
        })
        console.log(
            !containsForbiddenKeyword)
        return !containsForbiddenKeyword
    })
    await findUniqueJobsAndSaveToCsv(ggg)
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
    // Read the content of the file and convert to JSON (in-memory)
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
    // const ws = XLSX.utils.json_to_sheet(uniqueJobs); // [{id,title,url}, ...]
    // const wb = XLSX.utils.book_new();
    // XLSX.utils.book_append_sheet(wb, ws, "Jobs");
    // XLSX.writeFile(wb, "unique_jobs.xlsx");          // diacritics preserved
}

scrape().catch(console.error);
