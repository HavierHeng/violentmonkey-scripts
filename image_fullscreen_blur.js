// ==UserScript==
// @name         Fullscreen Image Scaler with Background Blur
// @namespace    http://tampermonkey.net/
// @version      1.11
// @description  Scales the largest visible image to screen height, blurs background, allows arrow key passthrough, with stable draggable 🖥️ toggle button at center-right of image
// @author       Grok
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let isFullscreenMode = false;
    let originalImage = null;
    let scaledImage = null;
    let toggleButton = null;
    let observer = null;
    let contentWrapper = null;
    let isProcessing = false;
    let lastButtonUpdate = 0;

    // Ensure DOM is loaded before initialization
    function initializeScript() {
        if (!document.body && !document.documentElement) {
            setTimeout(initializeScript, 100);
            return;
        }
        createContentWrapper();
        ensureToggleButton();
        setTimeout(scaleImageToScreen, 1000); // Initial check for images
    }

    // Create a wrapper for page content to apply blur
    function createContentWrapper() {
        if (document.getElementById('fullscreen-image-content-wrapper')) return;
        contentWrapper = document.createElement('div');
        contentWrapper.id = 'fullscreen-image-content-wrapper';
        const parent = document.body || document.documentElement;
        while (parent.firstChild && parent.firstChild !== toggleButton && parent.firstChild !== scaledImage) {
            contentWrapper.appendChild(parent.firstChild);
        }
        try {
            parent.appendChild(contentWrapper);
        } catch (e) {
            console.error('Failed to append content wrapper:', e);
        }
    }

    // Create or recreate the toggle button
    function createToggleButton() {
        toggleButton = document.createElement('button');
        toggleButton.id = 'fullscreen-image-toggle-button';
        toggleButton.textContent = '🖥️';
        toggleButton.style.position = 'fixed';
        toggleButton.style.top = '50%';
        toggleButton.style.left = '50%';
        toggleButton.style.transform = 'translate(-50%, -50%)';
        toggleButton.style.zIndex = '999999'; // High z-index to avoid overlap
        toggleButton.style.padding = '5px';
        toggleButton.style.backgroundColor = '#007bff';
        toggleButton.style.color = '#fff';
        toggleButton.style.border = 'none';
        toggleButton.style.borderRadius = '5px';
        toggleButton.style.cursor = 'move'; // Indicate draggable
        toggleButton.style.userSelect = 'none';
        toggleButton.style.fontSize = '24px'; // Larger emoji
        toggleButton.addEventListener('click', toggleFullscreenMode);

        // Make button draggable
        let isDragging = false;
        let currentX;
        let currentY;

        toggleButton.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                isDragging = true;
                currentX = e.clientX - parseFloat(toggleButton.style.left || window.innerWidth / 2);
                currentY = e.clientY - parseFloat(toggleButton.style.top || window.innerHeight / 2);
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                toggleButton.style.left = `${e.clientX - currentX}px`;
                toggleButton.style.top = `${e.clientY - currentY}px`;
                toggleButton.style.right = 'auto';
                toggleButton.style.bottom = 'auto';
                toggleButton.style.transform = 'none'; // Remove centering when dragged
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        return toggleButton;
    }

    // Ensure toggle button is present
    function ensureToggleButton() {
        const parent = document.body || document.documentElement;
        if (!document.getElementById('fullscreen-image-toggle-button')) {
            console.debug('Creating toggle button');
            try {
                parent.appendChild(createToggleButton());
                updateButtonPosition(); // Update position after creating
            } catch (e) {
                console.error('Failed to append toggle button:', e);
                // Fallback to documentElement if body fails
                if (parent !== document.documentElement) {
                    try {
                        document.documentElement.appendChild(createToggleButton());
                        updateButtonPosition();
                    } catch (e2) {
                        console.error('Fallback append to documentElement failed:', e2);
                    }
                }
            }
        }

        // Periodic check to ensure button exists
        setInterval(() => {
            if (!document.getElementById('fullscreen-image-toggle-button')) {
                console.warn('Toggle button missing, attempting to recreate');
                try {
                    parent.appendChild(createToggleButton());
                    updateButtonPosition(); // Update position after recreating
                } catch (e) {
                    console.error('Failed to re-append toggle button:', e);
                    // Fallback to documentElement
                    if (parent !== document.documentElement) {
                        try {
                            document.documentElement.appendChild(createToggleButton());
                            updateButtonPosition();
                        } catch (e2) {
                            console.error('Fallback append to documentElement failed:', e2);
                        }
                    }
                }
            }
        }, 500); // Increased frequency for faster recovery

        // Observe DOM to recreate button if removed
        const buttonObserver = new MutationObserver(() => {
            if (!document.getElementById('fullscreen-image-toggle-button')) {
                console.warn('Toggle button removed by DOM mutation, recreating');
                try {
                    parent.appendChild(createToggleButton());
                    updateButtonPosition(); // Update position after recreating
                } catch (e) {
                    console.error('Failed to recreate toggle button:', e);
                    // Fallback to documentElement
                    if (parent !== document.documentElement) {
                        try {
                            document.documentElement.appendChild(createToggleButton());
                            updateButtonPosition();
                        } catch (e2) {
                            console.error('Fallback append to documentElement failed:', e2);
                        }
                    }
                }
            }
        });
        buttonObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Debounce function to limit update frequency
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Update button position to center-right of scaled image or page center
    const updateButtonPosition = debounce(() => {
        if (!toggleButton) return;
        // Skip if button has been dragged
        if (toggleButton.style.transform === 'none') return;

        const now = Date.now();
        if (now - lastButtonUpdate < 100) return; // Throttle updates
        lastButtonUpdate = now;

        if (isFullscreenMode && scaledImage) {
            const imgRect = scaledImage.getBoundingClientRect();
            toggleButton.style.left = `${imgRect.right + 10}px`; // 10px offset from image right
            toggleButton.style.top = `${imgRect.top + imgRect.height / 2}px`;
            toggleButton.style.transform = 'translateY(-50%)'; // Center vertically
            toggleButton.style.right = 'auto';
            toggleButton.style.bottom = 'auto';
        } else {
            toggleButton.style.left = '50%';
            toggleButton.style.top = '50%';
            toggleButton.style.transform = 'translate(-50%, -50%)'; // Center on page
            toggleButton.style.right = 'auto';
            toggleButton.style.bottom = 'auto';
        }
    }, 100);

    // Check if an element is at least partially in the viewport
    function isElementInViewport(el) {
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;
        return (
            rect.top < windowHeight &&
            rect.bottom > 0 &&
            rect.left < windowWidth &&
            rect.right > 0
        );
    }

    // Find the largest image that is at least partially visible
    function findLargestVisibleImage() {
        const images = document.querySelectorAll('img');
        let largestImage = null;
        let maxArea = 0;

        images.forEach(img => {
            if (img.complete && img.naturalWidth > 0 && isElementInViewport(img)) {
                const area = img.naturalWidth * img.naturalHeight;
                if (area > maxArea) {
                    maxArea = area;
                    largestImage = img;
                }
            }
        });

        return largestImage;
    }

    // Scale and display the image
    function scaleImageToScreen() {
        if (!isFullscreenMode || isProcessing) return;
        isProcessing = true;

        // Remove previous scaled image if it exists
        if (scaledImage) {
            scaledImage.remove();
            scaledImage = null;
        }

        originalImage = findLargestVisibleImage();
        if (!originalImage) {
            isProcessing = false;
            updateButtonPosition(); // Update button even if no image
            return;
        }

        // Create a new image element for scaling
        scaledImage = document.createElement('img');
        scaledImage.src = originalImage.src;
        scaledImage.style.position = 'fixed';
        scaledImage.style.top = '0';
        scaledImage.style.left = '50%';
        scaledImage.style.transform = 'translateX(-50%)';
        scaledImage.style.zIndex = '999998'; // Below button but above content
        scaledImage.style.maxWidth = 'none';
        scaledImage.style.maxHeight = 'none';
        scaledImage.style.pointerEvents = 'none'; // Allow events to pass through

        // Scale to screen height while preserving aspect ratio
        const screenHeight = window.innerHeight;
        const aspectRatio = originalImage.naturalWidth / originalImage.naturalHeight;
        scaledImage.style.height = `${screenHeight}px`;
        scaledImage.style.width = `${screenHeight * aspectRatio}px`;

        try {
            const parent = document.body || document.documentElement;
            parent.appendChild(scaledImage);
        } catch (e) {
            console.error('Failed to append scaled image:', e);
        }

        updateButtonPosition(); // Update button position after scaling
        isProcessing = false;
    }

    // Toggle fullscreen mode
    function toggleFullscreenMode() {
        isFullscreenMode = !isFullscreenMode;

        if (isFullscreenMode) {
            toggleButton.textContent = '🖥️';
            contentWrapper.style.transition = 'filter 0.3s';
            contentWrapper.style.filter = 'blur(5px)';
            scaleImageToScreen();
            window.addEventListener('scroll', scaleImageToScreen);
            window.addEventListener('resize', () => {
                scaleImageToScreen();
                updateButtonPosition();
            });
            observer = new MutationObserver((mutations) => {
                if (isProcessing) return;
                for (const mutation of mutations) {
                    if (mutation.type === 'attributes' && (mutation.attributeName === 'src' || mutation.attributeName === 'class')) {
                        scaleImageToScreen();
                        break;
                    }
                }
            });
            observer.observe(document.body, {
                attributes: true,
                subtree: true,
                attributeFilter: ['src', 'class']
            });
            ensureToggleButton(); // Ensure button is present when entering fullscreen
        } else {
            toggleButton.textContent = '🖥️';
            contentWrapper.style.filter = 'none';
            if (scaledImage) {
                scaledImage.remove();
                scaledImage = null;
            }
            originalImage = null;
            window.removeEventListener('scroll', scaleImageToScreen);
            window.removeEventListener('resize', () => {
                scaleImageToScreen();
                updateButtonPosition();
            });
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            updateButtonPosition(); // Reset button to page center
            ensureToggleButton(); // Ensure button is present when exiting fullscreen
        }
    }

    // Pass arrow key events to the underlying page
    document.addEventListener('keydown', (event) => {
        if (isFullscreenMode && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            try {
                const newEvent = new KeyboardEvent('keydown', {
                    key: event.key,
                    code: event.code,
                    keyCode: event.keyCode,
                    which: event.which,
                    bubbles: true,
                    cancelable: true
                });
                (document.body || document.documentElement).dispatchEvent(newEvent);
            } catch (e) {
                console.error('Error dispatching key event:', e);
            }
        }
    });

    // Initialize the script after DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeScript);
    } else {
        initializeScript();
    }
})();
