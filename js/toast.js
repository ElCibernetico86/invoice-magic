// ============================================================
// toast.js — Toast Notification System
// ============================================================
// Provides subtle, iOS-style toast feedback for user actions
// like save, delete, convert. Auto-dismisses after a timeout.
// ============================================================

const Toast = {
    _container: null,
    _timeout: null,

    _ensureContainer() {
        if (this._container) return;
        this._container = document.createElement('div');
        this._container.className = 'toast-container';
        this._container.setAttribute('aria-live', 'polite');
        document.getElementById('app').appendChild(this._container);
    },

    /**
     * Show a toast notification
     * @param {string} message - Text to display
     * @param {'success'|'error'|'info'} type - Visual style
     * @param {number} duration - Ms before auto-dismiss (default 2200)
     */
    show(message, type = 'info', duration = 2200) {
        this._ensureContainer();

        // Clear any existing toast
        clearTimeout(this._timeout);
        this._container.innerHTML = '';

        const icons = {
            success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`,
            error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        this._container.appendChild(toast);

        // Force reflow for animation
        toast.offsetHeight;
        toast.classList.add('toast-visible');

        this._timeout = setTimeout(() => {
            toast.classList.remove('toast-visible');
            toast.classList.add('toast-exit');
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 350);
        }, duration);
    },
};
