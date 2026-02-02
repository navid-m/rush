let MAX_PARTICLES = 90;
let commits = [];
let particles = [];
let staticOutlines = [];
let currentCommitIndex = 0;
let frameCount = 0;
let isPaused = false;
let speed = 1;
let animationFrameId = null;
let lastFrameTime = 0;
let authorColors = new Map();
let gradientCache = new Set();
let svg = null;
let width = 1200;
let height = 800;
let hasCompleted = false;
let edges = [];
let authorContributionHistory = new Map();
let languageDistribution = new Map();
let uniqueFilesSet = new Set();
let isMassiveRepo = false;
let elaborateMode = false;
let treeNodes = [];
let branches = [];
let growthPoints = [];
let pulseEffects = [];
let spiralPaths = [];

async function init() {
    try {
        const response = await fetch("commits-data.json");
        const data = await response.json();

        commits = data.commits;
        isMassiveRepo = data.metadata?.isMassiveRepo || false;

        if (isMassiveRepo) {
            const sampleRate = Math.ceil(commits.length / 10000);
            const sampledCommits = [];

            for (let i = 0; i < commits.length; i += sampleRate) {
                sampledCommits.push(commits[i]);
            }

            commits = sampledCommits;
            MAX_PARTICLES = 45;
            console.log(
                `Massive repository detected. Using ${sampledCommits.length} commits out of ${data.commits.length} total.`,
            );
        }

        generateAuthorColors();

        setupSVG();

        document.getElementById("loading").style.display = "none";

        authorContributionHistory.set(-1, new Map());

        updateStats();

        lastFrameTime = performance.now();
        animate(lastFrameTime);

        setupKeyboardControls();
    } catch (error) {
        console.error("Error loading commit data:", error);
        document.getElementById("loading").textContent =
            "Error loading commit data: " + error.message;
    }
}

function generateAuthorColors() {
    const authors = [...new Set(commits.map((c) => c.author))];
    const colors = [
        "#1f77b4",
        "#ff7f0e",
        "#2ca02c",
        "#d62728",
        "#9467bd",
        "#8c564b",
        "#e377c2",
        "#7f7f7f",
        "#bcbd22",
        "#17becf",
    ];

    authors.forEach((author, i) => {
        authorColors.set(author, colors[i % colors.length]);
    });
}

function setupSVG() {
    const container = document.getElementById("animation");
    container.innerHTML = "";

    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute(
        "style",
        "background: radial-gradient(circle at center, #0f0f1f 0%, #000000 100%)",
    );

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.appendChild(defs);

    const particlesGroup = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g",
    );
    particlesGroup.setAttribute("class", "particles");
    svg.appendChild(particlesGroup);

    const elaborateGroup = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g",
    );
    elaborateGroup.setAttribute("class", "elaborate");
    svg.appendChild(elaborateGroup);

    container.appendChild(svg);
}

function setupKeyboardControls() {
    document.addEventListener("keydown", (e) => {
        if (e.code === "Space") {
            e.preventDefault();
            togglePause();
        } else if (e.code === "Equal" || e.code === "NumpadAdd") {
            changeSpeed(0.5);
        } else if (e.code === "Minus" || e.code === "NumpadSubtract") {
            changeSpeed(-0.5);
        } else if (e.code === "KeyR") {
            restartAnimation();
        } else if (e.code === "KeyE") {
            toggleElaborateMode();
        }
    });
}

function toggleElaborateMode() {
    elaborateMode = !elaborateMode;

    if (elaborateMode) {
        particles = [];
        staticOutlines = [];
        edges = [];
        treeNodes = [
            {
                x: width / 2,
                y: height - 50,
                vx: 0,
                vy: 0,
                color: "#ffffff",
                size: 8,
                isRoot: true,
            },
        ];
        branches = [];
        growthPoints = [];
        pulseEffects = [];
        spiralPaths = [];
    } else {
        treeNodes = [];
        branches = [];
        growthPoints = [];
        pulseEffects = [];
        spiralPaths = [];
    }

    updateStats();
}

function togglePause() {
    isPaused = !isPaused;
    if (!isPaused && !hasCompleted) {
        lastFrameTime = performance.now();
        animate(lastFrameTime);
    }
    updateStats();
}

function changeSpeed(delta) {
    speed = Math.max(0.1, Math.min(10, speed + delta));
    updateStats();
}

function restartAnimation() {
    particles = [];
    staticOutlines = [];
    edges = [];
    treeNodes = [];
    branches = [];
    growthPoints = [];
    pulseEffects = [];
    spiralPaths = [];
    authorContributionHistory = new Map();
    languageDistribution = new Map();
    currentCommitIndex = 0;
    frameCount = 0;
    hasCompleted = false;
    isPaused = false;
    lastFrameTime = performance.now();
    uniqueFilesSet = new Set();

    if (elaborateMode) {
        treeNodes = [
            {
                x: width / 2,
                y: height - 50,
                vx: 0,
                vy: 0,
                color: "#ffffff",
                size: 8,
                isRoot: true,
            },
        ];
    }

    animate(lastFrameTime);
    updateStats();
}

function createParticlesForCommit(commit) {
    if (elaborateMode) {
        createElaborateVisualization(commit);
    } else {
        createStandardParticles(commit);
    }

    updateAuthorContributionHistory(commit.author);
    updateLanguageDistribution(commit);
}

function createElaborateVisualization(commit) {
    const fileColors = generateFileColors(commit.files);
    const authorColor = authorColors.get(commit.author) || "#ffffff";
    const maxFilesPerCommit = isMassiveRepo ? 10 : commit.files.length;
    const filesToProcess = commit.files.slice(0, maxFilesPerCommit);
    const numBranches = Math.min(filesToProcess.length, 5);

    for (let i = 0; i < numBranches; i++) {
        let parentNode;

        if (treeNodes.length === 0) {
            parentNode = {
                x: width / 2,
                y: height - 50,
                vx: 0,
                vy: 0,
                color: "#ffffff",
                size: 8,
                isRoot: true,
            };
            treeNodes.push(parentNode);
        } else {
            parentNode =
                treeNodes[
                    Math.floor(Math.random() * Math.min(treeNodes.length, 20))
                ];
        }

        const angle = (Math.random() - 0.5) * Math.PI * 0.8 - Math.PI / 2;
        const distance = 40 + Math.random() * 60;

        const newNode = {
            x: parentNode.x + Math.cos(angle) * distance,
            y: parentNode.y + Math.sin(angle) * distance,
            vx: Math.cos(angle) * 2,
            vy: Math.sin(angle) * 2,
            color: fileColors[i % fileColors.length],
            authorColor: authorColor,
            size: 4 + Math.random() * 4,
            age: 0,
            filename: filesToProcess[i % filesToProcess.length]
                .split("/")
                .pop(),
            commitHash: commit.hash,
            isRoot: false,
        };

        treeNodes.push(newNode);

        branches.push({
            from: parentNode,
            to: newNode,
            color: authorColor,
            width: 2 + Math.random() * 2,
            age: 0,
            maxAge: 120,
        });

        pulseEffects.push({
            x: newNode.x,
            y: newNode.y,
            radius: 0,
            maxRadius: 40 + Math.random() * 30,
            color: fileColors[i % fileColors.length],
            age: 0,
            maxAge: 60,
        });

        if (Math.random() > 0.7) {
            spiralPaths.push({
                centerX: newNode.x,
                centerY: newNode.y,
                angle: 0,
                radius: 5,
                color: authorColor,
                age: 0,
                maxAge: 180,
                points: [],
            });
        }
    }

    if (filesToProcess.length > 3 && Math.random() > 0.5) {
        const centerNode = treeNodes[treeNodes.length - 1];

        growthPoints.push({
            x: centerNode.x,
            y: centerNode.y,
            petals: filesToProcess.length,
            color: authorColor,
            fileColor: fileColors[0],
            size: 20 + Math.random() * 20,
            age: 0,
            maxAge: 150,
            rotation: Math.random() * Math.PI * 2,
        });
    }

    filesToProcess.forEach((filename) => {
        uniqueFilesSet.add(filename);
    });
}

function createStandardParticles(commit) {
    const fileColors = generateFileColors(commit.files);
    const authorColor = authorColors.get(commit.author) || "#ffffff";
    const directoryGroups = new Map();

    if (particles.length >= MAX_PARTICLES) {
        particles.forEach((p) => {
            const proj = project3D(p.x, p.y, p.z);
            staticOutlines.push({
                x: proj.x,
                y: proj.y,
                r: p.size * proj.scale,
                color: p.color,
                opacity: 0.6,
            });
        });

        particles = [];
        edges = [];
    }

    const maxFilesPerCommit = isMassiveRepo ? 10 : commit.files.length;
    const filesToProcess = commit.files.slice(0, maxFilesPerCommit);

    filesToProcess.forEach((filename, i) => {
        const angle = (i / filesToProcess.length) * Math.PI * 2;
        const elevation = (Math.random() - 0.5) * Math.PI * 0.5;
        const particleSpeed = 1.5 + Math.random() * 1.5;

        const particle = {
            id: `${commit.hash}-${filename}`,
            x: 0,
            y: 0,
            z: 0,
            vx: Math.cos(angle) * Math.cos(elevation) * particleSpeed,
            vy: Math.sin(elevation) * particleSpeed,
            vz: Math.sin(angle) * Math.cos(elevation) * particleSpeed,
            color: createGradientColor(fileColors[i], authorColor),
            size: 6 + Math.random() * 5,
            age: 0,
            maxAge: Infinity,
            filename: filename.split("/").pop() || filename,
            author: commit.author,
            commitHash: commit.hash,
            fileColor: fileColors[i],
            fullPath: filename,
        };

        particles.push(particle);

        const directory =
            filename.substring(0, filename.lastIndexOf("/")) || "/";
        if (!directoryGroups.has(directory)) {
            directoryGroups.set(directory, []);
        }
        directoryGroups.get(directory).push(particle);
    });

    if (!isMassiveRepo) {
        for (const [directory, particlesInDir] of directoryGroups) {
            if (particlesInDir.length > 1) {
                for (let i = 0; i < particlesInDir.length; i++) {
                    for (let j = i + 1; j < particlesInDir.length; j++) {
                        edges.push({
                            source: particlesInDir[i],
                            target: particlesInDir[j],
                            directory: directory,
                        });
                    }
                }
            }
        }
    }

    filesToProcess.forEach((filename) => {
        uniqueFilesSet.add(filename);
    });
}

function generateFileColors(filenames) {
    const colors = [];
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

function updateAuthorContributionHistory(author) {
    const authorCounts = new Map();
    let totalCommits = 0;

    for (let i = 0; i <= currentCommitIndex; i++) {
        if (commits[i]) {
            const commitAuthor = commits[i].author;
            authorCounts.set(
                commitAuthor,
                (authorCounts.get(commitAuthor) || 0) + 1,
            );
            totalCommits++;
        }
    }

    const authorPercentages = new Map();
    for (const [auth, count] of authorCounts) {
        authorPercentages.set(auth, (count / totalCommits) * 100);
    }

    authorContributionHistory.set(currentCommitIndex, authorPercentages);
}

function updateLanguageDistribution(commit) {
    for (const file of commit.files) {
        const parts = file.split(".");
        if (parts.length > 1) {
            const ext = "." + parts[parts.length - 1].toLowerCase();
            let files = languageDistribution.get(ext) || new Set();
            files.add(file);
            languageDistribution.set(ext, files);
        } else {
            let files = languageDistribution.get("(no extension)") || new Set();
            files.add(file);
            languageDistribution.set("(no extension)", files);
        }
    }
}

function createGradientColor(fileColor, authorColor) {
    const gradientId = `gradient-${fileColor.replace("#", "").replace(/\./g, "")}-${authorColor.replace("#", "").replace(/\./g, "")}`;

    if (gradientCache.has(gradientId)) {
        return `url(#${gradientId})`;
    }

    const defs = svg.querySelector("defs");
    const gradient = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "radialGradient",
    );
    gradient.setAttribute("id", gradientId);
    gradient.setAttribute("cx", "30%");
    gradient.setAttribute("cy", "30%");
    gradient.setAttribute("r", "70%");

    const stop1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "stop",
    );
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", fileColor);
    stop1.setAttribute("stop-opacity", "0.95");

    const stop2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "stop",
    );
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", authorColor);
    stop2.setAttribute("stop-opacity", "0.85");

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);

    gradientCache.add(gradientId);
    return `url(#${gradientId})`;
}

function updateParticles() {
    if (elaborateMode) {
        updateElaborateElements();
    } else {
        updateStandardParticles();
    }
}

function updateElaborateElements() {
    for (let i = branches.length - 1; i >= 0; i--) {
        const branch = branches[i];
        branch.age++;

        if (branch.age > branch.maxAge) {
            branches.splice(i, 1);
        }
    }

    for (const node of treeNodes) {
        if (!node.isRoot) {
            node.age = (node.age || 0) + 1;
            node.vx += (Math.random() - 0.5) * 0.1;
            node.vy += (Math.random() - 0.5) * 0.1;
            node.vx *= 0.95;
            node.vy *= 0.95;
            node.x += node.vx;
            node.y += node.vy;

            if (node.x < 20) {
                node.x = 20;
                node.vx = Math.abs(node.vx);
            }
            if (node.x > width - 20) {
                node.x = width - 20;
                node.vx = -Math.abs(node.vx);
            }
            if (node.y < 20) {
                node.y = 20;
                node.vy = Math.abs(node.vy);
            }
            if (node.y > height - 20) {
                node.y = height - 20;
                node.vy = -Math.abs(node.vy);
            }
        }
    }

    for (let i = pulseEffects.length - 1; i >= 0; i--) {
        const pulse = pulseEffects[i];
        pulse.age++;
        pulse.radius = (pulse.age / pulse.maxAge) * pulse.maxRadius;

        if (pulse.age > pulse.maxAge) {
            pulseEffects.splice(i, 1);
        }
    }

    for (let i = spiralPaths.length - 1; i >= 0; i--) {
        const spiral = spiralPaths[i];
        spiral.age++;
        spiral.angle += 0.15;
        spiral.radius += 0.5;

        const x = spiral.centerX + Math.cos(spiral.angle) * spiral.radius;
        const y = spiral.centerY + Math.sin(spiral.angle) * spiral.radius;

        spiral.points.push({ x, y });

        if (spiral.points.length > 60) {
            spiral.points.shift();
        }

        if (spiral.age > spiral.maxAge) {
            spiralPaths.splice(i, 1);
        }
    }

    for (let i = growthPoints.length - 1; i >= 0; i--) {
        const gp = growthPoints[i];
        gp.age++;
        gp.rotation += 0.02;

        if (gp.age > gp.maxAge) {
            growthPoints.splice(i, 1);
        }
    }
}

function updateStandardParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        p.vy += 0.02;
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.vz *= 0.99;

        const proj = project3D(p.x, p.y, p.z);
        const groundLevel = height;
        const particleRadius = p.size * proj.scale;

        if (proj.y + particleRadius > groundLevel) {
            p.y = (groundLevel - particleRadius - height / 2) / proj.scale;

            p.vy = -p.vy * 0.7;
            p.vx *= 0.9;
            p.vz *= 0.9;
        }

        if (proj.y - particleRadius < 0) {
            p.y = (particleRadius - height / 2) / proj.scale;
            p.vy = -p.vy * 0.7;
        }

        if (proj.x - particleRadius < 0 || proj.x + particleRadius > width) {
            if (proj.x - particleRadius < 0) {
                p.x = (-width / 2 - particleRadius) / proj.scale;
            } else {
                p.x = (width / 2 - particleRadius) / proj.scale;
            }
            p.vx = -p.vx * 0.7;
        }

        const maxZ = 400;
        if (p.z < -maxZ || p.z > maxZ) {
            if (p.z < -maxZ) {
                p.z = -maxZ;
            } else {
                p.z = maxZ;
            }
            p.vz = -p.vz * 0.7;
        }
    }
}

function project3D(x, y, z) {
    const perspective = 600;
    const scale = perspective / (perspective + z);

    return {
        x: width / 2 + x * scale,
        y: height / 2 + y * scale,
        scale,
    };
}

function render() {
    if (!svg) return;

    if (elaborateMode) {
        renderElaborate();
    } else {
        renderStandard();
    }
}

function renderElaborate() {
    const elaborateGroup = svg.querySelector(".elaborate");
    if (!elaborateGroup) return;

    while (elaborateGroup.firstChild) {
        elaborateGroup.removeChild(elaborateGroup.firstChild);
    }

    for (const branch of branches) {
        const opacity = 1 - branch.age / branch.maxAge;

        const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line",
        );
        line.setAttribute("x1", branch.from.x);
        line.setAttribute("y1", branch.from.y);
        line.setAttribute("x2", branch.to.x);
        line.setAttribute("y2", branch.to.y);
        line.setAttribute("stroke", branch.color);
        line.setAttribute("stroke-width", branch.width);
        line.setAttribute("opacity", opacity * 0.7);
        line.setAttribute("stroke-linecap", "round");
        elaborateGroup.appendChild(line);
    }

    for (const spiral of spiralPaths) {
        if (spiral.points.length < 2) continue;

        const opacity = 1 - spiral.age / spiral.maxAge;
        let pathData = `M ${spiral.points[0].x} ${spiral.points[0].y}`;

        for (let i = 1; i < spiral.points.length; i++) {
            pathData += ` L ${spiral.points[i].x} ${spiral.points[i].y}`;
        }

        const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
        );
        path.setAttribute("d", pathData);
        path.setAttribute("stroke", spiral.color);
        path.setAttribute("stroke-width", "2");
        path.setAttribute("fill", "none");
        path.setAttribute("opacity", opacity * 0.8);
        elaborateGroup.appendChild(path);
    }

    for (const pulse of pulseEffects) {
        const opacity = (1 - pulse.age / pulse.maxAge) * 0.5;

        const circle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
        );
        circle.setAttribute("cx", pulse.x);
        circle.setAttribute("cy", pulse.y);
        circle.setAttribute("r", pulse.radius);
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke", pulse.color);
        circle.setAttribute("stroke-width", "2");
        circle.setAttribute("opacity", opacity);
        elaborateGroup.appendChild(circle);
    }

    for (const gp of growthPoints) {
        const progress = gp.age / gp.maxAge;
        const opacity = Math.sin(progress * Math.PI) * 0.8;

        for (let i = 0; i < gp.petals; i++) {
            const angle = (i / gp.petals) * Math.PI * 2 + gp.rotation;
            const petalLength = gp.size * progress;
            const x1 = gp.x;
            const y1 = gp.y;
            const x2 = gp.x + Math.cos(angle) * petalLength;
            const y2 = gp.y + Math.sin(angle) * petalLength;
            const line = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line",
            );

            line.setAttribute("x1", x1);
            line.setAttribute("y1", y1);
            line.setAttribute("x2", x2);
            line.setAttribute("y2", y2);
            line.setAttribute("stroke", gp.color);
            line.setAttribute("stroke-width", "2");
            line.setAttribute("opacity", opacity);
            elaborateGroup.appendChild(line);

            const circle = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "circle",
            );
            circle.setAttribute("cx", x2);
            circle.setAttribute("cy", y2);
            circle.setAttribute("r", 4 + progress * 3);
            circle.setAttribute("fill", gp.fileColor);
            circle.setAttribute("opacity", opacity);
            elaborateGroup.appendChild(circle);
        }
    }

    for (const node of treeNodes) {
        const circle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
        );
        circle.setAttribute("cx", node.x);
        circle.setAttribute("cy", node.y);
        circle.setAttribute("r", node.size);
        circle.setAttribute("fill", node.color);
        circle.setAttribute("opacity", node.isRoot ? 1 : 0.9);

        if (!node.isRoot && node.authorColor) {
            circle.setAttribute("stroke", node.authorColor);
            circle.setAttribute("stroke-width", "2");
        }

        elaborateGroup.appendChild(circle);

        if (!node.isRoot && node.filename && node.age < 200) {
            const text = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "text",
            );
            text.setAttribute("x", node.x + node.size + 5);
            text.setAttribute("y", node.y + 3);
            text.setAttribute("fill", node.color);
            text.setAttribute("opacity", Math.max(0, 1 - node.age / 200));
            text.setAttribute("font-size", "10px");
            text.setAttribute("font-family", "monospace");
            text.textContent = node.filename;
            elaborateGroup.appendChild(text);
        }
    }

    drawAuthorLegend();
    drawContributionBars();
    drawLanguageDistribution();
}

function renderStandard() {
    const particlesGroup = svg.querySelector(".particles");
    if (!particlesGroup) return;

    while (particlesGroup.firstChild) {
        particlesGroup.removeChild(particlesGroup.firstChild);
    }

    for (const outline of staticOutlines) {
        const circle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
        );
        circle.setAttribute("cx", outline.x);
        circle.setAttribute("cy", outline.y);
        circle.setAttribute("r", outline.r);
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke", outline.color);
        circle.setAttribute("stroke-width", "1");
        circle.setAttribute("opacity", outline.opacity);
        particlesGroup.appendChild(circle);
    }

    const projectedParticles = [];

    for (const p of particles) {
        const proj = project3D(p.x, p.y, p.z);

        if (
            proj.x < -100 ||
            proj.x > width + 100 ||
            proj.y < -100 ||
            proj.y > height + 100
        ) {
            continue;
        }

        const opacity = 0.9;

        projectedParticles.push({
            ...p,
            projX: proj.x,
            projY: proj.y,
            projScale: proj.scale,
            opacity,
        });
    }

    const projectedParticleMap = new Map();
    for (const p of projectedParticles) {
        projectedParticleMap.set(p.id, p);
    }

    for (const edge of edges) {
        const sourceParticle = projectedParticleMap.get(edge.source.id);
        const targetParticle = projectedParticleMap.get(edge.target.id);

        if (sourceParticle && targetParticle) {
            const line = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line",
            );
            line.setAttribute("x1", sourceParticle.projX);
            line.setAttribute("y1", sourceParticle.projY);
            line.setAttribute("x2", targetParticle.projX);
            line.setAttribute("y2", targetParticle.projY);
            line.setAttribute("stroke", "#444");
            line.setAttribute("stroke-width", "1");
            line.setAttribute("opacity", 0.4);
            particlesGroup.appendChild(line);
        }
    }

    projectedParticles.sort((a, b) => b.z - a.z);

    for (const p of projectedParticles) {
        const circle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
        );
        circle.setAttribute("cx", p.projX);
        circle.setAttribute("cy", p.projY);
        circle.setAttribute("r", p.size * p.projScale);
        circle.setAttribute("fill", p.color);
        circle.setAttribute("opacity", p.opacity);
        particlesGroup.appendChild(circle);
    }

    const labelsToShow = projectedParticles.filter((d) => d.projScale > 0.8);

    for (const p of labelsToShow) {
        const text = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
        );
        text.setAttribute("x", p.projX + (p.size + 2) * p.projScale);
        text.setAttribute("y", p.projY - (p.size + 2) * p.projScale);
        text.setAttribute("fill", p.fileColor);
        text.setAttribute("opacity", p.opacity * 0.8);
        text.setAttribute("font-size", Math.max(8, 10 * p.projScale) + "px");
        text.setAttribute("font-family", "monospace");
        text.textContent = p.filename;
        particlesGroup.appendChild(text);
    }

    drawAuthorLegend();
    drawContributionBars();
    drawLanguageDistribution();
}

function drawAuthorLegend() {
    if (!svg) return;

    let legendGroup = svg.querySelector(".legend");
    if (!legendGroup) {
        legendGroup = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "g",
        );
        legendGroup.setAttribute("class", "legend");
        svg.appendChild(legendGroup);
    } else {
        while (legendGroup.firstChild) {
            legendGroup.removeChild(legendGroup.firstChild);
        }
    }

    const activeAuthors = new Set();

    if (elaborateMode) {
        for (const node of treeNodes) {
            if (node.author) {
                activeAuthors.add(node.author);
            }
        }
    } else {
        for (const p of particles) {
            activeAuthors.add(p.author);
        }
    }

    const authors = Array.from(activeAuthors);
    const legendX = width - 200;
    let legendY = 50;

    const title = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
    );
    title.setAttribute("x", legendX);
    title.setAttribute("y", legendY);
    title.setAttribute("fill", "#ffffff");
    title.setAttribute("font-family", "monospace");
    title.setAttribute("font-size", "12px");
    title.setAttribute("font-weight", "bold");
    title.textContent = "Active Authors:";
    legendGroup.appendChild(title);

    legendY += 20;

    authors.slice(0, 10).forEach((author) => {
        const color = authorColors.get(author) || "#ffffff";

        const circle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
        );
        circle.setAttribute("cx", legendX);
        circle.setAttribute("cy", legendY);
        circle.setAttribute("r", 4);
        circle.setAttribute("fill", color);
        legendGroup.appendChild(circle);

        const text = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
        );
        text.setAttribute("x", legendX + 10);
        text.setAttribute("y", legendY + 4);
        text.setAttribute("fill", color);
        text.setAttribute("font-family", "monospace");
        text.setAttribute("font-size", "11px");
        text.textContent =
            author.length > 20 ? author.substring(0, 20) + "..." : author;
        legendGroup.appendChild(text);

        legendY += 18;
    });
}

function drawContributionBars() {
    if (!svg) return;

    let barsGroup = svg.querySelector(".contribution-bars");
    if (!barsGroup) {
        barsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        barsGroup.setAttribute("class", "contribution-bars");
        svg.appendChild(barsGroup);
    } else {
        while (barsGroup.firstChild) {
            barsGroup.removeChild(barsGroup.firstChild);
        }
    }

    const currentPercentages =
        authorContributionHistory.get(currentCommitIndex - 1) || new Map();

    if (currentPercentages.size === 0) return;

    const sortedAuthors = Array.from(currentPercentages.entries()).sort(
        (a, b) => b[1] - a[1],
    );
    const barWidth = 150;
    const barHeight = 15;
    const barSpacing = 5;
    const startX = 20;
    const startY = 50;
    const title = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
    );

    title.setAttribute("x", startX);
    title.setAttribute("y", startY - 10);
    title.setAttribute("fill", "#ffffff");
    title.setAttribute("font-family", "monospace");
    title.setAttribute("font-size", "12px");
    title.setAttribute("font-weight", "bold");
    title.textContent = "Contribution Percentages:";
    barsGroup.appendChild(title);

    const maxDisplay = 15;
    const displayAuthors = sortedAuthors.slice(0, maxDisplay);

    displayAuthors.forEach(([author, percentage], index) => {
        const barY = startY + index * (barHeight + barSpacing);
        const color = authorColors.get(author) || "#ffffff";
        const bgBar = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );

        bgBar.setAttribute("x", startX);
        bgBar.setAttribute("y", barY);
        bgBar.setAttribute("width", barWidth);
        bgBar.setAttribute("height", barHeight);
        bgBar.setAttribute("fill", "#333");
        bgBar.setAttribute("rx", "3");
        bgBar.setAttribute("ry", "3");
        barsGroup.appendChild(bgBar);

        const fillBar = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        fillBar.setAttribute("x", startX);
        fillBar.setAttribute("y", barY);
        fillBar.setAttribute("width", (percentage / 100) * barWidth);
        fillBar.setAttribute("height", barHeight);
        fillBar.setAttribute("fill", color);
        fillBar.setAttribute("rx", "3");
        fillBar.setAttribute("ry", "3");
        barsGroup.appendChild(fillBar);

        const authorText = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
        );
        authorText.setAttribute("x", startX + barWidth + 5);
        authorText.setAttribute("y", barY + barHeight - 3);
        authorText.setAttribute("fill", color);
        authorText.setAttribute("font-family", "monospace");
        authorText.setAttribute("font-size", "11px");
        authorText.textContent = `${author}: ${percentage.toFixed(1)}%`;
        barsGroup.appendChild(authorText);
    });

    if (sortedAuthors.length > maxDisplay) {
        const moreText = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
        );
        moreText.setAttribute("x", startX);
        moreText.setAttribute(
            "y",
            startY + maxDisplay * (barHeight + barSpacing) + 10,
        );
        moreText.setAttribute("fill", "#aaaaaa");
        moreText.setAttribute("font-family", "monospace");
        moreText.setAttribute("font-size", "10px");
        moreText.textContent = `... and ${sortedAuthors.length - maxDisplay} more authors`;
        barsGroup.appendChild(moreText);
    }
}

function drawLanguageDistribution() {
    if (!svg) return;

    let langGroup = svg.querySelector(".language-distribution");
    if (!langGroup) {
        langGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        langGroup.setAttribute("class", "language-distribution");
        svg.appendChild(langGroup);
    } else {
        while (langGroup.firstChild) {
            langGroup.removeChild(langGroup.firstChild);
        }
    }

    if (languageDistribution.size === 0) return;

    let totalFiles = 0;
    for (const [ext, files] of languageDistribution) {
        totalFiles += files.size;
    }

    if (totalFiles === 0) return;

    const languagePercentages = new Map();
    for (const [ext, files] of languageDistribution) {
        languagePercentages.set(ext, (files.size / totalFiles) * 100);
    }

    const sortedLanguages = Array.from(languagePercentages.entries()).sort(
        (a, b) => b[1] - a[1],
    );
    const barWidth = 150;
    const barHeight = 15;
    const barSpacing = 5;
    const startX = 20;
    const startY = height - 300;
    const title = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
    );

    title.setAttribute("x", startX);
    title.setAttribute("y", startY - 10);
    title.setAttribute("fill", "#ffffff");
    title.setAttribute("font-family", "monospace");
    title.setAttribute("font-size", "12px");
    title.setAttribute("font-weight", "bold");
    title.textContent = "Language Distribution:";
    langGroup.appendChild(title);

    const maxDisplay = 15;
    const displayLanguages = sortedLanguages.slice(0, maxDisplay);

    displayLanguages.forEach(([language, percentage], index) => {
        const barY = startY + index * (barHeight + barSpacing);

        let color = "#ffffff";
        if (language !== "(no extension)") {
            let hash = 0;
            for (let i = 0; i < language.length; i++) {
                hash = language.charCodeAt(i) + ((hash << 5) - hash);
            }
            const colors = [
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
            color = colors[Math.abs(hash) % colors.length];
        } else {
            color = "#7f7f7f";
        }

        const bgBar = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        bgBar.setAttribute("x", startX);
        bgBar.setAttribute("y", barY);
        bgBar.setAttribute("width", barWidth);
        bgBar.setAttribute("height", barHeight);
        bgBar.setAttribute("fill", "#333");
        bgBar.setAttribute("rx", "3");
        bgBar.setAttribute("ry", "3");
        langGroup.appendChild(bgBar);

        const fillBar = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        fillBar.setAttribute("x", startX);
        fillBar.setAttribute("y", barY);
        fillBar.setAttribute("width", (percentage / 100) * barWidth);
        fillBar.setAttribute("height", barHeight);
        fillBar.setAttribute("fill", color);
        fillBar.setAttribute("rx", "3");
        fillBar.setAttribute("ry", "3");
        langGroup.appendChild(fillBar);

        const langText = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
        );
        langText.setAttribute("x", startX + barWidth + 5);
        langText.setAttribute("y", barY + barHeight - 3);
        langText.setAttribute("fill", color);
        langText.setAttribute("font-family", "monospace");
        langText.setAttribute("font-size", "11px");
        langText.textContent = `${language}: ${percentage.toFixed(1)}% (${languageDistribution.get(language)?.size || 0} files)`;
        langGroup.appendChild(langText);
    });

    if (sortedLanguages.length > maxDisplay) {
        const moreText = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
        );
        moreText.setAttribute("x", startX);
        moreText.setAttribute(
            "y",
            startY + maxDisplay * (barHeight + barSpacing) + 10,
        );
        moreText.setAttribute("fill", "#aaaaaa");
        moreText.setAttribute("font-family", "monospace");
        moreText.setAttribute("font-size", "10px");
        moreText.textContent = `... and ${sortedLanguages.length - maxDisplay} more languages`;
        langGroup.appendChild(moreText);
    }
}

function updateStats() {
    const statsDiv = document.getElementById("stats");
    if (!statsDiv) return;

    let infoText = `Commits: ${currentCommitIndex}/${commits.length}<br>`;
    infoText += `Files: ${uniqueFilesSet.size}<br>`;
    infoText += `Speed: ${speed.toFixed(1)}x<br>`;
    infoText += `Mode: ${elaborateMode ? "ELABORATE" : "STANDARD"}<br>`;

    if (isPaused) {
        infoText += "Status: PAUSED";
    } else if (hasCompleted) {
        infoText += "Status: COMPLETED";
    } else {
        infoText += "Status: RUNNING";
    }

    statsDiv.innerHTML = infoText;

    const commitInfoDiv = document.getElementById("current-commit");
    if (commitInfoDiv && commits[currentCommitIndex - 1]) {
        const commit = commits[currentCommitIndex - 1];
        const date = new Date(commit.date).toLocaleDateString();
        const time = new Date(commit.date).toLocaleTimeString();
        commitInfoDiv.innerHTML = `
          <strong>${date} ${time}</strong><br>
          <em>${commit.author}</em>: ${commit.message.substring(0, 50)}
          ${commit.message.length > 50 ? "..." : ""}
        `;
    }
}

function animate(currentTime) {
    if (hasCompleted) {
        return;
    }

    if (isPaused) {
        animationFrameId = requestAnimationFrame(animate);
        return;
    }

    const deltaTime = currentTime - lastFrameTime;
    const baseFPS = isMassiveRepo ? 60 : 75;
    const frameInterval = 1000 / (baseFPS * speed);

    if (deltaTime >= frameInterval) {
        frameCount++;

        let commitInterval = Math.floor(30 / speed);
        if (isMassiveRepo) {
            commitInterval = Math.floor(60 / speed);
        }

        if (
            frameCount % commitInterval === 0 &&
            currentCommitIndex < commits.length
        ) {
            createParticlesForCommit(commits[currentCommitIndex]);
            currentCommitIndex++;
        }

        updateParticles();
        render();
        updateStats();

        if (currentCommitIndex >= commits.length) {
            hasCompleted = true;
            updateStats();
        }

        lastFrameTime = currentTime - (deltaTime % frameInterval);
    }

    animationFrameId = requestAnimationFrame(animate);
}

window.addEventListener("load", init);
