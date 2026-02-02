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
    fileColor: string;
}

interface ProjectedParticle extends Particle {
    projX: number;
    projY: number;
    projScale: number;
    opacity: number;
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
    private gradientCache: Set<string> = new Set();

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
        const fileColors = this.generateFileColors(commit.files);
        const authorColor = this.authorColors.get(commit.author) || "#ffffff";

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
                color: this.createGradientColor(fileColors[i], authorColor),
                size: 6 + Math.random() * 5,
                age: 0,
                maxAge: 120 + Math.random() * 80,
                filename: filename.split("/").pop() || filename,
                author: commit.author,
                commitHash: commit.hash,
                fileColor: fileColors[i],
            });
        });
    }

    private generateFileColors(filenames: string[]): string[] {
        const colors: string[] = [];
        const modernColorPalette = [
            "#FF6B6B",
            "#4ECDC4",
            "#45B7D1",
            "#96CEB4",
            "#FFEAA7",
            "#DDA0DD",
            "#98D8C8",
            "#F7DC6F",
            "#BB8FCE",
            "#85C1E9",
            "#F8C471",
            "#82E0AA",
            "#F1948A",
            "#85C1E9",
            "#D7BDE2",
            "#A3E4D7",
            "#FAD7A0",
            "#D5A6BD",
            "#AED6F1",
            "#A9DFBF",
        ];

        filenames.forEach((filename, index) => {
            const ext = filename.split(".").pop()?.toLowerCase() || "";
            let hash = 0;
            for (let i = 0; i < filename.length; i++) {
                hash = filename.charCodeAt(i) + ((hash << 5) - hash);
            }
            const colorIndex = Math.abs(hash) % modernColorPalette.length;
            colors.push(modernColorPalette[colorIndex]);
        });

        return colors;
    }

    private createGradientColor(
        fileColor: string,
        authorColor: string,
    ): string {
        const gradientId = `gradient-${fileColor.replace("#", "")}-${authorColor.replace("#", "")}`;

        if (this.gradientCache.has(gradientId)) {
            return `url(#${gradientId})`;
        }

        const defs = this.svg.select("defs");
        const gradient = defs
            .append("radialGradient")
            .attr("id", gradientId)
            .attr("cx", "30%")
            .attr("cy", "30%")
            .attr("r", "70%");
        gradient
            .append("stop")
            .attr("offset", "0%")
            .attr("stop-color", fileColor)
            .attr("stop-opacity", "0.95");

        gradient
            .append("stop")
            .attr("offset", "100%")
            .attr("stop-color", authorColor)
            .attr("stop-opacity", "0.85");

        this.gradientCache.add(gradientId);
        return `url(#${gradientId})`;
    }

    private updateParticles(): void {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;
            p.age++;

            p.vy += 0.02;
            p.vx *= 0.99;
            p.vy *= 0.99;
            p.vz *= 0.99;

            if (p.age >= p.maxAge) {
                this.particles.splice(i, 1);
            }
        }
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

        const projectedParticles: ProjectedParticle[] = [];

        for (const p of this.particles) {
            const proj = this.project3D(p.x, p.y, p.z);

            if (
                proj.x < -100 ||
                proj.x > this.width + 100 ||
                proj.y < -100 ||
                proj.y > this.height + 100
            ) {
                continue;
            }

            const ageFactor = 1 - p.age / p.maxAge;
            const opacity = ageFactor * 0.9;

            if (opacity <= 0.1) continue;

            projectedParticles.push({
                ...p,
                projX: proj.x,
                projY: proj.y,
                projScale: proj.scale,
                opacity,
            });
        }

        projectedParticles.sort((a, b) => b.z - a.z);

        const particleGroup = this.svg.select(".particles");

        const circles = particleGroup
            .selectAll("circle")
            .data(projectedParticles, (d: any) => d.id);

        circles.exit().remove();

        const newCircles = circles
            .enter()
            .append("circle")
            .attr("fill", (d: any) => d.color)
            .attr("stroke", "none");

        circles
            .merge(newCircles)
            .attr("cx", (d: any) => d.projX)
            .attr("cy", (d: any) => d.projY)
            .attr("r", (d: any) => d.size * d.projScale)
            .attr("opacity", (d: any) => d.opacity);

        const labelsToShow = projectedParticles.filter(
            (d) => d.age < 60 && d.projScale > 0.8,
        );

        const texts = particleGroup
            .selectAll("text.label")
            .data(labelsToShow, (d: any) => d.id);

        texts.exit().remove();

        const newTexts = texts
            .enter()
            .append("text")
            .attr("class", "label")
            .attr("font-family", "monospace")
            .text((d: any) => d.filename);

        texts
            .merge(newTexts)
            .attr("x", (d: any) => d.projX + (d.size + 2) * d.projScale)
            .attr("y", (d: any) => d.projY - (d.size + 2) * d.projScale)
            .attr("fill", (d: any) => d.fileColor)
            .attr("opacity", (d: any) => d.opacity * 0.8)
            .attr(
                "font-size",
                (d: any) => Math.max(8, 10 * d.projScale) + "px",
            );

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

        const activeAuthors = new Set<string>();
        for (const p of this.particles) {
            if (p.age < 60) {
                activeAuthors.add(p.author);
            }
        }

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
