// js/main.js

// --- Navigation & Mobile Menu Logic ---
document.addEventListener('DOMContentLoaded', () => {
    let currentActiveSection = 'about';

    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenuContainer = document.getElementById('mobile-menu-container');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuClose = document.getElementById('mobile-menu-close');

    /**
     * Shows a specific section and hides others.
     * We attach this to the window object so it can be called from the inline onclick="" attributes in the HTML.
     * @param {string} sectionId - The ID of the section to show.
     * @param {HTMLElement} [element] - The navigation element that was clicked.
     */
    window.showSection = function(sectionId, element) {
        if (sectionId === currentActiveSection && document.querySelector('.section.active')) return;
        
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show the target section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
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
    }

    /**
     * Toggles the mobile menu visibility.
     * Also attached to the window object for inline onclick calls.
     */
    window.toggleMobileMenu = function() {
        const isOpen = mobileMenuContainer.classList.toggle('menu-open');
        mobileMenu.classList.toggle('menu-open');
        document.body.classList.toggle('body-no-scroll', isOpen);
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
    
    // Show the initial "About Me" section on page load
    showSection('about');
});