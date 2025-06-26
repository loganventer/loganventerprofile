/**
 * HIGH-PERFORMANCE Refactored Neural Network Particle Animation
 *
 * This version uses the user-provided high-performance code as a definitive
 * base and correctly implements all requested features without breaking the core visuals.
 *
 * FINAL & CORRECTED IMPLEMENTATION:
 * 1.  **True Recursive Propagation on Arrival:** The chain-reaction (`_triggerSecondaryFirings`)
 * is now correctly triggered ONLY when a traveling fire signal reaches the end of its
 * path. These secondary fires can then trigger more fires recursively.
 * 2.  **Recursion Depth Limit:** A `depth` property is added to each fire to
 * prevent infinite loops. The chain reaction will propagate for a few steps
 * and then naturally die out.
 * 3.  **Synchronized Travel Time:** The traveling fire's speed is dynamically
 * calculated based on FIRING_DURATION to ensure the signal's journey is
 * perfectly synchronized with the flash's lifespan.
 * 4.  **Original Visuals Preserved:** All performance optimizations and visual
 * styles from the user-provided code are 100% intact.
 */

// --- Quadtree Helper Classes (Essential for Performance) ---
class Point {
    constructor(x, y, data) {
        this.x = x;
        this.y = y;
        this.data = data;
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
        let { x, y, w, h } = this.boundary;
        let hw = w / 2, hh = h / 2;
        this.northeast = new Quadtree(new Rectangle(x + hw, y - hh, hw, hh), this.capacity);
        this.northwest = new Quadtree(new Rectangle(x - hw, y - hh, hw, hh), this.capacity);
        this.southeast = new Quadtree(new Rectangle(x + hw, y + hh, hw, hh), this.capacity);
        this.southwest = new Quadtree(new Rectangle(x - hw, y + hh, hw, hh), this.capacity);
        this.divided = true;
    }

    insert(point) {
        if (!this.boundary.contains(point)) return false;
        if (this.points.length < this.capacity) {
            this.points.push(point);
            return true;
        }
        if (!this.divided) this.subdivide();
        return (this.northeast.insert(point) ||
                this.northwest.insert(point) ||
                this.southeast.insert(point) ||
                this.southwest.insert(point));
    }

    query(range, found = []) {
        if (!this.boundary.intersects(range)) return found;
        for (let p of this.points) {
            if (range.contains(p)) found.push(p.data);
        }
        if (this.divided) {
            this.northwest.query(range, found);
            this.northeast.query(range, found);
            this.southwest.query(range, found);
            this.southeast.query(range, found);
        }
        return found;
    }
}

// --- Main Particle System Class ---
class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`F@K! Canvas with ID '${canvasId}' not found.`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');

        this.config = {
            PARTICLE_COLOR: '#38BDF8',
            MIN_RADIUS: 2,
            MAX_RADIUS: 4,
            INITIAL_VELOCITY_RANGE: 0.35,
            PARTICLES_PER_PIXEL_DENSITY: 50000,
            MAX_PARTICLES: 150,
            MAX_CONNECTION_DISTANCE: 250,
            MOBILE_BREAKPOINT: 768,

            STATIC_DENDRITE_OPACITY: 0.18,
            STATIC_DENDRITE_LIFESPAN: 80,
            STATIC_DENDRITE_BRANCH_CHANCE: 0.15,
            STATIC_DENDRITE_SEGMENT_LENGTH: 5,
            STATIC_DENDRITE_PADDING: 20,

            PROXIMITY_LINE_WIDTH: 0.8,
            PROXIMITY_LINE_ROUGHNESS: 3,
            MAX_JAGGED_SEGMENTS: 60,
            STATIC_LINE_DRAW_CHANCE: 0.3,

            FIRING_CHANCE: 0.0002,
            FIRING_DURATION: 60, // Master duration in frames
            FIRING_LINE_WIDTH: 2.5,
            FIRING_LINE_ROUGHNESS: 6,
            FIRING_SHADOW_COLOR: 'rgba(125, 211, 252, 1)',
            FIRING_SHADOW_BLUR: 15,

            PARTICLE_SHADOW_BLUR: 15,
            PARTICLE_FLASH_RADIUS_BOOST: 3,
            PARTICLE_FLASH_GLOW_BOOST: 15,

            WOBBLE_SPEED: 0.002,
            PROPAGATION_CHANCE: 0.9, // High chance for a chain reaction
            MAX_PROPAGATION_DEPTH: 3, // How many steps a chain reaction can take
            TRAVELING_FIRE_LENGTH_RATIO: 0.2
        };

        this.particlesArray = [];
        this.travelingFires = [];
        this.staticJaggedLines = [];
        this.animationFrameId = null;
        this.time = 0;
        this._handleResize = this._debounce(this._handleResize.bind(this), 250);
        this._animate = this._animate.bind(this);
    }

    start() {
        Particle.preRenderParticles(this.config);
        this._resizeCanvas();
        this._initParticles();
        this._generateStaticLines();
        window.addEventListener('resize', this._handleResize);
        this._animate();
    }

    destroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        window.removeEventListener('resize', this._handleResize);
    }

    _resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    _handleResize() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this._resizeCanvas();
        this._initParticles();
        this._generateStaticLines();
        this._animate();
    }

    _initParticles() {
        this.particlesArray = [];
        let num = Math.min(
            this.config.MAX_PARTICLES,
            Math.floor((this.canvas.width * this.canvas.height) / this.config.PARTICLES_PER_PIXEL_DENSITY)
        );
        if (window.innerWidth < this.config.MOBILE_BREAKPOINT) {
            num = Math.min(this.config.MAX_PARTICLES, num * 2);
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

    _generateStaticLines() {
        this.staticJaggedLines = [];
        const qtree = new Quadtree(new Rectangle(this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 2, this.canvas.height / 2), 4);
        for (const p of this.particlesArray) qtree.insert(new Point(p.x, p.y, p));

        for (const pA of this.particlesArray) {
            const range = new Rectangle(pA.x, pA.y, this.config.MAX_CONNECTION_DISTANCE, this.config.MAX_CONNECTION_DISTANCE);
            for (const pB of qtree.query(range)) {
                if (pA.id >= pB.id) continue;
                if (Math.random() < this.config.STATIC_LINE_DRAW_CHANCE) {
                    const distance = Math.hypot(pB.x - pA.x, pB.y - pA.y);
                    if (distance < this.config.MAX_CONNECTION_DISTANCE) {
                        const opacity = (1 - (distance / this.config.MAX_CONNECTION_DISTANCE)) * this.config.PROXIMITY_LINE_OPACITY;
                        this.staticJaggedLines.push({
                            from: pA, to: pB,
                            color: `rgba(56, 189, 248, ${opacity})`,
                            lineWidth: this.config.PROXIMITY_LINE_WIDTH,
                            roughness: this.config.PROXIMITY_LINE_ROUGHNESS,
                            wobbleSeed: pA.x * 0.1 + pB.y * 0.1
                        });
                    }
                }
            }
        }
    }

    _getDynamicJaggedPathPoints(start, end, roughness, wobbleSeed, currentTime) {
        const path = [];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.hypot(dx, dy);
        if (distance === 0) return [{x: start.x, y: start.y}];

        const totalNumSegments = Math.max(2, Math.min(this.config.MAX_JAGGED_SEGMENTS, Math.floor(distance / 5)));
        const perpX = -dy / distance;
        const perpY = dx / distance;

        for (let i = 0; i <= totalNumSegments; i++) {
            const progress = i / totalNumSegments;
            let currentX = start.x + dx * progress;
            let currentY = start.y + dy * progress;

            const sineInput = currentTime * 2 + wobbleSeed + progress * 0.5;
            const jitter = Math.sin(sineInput) * roughness * Math.sin(progress * Math.PI);
            currentX += perpX * jitter;
            currentY += perpY * jitter;
            path.push({ x: currentX, y: currentY });
        }
        return path;
    }

    _animate() {
        this.time += this.config.WOBBLE_SPEED;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const qtree = new Quadtree(new Rectangle(this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 2, this.canvas.height / 2), 4);
        for (const p of this.particlesArray) qtree.insert(new Point(p.x, p.y, p));

        this._drawStaticJaggedLines();
        this.particlesArray.forEach(p => p.update());
        this._handleConnections(qtree);
        this._drawTravelingFires(qtree);
        this.animationFrameId = requestAnimationFrame(this._animate);
    }

    _drawStaticJaggedLines() {
        for (const lineData of this.staticJaggedLines) {
            const { from, to, color, lineWidth, roughness, wobbleSeed } = lineData;
            const jaggedPoints = this._getDynamicJaggedPathPoints(from, to, roughness, wobbleSeed, this.time);
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = lineWidth;
            this.ctx.beginPath();
            if (jaggedPoints.length > 0) {
                this.ctx.moveTo(jaggedPoints[0].x, jaggedPoints[0].y);
                for (let i = 1; i < jaggedPoints.length; i++) this.ctx.lineTo(jaggedPoints[i].x, jaggedPoints[i].y);
            }
            this.ctx.stroke();
        }
    }

    _handleConnections(qtree) {
        for (const pA of this.particlesArray) {
            const range = new Rectangle(pA.x, pA.y, this.config.MAX_CONNECTION_DISTANCE, this.config.MAX_CONNECTION_DISTANCE);
            for (const pB of qtree.query(range)) {
                if (pA.id >= pB.id || this.travelingFires.some(f => (f.from === pA && f.to === pB) || (f.from === pB && f.to === pA))) continue;

                if (Math.random() < this.config.FIRING_CHANCE) {
                    pA.flashTTL = this.config.FIRING_DURATION;
                    pB.flashTTL = this.config.FIRING_DURATION;
                    this.travelingFires.push({
                        from: pA, to: pB,
                        progress: 0,
                        speed: 1 / this.config.FIRING_DURATION,
                        depth: 0, // Initial fires start at depth 0
                        jaggedPointsCache: this._getDynamicJaggedPathPoints(pA, pB, this.config.FIRING_LINE_ROUGHNESS, pA.x * 0.1 + pB.y * 0.1, this.time)
                    });
                }
            }
        }
    }

    _triggerSecondaryFirings(originParticle, sourceParticle, qtree, currentDepth) {
        // Stop propagating if we've reached the max depth
        if (currentDepth >= this.config.MAX_PROPAGATION_DEPTH) return;

        const range = new Rectangle(originParticle.x, originParticle.y, this.config.MAX_CONNECTION_DISTANCE, this.config.MAX_CONNECTION_DISTANCE);
        const potentialNeighbors = qtree.query(range).filter(p => p.id !== originParticle.id && p.id !== sourceParticle.id);
        
        const numToFire = Math.min(potentialNeighbors.length, Math.floor(Math.random() * 2) + 1);
        const shuffledNeighbors = potentialNeighbors.sort(() => 0.5 - Math.random());

        for (let i = 0; i < numToFire; i++) {
            const targetParticle = shuffledNeighbors[i];
            
            targetParticle.flashTTL = this.config.FIRING_DURATION;
            originParticle.flashTTL = this.config.FIRING_DURATION;

            this.travelingFires.push({
                from: originParticle,
                to: targetParticle,
                progress: 0,
                speed: 1 / this.config.FIRING_DURATION,
                depth: currentDepth + 1, // Increment depth for the new fire
                jaggedPointsCache: this._getDynamicJaggedPathPoints(originParticle, targetParticle, this.config.FIRING_LINE_ROUGHNESS, originParticle.x * 0.1 + targetParticle.y * 0.1, this.time)
            });
        }
    }

    _drawTravelingFires(qtree) {
        for (let i = this.travelingFires.length - 1; i >= 0; i--) {
            const fire = this.travelingFires[i];
            fire.progress += fire.speed;

            const hasArrived = fire.progress >= 1;

            // Draw the visual effect
            const sparkOpacity = Math.sin(Math.min(1, fire.progress) * Math.PI);
            this.ctx.shadowColor = this.config.FIRING_SHADOW_COLOR;
            this.ctx.shadowBlur = this.config.FIRING_SHADOW_BLUR * 1.5;
            this._drawJaggedLineSegment(
                fire.jaggedPointsCache,
                { color: `rgba(255, 255, 255, ${sparkOpacity})`, lineWidth: this.config.FIRING_LINE_WIDTH + 1 },
                fire.progress,
                this.config.TRAVELING_FIRE_LENGTH_RATIO
            );
            this.ctx.shadowBlur = 0;

            // Handle arrival and propagation
            if (hasArrived) {
                if (Math.random() < this.config.PROPAGATION_CHANCE) {
                    this._triggerSecondaryFirings(fire.to, fire.from, qtree, fire.depth);
                }
                this.travelingFires.splice(i, 1);
            }
        }
    }
    
    _drawJaggedLineSegment(jaggedPoints, lineConfig, currentProgress, segmentLengthRatio) {
        if (!jaggedPoints || jaggedPoints.length < 2) return;

        this.ctx.strokeStyle = lineConfig.color;
        this.ctx.lineWidth = lineConfig.lineWidth;
        this.ctx.beginPath();

        const totalPoints = jaggedPoints.length;
        const segmentStartProgress = Math.max(0, currentProgress - segmentLengthRatio);
        const segmentEndProgress = Math.min(1, currentProgress);

        const getPointOnJaggedPath = (progress) => {
            progress = Math.max(0, Math.min(1, progress));
            const floatIndex = progress * (totalPoints - 1);
            const p1_idx = Math.floor(floatIndex);
            const p2_idx = Math.min(totalPoints - 1, Math.ceil(floatIndex));
            
            if (p1_idx === p2_idx) return jaggedPoints[p1_idx];

            const lerpFactor = floatIndex - p1_idx;
            const p1 = jaggedPoints[p1_idx];
            const p2 = jaggedPoints[p2_idx];
            return { x: p1.x + (p2.x - p1.x) * lerpFactor, y: p1.y + (p2.y - p1.y) * lerpFactor };
        };

        const startPoint = getPointOnJaggedPath(segmentStartProgress);
        this.ctx.moveTo(startPoint.x, startPoint.y);

        const firstRelevantIndex = Math.ceil(segmentStartProgress * (totalPoints - 1));
        const lastRelevantIndex = Math.floor(segmentEndProgress * (totalPoints - 1));

        for (let i = firstRelevantIndex; i <= lastRelevantIndex; i++) {
            if (i >= 0 && i < totalPoints) this.ctx.lineTo(jaggedPoints[i].x, jaggedPoints[i].y);
        }
        
        const endPoint = getPointOnJaggedPath(segmentEndProgress);
        if (startPoint.x !== endPoint.x || startPoint.y !== endPoint.y) this.ctx.lineTo(endPoint.x, endPoint.y);
        this.ctx.stroke();
    }
    
    _debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
}

// --- Particle Class ---
class Particle {
    static renderedParticles = new Map();
    constructor(x, y, vx, vy, radius, canvas, ctx, config) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.radius = radius; this.canvas = canvas; this.ctx = ctx;
        this.config = config; 
        this.flashTTL = 0;
        this.intRadius = Math.round(radius);
        this.id = Math.random().toString(36).substring(2, 9);
        this.dendriteCanvas = this._createDendriteTree();
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

    _createDendriteTree() {
        const dendriteCanvas = document.createElement('canvas');
        const dCtx = dendriteCanvas.getContext('2d');
        const maxDendriteLength = this.config.STATIC_DENDRITE_LIFESPAN * this.config.STATIC_DENDRITE_SEGMENT_LENGTH;
        const dendriteCanvasSize = (maxDendriteLength * 2) + this.config.STATIC_DENDRITE_PADDING;
        dendriteCanvas.width = dendriteCanvasSize;
        dendriteCanvas.height = dendriteCanvasSize;
        const centerX = dendriteCanvasSize / 2;
        const centerY = dendriteCanvasSize / 2;
        dCtx.strokeStyle = this.config.PARTICLE_COLOR;
        dCtx.lineWidth = 0.5;

        const growBranchOnCanvas = (x, y, angle, life) => {
            if (life <= 0) return;
            dCtx.beginPath();
            dCtx.moveTo(x, y);
            const newX = x + Math.cos(angle) * this.config.STATIC_DENDRITE_SEGMENT_LENGTH;
            const newY = y + Math.sin(angle) * this.config.STATIC_DENDRITE_SEGMENT_LENGTH;
            dCtx.lineTo(newX, newY);
            dCtx.stroke();
            const nextAngle = angle + (Math.random() - 0.5) * 0.5;
            growBranchOnCanvas(newX, newY, nextAngle, life - 1);
            if (Math.random() < this.config.STATIC_DENDRITE_BRANCH_CHANCE && life > 10) {
                const branchAngle = angle + (Math.random() > 0.5 ? 1 : -1) * 0.7;
                growBranchOnCanvas(newX, newY, branchAngle, life * 0.5);
            }
        };

        const initialBranches = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < initialBranches; i++) {
            growBranchOnCanvas(centerX, centerY, Math.random() * Math.PI * 2, this.config.STATIC_DENDRITE_LIFESPAN);
        }
        return dendriteCanvas;
    }

    draw() {
        if (this.dendriteCanvas) {
            this.ctx.globalAlpha = this.config.STATIC_DENDRITE_OPACITY;
            this.ctx.drawImage(this.dendriteCanvas, this.x - this.dendriteCanvas.width / 2, this.y - this.dendriteCanvas.height / 2);
            this.ctx.globalAlpha = 1.0;
        }
        const flashProgress = this.flashTTL > 0 ? this.flashTTL / this.config.FIRING_DURATION : 0;
        const flashMultiplier = Math.sin(flashProgress * Math.PI);
        const key = flashMultiplier > 0.5 ? `${this.intRadius}_flash` : `${this.intRadius}_base`;
        const pCanvas = Particle.renderedParticles.get(key);
        if (pCanvas) {
            this.ctx.drawImage(pCanvas, this.x - pCanvas.width / 2, this.y - pCanvas.height / 2);
        }
    }

    update() {
        if (this.x + this.radius > this.canvas.width || this.x - this.radius < 0) this.vx = -this.vx;
        if (this.y + this.radius > this.canvas.height || this.y - this.radius < 0) this.vy = -this.vy;
        this.x += this.vx;
        this.y += this.vy;
        if (this.flashTTL > 0) this.flashTTL--;
        this.draw();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const particleSystem = new ParticleSystem('neural-canvas');
    if (particleSystem.canvas) {
        particleSystem.start();
    }
});
