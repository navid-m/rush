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
    filename: string;
    author: string;
    commitHash: string;
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
            .attr(
                "style",
                "background: radial-gradient(circle at center, #0f0f1f 0%, #000000 100%)",
            );

        const defs = this.svg.append("defs");

        const gradient = defs
            .append("radialGradient")
            .attr("id", "depthGradient")
            .attr("cx", "50%")
            .attr("cy", "50%")
            .attr("r", "50%");

        gradient
            .append("stop")
            .attr("offset", "0%")
            .attr("style", "stop-color:#1a1a2e;stop-opacity:1");

        gradient
            .append("stop")
            .attr("offset", "100%")
            .attr("style", "stop-color:#000000;stop-opacity:1");

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
        const color = this.authorColors.get(commit.author) || "#ffffff";

        commit.files.forEach((filename, i) => {
            const angle = (i / commit.files.length) * Math.PI * 2;
            const elevation = (Math.random() - 0.5) * Math.PI * 0.5;
            const speed = 1.5 + Math.random() * 1.5;

            this.particles.push({
                id: `${commit.hash}-${filename}`,
                x: 0,
                y: 0,
                z: 0,
                vx: Math.cos(angle) * Math.cos(elevation) * speed,
                vy: Math.sin(elevation) * speed,
                vz: Math.sin(angle) * Math.cos(elevation) * speed,
                color,
                size: 3 + Math.random() * 2,
                age: 0,
                maxAge: 120 + Math.random() * 80,
                filename: filename.split("/").pop() || filename,
                author: commit.author,
                commitHash: commit.hash,
            });
        });
    }

    private updateParticles(): void {
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;
            p.age++;

            p.vy += 0.02;
            p.vx *= 0.99;
            p.vy *= 0.99;
            p.vz *= 0.99;
        }

        this.particles = this.particles.filter((p) => p.age < p.maxAge);
    }

    private render(): string {
        const currentCommit = this.commits[this.currentCommitIndex - 1];
        let infoText = `Commits: ${this.currentCommitIndex}/${this.commits.length} | `;
        infoText += `Files: ${this.particles.length} | `;
        infoText += `Speed: ${this.speed.toFixed(1)}x`;

        if (this.isPaused) {
            infoText += " | PAUSED";
        }

        if (currentCommit) {
            const date = currentCommit.date.toLocaleDateString();
            const time = currentCommit.date.toLocaleTimeString();
            infoText += `\n${date} ${time} - ${currentCommit.author}: ${currentCommit.message.substring(0, 50)}`;
        }

        this.svg.select(".info").text(infoText);

        const sortedParticles = [...this.particles].sort((a, b) => b.z - a.z);

        const visibleParticles = sortedParticles.filter((p) => {
            const proj = this.project3D(p.x, p.y, p.z);
            return (
                proj.x > -100 &&
                proj.x < this.width + 100 &&
                proj.y > -100 &&
                proj.y < this.height + 100
            );
        });

        const particleGroup = this.svg.select(".particles");
        const circles = particleGroup
            .selectAll("circle")
            .data(visibleParticles, (d: Particle) => d.id);

        circles.exit().remove();

        const newCircles = circles
            .enter()
            .append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", 0)
            .attr("fill", (d) => d.color)
            .attr("opacity", 0)
            .attr("stroke", "#fff")
            .attr("stroke-width", 0)
            .attr("stroke-opacity", 0);

        circles
            .merge(newCircles)
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
            .attr("fill", (d: Particle) => d.color)
            .attr("opacity", (d: Particle) => {
                const ageFactor = 1 - d.age / d.maxAge;
                const opacity = ageFactor * 0.9;
                return opacity > 0.1 ? opacity : 0;
            })
            .attr("stroke", "#fff")
            .attr("stroke-width", (d: Particle) => {
                const proj = this.project3D(d.x, d.y, d.z);
                return 0.5 * proj.scale;
            })
            .attr("stroke-opacity", (d: Particle) => {
                const ageFactor = 1 - d.age / d.maxAge;
                const opacity = ageFactor * 0.9;
                return opacity > 0.1 ? opacity * 0.5 : 0;
            });

        const texts = particleGroup.selectAll("text.label").data(
            visibleParticles.filter(
                (d) => d.age < 60 && this.project3D(d.x, d.y, d.z).scale > 0.8,
            ),
            (d: Particle) => d.id,
        );

        texts.exit().remove();

        const newTexts = texts
            .enter()
            .append("text")
            .attr("class", "label")
            .attr("x", 0)
            .attr("y", 0)
            .attr("fill", (d) => d.color)
            .attr("opacity", 0)
            .attr("font-size", "0px")
            .attr("font-family", "monospace")
            .text((d) => d.filename);

        texts
            .merge(newTexts)
            .attr("x", (d: Particle) => {
                const proj = this.project3D(d.x, d.y, d.z);
                return proj.x + (d.size + 2) * proj.scale;
            })
            .attr("y", (d: Particle) => {
                const proj = this.project3D(d.x, d.y, d.z);
                return proj.y - (d.size + 2) * proj.scale;
            })
            .attr("fill", (d: Particle) => d.color)
            .attr("opacity", (d: Particle) => {
                const ageFactor = 1 - d.age / d.maxAge;
                const opacity = ageFactor * 0.9;
                return opacity > 0.1 ? opacity * 0.8 : 0;
            })
            .attr("font-size", (d: Particle) => {
                const proj = this.project3D(d.x, d.y, d.z);
                return Math.max(8, 10 * proj.scale) + "px";
            });

        this.drawAuthorLegend();

        return this.svg.node().outerHTML;
    }

    private drawAuthorLegend(): void {
        const legendGroup = this.svg.selectAll(".legend").data([null]);
        const legend = legendGroup
            .enter()
            .append("g")
            .attr("class", "legend")
            .merge(legendGroup);

        legend.selectAll("*").remove();

        const activeAuthors = new Set(
            this.particles.filter((p) => p.age < 60).map((p) => p.author),
        );

        const authors = Array.from(activeAuthors);
        const legendX = this.width - 200;
        let legendY = 50;

        legend
            .append("text")
            .attr("x", legendX)
            .attr("y", legendY)
            .attr("fill", "#ffffff")
            .attr("font-family", "monospace")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .text("Active Authors:");

        legendY += 20;

        authors.slice(0, 10).forEach((author) => {
            const color = this.authorColors.get(author) || "#ffffff";

            legend
                .append("circle")
                .attr("cx", legendX)
                .attr("cy", legendY)
                .attr("r", 4)
                .attr("fill", color);

            legend
                .append("text")
                .attr("x", legendX + 10)
                .attr("y", legendY + 4)
                .attr("fill", color)
                .attr("font-family", "monospace")
                .attr("font-size", "11px")
                .text(
                    author.length > 20
                        ? author.substring(0, 20) + "..."
                        : author,
                );

            legendY += 18;
        });
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
