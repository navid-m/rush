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
            // Get commit history with stats
            const format = "%H|%an|%at|%s";
            const logCommand = `git -C "${this.repoPath}" log --all --format="${format}" --shortstat --reverse`;

            const output = execSync(logCommand, {
                encoding: "utf-8",
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
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

            // Check if this is a commit line (contains pipe separators)
            if (line.includes("|")) {
                // Save previous commit if exists
                if (currentCommit && currentCommit.hash) {
                    commits.push(currentCommit as Commit);
                }

                // Parse new commit
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
                // Parse stats line: " 5 files changed, 120 insertions(+), 45 deletions(-)"
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

        // Add the last commit
        if (currentCommit && currentCommit.hash) {
            commits.push(currentCommit as Commit);
        }

        return commits;
    }

    getRepoName(): string {
        return this.repoPath.split("/").pop() || "repository";
    }
}
