/**
 * Component Loader Module
 * Loads common HTML components to reduce redundancy
 */

class ComponentLoader {
    constructor() {
        this.componentsPath = 'assets/components/';
    }

    /**
     * Load a component and insert it into the specified element
     * @param {string} componentName - Name of the component file (without .html)
     * @param {string} targetSelector - CSS selector where to insert the component
     * @returns {Promise<void>}
     */
    async loadComponent(componentName, targetSelector) {
        try {
            const response = await fetch(`${this.componentsPath}${componentName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load component: ${componentName}`);
            }
            const html = await response.text();
            const targetElement = document.querySelector(targetSelector);
            if (targetElement) {
                targetElement.insertAdjacentHTML('beforeend', html);
            } else {
                console.warn(`Target element not found: ${targetSelector}`);
            }
        } catch (error) {
            console.error(`Error loading component ${componentName}:`, error);
        }
    }

    /**
     * Load multiple components
     * @param {Array<{name: string, target: string}>} components
     * @returns {Promise<void>}
     */
    async loadComponents(components) {
        const promises = components.map(({ name, target }) =>
            this.loadComponent(name, target)
        );
        await Promise.all(promises);

        // Dispatch event to notify that components are loaded
        document.dispatchEvent(new Event('componentsLoaded'));
    }

    /**
     * Replace an element's content with a component
     * @param {string} componentName - Name of the component file
     * @param {string} targetSelector - CSS selector to replace
     * @returns {Promise<void>}
     */
    async replaceWithComponent(componentName, targetSelector) {
        try {
            const response = await fetch(`${this.componentsPath}${componentName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load component: ${componentName}`);
            }
            const html = await response.text();
            const targetElement = document.querySelector(targetSelector);
            if (targetElement) {
                targetElement.outerHTML = html;
            } else {
                console.warn(`Target element not found: ${targetSelector}`);
            }
        } catch (error) {
            console.error(`Error loading component ${componentName}:`, error);
        }
    }
}

// Create global instance
window.componentLoader = new ComponentLoader();

// Export for ES modules
export { ComponentLoader };
