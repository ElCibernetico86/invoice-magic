// ============================================================
// app.js — Main Application Controller & Router
// ============================================================
// Manages view routing, navigation bar state, tab bar state,
// service worker registration, and orchestrates the lifecycle
// of all sub-views.
// ============================================================

const App = {
    _currentView: 'dashboard',    // 'dashboard' | 'invoices' | 'estimates' | 'clients' | 'tools' | 'settings' | 'editor' | 'preview'
    _previousView: 'dashboard',
    _currentDocId: null,

    // ── Initialize ──
    async init() {
        await db.open();

        // Optional cloud backup (no-op until firebase-config.js is filled in)
        if (typeof CloudSync !== 'undefined') CloudSync.init();

        // Apply saved theme
        Utils.applyTheme();

        // Register Service Worker for offline & PWA
        this._registerServiceWorker();

        // Tab bar click handlers
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.tab;
                Utils.haptic('light');
                this.navigate(view);
            });
        });

        // Back button handler
        document.getElementById('nav-back').addEventListener('click', () => {
            Utils.haptic('light');
            this.navigateBack();
        });

        const company = await db.getCompanyProfile();
        if (company.brandColor) Utils.applyAccent(company.brandColor);

        // Load the initial view
        this.navigate('dashboard');
    },

    // ── Register Service Worker ──
    _registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(() => {
                    // Service worker registered successfully
                })
                .catch((err) => {
                    console.warn('Service worker registration failed:', err);
                });
        }
    },

    // ── Navigate to a top-level tab ──
    async navigate(view) {
        // Clean up FAB from list views
        DocumentListView.removeFAB();

        // Save editor if we're leaving it
        if (this._currentView === 'editor') {
            await DocumentEditorView.saveNow();
        }

        this._previousView = this._currentView;
        this._currentView = view;
        this._currentDocId = null;

        const container = document.getElementById('main-content');
        const navTitle = document.getElementById('nav-title');
        const navBack = document.getElementById('nav-back');
        const navAction = document.getElementById('nav-action');
        const navAction2 = document.getElementById('nav-action-2');

        // Update navigation bar
        navBack.style.display = 'none';
        navAction.style.display = 'none';
        navAction2.style.display = 'none';

        // Update tab bar
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`[data-tab="${view}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Show tab bar
        document.getElementById('tab-bar').style.display = '';

        // Route to view
        switch (view) {
            case 'dashboard':
                navTitle.innerHTML = this._brandTitle();
                await DashboardView.render(container);
                break;

            case 'invoices':
                navTitle.innerHTML = this._brandTitle();
                await DocumentListView.render(container, 'invoice');
                break;

            case 'estimates':
                navTitle.innerHTML = this._brandTitle();
                await DocumentListView.render(container, 'estimate');
                break;

            case 'clients':
                navTitle.textContent = 'Clients';
                await ClientsView.render(container);
                break;

            case 'tools':
                navTitle.textContent = 'Tools';
                await ToolsView.render(container);
                break;

            case 'settings':
                navTitle.textContent = 'Settings';
                await SettingsView.render(container);
                break;
        }

        // Scroll to top
        container.scrollTop = 0;
    },

    _brandTitle() {
        return `<span style="display:flex; align-items:center; gap:8px; color:var(--color-label);"><svg width="24" height="24" viewBox="0 0 24 24" fill="var(--color-blue)" stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Invoice Magic</span>`;
    },

    _labelForView(view) {
        const labels = {
            dashboard: 'Home',
            invoices: 'Invoices',
            estimates: 'Estimates',
            clients: 'Clients',
            tools: 'Tools',
            settings: 'Settings',
        };
        return labels[view] || 'Back';
    },

    async createDocument(documentType, templateId = null, client = null) {
        const docNum = await db.getNextDocumentNumber(documentType, client);
        const company = await db.getCompanyProfile();
        const presetId = templateId || client?.defaultPresetId || company.defaultPresetId || 'apple-clean';
        const preset = Utils.getBrandPreset(presetId);
        const doc = Utils.createBlankDocument(documentType, docNum, preset.id);
        doc.templateId = preset.templateId;
        doc.brandPresetId = preset.id;
        doc.brandColor = company.brandColor || preset.color;
        doc.paymentTerms = company.defaultTerms && company.defaultTerms !== 'Payment due within 30 days.'
            ? company.defaultTerms
            : '';
        doc.paymentLink = company.paymentUrl || '';
        if (company.defaultTaxRate) {
            doc.lineItems[0].taxRate = parseFloat(company.defaultTaxRate) || 0;
        }

        if (client) {
            doc.clientId = client.id;
            doc.clientName = client.name;
            doc.paymentTerms = client.defaultTerms || doc.paymentTerms;
            doc.paymentLink = client.paymentUrl || doc.paymentLink;
            if (client.defaultTaxRate !== undefined && client.defaultTaxRate !== '') {
                doc.lineItems[0].taxRate = parseFloat(client.defaultTaxRate) || doc.lineItems[0].taxRate;
            }
        }

        Utils.addActivity(doc, 'preset', 'Brand preset selected', preset.name);
        const id = await db.saveDocument(doc);
        Utils.haptic('success');
        return id;
    },

    async showDocumentComposer(documentType, options = {}) {
        const [clients, company] = await Promise.all([
            db.getAllClients(),
            db.getCompanyProfile(),
        ]);
        const selectedClientId = options.client?.id || '';
        const defaultPresetId = options.client?.defaultPresetId || company.defaultPresetId || 'apple-clean';
        const typeLabel = documentType === 'invoice' ? 'Invoice' : 'Estimate';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-sheet modal-sheet-tall composer-sheet">
                <div class="modal-handle"></div>
                <div class="modal-title">New ${typeLabel}</div>
                <div class="composer-summary">
                    <div>
                        <strong>Start with a brand preset</strong>
                        <span>Each preset sets the layout, color, terms, and document voice.</span>
                    </div>
                </div>
                <div class="modal-form">
                    <label>Client
                        <select id="composer-client">
                            <option value="">Choose later</option>
                            ${clients.map(client => `
                                <option value="${client.id}" ${client.id === selectedClientId ? 'selected' : ''}>${Utils.escapeHtml(client.name)}</option>
                            `).join('')}
                        </select>
                    </label>
                </div>
                <div class="preset-grid">
                    ${Utils.brandPresets.map(preset => `
                        <button class="preset-card ${preset.id === defaultPresetId ? 'active' : ''}" data-preset-id="${preset.id}">
                            <span class="preset-color" style="background:${preset.color}"></span>
                            <strong>${preset.name}</strong>
                            <small>${preset.tone}</small>
                            <em>${preset.dueDays} day terms</em>
                        </button>
                    `).join('')}
                </div>
                <div class="modal-actions">
                    <button class="modal-action-btn modal-action-cancel" id="composer-cancel">Cancel</button>
                </div>
            </div>
        `;

        document.getElementById('app').appendChild(overlay);
        overlay.querySelector('#composer-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelectorAll('[data-preset-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const clientId = parseInt(overlay.querySelector('#composer-client').value, 10);
                const client = clients.find(c => c.id === clientId) || options.client || null;
                overlay.remove();
                const id = await this.createDocument(documentType, btn.dataset.presetId, client);
                App.navigateToEditor(id);
            });
        });
    },

    async recordDocumentEvent(docId, type, title, detail = '', patch = {}) {
        const doc = await db.getDocument(docId);
        if (!doc) return null;
        Object.assign(doc, patch);
        Utils.addActivity(doc, type, title, detail);
        await db.saveDocument(doc);
        return doc;
    },

    // ── Navigate to the document editor ──
    async navigateToEditor(docId) {
        // Clean up FAB
        DocumentListView.removeFAB();

        // Save current editor if open
        if (this._currentView === 'editor') {
            await DocumentEditorView.saveNow();
        }

        this._previousView = (this._currentView === 'editor' || this._currentView === 'preview')
            ? this._previousView
            : this._currentView;
        this._currentView = 'editor';
        this._currentDocId = docId;

        const container = document.getElementById('main-content');
        const navTitle = document.getElementById('nav-title');
        const navBack = document.getElementById('nav-back');
        const navBackLabel = document.getElementById('nav-back-label');
        const navAction = document.getElementById('nav-action');
        const navActionLabel = document.getElementById('nav-action-label');
        const navAction2 = document.getElementById('nav-action-2');
        const navAction2Label = document.getElementById('nav-action-2-label');

        // Get the doc to show proper title
        const doc = await db.getDocument(docId);

        // Update navigation bar
        navTitle.textContent = doc ? doc.documentID : 'Edit';
        navBack.style.display = '';
        navBackLabel.textContent = this._labelForView(this._previousView);

        // "Done" action button
        navAction.style.display = '';
        navActionLabel.textContent = 'Done';
        navAction.onclick = async () => {
            await DocumentEditorView.saveNow();
            Utils.haptic('success');
            Toast.show('Saved', 'success');
            this.navigateBack();
        };

        // "Share" action button (second action)
        navAction2.style.display = '';
        navAction2Label.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`;
        navAction2.onclick = async () => {
            await DocumentEditorView.saveNow();
            Utils.haptic('light');
            App.navigateToPreview(docId);
        };

        // Deselect tabs
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

        // Hide tab bar in editor for more space
        document.getElementById('tab-bar').style.display = 'none';

        // Render editor
        await DocumentEditorView.render(container, docId);

        // Scroll to top
        container.scrollTop = 0;
    },

    // ── Navigate to the document preview ──
    async navigateToPreview(docId) {
        // Clean up FAB
        DocumentListView.removeFAB();

        // Save editor first
        if (this._currentView === 'editor') {
            await DocumentEditorView.saveNow();
        }

        this._previousView = (this._currentView === 'preview')
            ? this._previousView
            : this._currentView;
        this._currentView = 'preview';
        this._currentDocId = docId;

        const container = document.getElementById('main-content');
        const navTitle = document.getElementById('nav-title');
        const navBack = document.getElementById('nav-back');
        const navBackLabel = document.getElementById('nav-back-label');
        const navAction = document.getElementById('nav-action');
        const navActionLabel = document.getElementById('nav-action-label');
        const navAction2 = document.getElementById('nav-action-2');

        // Get the doc for title
        const doc = await db.getDocument(docId);

        // Update navigation bar
        navTitle.textContent = 'Preview';
        navBack.style.display = '';
        navBackLabel.textContent = doc ? doc.documentID : 'Back';

        // "Edit" action button on preview
        navAction.style.display = '';
        navActionLabel.textContent = 'Edit';
        navAction.onclick = () => {
            Utils.haptic('light');
            App.navigateToEditor(docId);
        };

        // Hide second action
        navAction2.style.display = 'none';

        // Deselect tabs
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

        // Hide tab bar in preview
        document.getElementById('tab-bar').style.display = 'none';

        // Render preview
        await DocumentPreviewView.render(container, docId);

        // Scroll to top
        container.scrollTop = 0;
    },

    // ── Navigate back ──
    async navigateBack() {
        if (this._currentView === 'editor') {
            await DocumentEditorView.saveNow();
        }

        // If coming from preview, go back to editor
        if (this._currentView === 'preview' && this._currentDocId) {
            this.navigateToEditor(this._currentDocId);
            return;
        }

        this.navigate(this._previousView || 'dashboard');
    },
};

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
