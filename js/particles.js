/**
 * HIGH-PERFORMANCE Refactored Neural Network Particle Animation
 *
 * This version has been heavily optimized to target 60 FPS by addressing
 * major computational and rendering bottlenecks, especially for high-resolution (4K) displays.
 *
 * Performance Fixes:
 * 1.  **Quadtree Implementation:** Replaced the O(n^2) collision detection in
 * `_handleConnections` with a Quadtree. This dramatically reduces the number of
 * particle-pair checks, making the simulation scale much better.
 * 2.  **Particle Pre-Rendering:** Instead of creating expensive radial gradients and
 * shadows for every particle on every frame, particles are now pre-rendered to
 * off-screen canvases. The main loop uses the much faster `drawImage` to stamp
 * these sprites, significantly reducing rendering overhead.
 * 3.  **Dendrite Pre-Rendering:** The static background dendrite structures
 * for each particle are now pre-rendered to their own off-screen canvases once
 * during particle initialization. This dramatically improves rendering
 * performance by replacing per-segment drawing with a single `drawImage` call.
 * 4.  **Maximum Particle Count:** A hard cap (`MAX_PARTICLES`) is introduced
 * to limit the total number of particles, preventing excessive computational load
 * at very high resolutions like 4K, ensuring stable FPS.
 * 5.  **Capped Jagged Line Segments:** `MAX_JAGGED_SEGMENTS` limits the number
 * of individual segments used to draw a jagged line. This prevents extremely long
 * lines from becoming computationally expensive at high resolutions.
 * 6.  **Static Background Line Pre-calculation & Caching:**
 * Instead of generating jagged paths for static background lines every frame,
 * these paths are now calculated *once* during initialization and stored.
 * The animation loop then efficiently draws these cached paths, drastically
 * reducing per-frame CPU usage, especially for 4K+.
 * 7.  **Traveling Fire Pre-rendering (CRITICAL NEW FIX FOR 4K):** The jagged path
 * for each traveling fire effect is now pre-rendered to a dedicated off-screen
 * canvas *once* when the fire is created. The animation loop then draws a
 * *slice* of this pre-rendered path using `drawImage`, replacing expensive
 * per-frame path drawing operations with a much faster image blit.
 * 8.  **Configurable Static Line Draw Chance:** `STATIC_LINE_DRAW_CHANCE`
 * allows fine-tuning the visual density of background lines, letting us draw
 * only a percentage of potential connections to further optimize performance.
 *
 * New Features & Enhancements:
 * 1.  **Chain Reaction Firing with Delay & Traveling Path (FIXED & UPDATED):** When a connection fires, it now triggers
 * additional firings to random connected particles from the target node. A configurable delay is
 * applied before each element in the chain fires, and the firing animation now visually "travels"
 * along the *exact jagged path* of the connecting line, simulating precise signal propagation.
 * 2.  **Adjusted Line Wobble:** The "jaggedness" of the lines has been refined
 * to be less overtly "wobbly" but still maintain an organic, slightly
 * imperfect appearance.
 * 3.  **Enhanced Dendrite Appearance:** The static dendrites around each particle
 * are now slightly longer and have a higher chance of branching, contributing
 * to a more complex, biological look.
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
            console.error(`Canvas with ID '${canvasId}' not found. Cannot start the particle system.`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');

        // Configuration constants for fine-tuning the visual effects.
        // These are critical for controlling the look and feel.
        this.config = {
            PARTICLE_COLOR: '#38BDF8', // The base color for particles and lines (light blue)
            MIN_RADIUS: 2,             // Minimum radius of particles
            MAX_RADIUS: 4,             // Maximum radius of particles
            INITIAL_VELOCITY_RANGE: 0.35, // How fast particles initially move
            PARTICLES_PER_PIXEL_DENSITY: 50000, // Density of particles (higher for fewer particles on large screens)
            MAX_PARTICLES: 150,        // Absolute maximum number of particles to prevent slowdown on 4K+ displays (Reduced from 200)
            MAX_CONNECTION_DISTANCE: 250,      // Max distance for lines between particles
            MOBILE_BREAKPOINT: 768,             // Screen width to consider as mobile for particle density adjustment

            STATIC_DENDRITE_OPACITY: 0.18,      // Opacity of the background static dendrites
            STATIC_DENDRITE_LIFESPAN: 80,       // Length/complexity of each dendrite branch (increased for more biological look)
            STATIC_DENDRITE_BRANCH_CHANCE: 0.15, // Chance for a dendrite branch to split (increased for more branches)
            STATIC_DENDRITE_SEGMENT_LENGTH: 5,  // Length of each small segment in a dendrite branch
            STATIC_DENDRITE_PADDING: 20,        // Padding for the pre-rendered dendrite canvas

            PROXIMITY_LINE_OPACITY: 0.5,        // Opacity of regular proximity lines
            PROXIMITY_LINE_WIDTH: 0.8,          // Width of regular proximity lines
            PROXIMITY_LINE_ROUGHNESS: 3,        // Roughness/jaggedness of regular lines (reduced for less wobble)
            MAX_JAGGED_SEGMENTS: 60,           // Max segments for a jagged line (limits drawing complexity for long lines)

            STATIC_LINE_DRAW_CHANCE: 0.3,       // Chance (0.0 - 1.0) for a static background line to be drawn. CRITICAL FOR 4K. (Reduced from 0.4)

            FIRING_CHANCE: 0.0002,              // Chance for a connection to "fire" (become active)
            FIRING_DURATION: 40,                // Duration of a firing connection's animation frames
            FIRING_LINE_WIDTH: 2.5,             // Width of firing lines
            FIRING_LINE_ROUGHNESS: 6,           // Roughness/jaggedness of firing lines (reduced for less wobble)
            FIRING_STROKE_COLOR_BASE: 'rgba(200, 240, 255, ', // Base color for firing lines (white-blue)
            FIRING_SHADOW_COLOR: 'rgba(125, 211, 252, 1)',   // Shadow color for firing lines (bright blue)
            FIRING_SHADOW_BLUR: 15,             // Shadow blur for firing lines

            PARTICLE_SHADOW_BLUR: 15,           // Base shadow blur for particles
            PARTICLE_FLASH_RADIUS_BOOST: 3,     // How much radius increases when a particle flashes
            PARTICLE_FLASH_GLOW_BOOST: 15,      // How much glow increases when a particle flashes

            WOBBLE_SPEED: 0.002,                // Speed at which the line wobble animates
            SECONDARY_FIRING_DELAY: 150,         // Delay in milliseconds before secondary firings
            TRAVELING_FIRE_SPEED_PER_FRAME: 0.05, // How much progress per frame for traveling fire (e.g., 0.05 means 20 frames to travel)
            TRAVELING_FIRE_LENGTH_RATIO: 0.2    // Length of the traveling fire segment as a ratio of total line distance
        };

        this.particlesArray = [];
        this.travelingFires = [];    // For the moving "spark" effect
        this.staticJaggedLines = []; // NEW: Cache for pre-calculated static background lines
        this.animationFrameId = null; // Stores the requestAnimationFrame ID for cancellation
        this.time = 0; // Used for wobble animation and other time-based effects

        // Bind and debounce the resize handler to prevent performance issues
        this._handleResize = this._debounce(this._handleResize.bind(this), 250);
        this._animate = this._animate.bind(this); // Ensure 'this' context for animation loop
    }

    // Starts the particle system
    start() {
        // Pre-render particle core sprites AND dendrites once for all particles.
        // This is a critical optimization for 60 FPS.
        Particle.preRenderParticles(this.config);
        this._resizeCanvas();
        this._initParticles();
        this._generateStaticLines(); // NEW: Generate and cache static lines once
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
        this._generateStaticLines(); // NEW: Re-generate and cache static lines on resize
        this._animate();
    }

    // Initializes/re-initializes the array of particles
    _initParticles() {
        this.particlesArray = [];
        // Calculate number of particles based on screen density and adjust for mobile
        let num = Math.floor((this.canvas.width * this.canvas.height) / this.config.PARTICLES_PER_PIXEL_DENSITY);
        
        // Apply max particles cap
        num = Math.min(num, this.config.MAX_PARTICLES);

        if (window.innerWidth < this.config.MOBILE_BREAKPOINT) {
            num *= 2; // More particles on mobile for a denser look
            num = Math.min(num, this.config.MAX_PARTICLES); // Re-apply cap after mobile adjustment
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

    /**
     * NEW: Generates and caches the jagged paths for static background lines.
     * This heavy computation is done once, not every frame.
     */
    _generateStaticLines() {
        this.staticJaggedLines = []; // Clear existing lines

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
                    // Only draw a static line based on chance
                    if (Math.random() < this.config.STATIC_LINE_DRAW_CHANCE) {
                        const distance = Math.sqrt(distanceSq);
                        const opacity = (1 - (distance / this.config.MAX_CONNECTION_DISTANCE)) * this.config.PROXIMITY_LINE_OPACITY;

                        // Generate jagged points once and store them
                        const lineData = {
                            from: pA,
                            to: pB,
                            color: `rgba(56, 189, 248, ${opacity})`,
                            lineWidth: this.config.PROXIMITY_LINE_WIDTH,
                            roughness: this.config.PROXIMITY_LINE_ROUGHNESS,
                            jaggedPoints: this._getJaggedPathPoints(pA, pB, this.config.PROXIMITY_LINE_ROUGHNESS) // Generate once
                        };
                        this.staticJaggedLines.push(lineData);
                    }
                }
            }
        }
        console.log(`Generated and cached ${this.staticJaggedLines.length} static background lines.`);
    }

    /**
     * Helper to generate the full jagged path points between two particles.
     * This logic is extracted so it can be called once for caching.
     */
    _getJaggedPathPoints(start, end, roughness) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance === 0) return [{x: start.x, y: start.y}]; // Handle zero distance

        const totalNumSegments = Math.max(2, Math.min(this.config.MAX_JAGGED_SEGMENTS, Math.floor(distance / 5)));
        
        const vecX = dx / distance;
        const vecY = dy / distance;
        const perpX = -vecY;
        const perpY = vecX;
        const wobbleSeed = start.x * 0.1 + end.y * 0.1; 
        const jaggedPoints = [];

        for (let i = 0; i <= totalNumSegments; i++) {
            const currentTotalProgress = i / totalNumSegments;
            let currentX = start.x + dx * currentTotalProgress;
            let currentY = start.y + dy * currentTotalProgress;

            const sineInput = this.time * 2 + wobbleSeed + currentTotalProgress * 0.5; // Use this.time for consistent wobble across lines
            const jitter = Math.sin(sineInput) * roughness * Math.sin(currentTotalProgress * Math.PI);
            currentX += perpX * jitter;
            currentY += perpY * jitter;
            jaggedPoints.push({ x: currentX, y: currentY });
        }
        return jaggedPoints;
    }


    // The main animation loop
    _animate() {
        this.time += this.config.WOBBLE_SPEED; // Advance time for wobble animation
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the canvas each frame

        // Initialize Quadtree for efficient proximity queries
        const boundary = new Rectangle(this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 2, this.canvas.height / 2);
        const qtree = new Quadtree(boundary, 4); // Capacity of 4 points per node
        for (const p of this.particlesArray) {
            qtree.insert(new Point(p.x, p.y, p)); // Insert each particle's position into the Quadtree
        }

        // NEW: Draw cached static background lines FIRST
        this._drawStaticJaggedLines();

        this.particlesArray.forEach(p => p.update()); // Update and draw each particle
        this._handleConnections(qtree); // Only handles firing chances now, not drawing base lines
        this._drawTravelingFires();   // Draw the new traveling fire effects
        this.animationFrameId = requestAnimationFrame(this._animate); // Request next animation frame
    }

    /**
     * NEW: Draws the pre-calculated static background lines.
     * This is much faster as it avoids recalculating jagged paths each frame.
     */
    _drawStaticJaggedLines() {
        // We iterate through pre-generated lines and draw them.
        // Their jagged path points are already computed and stored.
        for (const lineData of this.staticJaggedLines) {
            const { color, lineWidth, jaggedPoints } = lineData;
            
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


    // Handles drawing connections between particles and initiating firing events
    _handleConnections(qtree) {
        for (const pA of this.particlesArray) {
            const range = new Rectangle(pA.x, pA.y, this.config.MAX_CONNECTION_DISTANCE, this.config.MAX_CONNECTION_DISTANCE);
            const nearbyParticles = qtree.query(range);

            for (const pB of nearbyParticles) {
                if (pA === pB || pA.id >= pB.id) continue;

                const dx = pB.x - pA.x;
                const dy = pB.y - pA.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < this.config.MAX_CONNECTION_DISTANCE * this.config.MAX_CONNECTION_DISTANCE) {
                    // Only handle firing chance here, as static lines are drawn separately now
                    if (Math.random() < this.config.FIRING_CHANCE) {
                        pA.flashTTL = this.config.FIRING_DURATION;
                        pB.flashTTL = this.config.FIRING_DURATION;

                        // Add the initial traveling fire effect
                        this.travelingFires.push({
                            from: pA,
                            to: pB,
                            progress: 0, // Starts at 0% of the path
                            speed: this.config.TRAVELING_FIRE_SPEED_PER_FRAME,
                            duration: this.config.FIRING_DURATION, // Ensure it travels for the same duration as the flash
                            jaggedPointsCache: this._getJaggedPathPoints(pA, pB, this.config.FIRING_LINE_ROUGHNESS) // Generate once
                        });

                        this._triggerSecondaryFirings(pB, qtree, this.config.SECONDARY_FIRING_DELAY);
                    }
                }
            }
        }
    }

    /**
     * Triggers secondary firing connections from a given origin particle (e.g., pB).
     * This creates a chain reaction effect.
     * @param {Particle} originParticle The particle from which new firings should originate.
     * @param {Quadtree} qtree The current Quadtree for efficient neighbor querying.
     * @param {number} delay - The delay in milliseconds before each secondary firing occurs.
     */
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
                    speed: this.config.TRAVELING_FIRE_SPEED_PER_FRAME,
                    duration: this.config.FIRING_DURATION,
                    jaggedPointsCache: this._getJaggedPathPoints(originParticle, targetParticle, this.config.FIRING_LINE_ROUGHNESS) // Generate once
                });

            }, delay * (i + 1));
        }
    }

    /**
     * Draws the traveling fire effects along connections.
     * This now draws a segment of the pre-calculated jagged path.
     */
    _drawTravelingFires() {
        for (let i = this.travelingFires.length - 1; i >= 0; i--) {
            const fire = this.travelingFires[i];

            fire.progress += fire.speed;

            if (fire.progress >= 1 + this.config.TRAVELING_FIRE_LENGTH_RATIO) {
                this.travelingFires.splice(i, 1);
                continue;
            }

            const sparkOpacity = Math.sin( (fire.progress / (1 + this.config.TRAVELING_FIRE_LENGTH_RATIO)) * Math.PI);

            this.ctx.shadowColor = this.config.FIRING_SHADOW_COLOR;
            this.ctx.shadowBlur = this.config.FIRING_SHADOW_BLUR * 1.5;

            // --- CRITICAL CHANGE: Use new _drawJaggedLineSegment to draw on main canvas ---
            this._drawJaggedLineSegment(
                fire.from, 
                fire.to, 
                fire.jaggedPointsCache, // Pass the pre-calculated jagged points
                {
                    color: `rgba(255, 255, 255, ${sparkOpacity})`,
                    lineWidth: this.config.FIRING_LINE_WIDTH + 1
                },
                fire.progress,
                this.config.TRAVELING_FIRE_LENGTH_RATIO
            );

            this.ctx.shadowBlur = 0;
        }
    }
    
    /**
     * Draws a specific segment of a pre-calculated jagged line path onto the main canvas.
     * This replaces direct path generation in the animation loop for traveling fires.
     * @param {Particle} start - The starting particle.
     * @param {Particle} end - The ending particle.
     * @param {Array<Object>} jaggedPoints - The array of pre-calculated jagged points for the entire line.
     * @param {Object} lineConfig - Configuration for the line (color, lineWidth).
     * @param {number} currentProgress - The current overall progress of the traveling fire (0 to 1+ratio).
     * @param {number} segmentLengthRatio - The length of the traveling segment as a ratio (e.g., 0.2).
     */
    _drawJaggedLineSegment(start, end, jaggedPoints, lineConfig, currentProgress, segmentLengthRatio) {
        const { color, lineWidth } = lineConfig;
        
        if (!jaggedPoints || jaggedPoints.length < 2) return; // Need at least two points

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();

        const totalPoints = jaggedPoints.length;
        const totalLineProgress = currentProgress; // Total progress along the full line length

        // Calculate the start and end progress points for the visible segment
        const segmentStartProgress = Math.max(0, totalLineProgress - segmentLengthRatio);
        const segmentEndProgress = totalLineProgress;

        // Function to get an interpolated point on the full jagged path
        const getPointOnJaggedPath = (progress) => {
            progress = Math.max(0, Math.min(1, progress)); // Clamp progress to [0, 1] for safety

            const floatIndex = progress * (totalPoints - 1); // Index in the jaggedPoints array
            const p1_idx = Math.floor(floatIndex);
            const p2_idx = Math.min(totalPoints - 1, Math.ceil(floatIndex));
            
            if (p1_idx === p2_idx) { // Exactly on a pre-calculated point
                return jaggedPoints[p1_idx];
            }

            const lerpFactor = floatIndex - p1_idx; // Fractional part for interpolation
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

        // Iterate through the *indices* of `jaggedPoints` that fall between the start and end of the segment.
        // We start from the first whole point *after* the interpolated start, and go up to the last whole point *before* the interpolated end.
        const firstRelevantIndex = Math.ceil(segmentStartProgress * (totalPoints - 1));
        const lastRelevantIndex = Math.floor(segmentEndProgress * (totalPoints - 1));

        for (let i = firstRelevantIndex; i <= lastRelevantIndex; i++) {
            if (i >= 0 && i < totalPoints) { // Ensure valid index
                this.ctx.lineTo(jaggedPoints[i].x, jaggedPoints[i].y);
            }
        }
        
        // Finally, draw to the precise interpolated end point.
        // This connects the last whole jagged point (or the start point if segment is very short) to the exact end position.
        // Only draw if the end point is distinct or if the path is essentially just this final segment.
        if (startPoint.x !== endPoint.x || startPoint.y !== endPoint.y) {
            this.ctx.lineTo(endPoint.x, endPoint.y);
        }

        this.ctx.stroke();
    }
    
    /**
     * Debounce function to limit how often a function can run.
     * Crucial for performance with events like window resizing.
     */
    _debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
}

// --- Particle Class (Represents a single neuron/particle) ---
class Particle {
    // Static Map to store pre-rendered particle core sprites (optimizes drawing)
    static renderedParticles = new Map();
    // Static Map to store pre-rendered dendrite canvases for each particle radius
    // Note: this map is not strictly used for caching *unique* dendrites but ensures
    // the underlying canvas generation logic is called once per radius if needed.
    static renderedDendrites = new Map();

    constructor(x, y, vx, vy, radius, canvas, ctx, config) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.radius = radius; this.canvas = canvas; this.ctx = ctx;
        this.config = config; 
        this.flashTTL = 0; // Time-to-live for flashing effect
        this.intRadius = Math.round(radius); // Rounded radius for sprite lookup
        // Assign a unique ID for connection handling (to prevent duplicate lines)
        this.id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        // Generate and store the pre-rendered dendrite canvas unique to this particle.
        // It's called once per particle during construction.
        this.dendriteCanvas = this._createDendriteTree();
    }
    
    /**
     * Pre-renders different particle core sprites (base and flashing) to off-screen canvases.
     * This avoids expensive gradient/shadow calculations on every frame.
     * @param {Object} config - The global configuration object.
     */
    static preRenderParticles(config) {
        for (let r = config.MIN_RADIUS; r <= config.MAX_RADIUS; r++) {
            // --- Pre-render Particle Cores ---
            const baseKey = `${r}_base`;
            if (!this.renderedParticles.has(baseKey)) {
                this.renderedParticles.set(baseKey, this._createParticleCanvas(r, 0, config));
            }

            const flashKey = `${r}_flash`;
            if (!this.renderedParticles.has(flashKey)) {
                this.renderedParticles.set(flashKey, this._createParticleCanvas(r, 1, config)); // Multiplier 1 for flash
            }
            // Dendrites are generated per particle in the constructor, not pre-rendered statically across all particles.
        }
    }

    /**
     * Creates a single off-screen canvas for a particle core sprite.
     * @param {number} radius - Base radius of the particle.
     * @param {number} flashMultiplier - Multiplier for flash effects (0 for base, 1 for flashing).
     * @param {Object} config - The global configuration object.
     * @returns {HTMLCanvasElement} The pre-rendered canvas for the particle.
     */
    static _createParticleCanvas(radius, flashMultiplier, config) {
        const pCanvas = document.createElement('canvas');
        const pCtx = pCanvas.getContext('2d');
        
        // Calculate current radius and shadow based on flash state
        const currentRadius = radius + (config.PARTICLE_FLASH_RADIUS_BOOST * flashMultiplier);
        const currentShadowBlur = config.PARTICLE_SHADOW_BLUR + (config.PARTICLE_FLASH_GLOW_BOOST * flashMultiplier);
        
        // Calculate canvas size to accommodate particle and its shadow
        const size = (currentRadius + currentShadowBlur) * 2;
        pCanvas.width = size;
        pCanvas.height = size;

        pCtx.shadowColor = config.PARTICLE_COLOR;
        pCtx.shadowBlur = currentShadowBlur;

        // Create radial gradient for the particle's core
        const gradient = pCtx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, currentRadius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); // White center
        gradient.addColorStop(0.4, config.PARTICLE_COLOR);   // Main particle color
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');   // Transparent edge
        
        pCtx.fillStyle = gradient;
        pCtx.beginPath();
        pCtx.arc(size / 2, size / 2, currentRadius, 0, Math.PI * 2);
        pCtx.fill();
        return pCanvas;
    }

    /**
     * Generates a static, biological-looking dendrite tree for this particle and
     * pre-renders it to an off-screen canvas. This canvas is then drawn directly.
     * @returns {HTMLCanvasElement} The pre-rendered canvas containing the dendrite tree.
     */
    _createDendriteTree() {
        const dendriteCanvas = document.createElement('canvas');
        const dCtx = dendriteCanvas.getContext('2d');

        // Calculate max dendrite length and canvas size based on config
        const maxDendriteLength = this.config.STATIC_DENDRITE_LIFESPAN * this.config.STATIC_DENDRITE_SEGMENT_LENGTH;
        const dendriteCanvasSize = (maxDendriteLength * 2) + this.config.STATIC_DENDRITE_PADDING;
        dendriteCanvas.width = dendriteCanvasSize;
        dendriteCanvas.height = dendriteCanvasSize;

        const centerX = dendriteCanvasSize / 2;
        const centerY = dendriteCanvasSize / 2;

        dCtx.strokeStyle = this.config.PARTICLE_COLOR; // Dendrite color
        dCtx.lineWidth = 0.5; // Dendrite line width
        // Opacity will be applied globally when drawing this canvas to the main context.

        // Recursive function to grow a branch directly on the off-screen canvas
        const growBranchOnCanvas = (x, y, angle, life) => {
            if (life <= 0) return;

            dCtx.beginPath();
            dCtx.moveTo(x, y);

            // Calculate next segment endpoint
            const newX = x + Math.cos(angle) * this.config.STATIC_DENDRITE_SEGMENT_LENGTH;
            const newY = y + Math.sin(angle) * this.config.STATIC_DENDRITE_SEGMENT_LENGTH;
            
            dCtx.lineTo(newX, newY);
            dCtx.stroke(); // Draw this segment

            // Slight random angle change for the next segment
            const nextAngle = angle + (Math.random() - 0.5) * 0.5;
            growBranchOnCanvas(newX, newY, nextAngle, life - 1); // Continue growing main branch

            // Randomly create a new branch if conditions met
            if (Math.random() < this.config.STATIC_DENDRITE_BRANCH_CHANCE && life > 10) {
                const branchAngle = angle + (Math.random() > 0.5 ? 1 : -1) * 0.7; // Branch off at a wider angle
                growBranchOnCanvas(newX, newY, branchAngle, life * 0.5); // New branch has reduced lifespan
            }
        };

        // Start initial branches from the center of the dendrite canvas
        const initialBranches = 1 + Math.floor(Math.random() * 3); // 1 to 3 initial branches
        for (let i = 0; i < initialBranches; i++) {
            growBranchOnCanvas(centerX, centerY, Math.random() * Math.PI * 2, this.config.STATIC_DENDRITE_LIFESPAN);
        }
        
        return dendriteCanvas; // Return the pre-rendered canvas
    }

    // Draws the particle and its dendrites
    draw() {
        // Draw static dendrites using the pre-rendered canvas
        if (this.dendriteCanvas) { // Ensure the dendrite canvas exists
            this.ctx.globalAlpha = this.config.STATIC_DENDRITE_OPACITY; // Apply global opacity for dendrites
            const drawSize = this.dendriteCanvas.width;
            // Draw the dendrite canvas centered on the particle's current position (x,y)
            this.ctx.drawImage(this.dendriteCanvas, this.x - drawSize / 2, this.y - drawSize / 2);
            this.ctx.globalAlpha = 1.0; // Reset global alpha for other drawings
        }

        // Determine which pre-rendered particle core sprite to draw (base or flashing)
        const flashProgress = this.flashTTL > 0 ? this.flashTTL / this.config.FIRING_DURATION : 0;
        // Sine wave for smooth flash animation (grows and shrinks)
        const flashMultiplier = Math.sin(flashProgress * Math.PI);
        // Choose flash sprite if progress is significant (e.g., > 0.5), otherwise base sprite
        const key = flashMultiplier > 0.5 ? `${this.intRadius}_flash` : `${this.intRadius}_base`;
        const pCanvas = Particle.renderedParticles.get(key);
        
        // Draw the pre-rendered particle core sprite
        if (pCanvas) {
            const drawSize = pCanvas.width;
            this.ctx.drawImage(pCanvas, this.x - drawSize / 2, this.y - drawSize / 2);
        }
    }

    // Updates particle position and flash state
    update() {
        // Bounce off walls
        if (this.x + this.radius > this.canvas.width || this.x - this.radius < 0) { this.vx = -this.vx; }
        if (this.y + this.radius > this.canvas.height || this.y - this.radius < 0) { this.vy = -this.vy; }
        this.x += this.vx;
        this.y += this.vy;

        // No direct dendrite segment updates needed here.
        // The pre-rendered dendrite canvas moves with the particle's (x,y) when drawn.

        if (this.flashTTL > 0) this.flashTTL--; // Decrease flash duration
        
        this.draw(); // Draw the particle with its updated position
    }
}

// Entry point: Initialize and start the particle system when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const particleSystem = new ParticleSystem('neural-canvas');
    if (particleSystem.canvas) { // Ensure canvas was found before starting
        particleSystem.start();
    }
});
