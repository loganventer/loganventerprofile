// js/main.js

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