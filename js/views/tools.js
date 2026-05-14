// ============================================================
// tools.js — Reports, Catalog, Expenses, Time, Mileage
// ============================================================

const ToolsView = {
    _state: null,

    async render(container) {
        const [docs, clients, payments, expenses, timeEntries, mileageEntries, catalog, company] = await Promise.all([
            db.getAllDocuments(),
            db.getAllClients(),
            db.getAllPayments(),
            db.getAllExpenses(),
            db.getAllTimeEntries(),
            db.getAllMileageEntries(),
            db.getCatalogItems(),
            db.getCompanyProfile(),
        ]);

        this._state = { docs, clients, payments, expenses, timeEntries, mileageEntries, catalog, company };
        const metrics = this._metrics();

        container.innerHTML = `
            <div class="ios-form view-enter">
                <div class="report-hero">
                    <div>
                        <div class="hero-kicker">Reports</div>
                        <div class="hero-title">${Utils.formatCurrency(metrics.profit)}</div>
                        <div class="hero-subtitle">Revenue less tracked expenses this month</div>
                    </div>
                </div>

                <div class="metric-grid">
                    ${DashboardView._metric('Revenue', Utils.formatCurrency(metrics.revenue), 'payments', 'success')}
                    ${DashboardView._metric('Expenses', Utils.formatCurrency(metrics.expenses), 'tracked', 'warning')}
                    ${DashboardView._metric('Unpaid', Utils.formatCurrency(metrics.unpaid), 'open invoices', metrics.unpaid ? 'danger' : 'primary')}
                    ${DashboardView._metric('Taxes', Utils.formatCurrency(metrics.tax), 'estimated', 'purple')}
                </div>

                ${this._renderThemeSection()}
                ${this._renderBillablesSection()}
                ${this._renderCatalogSection()}
                ${this._renderExpensesSection()}
                ${this._renderTimeSection()}
                ${this._renderMileageSection()}
                ${this._renderSettingsSection()}
            </div>
        `;

        this._bind(container);
    },

    _metrics() {
        const month = Utils.monthKey();
        const paymentMap = this._paymentsByDocument();
        const revenue = this._state.payments
            .filter(p => Utils.monthKey(p.paymentDate) === month)
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const expenses = this._state.expenses
            .filter(e => Utils.monthKey(e.expenseDate) === month)
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const unpaid = this._state.docs
            .filter(d => d.documentType === 'invoice')
            .reduce((sum, d) => sum + Utils.documentBalance(d, paymentMap[d.id]), 0);
        const tax = this._state.docs
            .filter(d => Utils.monthKey(d.creationDate) === month)
            .reduce((sum, d) => sum + Utils.docTax(d.lineItems, d.isTaxEnabled), 0);
        return { revenue, expenses, unpaid, tax, profit: revenue - expenses };
    },

    _renderThemeSection() {
        return `
            <div class="ios-section">
                <div class="ios-section-header">Brand Presets</div>
                <div class="ios-section-content">
                    <div class="preset-strip tools-preset-strip">
                        ${Utils.brandPresets.map(preset => `
                            <button class="mini-preset ${this._state.company.defaultPresetId === preset.id ? 'active' : ''}" data-theme-id="${preset.accentTheme}" data-theme-color="${preset.color}" data-preset-id="${preset.id}">
                                <span class="preset-color" style="background:${preset.color}"></span>
                                <strong>${preset.shortName}</strong>
                                <small>${preset.templateId}</small>
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="ios-section-footer">Sets the default document preset, app highlight color, terms, and exported document branding.</div>
            </div>
        `;
    },

    _renderCatalogSection() {
        return `
            <div class="ios-section">
                <div class="ios-section-header">Service Catalog</div>
                <div class="ios-section-content">
                    <div class="tool-action-row">
                        <button class="settings-action-btn settings-action-export" id="add-catalog-item">+ Add Service</button>
                    </div>
                    ${this._state.catalog.length ? this._state.catalog.slice(0, 6).map(item => `
                        <div class="compact-row">
                            <div class="compact-icon primary">§</div>
                            <div class="compact-body">
                                <div class="compact-title">${Utils.escapeHtml(item.name)}</div>
                                <div class="compact-subtitle">${Utils.escapeHtml(item.category || 'Service')} · ${item.taxRate || 0}% tax</div>
                            </div>
                            <div class="compact-value">${Utils.formatCurrency(item.unitPrice)}</div>
                            <button class="row-delete-btn" data-delete-catalog="${item.id}">×</button>
                        </div>
                    `).join('') : '<div class="empty-inline">Add reusable services to speed up invoice creation.</div>'}
                </div>
            </div>
        `;
    },

    _renderBillablesSection() {
        const billableExpenses = this._state.expenses.filter(e => e.billable && !e.documentId);
        const billableTime = this._state.timeEntries.filter(e => e.billable !== false && !e.documentId);
        const billableMileage = this._state.mileageEntries.filter(e => !e.documentId);
        const total = billableExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) +
            billableTime.reduce((sum, e) => sum + ((parseFloat(e.minutes) || 0) / 60) * (parseFloat(e.rate) || 0), 0) +
            billableMileage.reduce((sum, e) => sum + ((parseFloat(e.miles) || 0) * (parseFloat(e.rate) || 0)), 0);
        return `
            <div class="ios-section">
                <div class="ios-section-header">Ready To Invoice</div>
                <div class="ios-section-content">
                    <div class="insight-row">
                        <div class="insight-icon primary">$</div>
                        <div class="insight-body">
                            <div class="insight-title">${Utils.formatCurrency(total)} unbilled work</div>
                            <div class="insight-subtitle">${billableTime.length} time · ${billableExpenses.length} expenses · ${billableMileage.length} trips</div>
                        </div>
                    </div>
                    <div class="ios-cell ios-cell-interactive" id="create-billables-invoice" style="justify-content: center;">
                        <span class="text-blue fw-semibold">Create Invoice From Billables</span>
                    </div>
                </div>
            </div>
        `;
    },

    _renderExpensesSection() {
        return `
            <div class="ios-section">
                <div class="ios-section-header">Expenses</div>
                <div class="ios-section-content">
                    <div class="tool-action-row">
                        <button class="settings-action-btn settings-action-export" id="add-expense">+ Log Expense</button>
                    </div>
                    ${this._state.expenses.length ? this._state.expenses.slice(0, 6).map(expense => `
                        <div class="compact-row">
                            <div class="compact-icon warning">$</div>
                            <div class="compact-body">
                                <div class="compact-title">${Utils.escapeHtml(expense.description || 'Expense')}</div>
                                <div class="compact-subtitle">${Utils.escapeHtml(expense.category || 'General')} · ${Utils.formatDate(expense.expenseDate)}</div>
                            </div>
                            <div class="compact-value">${Utils.formatCurrency(expense.amount)}</div>
                            <button class="row-delete-btn" data-delete-expense="${expense.id}">×</button>
                        </div>
                    `).join('') : '<div class="empty-inline">Track supplies, materials, software, and billable costs.</div>'}
                </div>
            </div>
        `;
    },

    _renderTimeSection() {
        const total = this._state.timeEntries.reduce((sum, entry) => sum + (parseFloat(entry.minutes) || 0), 0);
        return `
            <div class="ios-section">
                <div class="ios-section-header">Time Tracking</div>
                <div class="ios-section-content">
                    <div class="tool-action-row">
                        <button class="settings-action-btn settings-action-export" id="add-time">+ Add Time</button>
                    </div>
                    <div class="insight-row">
                        <div class="insight-icon primary">⌚</div>
                        <div class="insight-body">
                            <div class="insight-title">${Utils.formatHours(total)} tracked</div>
                            <div class="insight-subtitle">Manual entries can be copied into invoice line items.</div>
                        </div>
                    </div>
                    ${this._state.timeEntries.slice(0, 5).map(entry => `
                        <div class="compact-row">
                            <div class="compact-body">
                                <div class="compact-title">${Utils.escapeHtml(entry.description || 'Time entry')}</div>
                                <div class="compact-subtitle">${Utils.formatDate(entry.entryDate)} · ${Utils.formatHours(entry.minutes)}</div>
                            </div>
                            <div class="compact-value">${Utils.formatCurrency((entry.minutes / 60) * (entry.rate || 0))}</div>
                            <button class="row-delete-btn" data-delete-time="${entry.id}">×</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    _renderMileageSection() {
        const miles = this._state.mileageEntries.reduce((sum, entry) => sum + (parseFloat(entry.miles) || 0), 0);
        const value = this._state.mileageEntries.reduce((sum, entry) => sum + ((parseFloat(entry.miles) || 0) * (parseFloat(entry.rate) || 0)), 0);
        return `
            <div class="ios-section">
                <div class="ios-section-header">Mileage</div>
                <div class="ios-section-content">
                    <div class="tool-action-row">
                        <button class="settings-action-btn settings-action-export" id="add-mileage">+ Add Trip</button>
                    </div>
                    <div class="insight-row">
                        <div class="insight-icon success">↗</div>
                        <div class="insight-body">
                            <div class="insight-title">${miles.toFixed(1)} miles · ${Utils.formatCurrency(value)}</div>
                            <div class="insight-subtitle">Uses your mileage rate from Settings.</div>
                        </div>
                    </div>
                    ${this._state.mileageEntries.slice(0, 5).map(entry => `
                        <div class="compact-row">
                            <div class="compact-body">
                                <div class="compact-title">${Utils.escapeHtml(entry.purpose || 'Business trip')}</div>
                                <div class="compact-subtitle">${Utils.formatDate(entry.tripDate)} · ${Utils.escapeHtml(entry.route || 'No route')}</div>
                            </div>
                            <div class="compact-value">${(parseFloat(entry.miles) || 0).toFixed(1)} mi</div>
                            <button class="row-delete-btn" data-delete-mileage="${entry.id}">×</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    _renderSettingsSection() {
        return `
            <div class="ios-section" style="margin-bottom: 40px;">
                <div class="ios-section-header">Business Setup</div>
                <div class="ios-section-content">
                    <div class="ios-cell ios-cell-interactive" id="open-settings">
                        <span class="ios-cell-title">Company, logo, currency, backups</span>
                        <span class="ios-cell-value">Settings</span>
                    </div>
                </div>
            </div>
        `;
    },

    _bind(container) {
        container.querySelector('#open-settings').addEventListener('click', () => App.navigate('settings'));
        container.querySelector('#add-catalog-item').addEventListener('click', () => this._showCatalogModal(container));
        container.querySelector('#add-expense').addEventListener('click', () => this._showExpenseModal(container));
        container.querySelector('#add-time').addEventListener('click', () => this._showTimeModal(container));
        container.querySelector('#add-mileage').addEventListener('click', () => this._showMileageModal(container));
        container.querySelector('#create-billables-invoice').addEventListener('click', () => this._showBillablesInvoiceModal(container));

        container.querySelectorAll('[data-theme-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                this._state.company.accentTheme = btn.dataset.themeId;
                this._state.company.brandColor = btn.dataset.themeColor;
                this._state.company.defaultPresetId = btn.dataset.presetId;
                this._state.company.defaultTerms = Utils.getBrandPreset(btn.dataset.presetId).defaultTerms;
                await db.saveCompanyProfile(this._state.company);
                Utils.applyAccent(btn.dataset.themeColor);
                Toast.show(`${Utils.getBrandPreset(btn.dataset.presetId).name} applied`, 'success');
                this.render(container);
            });
        });

        this._bindDeletes(container);
    },

    _bindDeletes(container) {
        [
            ['deleteCatalogItem', 'delete-catalog'],
            ['deleteExpense', 'delete-expense'],
            ['deleteTimeEntry', 'delete-time'],
            ['deleteMileageEntry', 'delete-mileage'],
        ].forEach(([method, attr]) => {
            container.querySelectorAll(`[data-${attr}]`).forEach(btn => {
                btn.addEventListener('click', async e => {
                    e.stopPropagation();
                    await db[method](parseInt(btn.dataset[attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase())], 10));
                    Toast.show('Deleted', 'success');
                    this.render(container);
                });
            });
        });
    },

    _showCatalogModal(container) {
        const overlay = this._sheet(`
            <div class="modal-title">Add Service</div>
            <div class="modal-form">
                <label>Name<input id="catalog-name" placeholder="Design work"></label>
                <label>Category<input id="catalog-category" placeholder="Creative, Labor, Materials"></label>
                <label>Unit Price<input id="catalog-price" type="number" step="0.01" value="0"></label>
                <label>Tax Rate %<input id="catalog-tax" type="number" step="0.01" value="${this._state.company.defaultTaxRate || 0}"></label>
                <label>Description<textarea id="catalog-description" rows="2" placeholder="Default line item description"></textarea></label>
            </div>
            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="save-catalog">Save Service</button>
                <button class="modal-action-btn modal-action-cancel" id="cancel">Cancel</button>
            </div>
        `);
        overlay.querySelector('#cancel').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#save-catalog').addEventListener('click', async () => {
            const name = overlay.querySelector('#catalog-name').value.trim();
            if (!name) return Toast.show('Service name required', 'error');
            await db.saveCatalogItem({
                name,
                category: overlay.querySelector('#catalog-category').value.trim(),
                unitPrice: parseFloat(overlay.querySelector('#catalog-price').value) || 0,
                taxRate: parseFloat(overlay.querySelector('#catalog-tax').value) || 0,
                description: overlay.querySelector('#catalog-description').value.trim(),
            });
            overlay.remove();
            Toast.show('Service saved', 'success');
            this.render(container);
        });
    },

    _showBillablesInvoiceModal(container) {
        const overlay = this._sheet(`
            <div class="modal-title">Invoice Billables</div>
            <div class="modal-message">Choose a client and Invoice Magic will pull their unbilled time, expenses, and mileage into a new invoice.</div>
            <div class="modal-form">
                ${this._clientSelect('billables-client')}
            </div>
            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="create-billables">Create Invoice</button>
                <button class="modal-action-btn modal-action-cancel" id="cancel">Cancel</button>
            </div>
        `);
        overlay.querySelector('#cancel').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#create-billables').addEventListener('click', async () => {
            const clientId = parseInt(overlay.querySelector('#billables-client').value, 10);
            const client = this._state.clients.find(c => c.id === clientId);
            if (!client) return Toast.show('Choose a client', 'error');
            const expenses = this._state.expenses.filter(e => e.billable && !e.documentId && e.clientId === clientId);
            const timeEntries = this._state.timeEntries.filter(e => e.billable !== false && !e.documentId && e.clientId === clientId);
            const mileageEntries = this._state.mileageEntries.filter(e => !e.documentId && e.clientId === clientId);
            const lineItems = [
                ...timeEntries.map(entry => ({
                    itemDescription: entry.description || 'Billable time',
                    itemNote: `${Utils.formatDate(entry.entryDate)} · ${Utils.formatHours(entry.minutes)}`,
                    quantity: ((parseFloat(entry.minutes) || 0) / 60).toFixed(2),
                    unitPrice: parseFloat(entry.rate) || 0,
                    taxRate: this._state.company.defaultTaxRate || 0,
                })),
                ...expenses.map(expense => ({
                    itemDescription: expense.description || 'Billable expense',
                    itemNote: `${expense.category || 'Expense'} · ${Utils.formatDate(expense.expenseDate)}`,
                    quantity: 1,
                    unitPrice: parseFloat(expense.amount) || 0,
                    taxRate: 0,
                })),
                ...mileageEntries.map(entry => ({
                    itemDescription: entry.purpose || 'Business mileage',
                    itemNote: `${entry.route || 'Trip'} · ${Utils.formatDate(entry.tripDate)}`,
                    quantity: parseFloat(entry.miles) || 0,
                    unitPrice: parseFloat(entry.rate) || 0,
                    taxRate: 0,
                })),
            ];
            if (!lineItems.length) return Toast.show('No billables for this client', 'error');
            const id = await App.createDocument('invoice', client.defaultPresetId || this._state.company.defaultPresetId, client);
            const doc = await db.getDocument(id);
            doc.lineItems = lineItems;
            Utils.addActivity(doc, 'billables', 'Billables imported', `${lineItems.length} line items`);
            await db.saveDocument(doc);
            for (const item of expenses) { item.documentId = id; await db.saveExpense(item); }
            for (const item of timeEntries) { item.documentId = id; await db.saveTimeEntry(item); }
            for (const item of mileageEntries) { item.documentId = id; await db.saveMileageEntry(item); }
            overlay.remove();
            Toast.show('Invoice created from billables', 'success');
            App.navigateToEditor(id);
        });
    },

    _showExpenseModal(container) {
        const overlay = this._sheet(`
            <div class="modal-title">Log Expense</div>
            <div class="modal-form">
                <label>Description<input id="expense-description" placeholder="Materials, software, fuel"></label>
                <label>Amount<input id="expense-amount" type="number" step="0.01" value="0"></label>
                <label>Category<input id="expense-category" placeholder="Supplies"></label>
                <label>Date<input id="expense-date" type="date" value="${Utils.today()}"></label>
                ${this._clientSelect('expense-client')}
                <label class="modal-check"><input id="expense-billable" type="checkbox"> Billable to client</label>
            </div>
            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="save-expense">Save Expense</button>
                <button class="modal-action-btn modal-action-cancel" id="cancel">Cancel</button>
            </div>
        `);
        overlay.querySelector('#cancel').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#save-expense').addEventListener('click', async () => {
            await db.saveExpense({
                description: overlay.querySelector('#expense-description').value.trim(),
                amount: parseFloat(overlay.querySelector('#expense-amount').value) || 0,
                category: overlay.querySelector('#expense-category').value.trim() || 'General',
                expenseDate: overlay.querySelector('#expense-date').value || Utils.today(),
                clientId: parseInt(overlay.querySelector('#expense-client').value, 10) || null,
                billable: overlay.querySelector('#expense-billable').checked,
            });
            overlay.remove();
            Toast.show('Expense logged', 'success');
            this.render(container);
        });
    },

    _showTimeModal(container) {
        const overlay = this._sheet(`
            <div class="modal-title">Add Time</div>
            <div class="modal-form">
                <label>Description<input id="time-description" placeholder="Consulting, install, design"></label>
                <label>Minutes<input id="time-minutes" type="number" step="1" value="60"></label>
                <label>Hourly Rate<input id="time-rate" type="number" step="0.01" value="0"></label>
                <label>Date<input id="time-date" type="date" value="${Utils.today()}"></label>
                ${this._clientSelect('time-client')}
                <label class="modal-check"><input id="time-billable" type="checkbox" checked> Billable</label>
            </div>
            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="save-time">Save Time</button>
                <button class="modal-action-btn modal-action-cancel" id="cancel">Cancel</button>
            </div>
        `);
        overlay.querySelector('#cancel').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#save-time').addEventListener('click', async () => {
            await db.saveTimeEntry({
                description: overlay.querySelector('#time-description').value.trim(),
                minutes: parseFloat(overlay.querySelector('#time-minutes').value) || 0,
                rate: parseFloat(overlay.querySelector('#time-rate').value) || 0,
                entryDate: overlay.querySelector('#time-date').value || Utils.today(),
                clientId: parseInt(overlay.querySelector('#time-client').value, 10) || null,
                billable: overlay.querySelector('#time-billable').checked,
            });
            overlay.remove();
            Toast.show('Time saved', 'success');
            this.render(container);
        });
    },

    _showMileageModal(container) {
        const overlay = this._sheet(`
            <div class="modal-title">Add Mileage</div>
            <div class="modal-form">
                <label>Purpose<input id="mileage-purpose" placeholder="Client visit"></label>
                <label>Route<input id="mileage-route" placeholder="Office to job site"></label>
                <label>Miles<input id="mileage-miles" type="number" step="0.1" value="0"></label>
                <label>Rate<input id="mileage-rate" type="number" step="0.01" value="${this._state.company.mileageRate || 0.67}"></label>
                <label>Date<input id="mileage-date" type="date" value="${Utils.today()}"></label>
                ${this._clientSelect('mileage-client')}
            </div>
            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="save-mileage">Save Trip</button>
                <button class="modal-action-btn modal-action-cancel" id="cancel">Cancel</button>
            </div>
        `);
        overlay.querySelector('#cancel').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#save-mileage').addEventListener('click', async () => {
            await db.saveMileageEntry({
                purpose: overlay.querySelector('#mileage-purpose').value.trim(),
                route: overlay.querySelector('#mileage-route').value.trim(),
                miles: parseFloat(overlay.querySelector('#mileage-miles').value) || 0,
                rate: parseFloat(overlay.querySelector('#mileage-rate').value) || 0,
                tripDate: overlay.querySelector('#mileage-date').value || Utils.today(),
                clientId: parseInt(overlay.querySelector('#mileage-client').value, 10) || null,
            });
            overlay.remove();
            Toast.show('Trip saved', 'success');
            this.render(container);
        });
    },

    _clientSelect(id) {
        return `
            <label>Client
                <select id="${id}">
                    <option value="">No client</option>
                    ${this._state.clients.map(client => `<option value="${client.id}">${Utils.escapeHtml(client.name)}</option>`).join('')}
                </select>
            </label>
        `;
    },

    _paymentsByDocument() {
        return this._state.payments.reduce((map, payment) => {
            if (!map[payment.documentId]) map[payment.documentId] = [];
            map[payment.documentId].push(payment);
            return map;
        }, {});
    },

    _sheet(innerHtml) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-sheet modal-sheet-tall">
                <div class="modal-handle"></div>
                ${innerHtml}
            </div>
        `;
        document.getElementById('app').appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        return overlay;
    },
};
