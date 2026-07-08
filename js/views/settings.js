// ============================================================
// settings.js — Company Profile / Settings View
// ============================================================
// Mirrors iOS Settings app layout with grouped Form sections
// for logo, business details, registration info, preferences,
// and data export/import for backup.
// ============================================================

const SettingsView = {
    _profile: null,

    // ── Render ──
    async render(container) {
        this._profile = await db.getCompanyProfile();
        const currentCurrency = Utils.getPreferredCurrency();
        const currentTheme = Utils.getThemePreference();
        const currentPreset = this._profile.defaultPresetId || 'apple-clean';

        const logoPreview = this._profile.logoData
            ? `<img src="${this._profile.logoData}" alt="Company Logo">`
            : `<div class="logo-placeholder">🏢</div>`;

        container.innerHTML = `
            <div class="ios-form view-enter">
                <!-- Logo Section -->
                <div class="ios-section" style="margin-top: 16px;">
                    <div class="ios-section-header">Company Logo</div>
                    <div class="ios-section-content">
                        <div class="ios-cell" style="justify-content: center;">
                            <div class="logo-preview">
                                ${logoPreview}
                            </div>
                        </div>
                        <div class="ios-cell ios-cell-interactive" id="choose-logo" style="justify-content: center;">
                            <span class="text-blue fw-semibold">Choose Logo</span>
                        </div>
                        ${this._profile.logoData ? `
                        <div class="ios-cell ios-cell-interactive" id="remove-logo" style="justify-content: center;">
                            <span class="text-red fw-semibold">Remove Logo</span>
                        </div>
                        ` : ''}
                    </div>
                    <input type="file" id="logo-file-input" accept="image/*" style="display: none;">
                </div>

                <!-- Business Details Section -->
                <div class="ios-section">
                    <div class="ios-section-header">Business Details</div>
                    <div class="ios-section-content">
                        <div class="ios-cell">
                            <span class="ios-input-label">Name</span>
                            <input type="text" class="ios-input" id="settings-name"
                                   placeholder="Company Name"
                                   value="${Utils.escapeHtml(this._profile.name || '')}">
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Email</span>
                            <input type="email" class="ios-input" id="settings-email"
                                   placeholder="company@email.com"
                                   value="${Utils.escapeHtml(this._profile.email || '')}">
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Phone</span>
                            <input type="tel" class="ios-input" id="settings-phone"
                                   placeholder="+1 (555) 000-0000"
                                   value="${Utils.escapeHtml(this._profile.phone || '')}">
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Address</span>
                            <input type="text" class="ios-input" id="settings-address"
                                   placeholder="Street, City, State ZIP"
                                   value="${Utils.escapeHtml(this._profile.address || '')}">
                        </div>
                    </div>
                </div>

                <!-- Registration Section -->
                <div class="ios-section">
                    <div class="ios-section-header">Registration</div>
                    <div class="ios-section-content">
                        <div class="ios-cell">
                            <span class="ios-input-label">Tax ID</span>
                            <input type="text" class="ios-input" id="settings-registration"
                                   placeholder="Registration / Tax ID"
                                   value="${Utils.escapeHtml(this._profile.registrationNumber || '')}">
                        </div>
                    </div>
                    <div class="ios-section-footer">
                        Your business registration or tax identification number. This will appear on all documents.
                    </div>
                </div>

                <!-- Preferences Section -->
                <div class="ios-section">
                    <div class="ios-section-header">Preferences</div>
                    <div class="ios-section-content">
                        <div class="ios-cell">
                            <span class="ios-input-label">Brand Color</span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span id="brand-color-hex" style="font-family: monospace; font-size: 13px; color: var(--color-label-secondary); text-transform: uppercase;">${this._profile.brandColor || '#0056B3'}</span>
                                <input type="color" id="settings-brand-color" value="${this._profile.brandColor || '#0056b3'}" style="width: 30px; height: 30px; padding: 0; border: none; border-radius: 4px; overflow: hidden; appearance: none; background: transparent; cursor: pointer;">
                            </div>
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Default Preset</span>
                            <select class="ios-select" id="settings-default-preset">
                                ${Utils.brandPresets.map(preset => `
                                    <option value="${preset.id}" ${preset.id === currentPreset ? 'selected' : ''}>
                                        ${preset.name}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Currency</span>
                            <select class="ios-select" id="settings-currency">
                                ${Utils.currencies.map(c => `
                                    <option value="${c.code}" ${c.code === currentCurrency ? 'selected' : ''}>
                                        ${c.code} (${c.symbol})
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Default Tax %</span>
                            <input type="number" class="ios-input ios-input-right" id="settings-default-tax"
                                   style="text-align: right;"
                                   min="0" step="0.01"
                                   value="${this._profile.defaultTaxRate || 0}">
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Mileage Rate</span>
                            <input type="number" class="ios-input ios-input-right" id="settings-mileage-rate"
                                   style="text-align: right;"
                                   min="0" step="0.01"
                                   value="${this._profile.mileageRate || 0.67}">
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Appearance</span>
                            <select class="ios-select" id="settings-theme">
                                <option value="system" ${currentTheme === 'system' ? 'selected' : ''}>System</option>
                                <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light</option>
                                <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark</option>
                            </select>
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Default Terms</span>
                            <textarea class="ios-input" id="settings-default-terms"
                                      rows="2"
                                      placeholder="Payment terms">${Utils.escapeHtml(this._profile.defaultTerms || '')}</textarea>
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Payment URL</span>
                            <input type="url" class="ios-input" id="settings-payment-url"
                                   placeholder="https://pay.example.com/..."
                                   value="${Utils.escapeHtml(this._profile.paymentUrl || '')}">
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Backup Check</span>
                            <select class="ios-select" id="settings-backup-reminder">
                                <option value="off" ${(this._profile.backupReminder || 'weekly') === 'off' ? 'selected' : ''}>Off</option>
                                <option value="weekly" ${(this._profile.backupReminder || 'weekly') === 'weekly' ? 'selected' : ''}>Weekly</option>
                                <option value="monthly" ${this._profile.backupReminder === 'monthly' ? 'selected' : ''}>Monthly</option>
                            </select>
                        </div>
                    </div>
                    <div class="ios-section-footer">
                        Brand color applies to all exported document templates. Currency applies to new and existing documents.
                    </div>
                </div>

                <!-- Cloud Backup Section -->
                <div class="ios-section">
                    <div class="ios-section-header">Cloud Backup</div>
                    <div class="ios-section-content" id="cloud-section">
                        ${this._renderCloudSection()}
                    </div>
                    <div class="ios-section-footer">
                        ${this._cloudFooterText()}
                    </div>
                </div>

                <!-- Data Management Section -->
                <div class="ios-section">
                    <div class="ios-section-header">Data</div>
                    <div class="ios-section-content">
                        <div class="ios-cell" style="flex-direction: column; align-items: stretch; gap: 10px; padding: 14px 16px;">
                            <div class="settings-actions-row">
                                <button class="settings-action-btn settings-action-export" id="data-export">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    Export Backup
                                </button>
                                <button class="settings-action-btn settings-action-import" id="data-import">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    Import
                                </button>
                            </div>
                            <button class="settings-action-btn settings-action-import" id="data-export-csv">
                                Export CSV Reports
                            </button>
                        </div>
                    </div>
                    <div class="ios-section-footer">
                        Export all documents, clients, and settings as a JSON backup file. Import to restore from a previous backup.
                    </div>
                    <input type="file" id="import-file-input" accept=".json" style="display: none;">
                </div>

                <!-- About Section -->
                <div class="ios-section" style="margin-bottom: 40px;">
                    <div class="ios-section-header">About</div>
                    <div class="ios-section-content">
                        <div class="ios-cell">
                            <span class="ios-cell-title">Version</span>
                            <span class="ios-cell-value">1.0.0</span>
                        </div>
                        <div class="ios-cell">
                            <span class="ios-cell-title">Storage</span>
                            <span class="ios-cell-value">${typeof CloudSync !== 'undefined' && CloudSync.isSignedIn() ? 'Local + Cloud' : 'Local (IndexedDB)'}</span>
                        </div>
                        <div class="ios-cell">
                            <span class="ios-cell-title">Platform</span>
                            <span class="ios-cell-value">Progressive Web App</span>
                        </div>
                    </div>
                    <div class="ios-section-footer">
                        Invoice Magic stores all data locally on your device. If you sign in to Cloud Backup, an encrypted copy is kept in your private account.
                    </div>
                </div>
            </div>
        `;

        this._bindEvents(container);
    },

    // ── Cloud section markup (three states) ──
    _renderCloudSection() {
        const cloud = typeof CloudSync !== 'undefined' ? CloudSync : null;

        if (!cloud || !cloud.sdkLoaded() || !cloud.isConfigured() || !cloud.isReady()) {
            return `
                <div class="ios-cell" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                    <span class="ios-cell-title">Not configured</span>
                    <span style="font-size: 13px; color: var(--color-label-secondary); line-height: 1.4;">
                        Cloud backup is off. To turn it on, follow the free 10-minute setup in
                        <strong>SETUP-CLOUD.md</strong> (in the app folder), then reload.
                    </span>
                </div>
            `;
        }

        if (!cloud.isSignedIn()) {
            return `
                <div class="ios-cell" style="flex-direction: column; align-items: stretch; padding: 14px 16px;">
                    <button class="settings-action-btn settings-action-export" id="cloud-google" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
                        Continue with Google
                    </button>
                </div>
                <div class="ios-cell" style="justify-content: center; padding: 6px 16px;">
                    <span style="font-size: 12px; color: var(--color-label-tertiary); text-transform: uppercase; letter-spacing: 0.04em;">or use email</span>
                </div>
                <div class="ios-cell">
                    <span class="ios-input-label">Email</span>
                    <input type="email" class="ios-input" id="cloud-email" placeholder="you@email.com" autocomplete="email">
                </div>
                <div class="ios-cell">
                    <span class="ios-input-label">Password</span>
                    <input type="password" class="ios-input" id="cloud-password" placeholder="6+ characters" autocomplete="current-password">
                </div>
                <div class="ios-cell" style="flex-direction: column; align-items: stretch; gap: 10px; padding: 14px 16px;">
                    <div class="settings-actions-row">
                        <button class="settings-action-btn settings-action-export" id="cloud-sign-in">Sign In</button>
                        <button class="settings-action-btn settings-action-import" id="cloud-sign-up">Create Account</button>
                    </div>
                </div>
                <div class="ios-cell ios-cell-interactive" id="cloud-forgot" style="justify-content: center;">
                    <span class="text-blue" style="font-size: 14px;">Forgot password?</span>
                </div>
            `;
        }

        const last = cloud.lastBackupAt();
        return `
            <div class="ios-cell">
                <span class="ios-cell-title">Account</span>
                <span class="ios-cell-value">${Utils.escapeHtml(cloud.userEmail())}</span>
            </div>
            <div class="ios-cell">
                <span class="ios-cell-title">Last Backup</span>
                <span class="ios-cell-value" id="cloud-last-backup">${last ? Utils.formatDate(last) : 'Never'}</span>
            </div>
            <div class="ios-cell ios-cell-interactive" id="cloud-auto-cell">
                <span class="ios-input-label">Auto Backup</span>
                <div class="ios-toggle ${cloud.autoBackupEnabled() ? 'active' : ''}" id="cloud-auto-toggle"></div>
            </div>
            <div class="ios-cell" style="flex-direction: column; align-items: stretch; gap: 10px; padding: 14px 16px;">
                <div class="settings-actions-row">
                    <button class="settings-action-btn settings-action-export" id="cloud-backup-now">Back Up Now</button>
                    <button class="settings-action-btn settings-action-import" id="cloud-restore">Restore</button>
                </div>
            </div>
            <div class="ios-cell ios-cell-interactive" id="cloud-sign-out" style="justify-content: center;">
                <span class="text-red fw-semibold">Sign Out</span>
            </div>
        `;
    },

    _cloudFooterText() {
        const cloud = typeof CloudSync !== 'undefined' ? CloudSync : null;
        if (!cloud || !cloud.isReady()) {
            return 'Optional: back up your invoices, estimates, clients, and settings to a free private cloud account so you can recover them on any device.';
        }
        if (!cloud.isSignedIn()) {
            return 'Sign in (or create a free account) to back up your data to the cloud. Your data is private to your account.';
        }
        return 'With Auto Backup on, changes are backed up a few seconds after you make them. Restore replaces the data on this device with the cloud copy.';
    },

    // ── Bind events ──
    _bindEvents(container) {
        const self = this;
        const autoSave = Utils.debounce(async () => {
            self._profile.name = container.querySelector('#settings-name').value.trim();
            self._profile.email = container.querySelector('#settings-email').value.trim();
            self._profile.phone = container.querySelector('#settings-phone').value.trim();
            self._profile.address = container.querySelector('#settings-address').value.trim();
            self._profile.registrationNumber = container.querySelector('#settings-registration').value.trim();
            self._profile.defaultTerms = container.querySelector('#settings-default-terms').value.trim();
            self._profile.defaultTaxRate = parseFloat(container.querySelector('#settings-default-tax').value) || 0;
            self._profile.mileageRate = parseFloat(container.querySelector('#settings-mileage-rate').value) || 0;
            self._profile.paymentUrl = container.querySelector('#settings-payment-url').value.trim();
            self._profile.defaultPresetId = container.querySelector('#settings-default-preset').value;
            self._profile.backupReminder = container.querySelector('#settings-backup-reminder').value;
            await db.saveCompanyProfile(self._profile);
        }, 500);

        // Text fields
        ['name', 'email', 'phone', 'address', 'registration', 'default-tax', 'mileage-rate', 'default-terms', 'payment-url'].forEach(field => {
            const el = container.querySelector(`#settings-${field}`);
            if (el) el.addEventListener('input', autoSave);
        });

        // ── Currency Picker ──
        container.querySelector('#settings-currency').addEventListener('change', (e) => {
            Utils.setPreferredCurrency(e.target.value);
            Utils.haptic('light');
            Toast.show(`Currency set to ${e.target.value}`, 'success');
        });

        container.querySelector('#settings-default-preset').addEventListener('change', async (e) => {
            const preset = Utils.getBrandPreset(e.target.value);
            self._profile.defaultPresetId = preset.id;
            self._profile.brandColor = preset.color;
            self._profile.accentTheme = preset.accentTheme;
            if (!self._profile.defaultTerms) self._profile.defaultTerms = preset.defaultTerms;
            Utils.applyAccent(preset.color);
            await db.saveCompanyProfile(self._profile);
            Toast.show(`${preset.name} is default`, 'success');
            self.render(container);
        });

        container.querySelector('#settings-backup-reminder').addEventListener('change', autoSave);

        // ── Brand Color Picker ──
        const brandColorInput = container.querySelector('#settings-brand-color');
        const brandColorHex = container.querySelector('#brand-color-hex');
        if (brandColorInput) {
            brandColorInput.addEventListener('input', (e) => {
                if (brandColorHex) brandColorHex.textContent = e.target.value;
                self._profile.brandColor = e.target.value;
                Utils.applyAccent(e.target.value);
                autoSave();
            });
        }

        // ── Theme Picker ──
        container.querySelector('#settings-theme').addEventListener('change', (e) => {
            Utils.setThemePreference(e.target.value);
            Utils.haptic('light');
            const labels = { system: 'System default', light: 'Light mode', dark: 'Dark mode' };
            Toast.show(labels[e.target.value] || 'Theme updated', 'success');
        });

        // Logo file picker
        const fileInput = container.querySelector('#logo-file-input');
        const chooseBtn = container.querySelector('#choose-logo');

        chooseBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (ev) => {
                self._profile.logoData = ev.target.result;
                await db.saveCompanyProfile(self._profile);
                Utils.haptic('success');
                Toast.show('Logo updated', 'success');
                // Re-render to show new logo
                self.render(container);
            };
            reader.readAsDataURL(file);
        });

        // Remove logo
        const removeBtn = container.querySelector('#remove-logo');
        if (removeBtn) {
            removeBtn.addEventListener('click', async () => {
                self._profile.logoData = null;
                await db.saveCompanyProfile(self._profile);
                Utils.haptic('light');
                Toast.show('Logo removed', 'info');
                self.render(container);
            });
        }

        // ── Data Export ──
        container.querySelector('#data-export').addEventListener('click', async () => {
            try {
                const documents = await db.getAll(STORES.DOCUMENTS);
                const clients = await db.getAll(STORES.CLIENTS);
                const company = await db.getCompanyProfile();
                const payments = await db.getAll(STORES.PAYMENTS);
                const expenses = await db.getAll(STORES.EXPENSES);
                const timeEntries = await db.getAll(STORES.TIME_ENTRIES);
                const mileageEntries = await db.getAll(STORES.MILEAGE);
                const catalog = await db.getAll(STORES.CATALOG);

                const backup = {
                    version: '1.0.0',
                    exportDate: new Date().toISOString(),
                    app: 'Invoice Magic',
                    data: { documents, clients, company, payments, expenses, timeEntries, mileageEntries, catalog },
                };

                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `invoice-magic-backup-${Utils.today()}.json`;
                a.click();
                URL.revokeObjectURL(url);

                Utils.haptic('success');
                Toast.show('Backup exported', 'success');
            } catch (err) {
                Toast.show('Export failed', 'error');
            }
        });

        container.querySelector('#data-export-csv').addEventListener('click', async () => {
            try {
                const docs = await db.getAllDocuments();
                const payments = await db.getAllPayments();
                const paymentMap = payments.reduce((map, payment) => {
                    if (!map[payment.documentId]) map[payment.documentId] = [];
                    map[payment.documentId].push(payment);
                    return map;
                }, {});
                const rows = [
                    ['type', 'number', 'client', 'status', 'created', 'due', 'total', 'balance', 'preset'],
                    ...docs.map(doc => [
                        doc.documentType,
                        doc.documentID,
                        doc.clientName || '',
                        Utils.statusForDocument(doc, paymentMap[doc.id]),
                        doc.creationDate,
                        doc.dueDate,
                        Utils.docTotal(doc.lineItems, doc.isTaxEnabled, doc).toFixed(2),
                        Utils.documentBalance(doc, paymentMap[doc.id]).toFixed(2),
                        doc.brandPresetId || doc.templateId || '',
                    ]),
                ];
                const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `invoice-magic-report-${Utils.today()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                Toast.show('CSV exported', 'success');
            } catch (err) {
                Toast.show('CSV export failed', 'error');
            }
        });

        // ── Data Import ──
        const importInput = container.querySelector('#import-file-input');
        container.querySelector('#data-import').addEventListener('click', () => {
            importInput.click();
        });

        importInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const backup = JSON.parse(text);

                if (!backup.data || !backup.app || backup.app !== 'Invoice Magic') {
                    Toast.show('Invalid backup file', 'error');
                    return;
                }

                // Show confirmation
                const overlay = document.createElement('div');
                overlay.className = 'modal-overlay';
                overlay.innerHTML = `
                    <div class="modal-sheet">
                        <div class="modal-handle"></div>
                        <div class="modal-title">Restore Backup?</div>
                        <div class="modal-message">
                            This will add ${(backup.data.documents || []).length} documents and ${(backup.data.clients || []).length} clients from the backup dated ${Utils.formatDate(backup.exportDate)}.
                        </div>
                        <div class="modal-actions">
                            <button class="modal-action-btn modal-action-primary" id="modal-import-confirm">Restore</button>
                            <button class="modal-action-btn modal-action-cancel" id="modal-import-cancel">Cancel</button>
                        </div>
                    </div>
                `;

                document.getElementById('app').appendChild(overlay);

                overlay.querySelector('#modal-import-cancel').addEventListener('click', () => overlay.remove());
                overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

                overlay.querySelector('#modal-import-confirm').addEventListener('click', async () => {
                    overlay.remove();
                    try {
                        // Import documents
                        for (const doc of (backup.data.documents || [])) {
                            delete doc.id; // Let IndexedDB auto-generate new IDs
                            await db.add(STORES.DOCUMENTS, doc);
                        }

                        // Import clients (avoid duplicates by name)
                        for (const client of (backup.data.clients || [])) {
                            const existing = await db.findClientByName(client.name);
                            if (!existing) {
                                delete client.id;
                                await db.add(STORES.CLIENTS, client);
                            }
                        }

                        // Restore company profile
                        if (backup.data.company) {
                            backup.data.company.id = 'main';
                            await db.saveCompanyProfile(backup.data.company);
                        }

                        for (const payment of (backup.data.payments || [])) {
                            delete payment.id;
                            await db.add(STORES.PAYMENTS, payment);
                        }
                        for (const expense of (backup.data.expenses || [])) {
                            delete expense.id;
                            await db.add(STORES.EXPENSES, expense);
                        }
                        for (const entry of (backup.data.timeEntries || [])) {
                            delete entry.id;
                            await db.add(STORES.TIME_ENTRIES, entry);
                        }
                        for (const trip of (backup.data.mileageEntries || [])) {
                            delete trip.id;
                            await db.add(STORES.MILEAGE, trip);
                        }
                        for (const item of (backup.data.catalog || [])) {
                            delete item.id;
                            await db.add(STORES.CATALOG, item);
                        }

                        Utils.haptic('success');
                        Toast.show('Backup restored', 'success');
                        self.render(container);
                    } catch (err) {
                        Toast.show('Import failed', 'error');
                    }
                });
            } catch (err) {
                Toast.show('Invalid JSON file', 'error');
            }
        });

        this._bindCloudEvents(container);
    },

    // ── Cloud backup events ──
    _bindCloudEvents(container) {
        const self = this;
        const cloud = typeof CloudSync !== 'undefined' ? CloudSync : null;
        if (!cloud || !cloud.isReady()) return;

        // Re-render this view when auth state changes while it's open
        cloud.onAuthChanged = () => {
            if (App._currentView === 'settings') self.render(container);
        };
        cloud.onBackupDone = () => {
            const el = container.querySelector('#cloud-last-backup');
            if (el) el.textContent = Utils.formatDate(cloud.lastBackupAt());
        };

        const googleBtn = container.querySelector('#cloud-google');
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                googleBtn.disabled = true;
                try {
                    await cloud.signInWithGoogle();
                    Utils.haptic('success');
                    Toast.show('Signed in with Google', 'success');
                } catch (err) {
                    if (err && err.code !== 'auth/popup-closed-by-user') {
                        Toast.show(cloud.friendlyAuthError(err), 'error');
                    }
                } finally {
                    googleBtn.disabled = false;
                }
            });
        }

        const signInBtn = container.querySelector('#cloud-sign-in');
        const signUpBtn = container.querySelector('#cloud-sign-up');
        const credentials = () => ({
            email: (container.querySelector('#cloud-email')?.value || '').trim(),
            password: container.querySelector('#cloud-password')?.value || '',
        });

        if (signInBtn) {
            signInBtn.addEventListener('click', async () => {
                const { email, password } = credentials();
                if (!email || !password) return Toast.show('Enter email and password', 'error');
                signInBtn.disabled = true;
                try {
                    await cloud.signIn(email, password);
                    Utils.haptic('success');
                    Toast.show('Signed in', 'success');
                } catch (err) {
                    Toast.show(cloud.friendlyAuthError(err), 'error');
                } finally {
                    signInBtn.disabled = false;
                }
            });
        }

        if (signUpBtn) {
            signUpBtn.addEventListener('click', async () => {
                const { email, password } = credentials();
                if (!email || !password) return Toast.show('Enter email and password', 'error');
                signUpBtn.disabled = true;
                try {
                    await cloud.signUp(email, password);
                    Utils.haptic('success');
                    Toast.show('Account created', 'success');
                    // First backup right away so the account isn't empty
                    cloud.backupNow(true);
                } catch (err) {
                    Toast.show(cloud.friendlyAuthError(err), 'error');
                } finally {
                    signUpBtn.disabled = false;
                }
            });
        }

        const forgotBtn = container.querySelector('#cloud-forgot');
        if (forgotBtn) {
            forgotBtn.addEventListener('click', async () => {
                const { email } = credentials();
                if (!email) return Toast.show('Enter your email first', 'error');
                try {
                    await cloud.resetPassword(email);
                    Toast.show('Password reset email sent', 'success');
                } catch (err) {
                    Toast.show(cloud.friendlyAuthError(err), 'error');
                }
            });
        }

        const autoCell = container.querySelector('#cloud-auto-cell');
        if (autoCell) {
            autoCell.addEventListener('click', () => {
                const toggle = container.querySelector('#cloud-auto-toggle');
                toggle.classList.toggle('active');
                cloud.setAutoBackup(toggle.classList.contains('active'));
                Utils.haptic('light');
            });
        }

        const backupBtn = container.querySelector('#cloud-backup-now');
        if (backupBtn) {
            backupBtn.addEventListener('click', async () => {
                backupBtn.disabled = true;
                backupBtn.textContent = 'Backing up…';
                await cloud.backupNow(false);
                backupBtn.disabled = false;
                backupBtn.textContent = 'Back Up Now';
            });
        }

        const restoreBtn = container.querySelector('#cloud-restore');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                const overlay = document.createElement('div');
                overlay.className = 'modal-overlay';
                overlay.innerHTML = `
                    <div class="modal-sheet">
                        <div class="modal-handle"></div>
                        <div class="modal-title">Restore From Cloud?</div>
                        <div class="modal-message">
                            This replaces all data on this device with your latest cloud backup. Anything created here since that backup will be lost.
                        </div>
                        <div class="modal-actions">
                            <button class="modal-action-btn modal-action-primary" id="cloud-restore-confirm">Restore</button>
                            <button class="modal-action-btn modal-action-cancel" id="cloud-restore-cancel">Cancel</button>
                        </div>
                    </div>
                `;
                document.getElementById('app').appendChild(overlay);
                overlay.querySelector('#cloud-restore-cancel').addEventListener('click', () => overlay.remove());
                overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
                overlay.querySelector('#cloud-restore-confirm').addEventListener('click', async () => {
                    overlay.remove();
                    const ok = await cloud.restoreFromCloud();
                    if (ok) self.render(container);
                });
            });
        }

        const signOutBtn = container.querySelector('#cloud-sign-out');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', async () => {
                await cloud.signOutUser();
                Toast.show('Signed out', 'info');
            });
        }
    },
};
