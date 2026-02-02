import { resolve } from "path";
import { GitParser } from "./git-parser";
import { Visualizer } from "./visualizer";
import { AnimationServer } from "./server";

async function main() {
    console.clear();
    const args = process.argv.slice(2);
    const repoPath = args.length > 0 ? resolve(args[0]) : process.cwd();

    console.log(`\x1b[33mRepository:\x1b[0m ${repoPath}\n`);

    const parser = new GitParser(repoPath);

    if (!parser.isValidRepo()) {
        console.error("\x1b[31mError:\x1b[0m Not a valid git repository");
        console.log("\nUsage:");
        console.log("  rush              # Current directory");
        console.log("  rush /path/to/repo  # Specific repository");
        process.exit(1);
    }

    console.log("\x1b[36mAnalyzing commit history...\x1b[0m");

    let commits;
    try {
        commits = await parser.getCommits();
    } catch (error) {
        console.error("\x1b[31mError reading commits:\x1b[0m", error);
        process.exit(1);
    }

    if (commits.length === 0) {
        console.error("\x1b[31mError:\x1b[0m No commits found in repository");
        process.exit(1);
    }

    console.log(`\x1b[32m✓\x1b[0m Found ${commits.length} commits\n`);

    const visualizer = new Visualizer(commits);

    console.log(visualizer.getStats());

    console.log("\x1b[36mStarting animation server...\x1b[0m");
    const server = new AnimationServer();
    const port = await server.start();

    console.log(
        `\x1b[32m✓\x1b[0m Server running at \x1b[1mhttp://localhost:${port}\x1b[0m\n`,
    );
    console.log("\x1b[33mControls:\x1b[0m");
    console.log("  SPACE     - Pause/Resume animation");
    console.log("  +         - Increase speed");
    console.log("  -         - Decrease speed");
    console.log("  R         - Restart animation");
    console.log("  Ctrl+C    - Exit\n");

    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");

        process.stdin.on("data", (key: string) => {
            if (key === "\u0003") {
                console.log("\n\n\x1b[36mShutting down...\x1b[0m");
                server.stop();
                process.exit(0);
            }

            if (key === " ") {
                visualizer.togglePause();
            }

            if (key === "+" || key === "=") {
                const currentSpeed = visualizer["speed"];
                visualizer.setSpeed(currentSpeed + 0.5);
                console.log(
                    `\x1b[33mSpeed:\x1b[0m ${visualizer["speed"].toFixed(1)}x`,
                );
            }

            if (key === "-" || key === "_") {
                const currentSpeed = visualizer["speed"];
                visualizer.setSpeed(currentSpeed - 0.5);
                console.log(
                    `\x1b[33mSpeed:\x1b[0m ${visualizer["speed"].toFixed(1)}x`,
                );
            }

            if (key.toLowerCase() === "r") {
                visualizer.restart();
                hasCompleted = false;
                console.log("\x1b[36mAnimation restarted\x1b[0m");
            }
        });
    }

    let frameCount = 0;
    const fps = 75;
    const frameTime = 1000 / fps;

    console.log("\x1b[32m▶ Animation started\x1b[0m");

    let hasCompleted = false;
    const interval = setInterval(() => {
        const { html, completed } = visualizer.update();
        server.updateFrame(html);

        frameCount++;

        if (frameCount % fps === 0 && !completed) {
            const progress =
                (visualizer["currentCommitIndex"] / commits.length) * 100;
            const files = visualizer["particles"].length;

            process.stdout.write(
                `\r\x1b[K\x1b[36mProgress:\x1b[0m ${progress.toFixed(1)}% | ` +
                    `\x1b[36mCommit:\x1b[0m ${visualizer["currentCommitIndex"]}/${commits.length} | ` +
                    `\x1b[36mFiles:\x1b[0m ${files}`,
            );
        }

        if (completed && !hasCompleted) {
            hasCompleted = true;
            console.log("\n\n\x1b[32mAnimation complete.\x1b[0m");
            console.log("Press R to restart or Ctrl+C to exit");
        }
    }, frameTime);

    process.on("SIGINT", () => {
        clearInterval(interval);
        console.log("\n\n\x1b[36mShutting down...\x1b[0m");
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
                // Ignore.
            }
        }
    };

    setTimeout(openBrowser, 200);
}

main().catch(console.error);
