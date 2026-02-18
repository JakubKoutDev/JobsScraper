import {describe, expect, it} from "vitest";
import {findUniqueJobs} from "../scrape.ts";

describe("findUniqueJobs", () => {
    it('should filter out jobs that already exist in the table', () => {
        const newJobs = [
            {id: 1, title: "a", url: "", locality: ""},
            {id: 2, title: "b", url: "", locality: ""}
        ]

        const existingJobs = [
            {id: 1, title: "a", url: "", locality: ""},
        ]

        const result = findUniqueJobs(newJobs, existingJobs);

        expect(result).toEqual([
            {id: 2, title: "b", url: "", locality: ""},
        ])
    });
})