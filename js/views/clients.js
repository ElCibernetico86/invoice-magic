// ============================================================
// clients.js — Lightweight Client CRM
// ============================================================

const ClientsView = {
    _clients: [],
    _docs: [],
    _payments: [],
    _searchQuery: '',

    async render(container) {
        [this._clients, this._docs, this._payments] = await Promise.all([
            db.getAllClients(),
            db.getAllDocuments(),
            db.getAllPayments(),
        ]);
        this._searchQuery = '';

        container.innerHTML = `
            <div class="search-container">
                <div class="search-input-wrapper">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="search-input" id="client-search" placeholder="Search clients…" autocomplete="off">
                    <button class="search-clear" id="client-search-clear" aria-label="Clear search">✕</button>
                </div>
            </div>
            <div class="ios-form view-enter">
                <div class="client-toolbar">
                    <button class="settings-action-btn settings-action-export" id="add-client-btn">+ Add Client</button>
                </div>
                <div id="clients-content"></div>
            </div>
        `;

        this._renderList(container);
        this._bind(container);
    },

    _bind(container) {
        const searchInput = container.querySelector('#client-search');
        const searchClear = container.querySelector('#client-search-clear');

        searchInput.addEventListener('input', () => {
            this._searchQuery = searchInput.value.trim().toLowerCase();
            searchClear.classList.toggle('visible', this._searchQuery.length > 0);
            this._renderList(container);
        });

        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            this._searchQuery = '';
            searchClear.classList.remove('visible');
            this._renderList(container);
            searchInput.focus();
        });

        container.querySelector('#add-client-btn').addEventListener('click', () => this._showClientEditor(container));
    },

    _renderList(container) {
        const content = container.querySelector('#clients-content');
        const clients = this._clients.filter(client => {
            if (!this._searchQuery) return true;
            return [client.name, client.email, client.phone, client.address].join(' ').toLowerCase().includes(this._searchQuery);
        });

        if (!clients.length) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">◎</div>
                    <div class="empty-state-title">${this._clients.length ? 'No matching clients' : 'No Clients Yet'}</div>
                    <div class="empty-state-description">Save client profiles once, then reuse them across invoices, estimates, payments, and reports.</div>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="ios-section" style="margin-top: 8px;">
                <div class="ios-section-header">${clients.length} ${clients.length === 1 ? 'Client' : 'Clients'}</div>
                <div class="ios-section-content">
                    ${clients.map(client => this._renderClientRow(client)).join('')}
                </div>
            </div>
        `;

        content.querySelectorAll('[data-client-id]').forEach(row => {
            row.addEventListener('click', () => {
                const client = this._clients.find(c => c.id === parseInt(row.dataset.clientId, 10));
                if (client) this._showClientDetail(container, client);
            });
        });
    },

    _renderClientRow(client) {
        const docs = this._docs.filter(doc => doc.clientId === client.id);
        const paymentMap = this._paymentsByDocument();
        const openBalance = docs
            .filter(doc => doc.documentType === 'invoice')
            .reduce((sum, doc) => sum + Utils.documentBalance(doc, paymentMap[doc.id]), 0);
        const lifetime = docs.reduce((sum, doc) => sum + Utils.docTotal(doc.lineItems, doc.isTaxEnabled, doc), 0);

        return `
            <div class="client-row" data-client-id="${client.id}">
                <div class="client-avatar">${Utils.initials(client.name)}</div>
                <div class="client-row-body">
                    <div class="client-row-title">${Utils.escapeHtml(client.name || 'Unnamed Client')}</div>
                    <div class="client-row-sub">${docs.length} docs · ${Utils.escapeHtml(client.email || client.phone || 'No contact')}</div>
                </div>
                <div class="client-row-right">
                    <div class="client-row-balance ${openBalance > 0 ? 'text-orange' : 'text-green'}">${Utils.formatCurrency(openBalance)}</div>
                    <div class="client-row-sub">open</div>
                </div>
                <div class="client-lifetime">${Utils.formatCurrency(lifetime)}</div>
            </div>
        `;
    },

    _showClientDetail(container, client) {
        const docs = this._docs.filter(doc => doc.clientId === client.id);
        const paymentMap = this._paymentsByDocument();
        const openBalance = docs
            .filter(doc => doc.documentType === 'invoice')
            .reduce((sum, doc) => sum + Utils.documentBalance(doc, paymentMap[doc.id]), 0);

        const overlay = this._sheet(`
            <div class="modal-title">${Utils.escapeHtml(client.name || 'Client')}</div>
            <div class="client-detail-card">
                <div class="client-detail-avatar">${Utils.initials(client.name)}</div>
                <div>
                    <div class="client-detail-name">${Utils.escapeHtml(client.name || 'Unnamed Client')}</div>
                    <div class="client-detail-meta">${Utils.escapeHtml(client.email || 'No email')}</div>
                    <div class="client-detail-meta">${Utils.escapeHtml(client.phone || 'No phone')}</div>
                    <div class="client-detail-meta">${Utils.escapeHtml(client.address || 'No address')}</div>
                    <div class="client-detail-meta">Preset: ${Utils.escapeHtml(Utils.getBrandPreset(client.defaultPresetId || 'apple-clean').name)}</div>
                </div>
            </div>
            <div class="metric-grid compact">
                ${DashboardView._metric('Open', Utils.formatCurrency(openBalance), 'balance', openBalance ? 'danger' : 'success')}
                ${DashboardView._metric('Docs', String(docs.length), 'history', 'primary')}
            </div>
            ${client.notes ? `
                <div class="client-notes-panel">
                    <strong>Private Notes</strong>
                    <span>${Utils.escapeHtml(client.notes)}</span>
                </div>
            ` : ''}
            <div class="modal-scroll-list">
                ${docs.length ? docs.slice(0, 8).map(doc => `
                    <button class="modal-list-row" data-open-doc="${doc.id}">
                        <span>${Utils.escapeHtml(doc.documentID)}</span>
                        <strong>${Utils.formatCurrency(Utils.docTotal(doc.lineItems, doc.isTaxEnabled, doc))}</strong>
                    </button>
                `).join('') : '<div class="empty-inline">No document history yet.</div>'}
            </div>
            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="client-new-invoice">New Invoice</button>
                <button class="modal-action-btn" id="client-edit">Edit Client</button>
                <button class="modal-action-btn modal-action-cancel" id="client-close">Close</button>
            </div>
        `);

        overlay.querySelector('#client-close').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#client-edit').addEventListener('click', () => {
            overlay.remove();
            this._showClientEditor(container, client);
        });
        overlay.querySelector('#client-new-invoice').addEventListener('click', async () => {
            overlay.remove();
            App.showDocumentComposer('invoice', { client });
        });
        overlay.querySelectorAll('[data-open-doc]').forEach(btn => {
            btn.addEventListener('click', () => {
                overlay.remove();
                App.navigateToEditor(parseInt(btn.dataset.openDoc, 10));
            });
        });
    },

    _showClientEditor(container, client = null) {
        const isNew = !client;
        const current = client || { name: '', email: '', phone: '', address: '', notes: '', defaultPresetId: 'apple-clean', defaultTerms: '', defaultTaxRate: '', paymentUrl: '' };
        const overlay = this._sheet(`
            <div class="modal-title">${isNew ? 'Add Client' : 'Edit Client'}</div>
            <div class="modal-form">
                <label>Name<input id="client-name" value="${Utils.escapeHtml(current.name || '')}" placeholder="Client name"></label>
                <label>Email<input id="client-email" value="${Utils.escapeHtml(current.email || '')}" placeholder="client@email.com"></label>
                <label>Phone<input id="client-phone" value="${Utils.escapeHtml(current.phone || '')}" placeholder="+1 (555) 000-0000"></label>
                <label>Address<textarea id="client-address" rows="2" placeholder="Street, City, State">${Utils.escapeHtml(current.address || '')}</textarea></label>
                <label>Default Preset
                    <select id="client-default-preset">
                        ${Utils.brandPresets.map(preset => `<option value="${preset.id}" ${preset.id === (current.defaultPresetId || 'apple-clean') ? 'selected' : ''}>${preset.name}</option>`).join('')}
                    </select>
                </label>
                <label>Default Tax %<input id="client-default-tax" type="number" step="0.01" value="${Utils.escapeHtml(current.defaultTaxRate || '')}" placeholder="Use company default"></label>
                <label>Payment Link<input id="client-payment-url" type="url" value="${Utils.escapeHtml(current.paymentUrl || '')}" placeholder="Client-specific pay link"></label>
                <label>Default Terms<textarea id="client-default-terms" rows="2" placeholder="Client-specific terms">${Utils.escapeHtml(current.defaultTerms || '')}</textarea></label>
                <label>Notes<textarea id="client-notes" rows="2" placeholder="Internal notes">${Utils.escapeHtml(current.notes || '')}</textarea></label>
            </div>
            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="save-client">Save Client</button>
                <button class="modal-action-btn modal-action-cancel" id="cancel-client">Cancel</button>
            </div>
        `);

        overlay.querySelector('#cancel-client').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#save-client').addEventListener('click', async () => {
            const name = overlay.querySelector('#client-name').value.trim();
            if (!name) {
                Toast.show('Client name required', 'error');
                return;
            }
            const updated = {
                ...current,
                name,
                email: overlay.querySelector('#client-email').value.trim(),
                phone: overlay.querySelector('#client-phone').value.trim(),
                address: overlay.querySelector('#client-address').value.trim(),
                defaultPresetId: overlay.querySelector('#client-default-preset').value,
                defaultTaxRate: overlay.querySelector('#client-default-tax').value.trim(),
                paymentUrl: overlay.querySelector('#client-payment-url').value.trim(),
                defaultTerms: overlay.querySelector('#client-default-terms').value.trim(),
                notes: overlay.querySelector('#client-notes').value.trim(),
            };
            await db.saveClient(updated);
            overlay.remove();
            Toast.show('Client saved', 'success');
            this.render(container);
        });
    },

    _paymentsByDocument() {
        return this._payments.reduce((map, payment) => {
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
