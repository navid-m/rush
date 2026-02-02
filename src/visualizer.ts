import * as d3 from "d3";
import { JSDOM } from "jsdom";
import type { Commit } from "./git-parser";

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
    commit: Commit;
}

export class Visualizer {
    private width = 1200;
    private height = 800;
    private particles: Particle[] = [];
    private frameCount = 0;
    private currentCommitIndex = 0;
    private commits: Commit[];
    private speed = 1;
    private isPaused = false;
    private dom: JSDOM;
    private svg: any;
    private authorColors: Map<string, string>;

    constructor(commits: Commit[]) {
        this.commits = commits;
        this.authorColors = this.generateAuthorColors();
        this.dom = new JSDOM("<!DOCTYPE html><body></body>");
        this.setupSVG();
    }

    private generateAuthorColors(): Map<string, string> {
        const authors = [...new Set(this.commits.map((c) => c.author))];
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        const colorMap = new Map<string, string>();

        authors.forEach((author, i) => {
            colorMap.set(author, colorScale(i.toString()));
        });

        return colorMap;
    }

    private setupSVG(): void {
        const document = this.dom.window.document;
        const body = d3.select(document.body);

        this.svg = body
            .append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .attr("style", "background: #000000");

        this.svg.append("g").attr("class", "particles");

        this.svg
            .append("text")
            .attr("class", "info")
            .attr("x", 20)
            .attr("y", 30)
            .attr("fill", "#ffffff")
            .attr("font-family", "monospace")
            .attr("font-size", "14px");

        this.svg
            .append("text")
            .attr("class", "controls")
            .attr("x", 20)
            .attr("y", this.height - 20)
            .attr("fill", "#888888")
            .attr("font-family", "monospace")
            .attr("font-size", "12px")
            .text("Controls: [SPACE] pause/resume | [+/-] speed | [R] restart");
    }

    private project3D(
        x: number,
        y: number,
        z: number,
    ): { x: number; y: number; scale: number } {
        const perspective = 600;
        const scale = perspective / (perspective + z);

        return {
            x: this.width / 2 + x * scale,
            y: this.height / 2 + y * scale,
            scale,
        };
    }

    private createParticlesForCommit(commit: Commit): void {
        const baseCount = Math.max(3, Math.floor(commit.filesChanged * 2));
        const intensityMultiplier =
            1 + (commit.insertions + commit.deletions) / 500;
        const particleCount = Math.floor(baseCount * intensityMultiplier);

        const color = this.authorColors.get(commit.author) || "#ffffff";

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const elevation = (Math.random() - 0.5) * Math.PI;
            const speed = 1 + Math.random() * 2;

            this.particles.push({
                id: `${commit.hash}-${i}`,
                x: 0,
                y: 0,
                z: 0,
                vx: Math.cos(angle) * Math.cos(elevation) * speed,
                vy: Math.sin(elevation) * speed,
                vz: Math.sin(angle) * Math.cos(elevation) * speed,
                color,
                size: 2 + Math.random() * 3,
                age: 0,
                maxAge: 100 + Math.random() * 100,
                commit,
            });
        }
    }

    private updateParticles(): void {
        this.particles = this.particles.filter((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;
            p.age++;

            // Add some gravity and friction
            p.vy += 0.02;
            p.vx *= 0.99;
            p.vy *= 0.99;
            p.vz *= 0.99;

            return p.age < p.maxAge;
        });
    }

    private render(): string {
        const currentCommit = this.commits[this.currentCommitIndex - 1];
        let infoText = `Commits: ${this.currentCommitIndex}/${this.commits.length} | `;
        infoText += `Particles: ${this.particles.length} | `;
        infoText += `Speed: ${this.speed.toFixed(1)}x`;

        if (this.isPaused) {
            infoText += " | PAUSED";
        }

        if (currentCommit) {
            infoText += `\n${currentCommit.date.toLocaleDateString()} - ${currentCommit.author}: ${currentCommit.message.substring(0, 60)}`;
        }

        this.svg.select(".info").text(infoText);

        const sortedParticles = [...this.particles].sort((a, b) => b.z - a.z);

        const circles = this.svg
            .select(".particles")
            .selectAll("circle")
            .data(sortedParticles, (d: any) => d.id);

        circles
            .enter()
            .append("circle")
            .attr("r", (d: Particle) => d.size)
            .attr("fill", (d: Particle) => d.color);

        this.svg
            .select(".particles")
            .selectAll("circle")
            .attr("cx", (d: Particle) => {
                const proj = this.project3D(d.x, d.y, d.z);
                return proj.x;
            })
            .attr("cy", (d: Particle) => {
                const proj = this.project3D(d.x, d.y, d.z);
                return proj.y;
            })
            .attr("r", (d: Particle) => {
                const proj = this.project3D(d.x, d.y, d.z);
                return d.size * proj.scale;
            })
            .attr("opacity", (d: Particle) => {
                const ageFactor = 1 - d.age / d.maxAge;
                return ageFactor * 0.8;
            });

        circles.exit().remove();

        return this.svg.node().outerHTML;
    }

    public setSpeed(speed: number): void {
        this.speed = Math.max(0.1, Math.min(10, speed));
    }

    public togglePause(): void {
        this.isPaused = !this.isPaused;
    }

    public restart(): void {
        this.currentCommitIndex = 0;
        this.particles = [];
        this.frameCount = 0;
    }

    public update(): { html: string; completed: boolean } {
        if (this.isPaused) {
            return { html: this.render(), completed: false };
        }

        this.frameCount++;

        const commitInterval = Math.floor(30 / this.speed);
        if (
            this.frameCount % commitInterval === 0 &&
            this.currentCommitIndex < this.commits.length
        ) {
            this.createParticlesForCommit(
                this.commits[this.currentCommitIndex],
            );
            this.currentCommitIndex++;
        }

        this.updateParticles();

        const completed =
            this.currentCommitIndex >= this.commits.length &&
            this.particles.length === 0;

        return {
            html: this.render(),
            completed,
        };
    }

    public getStats(): string {
        const totalCommits = this.commits.length;
        const authors = new Set(this.commits.map((c) => c.author)).size;
        const firstCommit = this.commits[0]?.date;
        const lastCommit = this.commits[this.commits.length - 1]?.date;
        const duration =
            lastCommit && firstCommit
                ? Math.floor(
                      (lastCommit.getTime() - firstCommit.getTime()) /
                          (1000 * 60 * 60 * 24),
                  )
                : 0;

        return `
Repository Statistics:
  Total Commits: ${totalCommits}
  Contributors: ${authors}
  First Commit: ${firstCommit?.toLocaleDateString()}
  Last Commit: ${lastCommit?.toLocaleDateString()}
  Duration: ${duration} days
`;
    }
}
