// js/main.js

// --- Theme ---
window.toggleTheme = function() {
    var html = document.documentElement;
    var current = html.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcons(next);
    if (particleSystem && particleSystem.updateColors) {
        particleSystem.updateColors(next);
    }
    updateMermaidTheme(next);
};

function updateThemeIcons(theme) {
    var cls = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    var icon = document.getElementById('theme-icon');
    var iconMobile = document.getElementById('theme-icon-mobile');
    if (icon) icon.className = cls;
    if (iconMobile) iconMobile.className = cls;
}

// Set initial icon state
(function() {
    var theme = document.documentElement.getAttribute('data-theme') || 'dark';
    document.addEventListener('DOMContentLoaded', function() { updateThemeIcons(theme); });
})();

// --- Mermaid Theme Override (JS-based, bypasses CSS specificity issues) ---
// Saves original style attributes before overriding, restores them for dark mode.
window.updateMermaidTheme = function(theme) {
    var isLight = theme === 'light';
    var ATTR = 'data-orig-style';

    function overrideEls(svg, selector, applyFn) {
        svg.querySelectorAll(selector).forEach(function(el) {
            if (isLight) {
                if (!el.hasAttribute(ATTR)) {
                    el.setAttribute(ATTR, el.getAttribute('style') || '');
                }
                applyFn(el);
            } else if (el.hasAttribute(ATTR)) {
                var orig = el.getAttribute(ATTR);
                if (orig) {
                    el.setAttribute('style', orig);
                } else {
                    el.removeAttribute('style');
                }
                el.removeAttribute(ATTR);
            }
        });
    }

    // Pastel palettes per project accent color
    var palettes = {
        blue:   { fill: '#dbeafe', stroke: '#60a5fa' },
        green:  { fill: '#d1fae5', stroke: '#34d399' },
        amber:  { fill: '#fef3c7', stroke: '#fbbf24' },
        purple: { fill: '#ede9fe', stroke: '#a78bfa' }
    };

    // === Project card diagrams ===
    document.querySelectorAll('.project-card').forEach(function(card) {
        var svg = card.querySelector('svg');
        if (!svg) return;

        // Determine pastel palette from card accent
        var p = palettes.blue;
        if (card.querySelector('.project-card-accent-green')) p = palettes.green;
        else if (card.querySelector('.project-card-accent-amber')) p = palettes.amber;
        else if (card.querySelector('.project-card-accent-purple')) p = palettes.purple;

        overrideEls(svg, '.node rect, .node polygon, .node circle', function(el) {
            var orig = el.getAttribute(ATTR) || '';
            var isNeutral = orig.indexOf('1e293b') !== -1;
            el.style.setProperty('fill', isNeutral ? '#f1f5f9' : p.fill, 'important');
            el.style.setProperty('stroke', p.stroke, 'important');
        });
        overrideEls(svg, '.nodeLabel', function(el) {
            el.style.setProperty('color', '#1e293b', 'important');
        });
        svg.querySelectorAll('.edgeLabel rect, .edgeLabel polygon').forEach(function(el) {
            el.style.setProperty('fill', isLight ? '#e2e8f0' : '#1e293b', 'important');
            el.style.setProperty('stroke', 'none', 'important');
        });
        svg.querySelectorAll('.edgeLabel span').forEach(function(el) {
            el.style.setProperty('color', isLight ? '#334155' : '#e2e8f0', 'important');
        });
        overrideEls(svg, '.flowchart-link', function(el) {
            el.style.setProperty('stroke', '#94a3b8', 'important');
        });
        overrideEls(svg, 'marker path', function(el) {
            el.style.setProperty('fill', '#94a3b8', 'important');
            el.style.setProperty('stroke', '#94a3b8', 'important');
        });
    });

    // === Chatbot diagrams (varied node colors from expanded palette) ===
    var chatNodePalettes = isLight ? [
        { fill: '#dbeafe', stroke: '#60a5fa', text: '#1e40af' },
        { fill: '#d1fae5', stroke: '#34d399', text: '#065f46' },
        { fill: '#fef3c7', stroke: '#fbbf24', text: '#92400e' },
        { fill: '#ede9fe', stroke: '#a78bfa', text: '#5b21b6' },
        { fill: '#fce7f3', stroke: '#f472b6', text: '#9d174d' },
        { fill: '#cffafe', stroke: '#22d3ee', text: '#155e75' },
        { fill: '#ffedd5', stroke: '#fb923c', text: '#9a3412' },
        { fill: '#e0e7ff', stroke: '#818cf8', text: '#3730a3' }
    ] : [
        { fill: '#1e3a5f', stroke: '#3b82f6', text: '#93c5fd' },
        { fill: '#1a3a2a', stroke: '#10b981', text: '#6ee7b7' },
        { fill: '#3b2a1a', stroke: '#f59e0b', text: '#fcd34d' },
        { fill: '#2a1a3b', stroke: '#8b5cf6', text: '#c4b5fd' },
        { fill: '#3b1a2a', stroke: '#f472b6', text: '#fbcfe8' },
        { fill: '#1a3b3b', stroke: '#22d3ee', text: '#a5f3fc' },
        { fill: '#3b2514', stroke: '#fb923c', text: '#fed7aa' },
        { fill: '#1e1a3b', stroke: '#818cf8', text: '#c7d2fe' }
    ];
    var chatEdgeBg = isLight ? '#e2e8f0' : '#0f172a';
    var chatEdgeText = isLight ? '#334155' : '#cbd5e1';
    var chatLine = isLight ? '#94a3b8' : '#64748b';

    document.querySelectorAll('.chat-mermaid-block svg').forEach(function(svg) {
        svg.querySelectorAll('.node').forEach(function(node, i) {
            var p = chatNodePalettes[i % chatNodePalettes.length];
            node.querySelectorAll('rect, polygon, circle').forEach(function(el) {
                el.style.setProperty('fill', p.fill, 'important');
                el.style.setProperty('fill-opacity', isLight ? '1' : '0.55', 'important');
                el.style.setProperty('stroke', p.stroke, 'important');
            });
            node.querySelectorAll('.nodeLabel').forEach(function(el) {
                el.style.setProperty('color', p.text, 'important');
            });
        });
        svg.querySelectorAll('.edgeLabel rect, .edgeLabel polygon').forEach(function(el) {
            el.style.setProperty('fill', chatEdgeBg, 'important');
            el.style.setProperty('stroke', 'none', 'important');
        });
        svg.querySelectorAll('.edgeLabel span').forEach(function(el) {
            el.style.setProperty('color', chatEdgeText, 'important');
        });
        svg.querySelectorAll('.flowchart-link').forEach(function(el) {
            el.style.setProperty('stroke', chatLine, 'important');
        });
        svg.querySelectorAll('marker path').forEach(function(el) {
            el.style.setProperty('fill', chatLine, 'important');
            el.style.setProperty('stroke', chatLine, 'important');
        });
    });
};

// --- Performance & Loading States ---
let isPageLoaded = false;
let particleSystem = null;
let isProgrammaticNavigation = false; // Flag to prevent popstate interference

// Initialize particle system (non-blocking)
function initializeParticleSystem() {
    try {
        if (typeof ParticleSystem !== 'undefined') {
            particleSystem = new ParticleSystem('neural-canvas');
            if (particleSystem) {
                particleSystem.start();
            }
        } else {
            console.warn('ParticleSystem class not found - neural background will not be available');
        }
    } catch (error) {
        console.error('Particle system failed to initialize:', error);
    }
}

// Show loading state
function showLoading() {
    const loadingEl = document.createElement('div');
    loadingEl.id = 'loading-overlay';
    loadingEl.innerHTML = `
        <div class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
            <div class="text-center">
                <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-400 mx-auto mb-4"></div>
                <p class="text-white text-lg">Loading...</p>
            </div>
        </div>
    `;
    document.body.appendChild(loadingEl);
}

// Hide loading state
function hideLoading() {
    const loadingEl = document.getElementById('loading-overlay');
    if (loadingEl) {
        loadingEl.style.opacity = '0';
        setTimeout(() => loadingEl.remove(), 300);
    }
}

// --- Navigation & Mobile Menu Logic ---
document.addEventListener('DOMContentLoaded', () => {
    let currentActiveSection = 'about';

    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenuContainer = document.getElementById('mobile-menu-container');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuClose = document.getElementById('mobile-menu-close');

    // Initialize particle system after DOM is ready
    initializeParticleSystem();

    // Hide loading after everything is ready
    setTimeout(() => {
        hideLoading();
        isPageLoaded = true;
    }, 500);

    /**
     * Shows a specific section and hides others.
     * We attach this to the window object so it can be called from the inline onclick="" attributes in the HTML.
     * @param {string} sectionId - The ID of the section to show.
     * @param {HTMLElement} [element] - The navigation element that was clicked.
     */
    window.showSection = function(sectionId, element) {
        if (sectionId === currentActiveSection && document.querySelector('.section.active')) {
            return;
        }
        
        // Add loading state for section transitions
        const currentSection = document.querySelector('.section.active');
        if (currentSection) {
            currentSection.style.opacity = '0.5';
        }
        
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
            section.style.opacity = '1';
        });
        
        // Show the target section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            // Smooth fade in
            targetSection.style.opacity = '0';
            setTimeout(() => {
                targetSection.style.opacity = '1';
            }, 50);
        } else {
            console.error('Target section not found:', sectionId);
        }
        currentActiveSection = sectionId;

        // Update active state on navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('nav-item-active');
        });
        
        if (element && !element.closest('.dropdown')) {
            // Handles direct navigation links
            element.classList.add('nav-item-active');
        } else if (element) {
            // This is a link inside a dropdown
            let parentDropdown = element.closest('.dropdown');
            if (parentDropdown) {
                parentDropdown.querySelector('.nav-item').classList.add('nav-item-active');
            }
        } else {
            // Fallback for the initial page load
            const aboutLink = document.querySelector('a.nav-item[onclick*="\'about\'"]');
            if (aboutLink) {
                aboutLink.classList.add('nav-item-active');
            }
        }

        // Update URL hash for better navigation
        if (history.pushState) {
            isProgrammaticNavigation = true;
            history.pushState(null, null, '#' + sectionId);
            // Reset the flag after a short delay
            setTimeout(() => {
                isProgrammaticNavigation = false;
            }, 100);
        }
    }

    /**
     * Toggles the mobile menu visibility.
     * Also attached to the window object for inline onclick calls.
     */
    window.toggleMobileMenu = function() {
        const isOpen = mobileMenuContainer.classList.toggle('menu-open');
        mobileMenu.classList.toggle('menu-open');
        document.body.classList.toggle('body-no-scroll', isOpen);
        
        // Pause particle animation on mobile menu open for performance
        if (particleSystem && particleSystem.pauseAnimation) {
            if (isOpen) {
                particleSystem.pauseAnimation();
            } else {
                particleSystem.resumeAnimation();
            }
        }
    }

    // --- Event Listeners ---
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', toggleMobileMenu);
    }
    if (mobileMenuClose) {
        mobileMenuClose.addEventListener('click', toggleMobileMenu);
    }
    
    // Close menu if user clicks on the background overlay
    if (mobileMenuContainer) {
        mobileMenuContainer.addEventListener('click', (e) => {
            if (e.target === mobileMenuContainer) {
                toggleMobileMenu();
            }
        });
    }

    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
        if (isProgrammaticNavigation) {
            return; // Ignore popstate events caused by our own navigation
        }
        const hash = window.location.hash.slice(1);
        if (hash && document.getElementById(hash)) {
            showSection(hash);
        } else {
            showSection('about');
        }
    });

    // Keyboard navigation support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close mobile menu if open
            if (mobileMenuContainer.classList.contains('menu-open')) {
                toggleMobileMenu();
            }
        }
    });

    // Performance: Intersection Observer for lazy loading
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '50px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('section-visible');
            }
        });
    }, observerOptions);

    // Observe all sections
    document.querySelectorAll('.section').forEach(section => {
        observer.observe(section);
    });
    
    // Show the initial "About Me" section on page load
    showSection('about');
});

// Ensure showSection is available globally even if DOMContentLoaded fails
window.addEventListener('load', () => {
    if (!window.showSection) {
        console.warn('showSection not available, creating fallback');
        window.showSection = function(sectionId, element) {
            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        };
        // Show about section if no section is active
        if (!document.querySelector('.section.active')) {
            showSection('about');
        }
    }
});

// --- Performance Optimizations ---
window.addEventListener('load', () => {
    // Preload critical images
    const criticalImages = [
        'assets/images/image.jpg'
    ];
    
    criticalImages.forEach(src => {
        const img = new Image();
        img.src = src;
    });
});

// --- Error Handling ---
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    // Could add error reporting here
});

// --- Cleanup on page unload ---
window.addEventListener('beforeunload', () => {
    if (particleSystem && particleSystem.destroy) {
        particleSystem.destroy();
    }
});