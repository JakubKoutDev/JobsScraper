import {Job} from "../scrape";

export const searchCriteria = ["Angular", "Programátor", "Vývojář", "React", "Web developer", "Developer", "Software Developer", "HTML", "Javascript", "Typescript", "Software Engineer", "Frontend", "Datový analytik", "Data analyst", "Databáze", "SQL", "SW", "Backend", "Řidič", "IT Konzultant", "Data engineer"]
export const excludeJobsKeywords = [".NET", "C#", "Senior", "PLC", "Embedded", "C++", "Experienced",]
export const jobs: Job[] = [];
export const headers = {
    "user-agent": "Mozilla/5.0 (JobScraper/1.0)",
    "accept-language": "cs,en;q=0.9",
}
export const allJobsCsvFilePath = "jobs.csv";
export const uniqueJobsCsvFilePath = "unique_jobs.csv"
export const scrapeUrlWithoutPageQueryParam = "https://www.jobs.cz/prace/?q%5B%5D=angular&q%5B%5D=web&q%5B%5D=v%C3%BDvoj%C3%A1%C5%99&q%5B%5D=react&q%5B%5D=web%20developer&q%5B%5D=data%20analyst&q%5B%5D=data&q%5B%5D=sql&q%5B%5D=mac&profession%5B%5D=201100249&profession%5B%5D=201100619&profession%5B%5D=201100271&page="