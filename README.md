# Logan Venter Profile

This repository hosts the source code for Logan Venter's personal portfolio website. The site is built using standard HTML, Tailwind CSS and vanilla JavaScript with advanced performance optimizations and PWA capabilities.

## Recent Updates

- **Mobile Neural Visibility** - Enhanced firing dendrite visibility on mobile devices with increased line width and firing frequency
- **Performance Optimizations** - Automatic brightness scaling for different screen types and device capabilities
- **Accessibility Improvements** - Better contrast and visibility across devices

## Quick Start

```bash
# Clone the repository
git clone [repository-url]
cd loganventer

# Open in browser (no build process required)
open index.html

# Or serve with a local server
npx serve .
```

## Dependencies

This project uses only vanilla technologies:
- HTML5
- CSS3 (with Tailwind CSS classes)
- Vanilla JavaScript (ES6+)
- No build tools or package managers required

## Features

### 🚀 Performance & User Experience
- **Progressive Web App (PWA)** - Installable on mobile devices
- **Service Worker** - Offline functionality and caching
- **Loading States** - Smooth transitions and visual feedback
- **Performance Monitoring** - Auto-adjusts particle effects based on device capabilities
- **Accessibility** - Keyboard navigation, focus indicators, and reduced motion support

### 🎨 Visual & Interactive
- **Neural Network Animation** - Dynamic particle system with performance controls
- **Responsive Design** - Optimized for all device sizes
- **Smooth Animations** - CSS transitions and intersection observer animations
- **Dark Theme** - Modern, professional appearance

### 📱 Mobile Optimized
- **Touch-Friendly Navigation** - Mobile menu with gesture support
- **Performance Scaling** - Reduced effects on low-end devices
- **PWA Installation** - Add to home screen functionality

## Neural Network Particle System

The website features a sophisticated neural network animation system that creates dynamic connections between particles, simulating neural activity. The system is highly configurable and automatically optimizes performance based on device capabilities.

### Configuration

The particle system can be customized by modifying the `config` object in `js/neuralbackground.js`. Here are the key configuration categories:

#### Particle Appearance & Behavior
- `PARTICLE_COLOR` - Main color of particles (default: '#38BDF8')
- `MIN_RADIUS` / `MAX_RADIUS` - Particle size range in pixels (default: 2-4)
- `INITIAL_VELOCITY_RANGE` - How fast particles move (default: 0.5)
- `PARTICLES_PER_PIXEL_DENSITY` - Particle density (default: 35000)

#### Connection Settings
- `MAX_CONNECTION_DISTANCE` - Maximum distance for connections (default: 200px)
- `PROXIMITY_LINE_OPACITY` - Transparency of static connections (default: 0.5)
- `PROXIMITY_LINE_WIDTH` - Width of proximity lines (default: 0.8)

#### Firing Connections (Dynamic Signals)
- `FIRING_CHANCE` - Probability of firing per frame (default: 0.0003)
- `FIRING_DURATION` - How long firing connections last (default: 240 frames)
- `PROPAGATION_CHANCE` - Chance of signal propagating (default: 0.1)
- `FIRING_LINE_WIDTH` - Width of firing lines (default: 2)

#### Dendrite Settings (Particle Branches)
- `STATIC_DENDRITE_OPACITY` - Transparency of branches (default: 0.18)
- `STATIC_DENDRITE_LIFESPAN` - How long branches grow (default: 60)
- `STATIC_DENDRITE_BRANCH_CHANCE` - Probability of branching (default: 0.1)
- `STATIC_DENDRITE_SEGMENT_LENGTH` - Length of each segment (default: 5)

#### Wobble Animation
- `WOBBLE_SPEED` - Speed of wobble animation (default: 0.0002)
- `WOBBLE_FREQUENCY_MULTIPLIER` - Frequency of wobble (default: 1)
- `WOBBLE_AMPLITUDE_MULTIPLIER` - Overall wobble amplitude (default: 0.7)

#### Performance Settings
- `PERFORMANCE_FPS_THRESHOLD` - FPS threshold for reduction (default: 30)
- `PERFORMANCE_PARTICLE_REDUCTION` - Particles to remove if slow (default: 10)
- `MOBILE_BREAKPOINT` - Screen width for mobile optimization (default: 768)

### Usage Examples

#### Basic Implementation
```javascript
// Initialize the particle system
const particleSystem = new ParticleSystem('particle-canvas');
particleSystem.start();

// Pause/resume animation
particleSystem.pauseAnimation();
particleSystem.resumeAnimation();

// Clean up when done
particleSystem.destroy();
```

#### Custom Configuration
```javascript
// Create custom configuration
const customConfig = {
    PARTICLE_COLOR: '#FF6B6B',
    INITIAL_VELOCITY_RANGE: 1.0,
    FIRING_CHANCE: 0.001,
    WOBBLE_SPEED: 0.0001
};

// Apply custom config
const particleSystem = new ParticleSystem('particle-canvas');
Object.assign(particleSystem.config, customConfig);
particleSystem.start();
```

#### Performance Optimization
```javascript
// For low-end devices, reduce effects
const lowEndConfig = {
    PARTICLES_PER_PIXEL_DENSITY: 50000,  // Fewer particles
    FIRING_CHANCE: 0.0001,               // Less firing
    PARTICLE_SHADOW_BLUR: 8,             // Less blur
    WOBBLE_AMPLITUDE_MULTIPLIER: 0.3     // Less wobble
};
```

### Performance Features

The system automatically:
- **Scales particle count** based on screen size and device capabilities
- **Reduces effects** on mobile and low-end devices
- **Pauses animation** when the tab is not visible
- **Monitors FPS** and removes particles if performance drops
- **Uses quadtree** for efficient collision detection

### Browser Compatibility

The particle system works on all modern browsers with Canvas support:
- Chrome/Edge (full support)
- Firefox (full support)
- Safari (full support)
- Mobile browsers (optimized performance)

## Project Structure

- `index.html` – Main entry page with SEO optimization
- `css/style.css` – Custom styles with accessibility features
- `js/main.js` – Core functionality and performance optimizations
- `js/neuralbackground.js` – Neural network animation system
- `sw.js` – Service worker for offline support
- `manifest.json` – PWA manifest file
- `assets/` – Images and documents used by the site

## Technical Improvements

### Performance Enhancements
- **Lazy Loading** - Intersection Observer for section animations
- **Resource Preloading** - Critical assets loaded first
- **Memory Management** - Proper cleanup of animations and event listeners
- **FPS Monitoring** - Automatic performance adjustment

### SEO & Accessibility
- **Meta Tags** - Complete Open Graph and Twitter Card support
- **Semantic HTML** - Proper heading structure and landmarks
- **Keyboard Navigation** - Full keyboard accessibility
- **Screen Reader Support** - ARIA labels and semantic markup

### Progressive Web App Features
- **Offline Support** - Service worker caches critical resources
- **Install Prompt** - Users can install the app on their devices
- **Background Sync** - Handles offline actions when connection returns
- **App-like Experience** - Standalone mode and splash screens

## Usage

### Development
Open `index.html` directly in a browser or serve the directory with any static web server:

```bash
npx serve .
```

### Production Deployment
For production deployment, ensure:
1. HTTPS is enabled (required for service worker)
2. All assets are properly cached
3. Performance monitoring is active

### Browser Support
- **Modern Browsers** - Full PWA support
- **Legacy Browsers** - Graceful degradation
- **Mobile Browsers** - Optimized performance

## Performance Metrics

The site is optimized for:
- **First Contentful Paint** < 1.5s
- **Largest Contentful Paint** < 2.5s
- **Cumulative Layout Shift** < 0.1
- **First Input Delay** < 100ms

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
