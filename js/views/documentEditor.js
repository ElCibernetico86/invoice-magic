// ============================================================
// documentEditor.js — Document Creation/Edit View
// ============================================================
// Form-based editor for invoices and estimates.
// - Section 1: Client (inline search + create)
// - Section 2: Document details (number, status, dates)
// - Section 3: Line items (dynamic add/remove with live totals)
// - Section 4: Notes
// - Section 5: Convert to Invoice (estimates only)
// ============================================================

const DocumentEditorView = {
    _currentDoc: null,
    _allClients: [],
    _payments: [],
    _catalog: [],
    _company: null,
    _autoSaveTimeout: null,

    // ── Render the editor ──
    async render(container, docId) {
        const doc = await db.getDocument(docId);
        if (!doc) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-title">Document not found</div></div>';
            return;
        }

        this._currentDoc = doc;
        this._allClients = await db.getAllClients();
        this._payments = doc.documentType === 'invoice' ? await db.getPaymentsForDocument(doc.id) : [];
        this._catalog = await db.getCatalogItems();
        this._company = await db.getCompanyProfile();
        Utils.ensureDocumentDefaults(doc, this._company);

        const typeLabel = doc.documentType === 'invoice' ? 'Invoice' : 'Estimate';
        const isEstimate = doc.documentType === 'estimate';
        const isOverdue = doc.status !== 'paid' && doc.status !== 'accepted' && Utils.isOverdue(doc.dueDate);
        const overdueClass = isOverdue ? ' overdue-indicator' : '';
        const status = Utils.statusForDocument(doc, this._payments);
        const meta = Utils.statusMeta(status);
        const preset = Utils.getBrandPreset(doc.brandPresetId || doc.templateId);
        const total = Utils.docTotal(doc.lineItems, doc.isTaxEnabled, doc);
        const balance = Utils.documentBalance(doc, this._payments);

        container.innerHTML = `
            <div class="ios-form view-enter">
                ${isOverdue ? `
                <div class="overdue-banner">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span>Overdue — Due <strong>${Utils.formatDate(doc.dueDate)}</strong></span>
                </div>
                ` : ''}

                <div class="composer-dock">
                    <div class="composer-brand">
                        <span class="preset-color" style="background:${doc.brandColor || preset.color}"></span>
                        <div>
                            <strong>${Utils.escapeHtml(preset.name)}</strong>
                            <span>${meta.label} · ${Utils.formatCurrency(total)}</span>
                        </div>
                    </div>
                    <div class="composer-balance ${balance > 0 ? 'text-orange' : 'text-green'}">
                        <small>${doc.documentType === 'invoice' ? 'Balance' : 'Estimate'}</small>
                        <strong>${Utils.formatCurrency(balance || total)}</strong>
                    </div>
                </div>

                <div class="ios-section">
                    <div class="ios-section-header">Brand Preset</div>
                    <div class="ios-section-content preset-strip-wrap">
                        <div class="preset-strip">
                            ${Utils.brandPresets.map(item => `
                                <button class="mini-preset ${item.id === doc.brandPresetId ? 'active' : ''}" data-editor-preset="${item.id}">
                                    <span class="preset-color" style="background:${item.color}"></span>
                                    <strong>${item.shortName}</strong>
                                    <small>${item.templateId}</small>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="ios-section-footer">Presets control the exported document style and due date defaults.</div>
                </div>

                <!-- Client Section -->
                <div class="ios-section" style="margin-top: 16px;">
                    <div class="ios-section-header">Client</div>
                    <div class="ios-section-content">
                        <div class="ios-cell">
                            <span class="ios-input-label">Name</span>
                            <input type="text" class="ios-input" id="editor-client-name"
                                   placeholder="Search or add client…"
                                   value="${Utils.escapeHtml(doc.clientName || '')}"
                                   autocomplete="off">
                            ${doc.clientId ? '<span style="color: var(--color-green); font-size: 18px;">✓</span>' : ''}
                        </div>
                        <div id="client-suggestions" class="client-suggestions"></div>
                        <div id="client-details" ${doc.clientId ? '' : 'style="display:none;"'}>
                            <div class="ios-cell">
                                <span class="ios-input-label">Email</span>
                                <input type="email" class="ios-input" id="editor-client-email"
                                       placeholder="client@email.com"
                                       value="${Utils.escapeHtml(this._getClientField('email'))}"
                                       autocomplete="off">
                            </div>
                            <div class="ios-cell">
                                <span class="ios-input-label">Phone</span>
                                <input type="tel" class="ios-input" id="editor-client-phone"
                                       placeholder="+1 (555) 000-0000"
                                       value="${Utils.escapeHtml(this._getClientField('phone'))}"
                                       autocomplete="off">
                            </div>
                            <div class="ios-cell">
                                <span class="ios-input-label">Address</span>
                                <input type="text" class="ios-input" id="editor-client-address"
                                       placeholder="Street, City, State"
                                       value="${Utils.escapeHtml(this._getClientField('address'))}"
                                       autocomplete="off">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Document Info Section -->
                <div class="ios-section">
                    <div class="ios-section-header">Details</div>
                    <div class="ios-section-content">
                        <div class="ios-cell">
                            <span class="ios-input-label">Number</span>
                            <input type="text" class="ios-input ios-input-right" id="editor-document-id"
                                   style="text-align: right;"
                                   value="${Utils.escapeHtml(doc.documentID)}"
                                   autocomplete="off">
                        </div>
                        <div class="ios-cell ios-cell-interactive" id="editor-tax-toggle-cell">
                            <span class="ios-input-label">Tax Enabled</span>
                            <div class="ios-toggle ${doc.isTaxEnabled ? 'active' : ''}" id="editor-tax-toggle"></div>
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Status</span>
                            <select class="ios-select" id="editor-status">
                                <option value="draft" ${doc.status === 'draft' ? 'selected' : ''}>Draft</option>
                                <option value="sent" ${doc.status === 'sent' ? 'selected' : ''}>Sent</option>
                                <option value="paid" ${doc.status === 'paid' ? 'selected' : ''}>Paid</option>
                                <option value="accepted" ${doc.status === 'accepted' ? 'selected' : ''}>Accepted</option>
                            </select>
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Created</span>
                            <input type="date" class="ios-date-input" id="editor-creation-date"
                                   value="${Utils.toInputDate(doc.creationDate)}">
                        </div>
                        <div class="ios-cell${overdueClass}">
                            <span class="ios-input-label">Due</span>
                            <input type="date" class="ios-date-input${isOverdue ? ' text-red' : ''}" id="editor-due-date"
                                   value="${Utils.toInputDate(doc.dueDate)}">
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Recurring</span>
                            <select class="ios-select" id="editor-recurring">
                                <option value="none" ${(doc.recurring || 'none') === 'none' ? 'selected' : ''}>None</option>
                                <option value="weekly" ${doc.recurring === 'weekly' ? 'selected' : ''}>Weekly</option>
                                <option value="monthly" ${doc.recurring === 'monthly' ? 'selected' : ''}>Monthly</option>
                                <option value="quarterly" ${doc.recurring === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                                <option value="yearly" ${doc.recurring === 'yearly' ? 'selected' : ''}>Yearly</option>
                            </select>
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Discount</span>
                            <div class="inline-control-group">
                                <select class="ios-select compact-select" id="editor-discount-type">
                                    <option value="none" ${(doc.discountType || 'none') === 'none' ? 'selected' : ''}>None</option>
                                    <option value="amount" ${doc.discountType === 'amount' ? 'selected' : ''}>Amount</option>
                                    <option value="percent" ${doc.discountType === 'percent' ? 'selected' : ''}>Percent</option>
                                </select>
                                <input type="number" class="ios-input mini-input" id="editor-discount-value"
                                       value="${doc.discountValue || 0}" min="0" step="0.01">
                            </div>
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Deposit</span>
                            <div class="inline-control-group">
                                <select class="ios-select compact-select" id="editor-deposit-type">
                                    <option value="none" ${(doc.depositType || 'none') === 'none' ? 'selected' : ''}>None</option>
                                    <option value="amount" ${doc.depositType === 'amount' ? 'selected' : ''}>Amount</option>
                                    <option value="percent" ${doc.depositType === 'percent' ? 'selected' : ''}>Percent</option>
                                </select>
                                <input type="number" class="ios-input mini-input" id="editor-deposit-value"
                                       value="${doc.depositValue || 0}" min="0" step="0.01">
                            </div>
                        </div>
                        <div class="ios-cell">
                            <span class="ios-input-label">Payment Link</span>
                            <input type="url" class="ios-input" id="editor-payment-link"
                                   placeholder="https://pay.example.com/..."
                                   value="${Utils.escapeHtml(doc.paymentLink || '')}">
                        </div>
                    </div>
                </div>

                <!-- Line Items Section -->
                <div class="ios-section">
                    <div class="ios-section-header">Line Items</div>
                    <div class="ios-section-content" id="line-items-container">
                        ${this._renderLineItems(doc.lineItems)}
                        <div class="ios-cell ios-cell-interactive" id="add-line-item" style="justify-content: center;">
                            <span class="text-blue fw-semibold" style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 20px;">+</span> Add Line Item
                            </span>
                        </div>
                        <div class="ios-cell ios-cell-interactive" id="add-section" style="justify-content: center;">
                            <span class="text-blue fw-semibold" style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 20px;">+</span> Add Section
                            </span>
                        </div>
                        ${this._catalog.length ? `
                        <div class="ios-cell ios-cell-interactive" id="add-catalog-item" style="justify-content: center;">
                            <span class="text-blue fw-semibold">Add From Catalog</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="ios-section-footer" id="totals-footer">
                        ${this._renderTotals(doc.lineItems)}
                    </div>
                </div>

                ${doc.documentType === 'invoice' ? this._renderPaymentSection() : ''}

                <!-- Notes Section -->
                <div class="ios-section">
                    <div class="ios-section-header">Terms & Notes</div>
                    <div class="ios-section-content">
                        <div class="ios-cell">
                            <textarea class="ios-input" id="editor-client-message"
                                      placeholder="${isEstimate ? 'e.g. Thanks for the opportunity — here is your estimate. Let us know if you would like any changes.' : 'e.g. Thank you for your business. Please review the invoice below.'}"
                                      rows="2">${Utils.escapeHtml(doc.clientMessage || '')}</textarea>
                        </div>
                        <div class="ios-cell">
                            <textarea class="ios-input" id="editor-payment-terms"
                                      placeholder="${isEstimate ? 'e.g. Estimate valid for 30 days. A 50% deposit is required to schedule work.' : 'e.g. Payment due within 30 days.'}"
                                      rows="2">${Utils.escapeHtml(doc.paymentTerms || '')}</textarea>
                        </div>
                        <div class="ios-cell">
                            <textarea class="ios-input" id="editor-notes"
                                      placeholder="${isEstimate ? 'e.g. Materials and labor included. Final price may change after on-site measurement.' : 'e.g. Any additional notes for the client…'}"
                                      rows="3">${Utils.escapeHtml(doc.notes || '')}</textarea>
                        </div>
                    </div>
                </div>

                <div class="ios-section">
                    <div class="ios-section-header">Send & Collect</div>
                    <div class="ios-section-content">
                        <div class="send-action-grid">
                            <button class="send-action-btn" id="mark-sent-btn">Mark Sent</button>
                            <button class="send-action-btn" id="copy-payment-request-btn">Copy Pay Request</button>
                            <button class="send-action-btn" id="duplicate-doc-btn">Duplicate</button>
                            <button class="send-action-btn" id="signature-btn">${doc.signatureName ? 'Signed' : 'Capture Signature'}</button>
                        </div>
                        <div class="ios-cell ios-cell-interactive" id="add-attachment-btn" style="justify-content: center;">
                            <span class="text-blue fw-semibold">Add Attachment Note</span>
                        </div>
                        ${(doc.attachments || []).length ? (doc.attachments || []).map((item, index) => `
                            <div class="compact-row">
                                <div class="compact-body">
                                    <div class="compact-title">${Utils.escapeHtml(item.name || 'Attachment')}</div>
                                    <div class="compact-subtitle">${Utils.formatDate(item.date)}</div>
                                </div>
                                <button class="row-delete-btn" data-delete-attachment="${index}">×</button>
                            </div>
                        `).join('') : '<div class="empty-inline">Track signed approvals, photos, receipts, and file references.</div>'}
                    </div>
                </div>

                ${this._renderActivitySection()}

                ${isEstimate ? `
                <!-- Convert Section -->
                <div class="ios-section">
                    <button class="ios-btn ios-btn-convert" id="convert-btn">
                        <span>⚡</span>
                        Convert to Invoice
                    </button>
                </div>
                ` : ''}

                ${!isEstimate && doc.recurring && doc.recurring !== 'none' ? `
                <div class="ios-section">
                    <button class="ios-btn ios-btn-primary" id="create-recurring-btn">
                        Create Next ${typeLabel}
                    </button>
                </div>
                ` : ''}

                <!-- Delete Section -->
                <div class="ios-section" style="margin-bottom: 40px;">
                    <button class="ios-btn ios-btn-destructive" id="delete-doc-btn">
                        Delete ${typeLabel}
                    </button>
                </div>
            </div>
        `;

        this._bindEvents(container);
    },

    // ── Switch to the client's own number sequence when a client is assigned ──
    // Only touches numbers that still look auto-generated (INV-0001 or
    // INV-JS-001 style); manually customized numbers are left alone.
    async _renumberForClient(container) {
        const doc = this._currentDoc;
        if (!doc.clientId) return;
        const isAutoNumber = /^(INV|EST)-(?:[A-Z0-9]{1,3}-)?\d{3,4}$/.test(doc.documentID || '');
        if (!isAutoNumber) return;

        const next = await db.getNextDocumentNumber(doc.documentType, { id: doc.clientId, name: doc.clientName });
        if (next === doc.documentID) return;

        doc.documentID = next;
        const numInput = container.querySelector('#editor-document-id');
        if (numInput) numInput.value = next;
        const navTitle = document.getElementById('nav-title');
        if (navTitle) navTitle.textContent = next;
        Toast.show(`Number set to ${next}`, 'info');
    },

    // ── Get current client field value ──
    _getClientField(field) {
        if (!this._currentDoc || !this._currentDoc.clientId) return '';
        const client = this._allClients.find(c => c.id === this._currentDoc.clientId);
        return client ? (client[field] || '') : '';
    },

    // ── Render line items ──
    _renderLineItems(items) {
        if (!items || items.length === 0) return '';
        return items.map((item, index) => item.type === 'section' ? `
            <div class="line-item-card line-item-section" data-index="${index}">
                <div class="section-item-row">
                    <button class="line-item-drag" aria-label="Reorder section">⠿</button>
                    <input type="text" class="section-item-name" placeholder="Section name (e.g. Master Bathroom)"
                           value="${Utils.escapeHtml(item.itemDescription || '')}"
                           data-field="itemDescription" data-index="${index}">
                    <button class="line-item-delete" data-delete-index="${index}" aria-label="Delete section">−</button>
                </div>
            </div>
        ` : `
            <div class="line-item-card" data-index="${index}">
                <input type="text" class="line-item-desc" placeholder="Description"
                       value="${Utils.escapeHtml(item.itemDescription || '')}"
                       data-field="itemDescription" data-index="${index}">
                <input type="text" class="line-item-note" placeholder="Optional detail, SKU, phase, or service note"
                       value="${Utils.escapeHtml(item.itemNote || '')}"
                       data-field="itemNote" data-index="${index}">
                <div class="line-item-fields">
                    <div class="line-item-field">
                        <label>QTY</label>
                        <input type="number" min="0" step="any"
                               value="${item.quantity || 1}"
                               data-field="quantity" data-index="${index}">
                    </div>
                    <div class="line-item-field">
                        <label>PRICE</label>
                        <input type="number" min="0" step="0.01"
                               value="${item.unitPrice || 0}"
                               data-field="unitPrice" data-index="${index}">
                    </div>
                    ${this._currentDoc?.isTaxEnabled ? `
                    <div class="line-item-field">
                        <label>TAX %</label>
                        <input type="number" min="0" step="0.01"
                               value="${item.taxRate || 0}"
                               data-field="taxRate" data-index="${index}">
                    </div>
                    ` : ''}
                    <div class="line-item-total" data-total-index="${index}">
                        ${Utils.formatCurrency(Utils.lineTotal(item, this._currentDoc?.isTaxEnabled))}
                    </div>
                    <button class="line-item-drag" aria-label="Reorder item">⠿</button>
                    <button class="line-item-delete" data-delete-index="${index}" aria-label="Delete item">−</button>
                </div>
            </div>
        `).join('');
    },

    // ── Render totals footer ──
    _renderTotals(items) {
        const subtotal = Utils.docSubtotal(items);
        const discount = Utils.docDiscount(this._currentDoc);
        const tax = Utils.docTotal(items, this._currentDoc?.isTaxEnabled, this._currentDoc) - Math.max(0, subtotal - discount);
        const total = Utils.docTotal(items, this._currentDoc?.isTaxEnabled, this._currentDoc);
        const paid = Utils.documentPaidTotal(this._currentDoc, this._payments);
        const balance = Utils.documentBalance(this._currentDoc, this._payments);

        return `
            <div class="totals-row">
                <span class="totals-label">Subtotal</span>
                <span>${Utils.formatCurrency(subtotal)}</span>
            </div>
            ${discount > 0 ? `
            <div class="totals-row">
                <span class="totals-label">Discount</span>
                <span>-${Utils.formatCurrency(discount)}</span>
            </div>
            ` : ''}
            <div class="totals-row">
                <span class="totals-label">Tax</span>
                <span>${Utils.formatCurrency(tax)}</span>
            </div>
            <div class="totals-row grand-total">
                <span class="totals-label">Total</span>
                <span>${Utils.formatCurrency(total)}</span>
            </div>
            ${Utils.docDeposit(this._currentDoc) > 0 ? `
            <div class="totals-row">
                <span class="totals-label">Deposit Due</span>
                <span>${Utils.formatCurrency(Utils.docDeposit(this._currentDoc))}</span>
            </div>
            ` : ''}
            ${this._currentDoc?.documentType === 'invoice' && paid > 0 ? `
            <div class="totals-row">
                <span class="totals-label">Paid</span>
                <span>${Utils.formatCurrency(paid)}</span>
            </div>
            <div class="totals-row grand-total balance-total">
                <span class="totals-label">Balance</span>
                <span>${Utils.formatCurrency(balance)}</span>
            </div>
            ` : ''}
        `;
    },

    _renderPaymentSection() {
        const total = Utils.docTotal(this._currentDoc.lineItems, this._currentDoc.isTaxEnabled, this._currentDoc);
        const paid = Utils.documentPaidTotal(this._currentDoc, this._payments);
        const balance = Utils.documentBalance(this._currentDoc, this._payments);
        return `
            <div class="ios-section">
                <div class="ios-section-header">Payments</div>
                <div class="ios-section-content">
                    <div class="payment-summary">
                        <div>
                            <div class="payment-summary-label">Paid</div>
                            <div class="payment-summary-value">${Utils.formatCurrency(paid)}</div>
                        </div>
                        <div>
                            <div class="payment-summary-label">Balance</div>
                            <div class="payment-summary-value ${balance > 0 ? 'text-orange' : 'text-green'}">${Utils.formatCurrency(balance)}</div>
                        </div>
                        <div>
                            <div class="payment-summary-label">Total</div>
                            <div class="payment-summary-value">${Utils.formatCurrency(total)}</div>
                        </div>
                    </div>
                    ${this._payments.length ? this._payments.map(payment => `
                        <div class="compact-row payment-row">
                            <div class="compact-body">
                                <div class="compact-title">${Utils.formatCurrency(payment.amount)}</div>
                                <div class="compact-subtitle">${Utils.escapeHtml(payment.method || 'Payment')} · ${Utils.formatDate(payment.paymentDate)}</div>
                            </div>
                            <button class="row-delete-btn" data-delete-payment="${payment.id}">×</button>
                        </div>
                    `).join('') : '<div class="empty-inline">No payments recorded yet.</div>'}
                    <div class="ios-cell ios-cell-interactive" id="add-payment" style="justify-content: center;">
                        <span class="text-blue fw-semibold">Record Payment</span>
                    </div>
                    ${balance > 0 ? `
                    <div class="ios-cell ios-cell-interactive" id="mark-paid" style="justify-content: center;">
                        <span class="text-green fw-semibold">Mark Paid in Full</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    _renderActivitySection() {
        const activity = (this._currentDoc.activity || []).slice(-6).reverse();
        return `
            <div class="ios-section">
                <div class="ios-section-header">Activity</div>
                <div class="ios-section-content">
                    ${activity.length ? activity.map(item => `
                        <div class="activity-row">
                            <div class="activity-dot ${Utils.escapeHtml(item.type || 'created')}"></div>
                            <div class="activity-body">
                                <div class="activity-title">${Utils.escapeHtml(item.title || 'Update')}</div>
                                <div class="activity-subtitle">${Utils.escapeHtml(item.detail || '')}${item.detail ? ' · ' : ''}${Utils.formatDate(item.date)}</div>
                            </div>
                        </div>
                    `).join('') : '<div class="empty-inline">Activity appears as you send, edit, sign, and collect payment.</div>'}
                </div>
            </div>
        `;
    },

    // ── Bind all event handlers ──
    _bindEvents(container) {
        const self = this;

        container.querySelectorAll('[data-editor-preset]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const preset = Utils.getBrandPreset(btn.dataset.editorPreset);
                Utils.applyPresetToDocument(self._currentDoc, preset.id);
                self._currentDoc.brandColor = preset.color;
                await db.saveDocument(self._currentDoc);
                Utils.applyAccent(preset.color);
                Toast.show(`${preset.name} applied`, 'success');
                self.render(container, self._currentDoc.id);
            });
        });

        // ── Client name search ──
        const clientInput = container.querySelector('#editor-client-name');
        const suggestionsEl = container.querySelector('#client-suggestions');
        const clientDetailsEl = container.querySelector('#client-details');

        clientInput.addEventListener('input', Utils.debounce(() => {
            const query = clientInput.value.trim().toLowerCase();
            if (!query) {
                suggestionsEl.innerHTML = '';
                return;
            }

            const filtered = self._allClients.filter(c =>
                c.name.toLowerCase().includes(query) &&
                c.name.toLowerCase() !== query
            );

            if (filtered.length > 0) {
                suggestionsEl.innerHTML = filtered.map(c => `
                    <button class="client-suggestion" data-client-id="${c.id}">
                        <span class="client-suggestion-avatar">${Utils.initials(c.name)}</span>
                        <span>${Utils.escapeHtml(c.name)}</span>
                    </button>
                `).join('');

                suggestionsEl.querySelectorAll('.client-suggestion').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const clientId = parseInt(btn.dataset.clientId, 10);
                        const client = self._allClients.find(c => c.id === clientId);
                        if (client) {
                            clientInput.value = client.name;
                            self._currentDoc.clientId = client.id;
                            self._currentDoc.clientName = client.name;
                            suggestionsEl.innerHTML = '';
                            clientDetailsEl.style.display = '';

                            // Populate client fields
                            container.querySelector('#editor-client-email').value = client.email || '';
                            container.querySelector('#editor-client-phone').value = client.phone || '';
                            container.querySelector('#editor-client-address').value = client.address || '';

                            Utils.haptic('light');
                            await self._renumberForClient(container);
                            self._autoSave();
                        }
                    });
                });
            } else {
                suggestionsEl.innerHTML = '';
            }
        }, 200));

        // When client name loses focus, auto-create if new
        clientInput.addEventListener('blur', async () => {
            const name = clientInput.value.trim();
            if (name && !self._currentDoc.clientId) {
                const client = await db.findOrCreateClient(name);
                if (client) {
                    self._currentDoc.clientId = client.id;
                    self._currentDoc.clientName = client.name;
                    self._allClients = await db.getAllClients();
                    clientDetailsEl.style.display = '';
                    await self._renumberForClient(container);
                    self._autoSave();
                }
            } else if (name) {
                self._currentDoc.clientName = name;
                self._autoSave();
            }
            // Clear suggestions after a short delay (allow click events first)
            setTimeout(() => { suggestionsEl.innerHTML = ''; }, 200);
        });

        // ── Client detail fields ──
        ['email', 'phone', 'address'].forEach(field => {
            const el = container.querySelector(`#editor-client-${field}`);
            if (el) {
                el.addEventListener('input', Utils.debounce(async () => {
                    if (self._currentDoc.clientId) {
                        const client = await db.get(STORES.CLIENTS, self._currentDoc.clientId);
                        if (client) {
                            client[field] = el.value;
                            await db.saveClient(client);
                        }
                    }
                }, 500));
            }
        });

        // ── Number ──
        const numInput = container.querySelector('#editor-document-id');
        if (numInput) {
            numInput.addEventListener('input', Utils.debounce(() => {
                self._currentDoc.documentID = numInput.value;
                self._autoSave();
            }, 300));
        }

        // ── Tax Toggle ──
        const taxToggleCell = container.querySelector('#editor-tax-toggle-cell');
        const taxToggle = container.querySelector('#editor-tax-toggle');
        if (taxToggleCell && taxToggle) {
            taxToggleCell.addEventListener('click', () => {
                Utils.haptic('light');
                taxToggle.classList.toggle('active');
                self._currentDoc.isTaxEnabled = taxToggle.classList.contains('active');
                self._refreshLineItems(container);
                self._autoSave();
            });
        }

        // ── Status ──
        container.querySelector('#editor-status').addEventListener('change', (e) => {
            self._currentDoc.status = e.target.value;
            Utils.haptic('light');
            self._autoSave();
        });

        // ── Dates ──
        container.querySelector('#editor-creation-date').addEventListener('change', (e) => {
            self._currentDoc.creationDate = e.target.value;
            self._autoSave();
        });
        container.querySelector('#editor-due-date').addEventListener('change', (e) => {
            self._currentDoc.dueDate = e.target.value;
            self._autoSave();
        });

        container.querySelector('#editor-recurring').addEventListener('change', (e) => {
            self._currentDoc.recurring = e.target.value;
            self._autoSave();
        });

        container.querySelector('#editor-discount-type').addEventListener('change', (e) => {
            self._currentDoc.discountType = e.target.value;
            container.querySelector('#totals-footer').innerHTML = self._renderTotals(self._currentDoc.lineItems);
            self._autoSave();
        });

        container.querySelector('#editor-discount-value').addEventListener('input', Utils.debounce((e) => {
            self._currentDoc.discountValue = parseFloat(e.target.value) || 0;
            container.querySelector('#totals-footer').innerHTML = self._renderTotals(self._currentDoc.lineItems);
            self._autoSave();
        }, 150));

        container.querySelector('#editor-deposit-type').addEventListener('change', (e) => {
            self._currentDoc.depositType = e.target.value;
            container.querySelector('#totals-footer').innerHTML = self._renderTotals(self._currentDoc.lineItems);
            self._autoSave();
        });

        container.querySelector('#editor-deposit-value').addEventListener('input', Utils.debounce((e) => {
            self._currentDoc.depositValue = parseFloat(e.target.value) || 0;
            container.querySelector('#totals-footer').innerHTML = self._renderTotals(self._currentDoc.lineItems);
            self._autoSave();
        }, 150));

        container.querySelector('#editor-payment-link').addEventListener('input', Utils.debounce(() => {
            self._currentDoc.paymentLink = container.querySelector('#editor-payment-link').value.trim();
            self._autoSave();
        }, 400));

        // ── Notes ──
        container.querySelector('#editor-client-message').addEventListener('input', Utils.debounce(() => {
            self._currentDoc.clientMessage = container.querySelector('#editor-client-message').value;
            self._autoSave();
        }, 500));

        container.querySelector('#editor-payment-terms').addEventListener('input', Utils.debounce(() => {
            self._currentDoc.paymentTerms = container.querySelector('#editor-payment-terms').value;
            self._autoSave();
        }, 500));

        container.querySelector('#editor-notes').addEventListener('input', Utils.debounce(() => {
            self._currentDoc.notes = container.querySelector('#editor-notes').value;
            self._autoSave();
        }, 500));

        // ── Line item fields ──
        this._bindLineItemEvents(container);

        // ── Add line item ──
        container.querySelector('#add-line-item').addEventListener('click', () => {
            self._currentDoc.lineItems.push({
                itemDescription: '',
                quantity: 1,
                unitPrice: 0,
                taxRate: 0,
            });
            Utils.haptic('light');
            self._refreshLineItems(container);
            self._autoSave();
        });

        // ── Add section header ──
        container.querySelector('#add-section').addEventListener('click', () => {
            self._currentDoc.lineItems.push({
                type: 'section',
                itemDescription: '',
                quantity: 0,
                unitPrice: 0,
                taxRate: 0,
            });
            Utils.haptic('light');
            self._refreshLineItems(container);
            self._autoSave();
            // Focus the new section name input
            const inputs = container.querySelectorAll('.section-item-name');
            if (inputs.length) inputs[inputs.length - 1].focus();
        });

        const addCatalogBtn = container.querySelector('#add-catalog-item');
        if (addCatalogBtn) {
            addCatalogBtn.addEventListener('click', () => self._showCatalogPicker(container));
        }

        const addPaymentBtn = container.querySelector('#add-payment');
        if (addPaymentBtn) {
            addPaymentBtn.addEventListener('click', () => self._showPaymentDialog(container));
        }

        const markPaidBtn = container.querySelector('#mark-paid');
        if (markPaidBtn) {
            markPaidBtn.addEventListener('click', async () => {
                const balance = Utils.documentBalance(self._currentDoc, self._payments);
                if (balance <= 0) return;
                await db.savePayment({
                    documentId: self._currentDoc.id,
                    clientId: self._currentDoc.clientId || null,
                    amount: balance,
                    method: 'Paid in full',
                    paymentDate: Utils.today(),
                    notes: '',
                });
                self._currentDoc.status = 'paid';
                Utils.addActivity(self._currentDoc, 'paid', 'Paid in full', Utils.formatCurrency(balance));
                await db.saveDocument(self._currentDoc);
                Toast.show('Invoice marked paid', 'success');
                self.render(container, self._currentDoc.id);
            });
        }

        container.querySelectorAll('[data-delete-payment]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await db.deletePayment(parseInt(btn.dataset.deletePayment, 10));
                self._payments = await db.getPaymentsForDocument(self._currentDoc.id);
                if (Utils.documentBalance(self._currentDoc, self._payments) > 0 && self._currentDoc.status === 'paid') {
                    self._currentDoc.status = 'sent';
                    await db.saveDocument(self._currentDoc);
                }
                Toast.show('Payment removed', 'success');
                self.render(container, self._currentDoc.id);
            });
        });

        // ── Convert button ──
        const convertBtn = container.querySelector('#convert-btn');
        if (convertBtn) {
            convertBtn.addEventListener('click', () => {
                Utils.haptic('medium');
                self._showConvertDialog();
            });
        }

        const recurringBtn = container.querySelector('#create-recurring-btn');
        if (recurringBtn) {
            recurringBtn.addEventListener('click', async () => {
                await self._createNextRecurring();
            });
        }

        container.querySelector('#mark-sent-btn').addEventListener('click', async () => {
            await self._markSent(container);
        });
        container.querySelector('#copy-payment-request-btn').addEventListener('click', async () => {
            await self._copyPaymentRequest();
        });
        container.querySelector('#duplicate-doc-btn').addEventListener('click', async () => {
            await self._duplicateCurrentDocument();
        });
        container.querySelector('#signature-btn').addEventListener('click', () => {
            self._showSignatureDialog(container);
        });
        container.querySelector('#add-attachment-btn').addEventListener('click', () => {
            self._showAttachmentDialog(container);
        });
        container.querySelectorAll('[data-delete-attachment]').forEach(btn => {
            btn.addEventListener('click', async () => {
                self._currentDoc.attachments.splice(parseInt(btn.dataset.deleteAttachment, 10), 1);
                Utils.addActivity(self._currentDoc, 'attachment', 'Attachment removed');
                await db.saveDocument(self._currentDoc);
                self.render(container, self._currentDoc.id);
            });
        });

        // ── Delete button ──
        container.querySelector('#delete-doc-btn').addEventListener('click', () => {
            Utils.haptic('medium');
            self._showDeleteDialog();
        });
    },

    // ── Bind line item input events ──
    _bindLineItemEvents(container) {
        const self = this;
        const lineContainer = container.querySelector('#line-items-container');

        // Handle input changes
        lineContainer.querySelectorAll('input[data-field]').forEach(input => {
            input.addEventListener('input', Utils.debounce(() => {
                const index = parseInt(input.dataset.index, 10);
                const field = input.dataset.field;

                if (field === 'itemDescription' || field === 'itemNote') {
                    self._currentDoc.lineItems[index][field] = input.value;
                } else {
                    self._currentDoc.lineItems[index][field] = parseFloat(input.value) || 0;
                }

                // Update line total display
                const totalEl = container.querySelector(`[data-total-index="${index}"]`);
                if (totalEl) {
                    totalEl.textContent = Utils.formatCurrency(Utils.lineTotal(self._currentDoc.lineItems[index], self._currentDoc.isTaxEnabled));
                }

                // Update footer totals
                container.querySelector('#totals-footer').innerHTML = self._renderTotals(self._currentDoc.lineItems);

                self._autoSave();
            }, 150));
        });

        // Handle delete buttons
        lineContainer.querySelectorAll('.line-item-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.deleteIndex, 10);
                if (self._currentDoc.lineItems.length > 1) {
                    self._currentDoc.lineItems.splice(index, 1);
                    Utils.haptic('light');
                    self._refreshLineItems(container);
                    self._autoSave();
                }
            });
        });

        this._bindDragEvents(container);
    },

    // ── Drag-to-reorder line items ──
    _bindDragEvents(container) {
        const self = this;
        const lineContainer = container.querySelector('#line-items-container');

        lineContainer.querySelectorAll('.line-item-drag').forEach(handle => {
            handle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                const card = handle.closest('.line-item-card');
                if (!card) return;
                const cards = () => [...lineContainer.querySelectorAll('.line-item-card')];

                card.classList.add('dragging');
                try { handle.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
                Utils.haptic('light');

                let lastY = e.clientY;
                let raf = null;

                // Move the card in the DOM to follow the pointer
                const reorderAt = (y) => {
                    for (const other of cards()) {
                        if (other === card) continue;
                        const rect = other.getBoundingClientRect();
                        if (y > rect.top && y < rect.bottom) {
                            if (y < rect.top + rect.height / 2) {
                                lineContainer.insertBefore(card, other);
                            } else {
                                lineContainer.insertBefore(card, other.nextSibling);
                            }
                            break;
                        }
                    }
                };

                // Auto-scroll while holding near the screen edges
                const scrollLoop = () => {
                    if (lastY < 110) window.scrollBy(0, -10);
                    else if (lastY > window.innerHeight - 110) window.scrollBy(0, 10);
                    reorderAt(lastY);
                    raf = requestAnimationFrame(scrollLoop);
                };
                raf = requestAnimationFrame(scrollLoop);

                const move = (ev) => {
                    lastY = ev.clientY;
                    reorderAt(lastY);
                };

                const finish = () => {
                    handle.removeEventListener('pointermove', move);
                    handle.removeEventListener('pointerup', finish);
                    handle.removeEventListener('pointercancel', finish);
                    cancelAnimationFrame(raf);
                    card.classList.remove('dragging');

                    // Rebuild the model from the new DOM order
                    const order = cards().map(el => parseInt(el.dataset.index, 10));
                    const changed = order.some((orig, pos) => orig !== pos);
                    if (changed) {
                        self._currentDoc.lineItems = order.map(i => self._currentDoc.lineItems[i]);
                        Utils.haptic('medium');
                        self._autoSave();
                    }
                    self._refreshLineItems(container);
                };

                handle.addEventListener('pointermove', move);
                handle.addEventListener('pointerup', finish);
                handle.addEventListener('pointercancel', finish);
            });
        });
    },

    // ── Refresh line items display ──
    _refreshLineItems(container) {
        // Preserve scroll: removing all cards briefly collapses the page,
        // which would otherwise make the browser jump to the top.
        const scrollEl = document.getElementById('main-content');
        const savedScroll = scrollEl ? scrollEl.scrollTop : 0;

        const lineContainer = container.querySelector('#line-items-container');
        const addBtn = lineContainer.querySelector('#add-line-item');
        const itemsHtml = this._renderLineItems(this._currentDoc.lineItems);

        // Remove old line items, keep add button
        lineContainer.querySelectorAll('.line-item-card').forEach(el => el.remove());
        addBtn.insertAdjacentHTML('beforebegin', itemsHtml);

        // Rebind events
        this._bindLineItemEvents(container);

        // Update totals
        container.querySelector('#totals-footer').innerHTML = this._renderTotals(this._currentDoc.lineItems);

        if (scrollEl) scrollEl.scrollTop = savedScroll;
    },

    // ── Auto-save ──
    _autoSave() {
        clearTimeout(this._autoSaveTimeout);
        this._autoSaveTimeout = setTimeout(async () => {
            if (this._currentDoc) {
                await db.saveDocument(this._currentDoc);
            }
        }, 300);
    },

    // ── Save immediately (called on navigation away) ──
    async saveNow() {
        clearTimeout(this._autoSaveTimeout);
        if (this._currentDoc) {
            Utils.ensureDocumentDefaults(this._currentDoc, this._company);
            await db.saveDocument(this._currentDoc);
        }
    },

    async _markSent(container) {
        this._currentDoc.status = 'sent';
        this._currentDoc.lastSentAt = new Date().toISOString();
        Utils.addActivity(this._currentDoc, 'sent', 'Marked as sent', this._currentDoc.clientName || '');
        await db.saveDocument(this._currentDoc);
        Toast.show('Marked as sent', 'success');
        this.render(container, this._currentDoc.id);
    },

    async _copyPaymentRequest() {
        const text = Utils.paymentRequestText(this._currentDoc, this._company || {}, this._payments);
        try {
            await navigator.clipboard.writeText(text);
            Utils.addActivity(this._currentDoc, 'payment', 'Payment request copied', this._currentDoc.paymentLink ? 'Link included' : 'No link configured');
            await db.saveDocument(this._currentDoc);
            Toast.show('Payment request copied', 'success');
        } catch (err) {
            Toast.show('Copy failed', 'error');
        }
    },

    async _duplicateCurrentDocument() {
        await this.saveNow();
        const id = await db.duplicateDocument(this._currentDoc.id);
        if (!id) return Toast.show('Duplicate failed', 'error');
        Toast.show('Document duplicated', 'success');
        App.navigateToEditor(id);
    },

    _showSignatureDialog(container) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-sheet">
                <div class="modal-handle"></div>
                <div class="modal-title">Capture Signature</div>
                <div class="modal-message">Record the signer name and approval date for this document.</div>
                <div class="modal-form">
                    <label>Signer Name<input id="signature-name" value="${Utils.escapeHtml(this._currentDoc.signatureName || this._currentDoc.clientName || '')}" placeholder="Client or approver"></label>
                    <label>Date<input id="signature-date" type="date" value="${Utils.today()}"></label>
                </div>
                <div class="modal-actions">
                    <button class="modal-action-btn modal-action-primary" id="save-signature">Save Signature</button>
                    <button class="modal-action-btn modal-action-cancel" id="cancel">Cancel</button>
                </div>
            </div>
        `;
        document.getElementById('app').appendChild(overlay);
        overlay.querySelector('#cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('#save-signature').addEventListener('click', async () => {
            const name = overlay.querySelector('#signature-name').value.trim();
            if (!name) return Toast.show('Signer name required', 'error');
            this._currentDoc.signatureName = name;
            this._currentDoc.signedAt = overlay.querySelector('#signature-date').value || Utils.today();
            if (this._currentDoc.documentType === 'estimate') this._currentDoc.status = 'accepted';
            Utils.addActivity(this._currentDoc, 'signed', 'Signature captured', name);
            await db.saveDocument(this._currentDoc);
            overlay.remove();
            Toast.show('Signature saved', 'success');
            this.render(container, this._currentDoc.id);
        });
    },

    _showAttachmentDialog(container) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-sheet">
                <div class="modal-handle"></div>
                <div class="modal-title">Attachment Note</div>
                <div class="modal-message">Track a receipt, photo, signed PDF, or external file reference.</div>
                <div class="modal-form">
                    <label>Name<input id="attachment-name" placeholder="Receipt, photo, signed approval"></label>
                    <label>Reference<textarea id="attachment-note" rows="2" placeholder="File name, URL, storage location, or note"></textarea></label>
                </div>
                <div class="modal-actions">
                    <button class="modal-action-btn modal-action-primary" id="save-attachment">Save Attachment</button>
                    <button class="modal-action-btn modal-action-cancel" id="cancel">Cancel</button>
                </div>
            </div>
        `;
        document.getElementById('app').appendChild(overlay);
        overlay.querySelector('#cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('#save-attachment').addEventListener('click', async () => {
            const name = overlay.querySelector('#attachment-name').value.trim();
            if (!name) return Toast.show('Attachment name required', 'error');
            this._currentDoc.attachments = this._currentDoc.attachments || [];
            this._currentDoc.attachments.push({
                name,
                note: overlay.querySelector('#attachment-note').value.trim(),
                date: Utils.today(),
            });
            Utils.addActivity(this._currentDoc, 'attachment', 'Attachment noted', name);
            await db.saveDocument(this._currentDoc);
            overlay.remove();
            Toast.show('Attachment noted', 'success');
            this.render(container, this._currentDoc.id);
        });
    },

    _showCatalogPicker(container) {
        if (!this._catalog.length) return;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-sheet modal-sheet-tall">
                <div class="modal-handle"></div>
                <div class="modal-title">Add From Catalog</div>
                <div class="modal-scroll-list">
                    ${this._catalog.map(item => `
                        <button class="modal-list-row" data-catalog-id="${item.id}">
                            <span>
                                <strong>${Utils.escapeHtml(item.name)}</strong>
                                <small>${Utils.escapeHtml(item.category || 'Service')}</small>
                            </span>
                            <strong>${Utils.formatCurrency(item.unitPrice)}</strong>
                        </button>
                    `).join('')}
                </div>
                <div class="modal-actions">
                    <button class="modal-action-btn modal-action-cancel" id="modal-cancel">Cancel</button>
                </div>
            </div>
        `;
        document.getElementById('app').appendChild(overlay);
        overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelectorAll('[data-catalog-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this._catalog.find(c => c.id === parseInt(btn.dataset.catalogId, 10));
                if (!item) return;
                this._currentDoc.lineItems.push({
                    itemDescription: item.description || item.name,
                    quantity: 1,
                    unitPrice: parseFloat(item.unitPrice) || 0,
                    taxRate: parseFloat(item.taxRate) || 0,
                });
                overlay.remove();
                Utils.haptic('success');
                this._refreshLineItems(container);
                this._autoSave();
            });
        });
    },

    _showPaymentDialog(container) {
        const balance = Utils.documentBalance(this._currentDoc, this._payments);
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-sheet">
                <div class="modal-handle"></div>
                <div class="modal-title">Record Payment</div>
                <div class="modal-form">
                    <label>Amount<input id="payment-amount" type="number" min="0" step="0.01" value="${balance.toFixed(2)}"></label>
                    <label>Date<input id="payment-date" type="date" value="${Utils.today()}"></label>
                    <label>Method
                        <select id="payment-method">
                            <option>Cash</option>
                            <option>Check</option>
                            <option>Credit Card</option>
                            <option>Bank Transfer</option>
                            <option>Other</option>
                        </select>
                    </label>
                    <label>Notes<textarea id="payment-notes" rows="2" placeholder="Reference or memo"></textarea></label>
                </div>
                <div class="modal-actions">
                    <button class="modal-action-btn modal-action-primary" id="modal-save-payment">Save Payment</button>
                    <button class="modal-action-btn modal-action-cancel" id="modal-cancel">Cancel</button>
                </div>
            </div>
        `;

        document.getElementById('app').appendChild(overlay);
        overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('#modal-save-payment').addEventListener('click', async () => {
            const amount = parseFloat(overlay.querySelector('#payment-amount').value) || 0;
            if (amount <= 0) {
                Toast.show('Payment amount required', 'error');
                return;
            }
            await db.savePayment({
                documentId: this._currentDoc.id,
                clientId: this._currentDoc.clientId || null,
                amount,
                paymentDate: overlay.querySelector('#payment-date').value || Utils.today(),
                method: overlay.querySelector('#payment-method').value,
                notes: overlay.querySelector('#payment-notes').value.trim(),
            });
            this._payments = await db.getPaymentsForDocument(this._currentDoc.id);
            if (Utils.documentBalance(this._currentDoc, this._payments) <= 0) {
                this._currentDoc.status = 'paid';
            }
            Utils.addActivity(this._currentDoc, 'payment', 'Payment recorded', Utils.formatCurrency(amount));
            await db.saveDocument(this._currentDoc);
            overlay.remove();
            Toast.show('Payment recorded', 'success');
            this.render(container, this._currentDoc.id);
        });
    },

    // ── Convert confirmation dialog ──
    _showConvertDialog() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-sheet">
                <div class="modal-handle"></div>
                <div class="modal-title">Convert to Invoice?</div>
                <div class="modal-message">
                    A new invoice will be created with this estimate's details. The estimate will be marked as Accepted.
                </div>
                <div class="modal-actions">
                    <button class="modal-action-btn modal-action-primary" id="modal-convert">Convert</button>
                    <button class="modal-action-btn modal-action-cancel" id="modal-cancel">Cancel</button>
                </div>
            </div>
        `;

        document.getElementById('app').appendChild(overlay);

        overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('#modal-convert').addEventListener('click', async () => {
            overlay.remove();
            await this._performConversion();
        });
    },

    // ── Perform estimate → invoice conversion ──
    async _performConversion() {
        const estimate = this._currentDoc;
        const newDocID = await db.getNextDocumentNumber(
            'invoice',
            estimate.clientId ? { id: estimate.clientId, name: estimate.clientName } : null
        );
        const invoice = Utils.cloneDocumentForConversion(estimate, newDocID);
        const invoiceId = await db.saveDocument(invoice);

        // Mark estimate as accepted
        estimate.status = 'accepted';
        Utils.addActivity(estimate, 'converted', 'Converted to invoice', newDocID);
        await db.saveDocument(estimate);

        Utils.haptic('success');
        Toast.show(`Converted to ${newDocID}`, 'success');

        // Navigate to the new invoice
        App.navigateToEditor(invoiceId);
    },

    async _createNextRecurring() {
        await this.saveNow();
        const current = this._currentDoc;
        const nextDocID = await db.getNextDocumentNumber(
            current.documentType,
            current.clientId ? { id: current.clientId, name: current.clientName } : null
        );
        const days = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365 }[current.recurring] || 30;
        const next = {
            ...current,
            documentID: nextDocID,
            status: 'draft',
            creationDate: Utils.addDays(current.creationDate, days),
            dueDate: Utils.addDays(current.dueDate, days),
            sourceDocumentId: current.id,
        };
        delete next.id;
        const id = await db.saveDocument(next);
        Toast.show(`Created ${nextDocID}`, 'success');
        App.navigateToEditor(id);
    },

    // ── Delete confirmation dialog ──
    _showDeleteDialog() {
        const typeLabel = this._currentDoc.documentType === 'invoice' ? 'invoice' : 'estimate';
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-sheet">
                <div class="modal-handle"></div>
                <div class="modal-title">Delete ${typeLabel}?</div>
                <div class="modal-message">
                    This will permanently delete ${this._currentDoc.documentID}. This action cannot be undone.
                </div>
                <div class="modal-actions">
                    <button class="modal-action-btn" id="modal-delete"
                            style="background: var(--color-red); color: white;">Delete</button>
                    <button class="modal-action-btn modal-action-cancel" id="modal-cancel">Cancel</button>
                </div>
            </div>
        `;

        document.getElementById('app').appendChild(overlay);

        overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('#modal-delete').addEventListener('click', async () => {
            overlay.remove();
            const label = this._currentDoc.documentType === 'invoice' ? 'Invoice' : 'Estimate';
            await db.deleteDocument(this._currentDoc.id);
            Utils.haptic('success');
            Toast.show(`${label} deleted`, 'success');
            App.navigateBack();
        });
    },
};
