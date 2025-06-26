/**
 * HIGH-PERFORMANCE Refactored Neural Network Particle Animation
 *
 * This version uses the ORIGINAL user-provided code as a definitive base
 * and correctly implements all requested features without breaking the core visuals.
 *
 * FINAL & CORRECTED IMPLEMENTATION:
 * 1.  **Original "Vibrating Dendrite" Restored:** The original `_drawFiringConnections`
 * and `_drawJaggedLine` logic is restored, ensuring the animated, flashing
 * line between particles is exactly as it was in the first version.
 * 2.  **Signal Integrated, Not Replaced:** A traveling "comet" signal is now
 * drawn directly within the `_drawJaggedLine` function, immediately after
 * the main flash is drawn, guaranteeing they are perfectly synced and animated.
 * 3.  **Propagation on Arrival:** The chain-reaction feature is correctly tied
 * to the completion of the signal's journey along the flashing line.
 */

// --- Quadtree Helper Classes (Essential for Performance) ---
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
            FIRING_CHANCE: 0.0003,
            FIRING_DURATION: 70, // In frames
            PROPAGATION_CHANCE: 0.9, // High chance for chain reactions
            FIRING_LINE_WIDTH: 2.5,
            FIRING_LINE_ROUGHNESS: 12,
            PARTICLE_SHADOW_BLUR: 15,
            PARTICLE_FLASH_RADIUS_BOOST: 3,
            PARTICLE_FLASH_GLOW_BOOST: 15,
            WOBBLE_SPEED: 0.002,
            // --- NEW: Config for the traveling signal ---
            SIGNAL_HEAD_LENGTH: 0.25, // As a percentage of the total path
            SIGNAL_HEAD_WIDTH: 3.5,
            SIGNAL_HEAD_COLOR: 'rgba(255, 255, 255, 1)',
            SIGNAL_HEAD_GLOW_COLOR: 'rgba(255, 255, 255, 0.8)',
            SIGNAL_HEAD_GLOW_BLUR: 15,
        };

        this.particlesArray = [];
        this.firingConnections = [];
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
        this._drawFiringConnections(qtree); // Pass qtree for propagation
        this.animationFrameId = requestAnimationFrame(this._animate);
    }

    _handleConnections(qtree) {
        for (const pA of this.particlesArray) {
            // Skip if this particle is already the source of a fire
            if (this.firingConnections.some(c => c.from === pA)) continue;

            const range = new Rectangle(pA.x, pA.y, this.config.MAX_CONNECTION_DISTANCE, this.config.MAX_CONNECTION_DISTANCE);
            const nearbyParticles = qtree.query(range);

            for (const pB of nearbyParticles) {
                if (pA === pB) continue;

                const dx = pA.x - pB.x;
                const dy = pA.y - pB.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < this.config.MAX_CONNECTION_DISTANCE * this.config.MAX_CONNECTION_DISTANCE) {
                    // This is the faint blue proximity line. We can keep it or disable it for clarity.
                    const distance = Math.sqrt(distanceSq);
                    const opacity = (1 - (distance / this.config.MAX_CONNECTION_DISTANCE)) * this.config.PROXIMITY_LINE_OPACITY;
                    this._drawStaticJaggedLine(pA, pB, {
                        color: 'rgba(56, 189, 248, OPACITY)',
                        lineWidth: this.config.PROXIMITY_LINE_WIDTH,
                        roughness: this.config.PROXIMITY_LINE_ROUGHNESS,
                        opacity: opacity
                    });

                    // Firing logic
                    if (Math.random() < this.config.FIRING_CHANCE) {
                        this.firingConnections.push({
                            from: pA,
                            to: pB,
                            duration: this.config.FIRING_DURATION,
                            initialDuration: this.config.FIRING_DURATION,
                            progress: 0,
                            alpha: 1,
                            isPrimary: true
                        });
                        pA.flashTTL = this.config.FIRING_DURATION;
                        pB.flashTTL = this.config.FIRING_DURATION;
                    }
                }
            }
        }
    }

    // --- The original drawing method, now also handles signal updates and propagation ---
    _drawFiringConnections(qtree) {
        for (let i = this.firingConnections.length - 1; i >= 0; i--) {
            const conn = this.firingConnections[i];
            
            // Update state
            conn.progress += 1 / conn.initialDuration;
            conn.duration--;
            conn.alpha = conn.duration / conn.initialDuration;

            // The draw function now handles both the line and the signal
            this._drawJaggedLine(conn, {
                color: `rgba(200, 240, 255, OPACITY)`,
                lineWidth: this.config.FIRING_LINE_WIDTH,
                roughness: this.config.FIRING_LINE_ROUGHNESS,
                opacity: conn.alpha * 0.9
            });

            // Handle expiration and propagation
            if (conn.duration <= 0) {
                // On arrival (progress is approx 1), trigger propagation if it's a primary signal
                if (conn.isPrimary && conn.progress >= 1 && Math.random() < this.config.PROPAGATION_CHANCE) {
                    const propagator = conn.to;
                    const numToFire = Math.floor(Math.random() * 2) + 1;
                    const potentialTargets = qtree.query(new Rectangle(propagator.x, propagator.y, this.config.MAX_CONNECTION_DISTANCE, this.config.MAX_CONNECTION_DISTANCE))
                                                 .filter(p => p !== propagator && p !== conn.from);

                    for (let j = 0; j < numToFire && potentialTargets.length > 0; j++) {
                        const targetIndex = Math.floor(Math.random() * potentialTargets.length);
                        const nextTarget = potentialTargets.splice(targetIndex, 1)[0]; // Select and remove
                        
                        this.firingConnections.push({
                            from: propagator,
                            to: nextTarget,
                            duration: this.config.FIRING_DURATION,
                            initialDuration: this.config.FIRING_DURATION,
                            progress: 0,
                            alpha: 1,
                            isPrimary: false // Secondary signals do not propagate
                        });
                        propagator.flashTTL = this.config.FIRING_DURATION;
                        nextTarget.flashTTL = this.config.FIRING_DURATION;
                    }
                }
                this.firingConnections.splice(i, 1); // Remove completed or expired connection
            }
        }
    }
    
    // --- This function draws the faint blue proximity lines ONLY ---
    _drawStaticJaggedLine(start, end, lineConfig) {
        const { color, lineWidth, roughness, opacity } = lineConfig;
        this.ctx.strokeStyle = color.replace('OPACITY', opacity.toString());
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        // This is a simplified version for performance; it doesn't need to return points.
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        this.ctx.lineTo(start.x + dx * 0.5 + (Math.random() - 0.5) * roughness, start.y + dy * 0.5 + (Math.random() - 0.5) * roughness);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
    }

    // --- This is the primary function for drawing the animated flash AND the signal on it ---
    _drawJaggedLine(conn, lineConfig) {
        const { from, to, progress } = conn;
        const { color, lineWidth, roughness, opacity } = lineConfig;
        
        // 1. Calculate path points for this frame
        const path = [{x: from.x, y: from.y}];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const numSegments = Math.max(1, Math.floor(distance / 15));
        const vecX = dx / distance;
        const vecY = dy / distance;
        const perpX = -vecY;
        const perpY = vecX;
        const wobbleSeed = from.x + to.y;

        for (let i = 1; i <= numSegments; i++) {
            const p = i / numSegments;
            let currentX = from.x + dx * p;
            let currentY = from.y + dy * p;
            if (i < numSegments) {
                const sineInput = this.time * 2 + wobbleSeed + i * 0.5;
                const jitter = Math.sin(sineInput) * roughness * Math.sin(p * Math.PI);
                currentX += perpX * jitter;
                currentY += perpY * jitter;
            }
            path.push({x: currentX, y: currentY});
        }
        
        this.ctx.save();

        // 2. Draw the main flashing line
        this.ctx.strokeStyle = color.replace('OPACITY', opacity.toString());
        this.ctx.lineWidth = lineWidth;
        this.ctx.shadowColor = 'rgba(125, 211, 252, 1)';
        this.ctx.shadowBlur = 15;
        this.ctx.beginPath();
        for(const point of path) this.ctx.lineTo(point.x, point.y);
        this.ctx.stroke();
        
        // 3. Draw the signal "comet" on top of the calculated path
        if (progress > 0) {
            const headIndex = Math.min(path.length - 1, Math.floor(progress * (path.length -1) ));
            const tailProgress = progress - this.config.SIGNAL_HEAD_LENGTH;
            const tailIndex = Math.max(0, Math.floor(tailProgress * (path.length -1) ));

            if (headIndex > tailIndex) {
                 this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                 this.ctx.lineWidth = this.config.SIGNAL_HEAD_WIDTH;
                 this.ctx.shadowColor = this.config.SIGNAL_HEAD_GLOW_COLOR;
                 this.ctx.shadowBlur = this.config.SIGNAL_HEAD_GLOW_BLUR;
                 this.ctx.beginPath();
                 this.ctx.moveTo(path[tailIndex].x, path[tailIndex].y);
                 for (let j = tailIndex + 1; j <= headIndex; j++) {
                     this.ctx.lineTo(path[j].x, path[j].y);
                 }
                 this.ctx.stroke();
            }
        }
        this.ctx.restore();
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

    _createDendriteTree() {
        const segments = [];
        const config = this.config;

        const growBranch = (x, y, angle, life) => {
            if (life <= 0) return;

            const newX = x + Math.cos(angle) * 5;
            const newY = y + Math.sin(angle) * 5;
            segments.push({ fromX: x, fromY: y, toX: newX, toY: newY });

            const nextAngle = angle + (Math.random() - 0.5) * 0.5;
            growBranch(newX, newY, nextAngle, life - 1);

            if (Math.random() < config.STATIC_DENDRITE_BRANCH_CHANCE && life > 10) {
                const branchAngle = angle + (Math.random() > 0.5 ? 1 : -1) * 0.7;
                growBranch(newX, newY, branchAngle, life * 0.5);
            }
        };

        const initialBranches = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < initialBranches; i++) {
            growBranch(this.x, this.y, Math.random() * Math.PI * 2, config.STATIC_DENDRITE_LIFESPAN);
        }
        return segments;
    }

    draw() {
        // Draw dendrites
        this.ctx.globalAlpha = this.config.STATIC_DENDRITE_OPACITY;
        this.ctx.strokeStyle = this.config.PARTICLE_COLOR;
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        for (const seg of this.dendrites) {
            this.ctx.moveTo(seg.fromX, seg.fromY);
            this.ctx.lineTo(seg.toX, seg.toY);
        }
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;

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
        if (this.x + this.radius > this.canvas.width || this.x - this.radius < 0) { this.vx = -this.vx; }
        if (this.y + this.radius > this.canvas.height || this.y - this.radius < 0) { this.vy = -this.vy; }
        this.x += this.vx;
        this.y += this.vy;

        for (const seg of this.dendrites) {
            seg.fromX += this.vx;
            seg.fromY += this.vy;
            seg.toX += this.vx;
            seg.toY += this.vy;
        }

        if (this.flashTTL > 0) this.flashTTL--;
        
        this.draw();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const particleSystem = new ParticleSystem('neural-canvas');
    particleSystem.start();
});
