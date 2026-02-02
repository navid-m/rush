import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

export interface Commit {
    hash: string;
    author: string;
    date: Date;
    message: string;
    filesChanged: number;
    insertions: number;
    deletions: number;
}

export class GitParser {
    private repoPath: string;

    constructor(repoPath: string) {
        this.repoPath = repoPath;
    }

    isValidRepo(): boolean {
        const gitPath = join(this.repoPath, ".git");
        return existsSync(gitPath);
    }

    async getCommits(): Promise<Commit[]> {
        try {
            const format = "%H|%an|%at|%s";
            const logCommand = `git -C "${this.repoPath}" log --all --format="${format}" --shortstat --reverse`;

            const output = execSync(logCommand, {
                encoding: "utf-8",
                maxBuffer: 10 * 1024 * 1024,
            });

            return this.parseCommits(output);
        } catch (error) {
            throw new Error(`Failed to read git history: ${error}`);
        }
    }

    private parseCommits(output: string): Commit[] {
        const commits: Commit[] = [];
        const lines = output.split("\n");

        let currentCommit: Partial<Commit> | null = null;

        for (const line of lines) {
            if (!line.trim()) continue;

            if (line.includes("|")) {
                if (currentCommit && currentCommit.hash) {
                    commits.push(currentCommit as Commit);
                }

                const [hash, author, timestamp, message] = line.split("|");
                currentCommit = {
                    hash,
                    author,
                    date: new Date(parseInt(timestamp) * 1000),
                    message,
                    filesChanged: 0,
                    insertions: 0,
                    deletions: 0,
                };
            } else if (currentCommit && line.includes("changed")) {
                const filesMatch = line.match(/(\d+) files? changed/);
                const insertionsMatch = line.match(/(\d+) insertions?/);
                const deletionsMatch = line.match(/(\d+) deletions?/);

                if (filesMatch)
                    currentCommit.filesChanged = parseInt(filesMatch[1]);
                if (insertionsMatch)
                    currentCommit.insertions = parseInt(insertionsMatch[1]);
                if (deletionsMatch)
                    currentCommit.deletions = parseInt(deletionsMatch[1]);
            }
        }

        if (currentCommit && currentCommit.hash) {
            commits.push(currentCommit as Commit);
        }

        return commits;
    }

    getRepoName(): string {
        return this.repoPath.split("/").pop() || "repository";
    }
}
