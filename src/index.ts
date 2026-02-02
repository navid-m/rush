import { resolve } from "path";
import { GitParser } from "./git-parser";
import { StaticFileServer } from "./static-server";
import { writeFileSync } from "fs";

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

async function main() {
    console.clear();
    const args = process.argv.slice(2);
    const repoPath = args.length > 0 ? resolve(args[0]) : process.cwd();

    console.log(`\x1b[31mRepository:\x1b[0m ${repoPath}\n`);

    const parser = new GitParser(repoPath);

    if (!parser.isValidRepo()) {
        console.error("\x1b[31mError:\x1b[0m Not a valid git repository");
        console.log("\nUsage:");
        console.log("  rush              # Current directory");
        console.log("  rush /path/to/repo  # Specific repository");
        process.exit(1);
    }

    let rawCommits;
    try {
        rawCommits = await parser.getCommits();
    } catch (error) {
        console.error("\x1b[31mError reading commits:\x1b[0m", error);
        process.exit(1);
    }

    if (rawCommits.length === 0) {
        console.error("\x1b[31mError:\x1b[0m No commits found in repository");
        process.exit(1);
    }

    const dataPromise = (async () => {
        const commitsWithFiles = await parser.getAllFilesForCommits(rawCommits);
        const commits = commitsWithFiles.map((commit) => ({
            ...commit,
            date: commit.date.toISOString(),
        }));
        const totalCommits = commits.length;
        const authors = new Set(commits.map((c) => c.author)).size;
        const firstCommit = new Date(commits[0]?.date);
        const lastCommit = new Date(commits[commits.length - 1]?.date);
        const duration =
            lastCommit && firstCommit
                ? Math.floor(
                      (lastCommit.getTime() - firstCommit.getTime()) /
                          (1000 * 60 * 60 * 24),
                  )
                : 0;

        console.log(`Total Commits: ${totalCommits}
Contributors: ${authors}
First Commit: ${firstCommit?.toLocaleDateString()}
Last Commit: ${lastCommit?.toLocaleDateString()}
Duration: ${duration} days
`);

        const jsonData = {
            commits: commits,
            metadata: {
                totalCommits: commits.length,
                authors: [...new Set(commits.map((c) => c.author))],
                firstCommitDate: commits[0]?.date,
                lastCommitDate: commits[commits.length - 1]?.date,
            },
        };

        writeFileSync("./commits-data.json", JSON.stringify(jsonData, null, 2));
    })();

    const server = new StaticFileServer();
    const port = await server.start(dataPromise);

    console.log(
        `\x1b[32m\x1b[0mServer running at \x1b[1mhttp://localhost:${port}\x1b[0m\n`,
    );
    process.on("SIGINT", () => {
        console.log("Bye");
        server.stop();
        process.exit(0);
    });

    const openBrowser = async () => {
        const url = `http://localhost:${port}`;
        const commands: { [key: string]: string } = {
            darwin: `open "${url}"`,
            linux: `xdg-open "${url}" || sensible-browser "${url}" || x-www-browser "${url}"`,
            win32: `start "${url}"`,
        };

        const command = commands[process.platform];
        if (command) {
            try {
                await Bun.$`${command}`.quiet();
            } catch {
                // Ignore browser open errors
            }
        }
    };

    setTimeout(openBrowser, 200);
}

main().catch(console.error);
