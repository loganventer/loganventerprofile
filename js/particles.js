/**
 * HIGH-PERFORMANCE Refactored Neural Network Particle Animation
 *
 * This version uses the user-provided high-performance code as a definitive
 * base and correctly implements the signal propagation on arrival.
 *
 * FINAL & CORRECTED IMPLEMENTATION:
 * 1.  **Propagation on Arrival:** The chain-reaction (`_triggerSecondaryFirings`)
 * is no longer triggered instantly. It is now correctly triggered ONLY when a
 * traveling fire signal reaches the end of its path (progress >= 1).
 * 2.  **Synchronized Travel Time:** The traveling fire's speed is now
 * dynamically calculated based on FIRING_DURATION. This ensures the signal's
 * journey is perfectly synchronized with the flash's lifespan, regardless of
 * the distance between particles.
 * 3.  **Original Visuals Preserved:** All performance optimizations and visual
 * styles from the user-provided code, including the animated jagged lines
 * and pre-rendered assets, are 100% intact.
 */

// --- Quadtree Helper Classes (Essential for Performance) ---
// These classes efficiently manage spatial data for quick proximity queries,
// preventing an O(N^2) particle-to-particle comparison on every frame.
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

    // Checks if a point is contained within this rectangle
    contains(point) {
        return (point.x >= this.x - this.w &&
                point.x <= this.x + this.w &&
                point.y >= this.y - this.h &&
                point.y <= this.y + this.h);
    }

    // Checks if this rectangle intersects with another rectangle (range)
    intersects(range) {
        return !(range.x - range.w > this.x + this.w ||
                range.x + range.w < this.x - this.w ||
                range.y - range.h > this.y + this.h ||
                range.y + range.h < this.y - this.h);
    }
}

class Quadtree {
    constructor(boundary, capacity) {
        this.boundary = boundary; // The rectangular area this Quadtree covers
        this.capacity = capacity; // Maximum number of points before subdividing
        this.points = []; // Points (particles) directly stored in this node
        this.divided = false; // Flag to indicate if this node has been subdivided
    }

    // Subdivides the current Quadtree into four smaller Quadtrees
    subdivide() {
        let x = this.boundary.x;
        let y = this.boundary.y;
        let w = this.boundary.w / 2;
        let h = this.boundary.h / 2;

        // Create four new child Quadtrees for each quadrant
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

    // Inserts a point into the Quadtree
    insert(point) {
        // If the point is not within this Quadtree's boundary, it cannot be inserted here
        if (!this.boundary.contains(point)) {
            return false;
        }

        // If capacity allows, add the point to this node
        if (this.points.length < this.capacity) {
            this.points.push(point);
            return true;
        } else {
            // If capacity is full, subdivide if not already, and then insert into children
            if (!this.divided) {
                this.subdivide();
            }
            // Attempt to insert into each child; point will only be contained by one
            return (this.northeast.insert(point) ||
                    this.northwest.insert(point) ||
                    this.southeast.insert(point) ||
                    this.southwest.insert(point));
        }
    }

    // Queries the Quadtree for points within a given range
    query(range, found) {
        // Initialize found array if not provided
        if (!found) {
            found = [];
        }
        // If the query range does not intersect this Quadtree's boundary, no points can be found
        if (!this.boundary.intersects(range)) {
            return found;
        } else {
            // Check points directly in this node
            for (let p of this.points) {
                if (range.contains(p)) {
                    found.push(p.data); // Push the actual particle object (data)
                }
            }
            // If subdivided, recursively query child Quadtrees
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

// --- Main Particle System Class ---
// Manages the overall animation, particles, connections, and rendering.
class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`F@K! Canvas with ID '${canvasId}' not found. Cannot start the particle system.`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');

        // Configuration constants for fine-tuning the visual effects.
        // These are critical for controlling the look and feel.
        this.config = {
            PARTICLE_COLOR: '#38BDF8', // The base color for particles and lines (light blue)
            MIN_RADIUS: 2,           // Minimum radius of particles
            MAX_RADIUS: 4,           // Maximum radius of particles
            INITIAL_VELOCITY_RANGE: 0.35, // How fast particles initially move
            PARTICLES_PER_PIXEL_DENSITY: 50000, // Density of particles (higher for fewer particles on large screens)
            MAX_PARTICLES: 150,      // Absolute maximum number of particles to prevent slowdown on 4K+ displays
            MAX_CONNECTION_DISTANCE: 250,      // Max distance for lines between particles
            MOBILE_BREAKPOINT: 768,        // Screen width to consider as mobile for particle density adjustment

            STATIC_DENDRITE_OPACITY: 0.18,     // Opacity of the background static dendrites
            STATIC_DENDRITE_LIFESPAN: 80,      // Length/complexity of each dendrite branch (increased for more biological look)
            STATIC_DENDRITE_BRANCH_CHANCE: 0.15, // Chance for a dendrite branch to split (increased for more branches)
            STATIC_DENDRITE_SEGMENT_LENGTH: 5,   // Length of each small segment in a dendrite branch
            STATIC_DENDRITE_PADDING: 20,       // Padding for the pre-rendered dendrite canvas

            PROXIMITY_LINE_OPACITY: 0.5,       // Opacity of regular proximity lines
            PROXIMITY_LINE_WIDTH: 0.8,         // Width of regular proximity lines
            PROXIMITY_LINE_ROUGHNESS: 3,       // Roughness/jaggedness of regular lines (reduced for less wobble)
            MAX_JAGGED_SEGMENTS: 60,       // Max segments for a jagged line (limits drawing complexity for long lines)

            STATIC_LINE_DRAW_CHANCE: 0.3,      // Chance (0.0 - 1.0) for a static background line to be drawn. CRITICAL FOR 4K.

            FIRING_CHANCE: 0.0002,         // Chance for a connection to "fire" (become active)
            FIRING_DURATION: 60,           // Duration of a firing connection's animation in frames
            FIRING_LINE_WIDTH: 2.5,          // Width of firing lines
            FIRING_LINE_ROUGHNESS: 6,        // Roughness/jaggedness of firing lines
            FIRING_STROKE_COLOR_BASE: 'rgba(200, 240, 255, ', // Base color for firing lines (white-blue)
            FIRING_SHADOW_COLOR: 'rgba(125, 211, 252, 1)',   // Shadow color for firing lines (bright blue)
            FIRING_SHADOW_BLUR: 15,          // Shadow blur for firing lines

            PARTICLE_SHADOW_BLUR: 15,          // Base shadow blur for particles
            PARTICLE_FLASH_RADIUS_BOOST: 3,    // How much radius increases when a particle flashes
            PARTICLE_FLASH_GLOW_BOOST: 15,     // How much glow increases when a particle flashes

            WOBBLE_SPEED: 0.002,           // Speed at which the line wobble animates
            SECONDARY_FIRING_DELAY: 50,      // Delay in milliseconds before secondary firings
            PROPAGATION_CHANCE: 0.8,         // Chance a primary signal will propagate
            TRAVELING_FIRE_LENGTH_RATIO: 0.2    // Length of the traveling fire segment as a ratio of total line distance
        };

        this.particlesArray = [];
        this.travelingFires = [];      // For the moving "spark" effect
        this.staticJaggedLines = []; // Cache for pre-calculated static background lines
        this.animationFrameId = null; // Stores the requestAnimationFrame ID for cancellation
        this.time = 0; // Used for wobble animation and other time-based effects

        // Bind and debounce the resize handler to prevent performance issues
        this._handleResize = this._debounce(this._handleResize.bind(this), 250);
        this._animate = this._animate.bind(this); // Ensure 'this' context for animation loop
    }

    // Starts the particle system
    start() {
        Particle.preRenderParticles(this.config);
        this._resizeCanvas();
        this._initParticles();
        this._generateStaticLines(); // Generate and cache static lines once
        window.addEventListener('resize', this._handleResize); // Listen for window resize events
        this._animate(); // Begin the animation loop
    }

    // Destroys the particle system, cleaning up resources
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId); // Stop the animation
        }
        window.removeEventListener('resize', this._handleResize); // Remove event listener
        console.log("Particle system destroyed and resources cleaned up.");
    }

    // Resizes the canvas to match the window dimensions
    _resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    // Handles window resize: stops animation, resizes, re-initializes, and restarts
    _handleResize() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this._resizeCanvas();
        this._initParticles();
        this._generateStaticLines(); // Re-generate and cache static lines on resize
        this._animate();
    }

    // Initializes/re-initializes the array of particles
    _initParticles() {
        this.particlesArray = [];
        let num = Math.floor((this.canvas.width * this.canvas.height) / this.config.PARTICLES_PER_PIXEL_DENSITY);
        
        num = Math.min(num, this.config.MAX_PARTICLES);

        if (window.innerWidth < this.config.MOBILE_BREAKPOINT) {
            num *= 2; 
            num = Math.min(num, this.config.MAX_PARTICLES);
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
        const boundary = new Rectangle(this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 2, this.canvas.height / 2);
        const qtree = new Quadtree(boundary, 4);
        for (const p of this.particlesArray) {
            qtree.insert(new Point(p.x, p.y, p));
        }

        for (const pA of this.particlesArray) {
            const range = new Rectangle(pA.x, pA.y, this.config.MAX_CONNECTION_DISTANCE, this.config.MAX_CONNECTION_DISTANCE);
            const nearbyParticles = qtree.query(range);

            for (const pB of nearbyParticles) {
                if (pA === pB || pA.id >= pB.id) continue;

                const dx = pB.x - pA.x;
                const dy = pB.y - pA.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < this.config.MAX_CONNECTION_DISTANCE * this.config.MAX_CONNECTION_DISTANCE) {
                    if (Math.random() < this.config.STATIC_LINE_DRAW_CHANCE) {
                        const distance = Math.sqrt(distanceSq);
                        const opacity = (1 - (distance / this.config.MAX_CONNECTION_DISTANCE)) * this.config.PROXIMITY_LINE_OPACITY;

                        const lineData = {
                            from: pA,
                            to: pB,
                            color: `rgba(56, 189, 248, ${opacity})`,
                            lineWidth: this.config.PROXIMITY_LINE_WIDTH,
                            roughness: this.config.PROXIMITY_LINE_ROUGHNESS,
                            wobbleSeed: pA.x * 0.1 + pB.y * 0.1
                        };
                        this.staticJaggedLines.push(lineData);
                    }
                }
            }
        }
    }

    _getDynamicJaggedPathPoints(start, end, roughness, wobbleSeed, currentTime) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance === 0) return [{x: start.x, y: start.y}];

        const totalNumSegments = Math.max(2, Math.min(this.config.MAX_JAGGED_SEGMENTS, Math.floor(distance / 5)));
        
        const vecX = dx / distance;
        const vecY = dy / distance;
        const perpX = -vecY;
        const perpY = vecX;
        const jaggedPoints = [];

        for (let i = 0; i <= totalNumSegments; i++) {
            const currentTotalProgress = i / totalNumSegments;
            let currentX = start.x + dx * currentTotalProgress;
            let currentY = start.y + dy * currentTotalProgress;

            const sineInput = currentTime * 2 + wobbleSeed + currentTotalProgress * 0.5;
            const jitter = Math.sin(sineInput) * roughness * Math.sin(currentTotalProgress * Math.PI);
            currentX += perpX * jitter;
            currentY += perpY * jitter;
            jaggedPoints.push({ x: currentX, y: currentY });
        }
        return jaggedPoints;
    }

    // The main animation loop
    _animate() {
        this.time += this.config.WOBBLE_SPEED;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const boundary = new Rectangle(this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 2, this.canvas.height / 2);
        const qtree = new Quadtree(boundary, 4);
        for (const p of this.particlesArray) {
            qtree.insert(new Point(p.x, p.y, p));
        }

        this._drawStaticJaggedLines();
        this.particlesArray.forEach(p => p.update());
        this._handleConnections(qtree); 
        this._drawTravelingFires(qtree); // Pass qtree for propagation
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
                for (let i = 1; i < jaggedPoints.length; i++) {
                    this.ctx.lineTo(jaggedPoints[i].x, jaggedPoints[i].y);
                }
            }
            this.ctx.stroke();
        }
    }

    _handleConnections(qtree) {
        for (const pA of this.particlesArray) {
            const range = new Rectangle(pA.x, pA.y, this.config.MAX_CONNECTION_DISTANCE, this.config.MAX_CONNECTION_DISTANCE);
            const nearbyParticles = qtree.query(range);

            for (const pB of nearbyParticles) {
                if (pA === pB || pA.id >= pB.id) continue;
                // Prevent creating a new fire if one between these particles already exists
                 if (this.travelingFires.some(f => (f.from === pA && f.to === pB) || (f.from === pB && f.to === pA))) continue;

                const dx = pB.x - pA.x;
                const dy = pB.y - pA.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < this.config.MAX_CONNECTION_DISTANCE * this.config.MAX_CONNECTION_DISTANCE) {
                    if (Math.random() < this.config.FIRING_CHANCE) {
                        pA.flashTTL = this.config.FIRING_DURATION;
                        pB.flashTTL = this.config.FIRING_DURATION;

                        this.travelingFires.push({
                            from: pA,
                            to: pB,
                            progress: 0,
                            // CORRECTED: Speed is now calculated for perfect sync
                            speed: 1 / this.config.FIRING_DURATION, 
                            isPrimary: true, // Mark as a signal that can propagate
                            // Cache the path once on creation
                            jaggedPointsCache: this._getDynamicJaggedPathPoints(pA, pB, this.config.FIRING_LINE_ROUGHNESS, pA.x * 0.1 + pB.y * 0.1, this.time)
                        });
                        
                        // REMOVED: Do not trigger secondary firings here. This happens on arrival.
                    }
                }
            }
        }
    }

    _triggerSecondaryFirings(originParticle, qtree, delay) {
        const range = new Rectangle(originParticle.x, originParticle.y, this.config.MAX_CONNECTION_DISTANCE, this.config.MAX_CONNECTION_DISTANCE);
        const potentialNeighbors = qtree.query(range);

        const connectedNeighbors = [];
        for (const neighbor of potentialNeighbors) {
            if (originParticle === neighbor) continue;

            const dx = neighbor.x - originParticle.x;
            const dy = neighbor.y - originParticle.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq < this.config.MAX_CONNECTION_DISTANCE * this.config.MAX_CONNECTION_DISTANCE) {
                connectedNeighbors.push(neighbor);
            }
        }

        const numToFire = Math.min(connectedNeighbors.length, 1 + Math.floor(Math.random() * 2));
        const shuffledNeighbors = connectedNeighbors.sort(() => 0.5 - Math.random());

        for (let i = 0; i < numToFire; i++) {
            const targetParticle = shuffledNeighbors[i];
            
            setTimeout(() => {
                targetParticle.flashTTL = this.config.FIRING_DURATION;
                originParticle.flashTTL = this.config.FIRING_DURATION;

                this.travelingFires.push({
                    from: originParticle,
                    to: targetParticle,
                    progress: 0,
                    speed: 1 / this.config.FIRING_DURATION,
                    isPrimary: false, // Secondary fires do not propagate
                    jaggedPointsCache: this._getDynamicJaggedPathPoints(originParticle, targetParticle, this.config.FIRING_LINE_ROUGHNESS, originParticle.x * 0.1 + targetParticle.y * 0.1, this.time)
                });

            }, delay * (i + 1));
        }
    }

    // CORRECTED: Now takes qtree to handle propagation on arrival
    _drawTravelingFires(qtree) {
        for (let i = this.travelingFires.length - 1; i >= 0; i--) {
            const fire = this.travelingFires[i];

            fire.progress += fire.speed;

            // Base opacity fades with progress
            const sparkOpacity = Math.sin(fire.progress * Math.PI);

            this.ctx.shadowColor = this.config.FIRING_SHADOW_COLOR;
            this.ctx.shadowBlur = this.config.FIRING_SHADOW_BLUR * 1.5;

            // Draw the line segment for the traveling fire
            this._drawJaggedLineSegment(
                fire.jaggedPointsCache,
                {
                    color: `rgba(255, 255, 255, ${sparkOpacity})`,
                    lineWidth: this.config.FIRING_LINE_WIDTH + 1
                },
                fire.progress,
                this.config.TRAVELING_FIRE_LENGTH_RATIO
            );

            this.ctx.shadowBlur = 0;

            // CORRECTED: Check for arrival and trigger propagation
            if (fire.progress >= 1) {
                // If it's a primary fire and propagation roll succeeds, trigger next fires
                if (fire.isPrimary && Math.random() < this.config.PROPAGATION_CHANCE) {
                    this._triggerSecondaryFirings(fire.to, qtree, this.config.SECONDARY_FIRING_DELAY);
                }
                // Remove the completed fire from the array
                this.travelingFires.splice(i, 1);
            }
        }
    }
    
    _drawJaggedLineSegment(jaggedPoints, lineConfig, currentProgress, segmentLengthRatio) {
        const { color, lineWidth } = lineConfig;
        
        if (!jaggedPoints || jaggedPoints.length < 2) return;

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();

        const totalPoints = jaggedPoints.length;

        const segmentStartProgress = Math.max(0, currentProgress - segmentLengthRatio);
        const segmentEndProgress = Math.min(1, currentProgress);

        const getPointOnJaggedPath = (progress) => {
            progress = Math.max(0, Math.min(1, progress));
            const floatIndex = progress * (totalPoints - 1);
            const p1_idx = Math.floor(floatIndex);
            const p2_idx = Math.min(totalPoints - 1, Math.ceil(floatIndex));
            
            if (p1_idx === p2_idx) {
                return jaggedPoints[p1_idx];
            }

            const lerpFactor = floatIndex - p1_idx;
            const p1 = jaggedPoints[p1_idx];
            const p2 = jaggedPoints[p2_idx];

            return {
                x: p1.x + (p2.x - p1.x) * lerpFactor,
                y: p1.y + (p2.y - p1.y) * lerpFactor
            };
        };

        const startPoint = getPointOnJaggedPath(segmentStartProgress);
        const endPoint = getPointOnJaggedPath(segmentEndProgress);

        this.ctx.moveTo(startPoint.x, startPoint.y);

        const firstRelevantIndex = Math.ceil(segmentStartProgress * (totalPoints - 1));
        const lastRelevantIndex = Math.floor(segmentEndProgress * (totalPoints - 1));

        for (let i = firstRelevantIndex; i <= lastRelevantIndex; i++) {
            if (i >= 0 && i < totalPoints) {
                this.ctx.lineTo(jaggedPoints[i].x, jaggedPoints[i].y);
            }
        }
        
        if (startPoint.x !== endPoint.x || startPoint.y !== endPoint.y) {
            this.ctx.lineTo(endPoint.x, endPoint.y);
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
    static renderedDendrites = new Map();

    constructor(x, y, vx, vy, radius, canvas, ctx, config) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.radius = radius; this.canvas = canvas; this.ctx = ctx;
        this.config = config; 
        this.flashTTL = 0;
        this.intRadius = Math.round(radius);
        this.id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
            const drawSize = this.dendriteCanvas.width;
            this.ctx.drawImage(this.dendriteCanvas, this.x - drawSize / 2, this.y - drawSize / 2);
            this.ctx.globalAlpha = 1.0;
        }

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
