/**
 * HIGH-PERFORMANCE Refactored Neural Network Particle Animation
 *
 * This version has been heavily optimized to target 60 FPS by addressing
 * major computational and rendering bottlenecks.
 *
 * Performance Fixes:
 * 1.  **Quadtree Implementation:** Replaced the O(n^2) collision detection in
 * `_handleConnections` with a Quadtree. This dramatically reduces the number of
 * particle-pair checks, making the simulation scale much better.
 * 2.  **Particle Pre-Rendering:** Instead of creating expensive radial gradients and
 * shadows for every particle on every frame, particles are now pre-rendered to
 * off-screen canvases. The main loop uses the much faster `drawImage` to stamp
 * these sprites, significantly reducing rendering overhead.
 * 3.  **Bug Fix:** The `_createDendriteTree` method is now correctly implemented,
 * restoring the static background dendrite effect.
 *
 * NEW FEATURE:
 * 4.  **Dendrite Signal Propagation:** When particles "fire," a visual signal
 * is now generated. This signal travels along the particle's own dendrite
 * branches, creating a visible representation of neural activity propagating
 * through the network. This is achieved by restructuring dendrites into
 * traceable paths and managing active signals in the main animation loop.
 */

// --- Quadtree Helper Classes ---
class Point {
    constructor(x, y, data) {
        this.x = x;
        this.y = y;
        this.data = data; // Associate data (the particle object) with the point
    }
}

class Rectangle {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    contains(point) {
        return (point.x >= this.x - this.w &&
            point.x <= this.x + this.w &&
            point.y >= this.y - this.h &&
            point.y <= this.y + this.h);
    }

    intersects(range) {
        return !(range.x - range.w > this.x + this.w ||
            range.x + range.w < this.x - this.w ||
            range.y - range.h > this.y + this.h ||
            range.y + range.h < this.y - this.h);
    }
}

class Quadtree {
    constructor(boundary, capacity) {
        this.boundary = boundary;
        this.capacity = capacity;
        this.points = [];
        this.divided = false;
    }

    subdivide() {
        let x = this.boundary.x;
        let y = this.boundary.y;
        let w = this.boundary.w / 2;
        let h = this.boundary.h / 2;
        let ne = new Rectangle(x + w, y - h, w, h);
        this.northeast = new Quadtree(ne, this.capacity);
        let nw = new Rectangle(x - w, y - h, w, h);
        this.northwest = new Quadtree(nw, this.capacity);
        let se = new Rectangle(x + w, y + h, w, h);
        this.southeast = new Quadtree(se, this.capacity);
        let sw = new Rectangle(x - w, y + h, w, h);
        this.southwest = new Quadtree(sw, this.capacity);
        this.divided = true;
    }

    insert(point) {
        if (!this.boundary.contains(point)) {
            return false;
        }

        if (this.points.length < this.capacity) {
            this.points.push(point);
            return true;
        } else {
            if (!this.divided) {
                this.subdivide();
            }
            this.northeast.insert(point);
            this.northwest.insert(point);
            this.southeast.insert(point);
            this.southwest.insert(point);
        }
    }

    query(range, found) {
        if (!found) {
            found = [];
        }
        if (!this.boundary.intersects(range)) {
            return found;
        } else {
            for (let p of this.points) {
                if (range.contains(p)) {
                    found.push(p.data);
                }
            }
            if (this.divided) {
                this.northwest.query(range, found);
                this.northeast.query(range, found);
                this.southwest.query(range, found);
                this.southeast.query(range, found);
            }
        }
        return found;
    }
}

class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas with ID '${canvasId}' not found.`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.config = {
            PARTICLE_COLOR: '#38BDF8',
            MIN_RADIUS: 3,
            MAX_RADIUS: 5,
            INITIAL_VELOCITY_RANGE: 0.35,
            PARTICLES_PER_PIXEL_DENSITY: 35000,
            MAX_CONNECTION_DISTANCE: 250,
            MOBILE_BREAKPOINT: 768,
            STATIC_DENDRITE_OPACITY: 0.18,
            STATIC_DENDRITE_LIFESPAN: 60,
            STATIC_DENDRITE_BRANCH_CHANCE: 0.1,
            PROXIMITY_LINE_OPACITY: 0.5,
            PROXIMITY_LINE_WIDTH: 0.8,
            PROXIMITY_LINE_ROUGHNESS: 6,
            FIRING_CHANCE: 0.0002,
            FIRING_DURATION: 20,
            FIRING_LINE_WIDTH: 2.5,
            FIRING_LINE_ROUGHNESS: 12,
            PARTICLE_SHADOW_BLUR: 15,
            PARTICLE_FLASH_RADIUS_BOOST: 3,
            PARTICLE_FLASH_GLOW_BOOST: 15,
            WOBBLE_SPEED: 0.002,
            // --- NEW CONFIG FOR DENDRITE SIGNALS ---
            SIGNAL_SPEED: 0.04,          // Progress per frame (0 to 1)
            SIGNAL_LINE_WIDTH: 1.5,
            SIGNAL_COLOR: 'rgba(255, 255, 255, 1)',
            SIGNAL_GLOW_COLOR: 'rgba(255, 255, 255, 0.8)',
            SIGNAL_GLOW_BLUR: 10
        };

        this.particlesArray = [];
        this.firingConnections = [];
        this.dendriteSignals = []; // <<< NEW: To manage active signals
        this.animationFrameId = null;
        this.time = 0;
        this._handleResize = this._debounce(this._handleResize.bind(this), 250);
        this._animate = this._animate.bind(this);
    }

    start() {
        Particle.preRenderParticles(this.config);
        this._resizeCanvas();
        this._initParticles();
        window.addEventListener('resize', this._handleResize);
        this._animate();
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        window.removeEventListener('resize', this._handleResize);
        console.log("Particle system destroyed and resources cleaned up.");
    }

    _resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    _handleResize() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this._resizeCanvas();
        this._initParticles();
        this._animate();
    }

    _initParticles() {
        this.particlesArray = [];
        this.dendriteSignals = []; // Clear signals on resize
        let num = Math.floor((this.canvas.width * this.canvas.height) / this.config.PARTICLES_PER_PIXEL_DENSITY);
        if (window.innerWidth < this.config.MOBILE_BREAKPOINT) {
            num *= 2;
        }
        for (let i = 0; i < num; i++) {
            const r = Math.random() * (this.config.MAX_RADIUS - this.config.MIN_RADIUS) + this.config.MIN_RADIUS;
            const x = Math.random() * (this.canvas.width - r * 2) + r;
            const y = Math.random() * (this.canvas.height - r * 2) + r;
            const vx = (Math.random() - 0.5) * this.config.INITIAL_VELOCITY_RANGE;
            const vy = (Math.random() - 0.5) * this.config.INITIAL_VELOCITY_RANGE;
            this.particlesArray.push(new Particle(x, y, vx, vy, r, this.canvas, this.ctx, this.config));
        }
    }

    _animate() {
        this.time += this.config.WOBBLE_SPEED;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const boundary = new Rectangle(this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 2, this.canvas.height / 2);
        const qtree = new Quadtree(boundary, 4);
        for (const p of this.particlesArray) {
            qtree.insert(new Point(p.x, p.y, p));
        }

        this.particlesArray.forEach(p => p.update());
        this._handleConnections(qtree);
        this._drawFiringConnections();
        this._updateAndDrawDendriteSignals(); // <<< NEW: Animate our signals
        this.animationFrameId = requestAnimationFrame(this._animate);
    }

    _handleConnections(qtree) {
        for (const pA of this.particlesArray) {
            const range = new Rectangle(pA.x, pA.y, this.config.MAX_CONNECTION_DISTANCE, this.config.MAX_CONNECTION_DISTANCE);
            const nearbyParticles = qtree.query(range);

            for (const pB of nearbyParticles) {
                if (pA === pB) continue;

                const dx = pA.x - pB.x;
                const dy = pA.y - pB.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < this.config.MAX_CONNECTION_DISTANCE * this.config.MAX_CONNECTION_DISTANCE) {
                    const distance = Math.sqrt(distanceSq);
                    const opacity = (1 - (distance / this.config.MAX_CONNECTION_DISTANCE)) * this.config.PROXIMITY_LINE_OPACITY;
                    this._drawJaggedLine(pA, pB, {
                        color: 'rgba(56, 189, 248, OPACITY)',
                        lineWidth: this.config.PROXIMITY_LINE_WIDTH,
                        roughness: this.config.PROXIMITY_LINE_ROUGHNESS,
                        opacity: opacity
                    });

                    if (Math.random() < this.config.FIRING_CHANCE) {
                        this.firingConnections.push({
                            from: pA, to: pB,
                            duration: this.config.FIRING_DURATION, alpha: 1
                        });
                        pA.flashTTL = this.config.FIRING_DURATION;
                        pB.flashTTL = this.config.FIRING_DURATION;

                        // --- NEW: Trigger a dendrite signal on the firing particle ---
                        if (pA.dendrites.length > 0) {
                            this.dendriteSignals.push({
                                particle: pA,
                                branchIndex: Math.floor(Math.random() * pA.dendrites.length),
                                segmentIndex: 0,
                                progress: 0, // Starts at the beginning of the segment
                                speed: this.config.SIGNAL_SPEED
                            });
                        }
                    }
                }
            }
        }
    }

    _drawFiringConnections() {
        for (let i = this.firingConnections.length - 1; i >= 0; i--) {
            const conn = this.firingConnections[i];
            const opacity = conn.alpha * 0.9;
            this.ctx.shadowColor = 'rgba(125, 211, 252, 1)';
            this.ctx.shadowBlur = 15;
            this._drawJaggedLine(conn.from, conn.to, {
                color: 'rgba(200, 240, 255, OPACITY)',
                lineWidth: this.config.FIRING_LINE_WIDTH,
                roughness: this.config.FIRING_LINE_ROUGHNESS,
                opacity: opacity
            });
            this.ctx.shadowBlur = 0;
            conn.duration--;
            conn.alpha = conn.duration / this.config.FIRING_DURATION;
            if (conn.duration <= 0) {
                this.firingConnections.splice(i, 1);
            }
        }
    }

    // --- NEW: Method to update and render the traveling signals ---
    _updateAndDrawDendriteSignals() {
        this.ctx.save();
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = this.config.SIGNAL_COLOR;
        this.ctx.lineWidth = this.config.SIGNAL_LINE_WIDTH;
        this.ctx.shadowColor = this.config.SIGNAL_GLOW_COLOR;
        this.ctx.shadowBlur = this.config.SIGNAL_GLOW_BLUR;

        for (let i = this.dendriteSignals.length - 1; i >= 0; i--) {
            const signal = this.dendriteSignals[i];
            const particle = signal.particle;
            const branch = particle.dendrites[signal.branchIndex];

            if (!branch || !branch[signal.segmentIndex]) {
                // Branch or segment doesn't exist, remove signal
                this.dendriteSignals.splice(i, 1);
                continue;
            }

            const segment = branch[signal.segmentIndex];

            // Draw the signal path for the current segment
            const travelDx = (segment.toX - segment.fromX) * signal.progress;
            const travelDy = (segment.toY - segment.fromY) * signal.progress;
            const currentX = segment.fromX + travelDx;
            const currentY = segment.fromY + travelDy;

            this.ctx.beginPath();
            this.ctx.moveTo(segment.fromX, segment.fromY);
            this.ctx.lineTo(currentX, currentY);
            this.ctx.stroke();

            // Update signal progress
            signal.progress += signal.speed;

            // If signal reaches end of segment, move to the next one
            if (signal.progress >= 1) {
                signal.progress = 0;
                signal.segmentIndex++;

                // If signal reaches end of the branch, remove it
                if (signal.segmentIndex >= branch.length) {
                    this.dendriteSignals.splice(i, 1);
                }
            }
        }
        this.ctx.restore();
    }

    _drawJaggedLine(start, end, lineConfig) {
        const { color, lineWidth, roughness, opacity } = lineConfig;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const numSegments = Math.max(1, Math.floor(distance / 15));
        const vecX = dx / distance;
        const vecY = dy / distance;
        const perpX = -vecY;
        const perpY = vecX;
        const wobbleSeed = start.x + end.y;

        this.ctx.strokeStyle = color.replace('OPACITY', opacity.toString());
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);

        for (let i = 1; i <= numSegments; i++) {
            const progress = i / numSegments;
            let currentX = start.x + dx * progress;
            let currentY = start.y + dy * progress;
            if (i < numSegments) {
                const sineInput = this.time * 2 + wobbleSeed + i * 0.5;
                const jitter = Math.sin(sineInput) * roughness * Math.sin(progress * Math.PI);
                currentX += perpX * jitter;
                currentY += perpY * jitter;
            }
            this.ctx.lineTo(currentX, currentY);
        }
        this.ctx.stroke();
    }

    _debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
}

class Particle {
    static renderedParticles = new Map();

    constructor(x, y, vx, vy, radius, canvas, ctx, config) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.radius = radius; this.canvas = canvas; this.ctx = ctx;
        this.config = config; this.flashTTL = 0;
        // --- MODIFIED: Create and store dendrites with new structure ---
        this.dendrites = this._createDendriteTree();
        this.intRadius = Math.round(radius);
    }

    static preRenderParticles(config) {
        for (let r = config.MIN_RADIUS; r <= config.MAX_RADIUS; r++) {
            const baseKey = `${r}_base`;
            if (!this.renderedParticles.has(baseKey)) {
                this.renderedParticles.set(baseKey, this._createParticleCanvas(r, 0, config));
            }

            const flashKey = `${r}_flash`;
            if (!this.renderedParticles.has(flashKey)) {
                this.renderedParticles.set(flashKey, this._createParticleCanvas(r, 1, config));
            }
        }
    }

    static _createParticleCanvas(radius, flashMultiplier, config) {
        const pCanvas = document.createElement('canvas');
        const pCtx = pCanvas.getContext('2d');
        const currentRadius = radius + (config.PARTICLE_FLASH_RADIUS_BOOST * flashMultiplier);
        const currentShadowBlur = config.PARTICLE_SHADOW_BLUR + (config.PARTICLE_FLASH_GLOW_BOOST * flashMultiplier);
        const size = (currentRadius + currentShadowBlur) * 2;
        pCanvas.width = size;
        pCanvas.height = size;

        pCtx.shadowColor = config.PARTICLE_COLOR;
        pCtx.shadowBlur = currentShadowBlur;
        const gradient = pCtx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, currentRadius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.4, config.PARTICLE_COLOR);
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
        pCtx.fillStyle = gradient;
        pCtx.beginPath();
        pCtx.arc(size / 2, size / 2, currentRadius, 0, Math.PI * 2);
        pCtx.fill();
        return pCanvas;
    }

    // --- RESTRUCTURED METHOD to return an array of branches ---
    _createDendriteTree() {
        const branches = []; // Will hold arrays of segments (each array is a branch)
        const config = this.config;

        const growBranch = (x, y, angle, life, currentBranch) => {
            if (life <= 0) return;

            const newX = x + Math.cos(angle) * 5;
            const newY = y + Math.sin(angle) * 5;
            // A segment knows its start and end points
            currentBranch.push({ fromX: x, fromY: y, toX: newX, toY: newY });

            // Chance to fork into a NEW branch
            if (Math.random() < config.STATIC_DENDRITE_BRANCH_CHANCE && life > 10) {
                const forkBranch = []; // Create a new array for the new branch
                const branchAngle = angle + (Math.random() > 0.5 ? 1 : -1) * 0.7;
                growBranch(newX, newY, branchAngle, life * 0.5, forkBranch);
                if (forkBranch.length > 0) {
                    branches.push(forkBranch); // Add the completed new branch to the main list
                }
            }
            
            // Continue growing the CURRENT branch
            const nextAngle = angle + (Math.random() - 0.5) * 0.5;
            growBranch(newX, newY, nextAngle, life - 1, currentBranch);
        };

        const initialBranches = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < initialBranches; i++) {
            const rootBranch = []; // Each initial growth is a new root branch
            growBranch(this.x, this.y, Math.random() * Math.PI * 2, config.STATIC_DENDRITE_LIFESPAN, rootBranch);
            if (rootBranch.length > 0) {
                branches.push(rootBranch);
            }
        }
        return branches;
    }

    draw() {
        // --- MODIFIED: Draw dendrites from the new hierarchical structure ---
        this.ctx.save();
        this.ctx.globalAlpha = this.config.STATIC_DENDRITE_OPACITY;
        this.ctx.strokeStyle = this.config.PARTICLE_COLOR;
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        // Iterate through each branch
        for (const branch of this.dendrites) {
            // Iterate through each segment in the branch
            for (const seg of branch) {
                this.ctx.moveTo(seg.fromX, seg.fromY);
                this.ctx.lineTo(seg.toX, seg.toY);
            }
        }
        this.ctx.stroke();
        this.ctx.restore();

        // Draw particle core
        const flashProgress = this.flashTTL > 0 ? this.flashTTL / this.config.FIRING_DURATION : 0;
        const flashMultiplier = Math.sin(flashProgress * Math.PI);
        const key = flashMultiplier > 0.5 ? `${this.intRadius}_flash` : `${this.intRadius}_base`;
        const pCanvas = Particle.renderedParticles.get(key);

        if (pCanvas) {
            const drawSize = pCanvas.width;
            this.ctx.drawImage(pCanvas, this.x - drawSize / 2, this.y - drawSize / 2);
        }
    }

    update() {
        // Bounce off walls
        if (this.x + this.radius > this.canvas.width || this.x - this.radius < 0) { this.vx = -this.vx; }
        if (this.y + this.radius > this.canvas.height || this.y - this.radius < 0) { this.vy = -this.vy; }
        
        // --- MODIFIED: Update particle and all its dendrite segments ---
        const dx = this.vx;
        const dy = this.vy;
        this.x += dx;
        this.y += dy;

        // Move the entire dendrite structure with the particle
        for (const branch of this.dendrites) {
            for (const seg of branch) {
                seg.fromX += dx;
                seg.fromY += dy;
                seg.toX += dx;
                seg.toY += dy;
            }
        }

        if (this.flashTTL > 0) this.flashTTL--;

        this.draw();
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const particleSystem = new ParticleSystem('neural-canvas');
    particleSystem.start();
});