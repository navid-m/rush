import { resolve } from "path";
import { GitParser } from "./git-parser";
import { writeFileSync } from "fs";

interface Particle {
    id: string;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    color: string;
    size: number;
    age: number;
    maxAge: number;
    filename: string;
    author: string;
    commitHash: string;
    fileColor: string;
}

interface CommitData {
    hash: string;
    author: string;
    date: string;
    message: string;
    filesChanged: number;
    insertions: number;
    deletions: number;
    files: string[];
}

export class DataGenerator {
    private repoPath: string;
    private commits: CommitData[] = [];

    constructor(repoPath: string) {
        this.repoPath = repoPath;
    }

    async generateData(): Promise<void> {
        console.log(`\x1b[31mRepository:\x1b[0m ${this.repoPath}\n`);

        const parser = new GitParser(this.repoPath);

        if (!parser.isValidRepo()) {
            console.error("\x1b[31mError:\x1b[0m Not a valid git repository");
            process.exit(1);
        }

        try {
            const rawCommits = await parser.getCommits();
            const commitsWithFiles =
                await parser.getAllFilesForCommits(rawCommits);

            this.commits = commitsWithFiles.map((commit) => ({
                ...commit,
                date: commit.date.toISOString(),
            }));
        } catch (error) {
            console.error("\x1b[31mError reading commits:\x1b[0m", error);
            process.exit(1);
        }

        if (this.commits.length === 0) {
            console.error(
                "\x1b[31mError:\x1b[0mNo commits found in repository",
            );
            process.exit(1);
        }

        console.log(`\x1b[32m\x1b[0mFound ${this.commits.length} commits\n`);

        const jsonData = {
            commits: this.commits,
            metadata: {
                totalCommits: this.commits.length,
                authors: [...new Set(this.commits.map((c) => c.author))],
                firstCommitDate: this.commits[0]?.date,
                lastCommitDate: this.commits[this.commits.length - 1]?.date,
            },
        };

        writeFileSync("commits-data.json", JSON.stringify(jsonData, null, 2));
        console.log("\x1b[32m\x1b[0mCommit data saved to commits-data.json");
    }
}

export async function dgMain() {
    const args = process.argv.slice(2);
    const repoPath = args.length > 0 ? resolve(args[0]) : process.cwd();
    const generator = new DataGenerator(repoPath);
    await generator.generateData();
}

if (require.main === module) {
    dgMain().catch(console.error);
}
