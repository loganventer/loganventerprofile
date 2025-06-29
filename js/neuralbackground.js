/**
 * Neural Network Particle Animation System
 * 
 * A high-performance particle system that creates an animated neural network effect
 * with dynamic connections, signal propagation, and performance optimizations.
 * 
 * Features:
 * - Quadtree-based collision detection for optimal performance
 * - Dynamic signal propagation between particles
 * - Configurable particle density and effects
 * - Automatic performance scaling for different devices
 * - Visibility-based animation pausing
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

            if (this.northeast.insert(point)) return true;
            if (this.northwest.insert(point)) return true;
            if (this.southeast.insert(point)) return true;
            if (this.southwest.insert(point)) return true;

            return false;
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
            // Particle appearance and behavior
            PARTICLE_COLOR: '#38BDF8',                    // Main color of particles (cyan/blue)
            MIN_RADIUS: 2,                                // Minimum particle radius in pixels
            MAX_RADIUS: 4,                                // Maximum particle radius in pixels
            INITIAL_VELOCITY_RANGE: 0.5,                  // How fast particles move (higher = faster)
            PARTICLES_PER_PIXEL_DENSITY: 35000,           // Particle density (higher = fewer particles)
            
            // Connection and proximity settings
            MAX_CONNECTION_DISTANCE: 200,                 // Maximum distance for connections between particles
            MOBILE_BREAKPOINT: 768,                       // Screen width threshold for mobile optimization
            
            // Static dendrite (particle branches) settings
            STATIC_DENDRITE_OPACITY: 0.18,                // Transparency of static particle branches
            STATIC_DENDRITE_LIFESPAN: 60,                 // How long dendrite branches grow
            STATIC_DENDRITE_BRANCH_CHANCE: 0.1,           // Probability of dendrite branching
            STATIC_DENDRITE_SEGMENT_LENGTH: 5,            // Length of each dendrite segment
            STATIC_DENDRITE_ANGLE_VARIATION: 0.5,         // How much dendrites can curve
            STATIC_DENDRITE_BRANCH_ANGLE: 0.7,            // Angle of dendrite branches
            STATIC_DENDRITE_MIN_BRANCH_LIFE: 10,          // Minimum life before branching
            STATIC_DENDRITE_BRANCH_LIFE_MULTIPLIER: 0.5,  // How much life branches get
            STATIC_DENDRITE_INITIAL_BRANCHES_MIN: 1,      // Minimum initial branches per particle
            STATIC_DENDRITE_INITIAL_BRANCHES_MAX: 3,      // Maximum initial branches per particle
            STATIC_DENDRITE_LINE_WIDTH: 0.5,              // Width of dendrite lines
            
            // Proximity line settings (static connections)
            PROXIMITY_LINE_OPACITY: 0.5,                  // Transparency of proximity lines
            PROXIMITY_LINE_WIDTH: 0.8,                    // Width of proximity lines
            PROXIMITY_LINE_ROUGHNESS: 6,                  // Jaggedness of proximity lines
            
            // Firing connection settings (dynamic signals)
            FIRING_CHANCE: 0.0003,                        // Probability of firing per frame per connection
            FIRING_DURATION: 240,                         // How long firing connections last (frames)
            PROPAGATION_CHANCE: 0.1,                      // Chance of signal propagating to nearby particles
            FIRING_LINE_WIDTH: 2,                         // Width of firing connection lines
            FIRING_LINE_ROUGHNESS: 6,                     // Jaggedness of firing lines
            FIRING_BOUNCES_MIN: 1,                        // Minimum bounces for firing signals
            FIRING_BOUNCES_MAX: 2,                        // Maximum bounces for firing signals
            FIRING_PROPAGATION_BOUNCES_MIN: 2,            // Minimum bounces for propagated signals
            FIRING_PROPAGATION_BOUNCES_MAX: 4,            // Maximum bounces for propagated signals
            FIRING_PROPAGATION_TARGETS_MIN: 1,            // Minimum targets for signal propagation
            FIRING_PROPAGATION_TARGETS_MAX: 2,            // Maximum targets for signal propagation
            
            // Particle visual effects
            PARTICLE_SHADOW_BLUR: 15,                     // Blur amount for particle glow
            PARTICLE_FLASH_RADIUS_BOOST: 3,               // How much particles grow when firing
            PARTICLE_FLASH_GLOW_BOOST: 15,                // Additional glow when particles fire
            PARTICLE_GRADIENT_INNER_COLOR: 'rgba(255, 255, 255, 1)',  // Inner particle color
            PARTICLE_GRADIENT_MIDDLE_STOP: 0.4,           // Middle gradient stop position
            PARTICLE_GRADIENT_OUTER_COLOR: 'rgba(56, 189, 248, 0)',   // Outer particle color
            
            // Wobble animation settings
            WOBBLE_SPEED: 0.0002,                         // Speed of wobble animation (lower = slower)
            WOBBLE_FREQUENCY_MULTIPLIER: 1,               // Frequency of wobble sine wave
            WOBBLE_SEGMENT_MULTIPLIER: 0.3,               // Variation between segments
            WOBBLE_AMPLITUDE_MULTIPLIER: 0.7,             // Overall wobble amplitude
            
            // Signal head settings (moving dot/line on firing connections)
            SIGNAL_STYLE: 'dot',                          // 'dot' or 'line' style for signal heads
            SIGNAL_HEAD_LENGTH: 0.01,                     // Length of signal head (for line style)
            SIGNAL_HEAD_WIDTH: 5,                         // Width of signal head
            SIGNAL_HEAD_COLOR: 'rgba(255, 255, 255, 1)',  // Color of signal head
            SIGNAL_HEAD_GLOW_COLOR: 'rgba(255, 255, 255, 0.9)',  // Glow color of signal head
            SIGNAL_HEAD_GLOW_BLUR: 25,                    // Blur amount for signal head glow
            SIGNAL_PULSE_AMPLITUDE: 2.5,                  // How much signal head pulses
            SIGNAL_PULSE_FREQUENCY: 1200,                 // Frequency of signal head pulsing
            
            // Line segment settings
            LINE_SEGMENT_DISTANCE: 15,                    // Distance between line segments for jagged lines
            LINE_SHADOW_COLOR: 'rgba(125, 211, 252, 1)',  // Shadow color for firing lines
            LINE_SHADOW_BLUR: 15,                         // Shadow blur for firing lines
            
            // Animation timing
            ANIMATION_FRAME_TIME: 16,                     // Target frame time (60fps)
            PERFORMANCE_CHECK_INTERVAL: 60,               // Frames between performance checks
            PERFORMANCE_FPS_THRESHOLD: 30,                // FPS threshold for performance reduction
            PERFORMANCE_PARTICLE_REDUCTION: 10,           // Particles to remove if performance is poor
            
            // Debug settings
            DEBUG_LOG_CHANCE: 0.0001,                     // Probability of debug logging (0 = disabled)
            DEBUG_PARTICLES_TO_LOG: 3,                    // Number of initial particles to log
            
            // Resize and debounce settings
            RESIZE_DEBOUNCE_DELAY: 250,                   // Delay for resize event debouncing
            
            // Quadtree settings
            QUADTREE_CAPACITY: 10,                        // Maximum points per quadtree node
        };

        // Adjust performance based on device capabilities
        this.adjustPerformance();

        this.particlesArray = [];
        this.firingConnections = [];
        this.animationFrameId = null;
        this.time = 0;
        this.isPaused = false;
        this.isVisible = true;
        this._handleResize = this._debounce(this._handleResize.bind(this), this.config.RESIZE_DEBOUNCE_DELAY);
        this._animate = this._animate.bind(this);
        
        // Performance monitoring
        this.frameCount = 0;
        this.lastTime = 0;
        this.fps = 60;
    }

    start() {
        Particle.preRenderParticles(this.config);
        this._resizeCanvas();
        this._initParticles();
        window.addEventListener('resize', this._handleResize);
        
        // Add visibility change listener for performance
        document.addEventListener('visibilitychange', () => {
            this.isVisible = !document.hidden;
            if (!this.isVisible) {
                this.pauseAnimation();
            } else {
                this.resumeAnimation();
            }
        });
        
        this._animate();
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        window.removeEventListener('resize', this._handleResize);
        document.removeEventListener('visibilitychange', this._handleVisibilityChange);
    }

    // Performance control methods
    pauseAnimation() {
        this.isPaused = true;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    resumeAnimation() {
        if (this.isPaused) {
            this.isPaused = false;
            this._animate();
        }
    }

    // Adjust performance based on device capabilities
    adjustPerformance() {
        const isMobile = window.innerWidth <= this.config.MOBILE_BREAKPOINT;
        const isLowEnd = navigator.hardwareConcurrency <= 4;
        
        if (isMobile || isLowEnd) {
            // Reduce particle count and effects for better performance
            this.config.PARTICLES_PER_PIXEL_DENSITY *= 0.7;
            this.config.FIRING_CHANCE *= 0.5;
            
            // Increase brightness for mobile visibility instead of reducing it
            this.config.PARTICLE_SHADOW_BLUR *= 1.5;  // Increase blur for more glow
            this.config.PARTICLE_FLASH_GLOW_BOOST *= 1.3;  // Increase flash glow
            this.config.LINE_SHADOW_BLUR *= 1.2;  // Increase line shadow blur
            this.config.SIGNAL_HEAD_GLOW_BLUR *= 1.2;  // Increase signal head glow
            
            // Increase dendrite intensity for better mobile visibility
            this.config.STATIC_DENDRITE_OPACITY *= 2.0;  // Double the dendrite visibility
        }
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
        this._animate();
    }

    _initParticles() {
        this.particlesArray = [];
        const area = this.canvas.width * this.canvas.height;
        const particleCount = Math.floor(area / this.config.PARTICLES_PER_PIXEL_DENSITY);
        
        console.log(`Creating ${particleCount} particles for canvas ${this.canvas.width}x${this.canvas.height}`);
        
        for (let i = 0; i < particleCount; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            const vx = (Math.random() - 0.5) * this.config.INITIAL_VELOCITY_RANGE;
            const vy = (Math.random() - 0.5) * this.config.INITIAL_VELOCITY_RANGE;
            const radius = Math.random() * (this.config.MAX_RADIUS - this.config.MIN_RADIUS) + this.config.MIN_RADIUS;
            
            // Debug: Log velocity for first few particles
            if (i < this.config.DEBUG_PARTICLES_TO_LOG) {
                console.log(`Particle ${i}: vx=${vx.toFixed(4)}, vy=${vy.toFixed(4)}`);
            }
            
            this.particlesArray.push(new Particle(x, y, vx, vy, radius, this.canvas, this.ctx, this.config));
        }
        
        console.log(`Created ${this.particlesArray.length} particles`);
    }

    _animate() {
        if (this.isPaused || !this.isVisible) return;
        
        this.animationFrameId = requestAnimationFrame(this._animate);
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.time += this.config.ANIMATION_FRAME_TIME; // 60fps timing
        
        const boundary = new Rectangle(this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 2, this.canvas.height / 2);
        const qtree = new Quadtree(boundary, this.config.QUADTREE_CAPACITY);
        
        this.particlesArray.forEach(particle => {
            const point = new Point(particle.x, particle.y, particle);
            qtree.insert(point);
        });
        
        this._handleConnections(qtree);
        this._drawFiringConnections(qtree);
        
        this.particlesArray.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        // Performance monitoring and auto-adjustment
        this.frameCount++;
        if (this.frameCount % this.config.PERFORMANCE_CHECK_INTERVAL === 0) {
            const currentTime = performance.now();
            this.fps = 60000 / (currentTime - this.lastTime);
            this.lastTime = currentTime;
            
            if (this.fps < this.config.PERFORMANCE_FPS_THRESHOLD && this.particlesArray.length > 50) {
                this.particlesArray.splice(-this.config.PERFORMANCE_PARTICLE_REDUCTION);
            }
        }
    }

    _handleConnections(qtree) {
        for (const pA of this.particlesArray) {
            if (this.firingConnections.some(c => c.from === pA || c.to === pA)) continue;

            const range = new Rectangle(pA.x, pA.y, this.config.MAX_CONNECTION_DISTANCE, this.config.MAX_CONNECTION_DISTANCE);
            const nearbyParticles = qtree.query(range);

            for (const pB of nearbyParticles) {
                if (pA === pB || this.firingConnections.some(c => c.from === pB || c.to === pB)) continue;

                const dx = pA.x - pB.x;
                const dy = pA.y - pB.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < this.config.MAX_CONNECTION_DISTANCE * this.config.MAX_CONNECTION_DISTANCE) {
                    const distance = Math.sqrt(distanceSq);
                    const opacity = (1 - (distance / this.config.MAX_CONNECTION_DISTANCE)) * this.config.PROXIMITY_LINE_OPACITY;
                    this._drawStaticJaggedLine(pA, pB, {
                        color: 'rgba(56, 189, 248, OPACITY)',
                        lineWidth: this.config.PROXIMITY_LINE_WIDTH,
                        roughness: this.config.PROXIMITY_LINE_ROUGHNESS,
                        opacity: opacity
                    });

                    if (Math.random() < this.config.FIRING_CHANCE) {
                        this.firingConnections.push({
                            from: pA,
                            to: pB,
                            duration: this.config.FIRING_DURATION,
                            initialDuration: this.config.FIRING_DURATION,
                            progress: 0,
                            alpha: 1,
                            isPrimary: true,
                            bounces: Math.floor(Math.random() * (this.config.FIRING_BOUNCES_MAX - this.config.FIRING_BOUNCES_MIN + 1)) + this.config.FIRING_BOUNCES_MIN,
                            direction: 1,
                            hasPropagated: false,
                        });
                        pA.flashTTL = this.config.FIRING_DURATION;
                        pB.flashTTL = this.config.FIRING_DURATION;
                    }
                }
            }
        }
    }

    _drawFiringConnections(qtree) {
        const activeParticles = new Set();
        for (const c of this.firingConnections) {
            activeParticles.add(c.from);
            activeParticles.add(c.to);
        }

        for (let i = this.firingConnections.length - 1; i >= 0; i--) {
            const conn = this.firingConnections[i];
            
            conn.duration--;
            conn.alpha = conn.duration / conn.initialDuration;

            const speed = conn.bounces / conn.initialDuration;
            conn.progress += speed * conn.direction;

            if (conn.direction === 1 && conn.progress >= 1) {
                conn.progress = 1;
                conn.direction = -1;
                if (!conn.hasPropagated && conn.isPrimary) {
                    const propagator = conn.to;
                    const numToFire = Math.floor(Math.random() * (this.config.FIRING_PROPAGATION_TARGETS_MAX - this.config.FIRING_PROPAGATION_TARGETS_MIN + 1)) + this.config.FIRING_PROPAGATION_TARGETS_MIN;
                    const potentialTargets = qtree.query(new Rectangle(propagator.x, propagator.y, this.config.MAX_CONNECTION_DISTANCE, this.config.MAX_CONNECTION_DISTANCE))
                                                 .filter(p => p !== propagator && p !== conn.from && !activeParticles.has(p));

                    for (let j = 0; j < numToFire && potentialTargets.length > 0; j++) {
                        const targetIndex = Math.floor(Math.random() * potentialTargets.length);
                        const nextTarget = potentialTargets.splice(targetIndex, 1)[0];
                        
                        this.firingConnections.push({
                            from: propagator,
                            to: nextTarget,
                            duration: this.config.FIRING_DURATION,
                            initialDuration: this.config.FIRING_DURATION,
                            progress: 0,
                            alpha: 1,
                            isPrimary: true,
                            bounces: Math.floor(Math.random() * (this.config.FIRING_BOUNCES_MAX - this.config.FIRING_BOUNCES_MIN + 1)) + this.config.FIRING_BOUNCES_MIN,
                            direction: 1,
                            hasPropagated: false,
                        });
                        
                        propagator.flashTTL = this.config.FIRING_DURATION;
                        nextTarget.flashTTL = this.config.FIRING_DURATION;
                    }
                    conn.hasPropagated = true;
                }
            } else if (conn.direction === -1 && conn.progress <= 0) {
                conn.progress = 0;
                conn.direction = 1;
            }

            this._drawJaggedLine(conn, {
                color: `rgba(200, 240, 255, OPACITY)`,
                lineWidth: this.config.FIRING_LINE_WIDTH,
                roughness: this.config.FIRING_LINE_ROUGHNESS,
                opacity: conn.alpha * 0.9
            });

            if (conn.duration <= 0) {
                this.firingConnections.splice(i, 1);
            }
        }
    }
    
    _drawStaticJaggedLine(start, end, lineConfig) {
        const { color, lineWidth, roughness, opacity } = lineConfig;
        this.ctx.strokeStyle = color.replace('OPACITY', opacity.toString());
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        this.ctx.lineTo(start.x + dx * 0.5 + (Math.random() - 0.5) * roughness, start.y + dy * 0.5 + (Math.random() - 0.5) * roughness);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
    }

    _drawJaggedLine(conn, lineConfig) {
        const { from, to, progress } = conn;
        const { color, lineWidth, roughness, opacity } = lineConfig;
        
        const path = [{x: from.x, y: from.y}];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const numSegments = Math.max(1, Math.floor(distance / this.config.LINE_SEGMENT_DISTANCE));
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
                const sineInput = this.time * this.config.WOBBLE_FREQUENCY_MULTIPLIER + wobbleSeed + i * this.config.WOBBLE_SEGMENT_MULTIPLIER;
                const jitter = Math.sin(sineInput) * roughness * this.config.WOBBLE_AMPLITUDE_MULTIPLIER * Math.sin(p * Math.PI);
                currentX += perpX * jitter;
                currentY += perpY * jitter;
            }
            path.push({x: currentX, y: currentY});
        }
        
        this.ctx.save();

        this.ctx.strokeStyle = color.replace('OPACITY', opacity.toString());
        this.ctx.lineWidth = this.config.STATIC_DENDRITE_LINE_WIDTH;
        this.ctx.shadowColor = this.config.LINE_SHADOW_COLOR;
        this.ctx.shadowBlur = this.config.LINE_SHADOW_BLUR;
        this.ctx.beginPath();
        for(const point of path) this.ctx.lineTo(point.x, point.y);
        this.ctx.stroke();
        
        if (progress >= 0 && progress <= 1) { 
            const headIndex = Math.min(path.length - 1, Math.floor(progress * (path.length - 1)));
            const pulse = Math.sin(conn.progress * this.config.SIGNAL_PULSE_FREQUENCY) * this.config.SIGNAL_PULSE_AMPLITUDE;

            if (this.config.SIGNAL_STYLE === 'dot') {
                const dotPos = path[headIndex];
                if (dotPos) {
                    const radius = (this.config.SIGNAL_HEAD_WIDTH / 2) + pulse;
                    this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                    this.ctx.shadowColor = this.config.SIGNAL_HEAD_GLOW_COLOR;
                    this.ctx.shadowBlur = this.config.SIGNAL_HEAD_GLOW_BLUR + (pulse * 2);
                    this.ctx.beginPath();
                    this.ctx.arc(dotPos.x, dotPos.y, Math.max(0, radius), 0, Math.PI * 2);
                    this.ctx.fill();
                }
            } else { // 'line' style
                const tailProgress = progress - this.config.SIGNAL_HEAD_LENGTH;
                const tailIndex = Math.max(0, Math.floor(tailProgress * (path.length - 1)));
                if (headIndex > tailIndex) {
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    this.ctx.lineWidth = this.config.SIGNAL_HEAD_WIDTH + pulse;
                    this.ctx.shadowColor = this.config.SIGNAL_HEAD_GLOW_COLOR;
                    this.ctx.shadowBlur = this.config.SIGNAL_HEAD_GLOW_BLUR + (pulse * 2);
                    this.ctx.beginPath();
                    this.ctx.moveTo(path[tailIndex].x, path[tailIndex].y);
                    for (let j = tailIndex + 1; j <= headIndex; j++) {
                        this.ctx.lineTo(path[j].x, path[j].y);
                    }
                    this.ctx.stroke();
                }
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
        gradient.addColorStop(0, config.PARTICLE_GRADIENT_INNER_COLOR);
        gradient.addColorStop(config.PARTICLE_GRADIENT_MIDDLE_STOP, config.PARTICLE_COLOR);
        gradient.addColorStop(1, config.PARTICLE_GRADIENT_OUTER_COLOR);
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

            const newX = x + Math.cos(angle) * config.STATIC_DENDRITE_SEGMENT_LENGTH;
            const newY = y + Math.sin(angle) * config.STATIC_DENDRITE_SEGMENT_LENGTH;
            segments.push({ fromX: x, fromY: y, toX: newX, toY: newY });

            const nextAngle = angle + (Math.random() - 0.5) * config.STATIC_DENDRITE_ANGLE_VARIATION;
            growBranch(newX, newY, nextAngle, life - 1);

            if (Math.random() < config.STATIC_DENDRITE_BRANCH_CHANCE && life > config.STATIC_DENDRITE_MIN_BRANCH_LIFE) {
                const branchAngle = angle + (Math.random() > 0.5 ? 1 : -1) * config.STATIC_DENDRITE_BRANCH_ANGLE;
                growBranch(newX, newY, branchAngle, life * config.STATIC_DENDRITE_BRANCH_LIFE_MULTIPLIER);
            }
        };

        const initialBranches = this.config.STATIC_DENDRITE_INITIAL_BRANCHES_MIN + Math.floor(Math.random() * (this.config.STATIC_DENDRITE_INITIAL_BRANCHES_MAX - this.config.STATIC_DENDRITE_INITIAL_BRANCHES_MIN + 1));
        for (let i = 0; i < initialBranches; i++) {
            growBranch(this.x, this.y, Math.random() * Math.PI * 2, config.STATIC_DENDRITE_LIFESPAN);
        }
        return segments;
    }

    draw() {
        this.ctx.globalAlpha = this.config.STATIC_DENDRITE_OPACITY;
        this.ctx.strokeStyle = this.config.PARTICLE_COLOR;
        this.ctx.lineWidth = this.config.STATIC_DENDRITE_LINE_WIDTH;
        this.ctx.beginPath();
        for (const seg of this.dendrites) {
            this.ctx.moveTo(seg.fromX, seg.fromY);
            this.ctx.lineTo(seg.toX, seg.toY);
        }
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;

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
        // Store old position for debugging
        const oldX = this.x;
        const oldY = this.y;
        
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
        
        // Debug: Log movement occasionally
        if (Math.random() < this.config.DEBUG_LOG_CHANCE) { // Very rare to avoid spam
            console.log(`Particle moved: (${oldX.toFixed(2)}, ${oldY.toFixed(2)}) -> (${this.x.toFixed(2)}, ${this.y.toFixed(2)}) - velocity: (${this.vx.toFixed(4)}, ${this.vy.toFixed(4)})`);
        }
        
        this.draw();
    }
}
