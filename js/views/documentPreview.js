// ============================================================
// documentPreview.js — Professional Document Preview & Export
// ============================================================
// Renders a print-ready, professional invoice/estimate layout
// with company branding. Supports PDF export via window.print()
// and native sharing via the Web Share API.
// ============================================================

const DocumentPreviewView = {
    _doc: null,
    _company: null,
    _client: null,
    _payments: [],

    // ── Render the preview ──
    async render(container, docId) {
        this._doc = await db.getDocument(docId);
        if (!this._doc) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-title">Document not found</div></div>';
            return;
        }

        this._company = await db.getCompanyProfile();
        Utils.ensureDocumentDefaults(this._doc, this._company);

        // Load client details
        if (this._doc.clientId) {
            this._client = await db.get(STORES.CLIENTS, this._doc.clientId);
        } else {
            this._client = null;
        }
        this._payments = this._doc.documentType === 'invoice' ? await db.getPaymentsForDocument(this._doc.id) : [];

        const typeLabel = this._doc.documentType === 'invoice' ? 'Invoice' : 'Estimate';
        const meta = Utils.statusMeta(Utils.statusForDocument(this._doc, this._payments));
        const balance = Utils.documentBalance(this._doc, this._payments);
        const total = Utils.docTotal(this._doc.lineItems, this._doc.isTaxEnabled, this._doc);
        const preset = Utils.getBrandPreset(this._doc.brandPresetId || this._doc.templateId);
        const canReceipt = this._doc.documentType === 'invoice' && (this._payments.length > 0 || balance <= 0);

        container.innerHTML = `
            <div class="ios-form view-enter">
                <div class="preview-command-card">
                    <div>
                        <div class="hero-kicker">${Utils.escapeHtml(preset.name)}</div>
                        <div class="hero-title">${Utils.formatCurrency(balance || total)}</div>
                        <div class="hero-subtitle">${typeLabel} ${Utils.escapeHtml(this._doc.documentID)} · ${meta.label}</div>
                    </div>
                    <span class="preview-status-badge ${meta.cssClass}">${meta.label}</span>
                </div>

                <div class="ios-section preview-preset-section">
                    <div class="ios-section-header">Theme</div>
                    <div class="ios-section-content theme-tab">
                        ${this._renderThemeLargePreview(preset)}
                        <div class="theme-preview-grid">
                            ${Utils.brandPresets.map(item => this._renderThemeOption(item)).join('')}
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="preview-actions">
                    <button class="preview-action-btn" id="preview-print">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        <span>Export PDF</span>
                    </button>
                    <button class="preview-action-btn" id="preview-share" style="display: ${navigator.share ? '' : 'none'};">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                        <span>Share</span>
                    </button>
                    <button class="preview-action-btn secondary" id="preview-copy-pay">
                        <span>Copy Pay</span>
                    </button>
                    <button class="preview-action-btn secondary" id="preview-mark-sent">
                        <span>Mark Sent</span>
                    </button>
                    ${canReceipt ? `
                    <button class="preview-action-btn secondary" id="preview-receipt">
                        <span>Receipt</span>
                    </button>
                    ` : ''}
                    ${this._doc.documentType === 'invoice' && balance > 0 ? `
                    <button class="preview-action-btn secondary" id="preview-reminder">
                        <span>Reminder</span>
                    </button>
                    ` : ''}
                </div>

                <!-- Document Preview Card -->
                <div class="preview-card template-${this._doc.templateId || 'modern'}" id="preview-card" style="--brand-color: ${this._doc.brandColor || this._company.brandColor || '#0056b3'}; --invoice-font: ${preset.fontStack};">
                    ${this._getTemplateHTML()}
                </div>

                ${this._renderPreviewActivity()}
            </div>
        `;

        this._bindEvents(container);
    },

    // ── Template Routing ──
    _getTemplateHTML() {
        const id = this._doc.templateId || 'modern';
        if (id === 'classic') return this._renderClassic();
        if (id === 'bold') return this._renderBold();
        if (id === 'studio') return this._renderStudio();
        if (id === 'contractor') return this._renderContractor();
        if (id === 'minimal') return this._renderMinimal();
        return this._renderModern();
    },

    _renderThemeLargePreview(preset) {
        return `
            <div class="theme-large-preview" style="--brand-color:${preset.color}; --invoice-font:${preset.fontStack};">
                <div class="theme-large-head">
                    <div>
                        <span>Current Theme</span>
                        <strong>${Utils.escapeHtml(preset.name)}</strong>
                        <small>${Utils.escapeHtml(preset.tone)}</small>
                    </div>
                    <em>${Utils.escapeHtml(preset.templateId)}</em>
                </div>
                <div class="theme-paper-preview theme-paper-${preset.templateId}">
                    <div class="theme-paper-top">
                        <strong>${this._doc.documentType === 'estimate' ? 'ESTIMATE' : 'INVOICE'}</strong>
                        <span>${Utils.escapeHtml(this._company.name || 'Your Company')}</span>
                    </div>
                    <div class="theme-paper-meta">
                        <span>Bill To<br><b>${Utils.escapeHtml(this._doc.clientName || 'Client Name')}</b></span>
                        <span>${Utils.escapeHtml(this._doc.documentID || 'INV-0001')}<br>${Utils.formatDate(this._doc.creationDate)}</span>
                    </div>
                    <div class="theme-paper-table">
                        <i></i><i></i><i></i>
                    </div>
                    <div class="theme-paper-total">
                        <span>Total</span>
                        <strong>${Utils.formatCurrency(Utils.docTotal(this._doc.lineItems, this._doc.isTaxEnabled, this._doc))}</strong>
                    </div>
                </div>
            </div>
        `;
    },

    _renderThemeOption(preset) {
        const active = preset.id === this._doc.brandPresetId;
        return `
            <button class="theme-option ${active ? 'active' : ''}" data-preview-preset="${preset.id}" style="--brand-color:${preset.color}; --invoice-font:${preset.fontStack};">
                <div class="theme-option-paper theme-paper-${preset.templateId}">
                    <div class="theme-option-title">INVOICE</div>
                    <div class="theme-option-lines"><span></span><span></span><span></span></div>
                    <div class="theme-option-total"></div>
                </div>
                <strong>${Utils.escapeHtml(preset.shortName)}</strong>
                <small>${Utils.escapeHtml(preset.name)}</small>
            </button>
        `;
    },

    // ── Classic Template (Image 1) ──
    _renderClassic() {
        const typeLabel = this._doc.documentType === 'invoice' ? 'INVOICE' : 'ESTIMATE';
        return `
            <!-- Top Section: Logo Left, Title Right -->
            <div class="template-title-row template-flex" style="align-items: flex-start; justify-content: space-between; margin-bottom: 20px;">
                <div class="preview-logo-wrapper">
                    ${this._company.logoData
                        ? `<img src="${this._company.logoData}" alt="Logo" style="max-height: 48px; max-width: 150px; object-fit: contain;">`
                        : (this._company.name ? `<h2 class="invoice-company-title">${Utils.escapeHtml(this._company.name)}</h2>` : '')
                    }
                </div>
                <div style="text-align: right;">
                    <h1 class="invoice-title invoice-title-classic">${typeLabel}</h1>
                    <div class="preview-company-detail">${Utils.escapeHtml(this._company.name || '')}</div>
                </div>
            </div>

            <!-- Meta Section: Bill To Left, Dates Right -->
            <div class="template-flex" style="justify-content: space-between; margin-bottom: 16px;">
                <div class="meta-section">
                    <div style="font-weight: 700; margin-bottom: 4px; color: #1c1c1e;">FOR:</div>
                    <div style="font-weight: 500; color: #1c1c1e;">${Utils.escapeHtml(this._doc.clientName || 'No Client')}</div>
                    ${this._client && this._client.email ? `<div class="preview-meta-sub">${Utils.escapeHtml(this._client.email)}</div>` : ''}
                    ${this._client && this._client.address ? `<div class="preview-meta-sub" style="margin-top: 2px;">${Utils.escapeHtml(this._client.address)}</div>` : ''}
                </div>
                <div class="meta-section" style="text-align: right;">
                    <div style="display: flex; justify-content: flex-end; gap: 24px;">
                        <span style="font-weight: 500; color: #1c1c1e;">Number:</span>
                        <span style="color: var(--color-label-secondary); min-width: 80px;">${Utils.escapeHtml(this._doc.documentID)}</span>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 24px; margin-top: 6px;">
                        <span style="font-weight: 500; color: #1c1c1e;">Date:</span>
                        <span style="color: var(--color-label-secondary); min-width: 80px;">${Utils.formatDate(this._doc.creationDate)}</span>
                    </div>
                </div>
            </div>

            <!-- Line Items Table -->
            ${this._renderTable()}

            <!-- Totals Footer -->
            <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
                <div style="width: 250px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: 600;">
                        <span>SUBTOTAL:</span>
                        <span>${Utils.formatCurrency(Utils.docSubtotal(this._doc.lineItems))}</span>
                    </div>
                    ${this._doc.isTaxEnabled ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-weight: 600;">
                        <span>TAX:</span>
                        <span>${Utils.formatCurrency(Utils.docTax(this._doc.lineItems, this._doc.isTaxEnabled))}</span>
                    </div>
                    ` : ''}
                    <div style="border-top: 2.5px solid var(--brand-color); padding-top: 8px; display: flex; justify-content: space-between; font-weight: 700; font-size: 17px;">
                        <span>TOTAL</span>
                        <span>${Utils.formatCurrency(Utils.docTotal(this._doc.lineItems, this._doc.isTaxEnabled, this._doc))}</span>
                    </div>
                </div>
            </div>

            ${this._renderNotesBlock()}

            <!-- Company Meta -->
            <div class="preview-footer" style="margin-top: 40px; font-size: 12px;">
                ${this._company.registrationNumber ? `<span>Tax ID: ${Utils.escapeHtml(this._company.registrationNumber)}</span>` : ''}
            </div>
        `;
    },

    // ── Bold Template (Image 2) ──
    _renderBold() {
        const typeLabel = this._doc.documentType === 'invoice' ? 'INVOICE' : 'ESTIMATE';
        return `
            <!-- Massive Blue Header -->
            <div class="bold-header" style="background: linear-gradient(135deg, var(--brand-color) 0%, rgba(0,0,0,0.8) 150%); margin: -32px -32px 30px -32px; padding: 32px 32px 40px 32px; color: white;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
                    <div>
                        ${this._company.logoData
                            ? `<img src="${this._company.logoData}" alt="Logo" style="max-height: 48px; max-width: 150px; object-fit: contain; background: white; padding: 4px; border-radius: 4px;">`
                            : (this._company.name ? `<h2 style="margin:0; font-size: 28px; letter-spacing: -1px; color: white;">${Utils.escapeHtml(this._company.name)}</h2>` : '')
                        }
                    </div>
                    <div style="text-align: right; font-weight: 500; font-size: 14px; letter-spacing: 0.5px; opacity: 0.9; text-transform: uppercase;">
                        ${Utils.escapeHtml(this._company.name || '')}
                    </div>
                </div>
            </div>

            <!-- Overlapping Centered Title -->
            <div class="bold-title-lockup">
                <h1 class="invoice-title invoice-title-bold">${typeLabel}</h1>
                <div style="font-size: 14px; font-weight: 500; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">
                    ${Utils.formatDate(this._doc.creationDate)}
                </div>
            </div>

            <!-- Meta Section -->
            <div class="template-flex" style="justify-content: space-between; margin-bottom: 16px;">
                <div class="meta-section">
                    <span style="font-weight: 600; color: #1c1c1e;">FOR:</span>
                    <span style="font-weight: 500; color: #1c1c1e;">${Utils.escapeHtml(this._doc.clientName || 'No Client')}</span>
                    ${this._client && this._client.email ? `<div class="preview-meta-sub">${Utils.escapeHtml(this._client.email)}</div>` : ''}
                    ${this._client && this._client.address ? `<div class="preview-meta-sub" style="margin-top: 2px;">${Utils.escapeHtml(this._client.address)}</div>` : ''}
                </div>
                <div class="meta-section" style="text-align: right; text-transform: uppercase;">
                    <div style="display: flex; justify-content: flex-end; gap: 16px;">
                        <span style="font-weight: 600; color: #1c1c1e;">NUMBER:</span>
                        <span style="color: var(--color-label-secondary);">${Utils.escapeHtml(this._doc.documentID)}</span>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 16px; margin-top: 4px;">
                        <span style="font-weight: 600; color: #1c1c1e;">DATE:</span>
                        <span style="color: var(--color-label-secondary);">${Utils.formatDate(this._doc.creationDate)}</span>
                    </div>
                </div>
            </div>

            <!-- Line Items Table -->
            ${this._renderTable()}

            <!-- Totals Footer -->
            <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
                <div style="width: 250px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: 700; padding: 0 16px;">
                        <span>SUBTOTAL:</span>
                        <span>${Utils.formatCurrency(Utils.docSubtotal(this._doc.lineItems))}</span>
                    </div>
                    ${this._doc.isTaxEnabled ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-weight: 700; padding: 0 16px;">
                        <span>TAX:</span>
                        <span>${Utils.formatCurrency(Utils.docTax(this._doc.lineItems, this._doc.isTaxEnabled))}</span>
                    </div>
                    ` : ''}
                    <div style="background: #1c1c1e; color: white; padding: 9px 16px; display: flex; justify-content: space-between; font-weight: 700; font-size: 17px;">
                        <span>TOTAL</span>
                        <span>${Utils.formatCurrency(Utils.docTotal(this._doc.lineItems, this._doc.isTaxEnabled, this._doc))}</span>
                    </div>
                </div>
            </div>

            ${this._renderNotesBlock()}
        `;
    },

    // ── Modern Template (Image 3) ──
    _renderModern() {
        const typeLabel = this._doc.documentType === 'invoice' ? 'INVOICE' : 'ESTIMATE';
        return `
            <!-- Top Section: Type left, Logo right -->
            <div class="template-title-row template-flex" style="align-items: center; justify-content: space-between; margin-bottom: 24px;">
                <div>
                    <h1 class="invoice-title invoice-title-modern">${typeLabel}</h1>
                </div>
                <div class="preview-logo-wrapper" style="text-align: right;">
                    ${this._company.logoData
                        ? `<img src="${this._company.logoData}" alt="Logo" style="max-height: 48px; max-width: 150px; object-fit: contain;">`
                        : (this._company.name ? `<h2 class="invoice-company-title invoice-company-title-large">${Utils.escapeHtml(this._company.name)}</h2>` : '')
                    }
                </div>
            </div>

            <!-- Meta Section: 3 Columns -->
            <div class="template-flex" style="margin-bottom: 16px;">
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: var(--brand-color); text-transform: uppercase; font-size: 12px; margin-bottom: 6px;">${typeLabel} FROM:</div>
                    <div style="font-weight: 700; font-size: 15px; color: #1c1c1e;">${Utils.escapeHtml(this._company.name || 'Your Company')}</div>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: var(--brand-color); text-transform: uppercase; font-size: 12px; margin-bottom: 6px;">FOR:</div>
                    <div style="font-weight: 700; font-size: 15px; color: #1c1c1e;">${Utils.escapeHtml(this._doc.clientName || 'No Client')}</div>
                    ${this._client && this._client.email ? `<div class="preview-meta-sub">${Utils.escapeHtml(this._client.email)}</div>` : ''}
                    ${this._client && this._client.address ? `<div class="preview-meta-sub" style="margin-top: 2px;">${Utils.escapeHtml(this._client.address)}</div>` : ''}
                </div>
                <div style="flex: 1; text-align: right;">
                    <div style="display: flex; justify-content: flex-end; gap: 12px;">
                        <span style="font-weight: 500; font-size: 13px; color: #1c1c1e;">Number:</span>
                        <span style="color: var(--color-label-secondary); font-size: 13px;">${Utils.escapeHtml(this._doc.documentID)}</span>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 4px;">
                        <span style="font-weight: 500; font-size: 13px; color: #1c1c1e;">Date:</span>
                        <span style="color: var(--color-label-secondary); font-size: 13px;">${Utils.formatDate(this._doc.creationDate)}</span>
                    </div>
                </div>
            </div>

            <!-- Line Items Table -->
            ${this._renderTable()}

            <!-- Totals Footer -->
            <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
                <div style="width: 250px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: 500; font-size: 13px; letter-spacing: 0.5px; padding: 0 16px;">
                        <span>SUBTOTAL:</span>
                        <span>${Utils.formatCurrency(Utils.docSubtotal(this._doc.lineItems))}</span>
                    </div>
                    ${this._doc.isTaxEnabled ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-weight: 500; font-size: 13px; letter-spacing: 0.5px; padding: 0 16px;">
                        <span>TAX:</span>
                        <span>${Utils.formatCurrency(Utils.docTax(this._doc.lineItems, this._doc.isTaxEnabled))}</span>
                    </div>
                    ` : ''}
                    <div style="background: #000; color: white; padding: 10px 16px; display: flex; justify-content: space-between; font-weight: 700; font-size: 18px; letter-spacing: -0.5px;">
                        <span>TOTAL</span>
                        <span>${Utils.formatCurrency(Utils.docTotal(this._doc.lineItems, this._doc.isTaxEnabled, this._doc))}</span>
                    </div>
                </div>
            </div>

            ${this._renderNotesBlock()}
        `;
    },

    _renderStudio() {
        return `
            <div style="border-left: 8px solid var(--brand-color); padding-left: 22px;">
                ${this._renderModern()}
            </div>
        `;
    },

    _renderContractor() {
        const typeLabel = this._doc.documentType === 'invoice' ? 'INVOICE' : 'ESTIMATE';
        return `
            <div style="display:flex; justify-content:space-between; gap:18px; margin-bottom:18px; border-bottom:4px solid var(--brand-color); padding-bottom:12px;">
                <div>
                    <div style="font-size:12px; font-weight:800; color:var(--brand-color); text-transform:uppercase;">Work Order Billing</div>
                    <h1 class="invoice-title invoice-title-contractor">${typeLabel}</h1>
                </div>
                <div style="text-align:right; font-size:13px; color:#555;">
                    <strong>${Utils.escapeHtml(this._company.name || 'Your Company')}</strong><br>
                    ${Utils.escapeHtml(this._company.phone || '')}<br>
                    ${Utils.escapeHtml(this._company.email || '')}
                </div>
            </div>
            <div class="template-flex" style="justify-content:space-between; margin-bottom:14px;">
                <div><strong>Client</strong><br>${Utils.escapeHtml(this._doc.clientName || 'No Client')}<br><span class="preview-meta-sub">${Utils.escapeHtml(this._client?.address || '')}</span></div>
                <div style="text-align:right;"><strong>${Utils.escapeHtml(this._doc.documentID)}</strong><br>Created ${Utils.formatDate(this._doc.creationDate)}<br>Due ${Utils.formatDate(this._doc.dueDate)}</div>
            </div>
            ${this._renderTable()}
            ${this._renderTotalsBlock()}
            ${this._renderNotesBlock()}
        `;
    },

    _renderMinimal() {
        const typeLabel = this._doc.documentType === 'invoice' ? 'Invoice' : 'Estimate';
        return `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:22px;">
                <h1 class="invoice-title invoice-title-minimal">${typeLabel}</h1>
                <div style="text-align:right; font-size:13px; color:#555;">${Utils.escapeHtml(this._doc.documentID)}<br>${Utils.formatDate(this._doc.creationDate)}</div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:16px;">
                <div><div class="preview-meta-label">From</div><strong>${Utils.escapeHtml(this._company.name || 'Your Company')}</strong></div>
                <div><div class="preview-meta-label">Bill To</div><strong>${Utils.escapeHtml(this._doc.clientName || 'No Client')}</strong></div>
            </div>
            ${this._renderTable()}
            ${this._renderTotalsBlock()}
            ${this._renderNotesBlock()}
        `;
    },

    _renderTotalsBlock() {
        const subtotal = Utils.docSubtotal(this._doc.lineItems);
        const discount = Utils.docDiscount(this._doc);
        const total = Utils.docTotal(this._doc.lineItems, this._doc.isTaxEnabled, this._doc);
        const tax = total - Math.max(0, subtotal - discount);
        const paid = Utils.documentPaidTotal(this._doc, this._payments);
        const balance = Utils.documentBalance(this._doc, this._payments);
        const deposit = Utils.docDeposit(this._doc);
        return `
            <div style="display:flex; justify-content:flex-end; margin-top:14px;">
                <div style="width:260px;">
                    <div class="preview-total-row"><span>Subtotal</span><span>${Utils.formatCurrency(subtotal)}</span></div>
                    ${discount > 0 ? `<div class="preview-total-row"><span>Discount</span><span>-${Utils.formatCurrency(discount)}</span></div>` : ''}
                    ${this._doc.isTaxEnabled ? `<div class="preview-total-row"><span>Tax</span><span>${Utils.formatCurrency(tax)}</span></div>` : ''}
                    <div class="preview-total-row preview-grand-total"><span>Total</span><span>${Utils.formatCurrency(total)}</span></div>
                    ${deposit > 0 ? `<div class="preview-total-row"><span>Deposit Due</span><span>${Utils.formatCurrency(deposit)}</span></div>` : ''}
                    ${paid > 0 ? `<div class="preview-total-row"><span>Paid</span><span>${Utils.formatCurrency(paid)}</span></div><div class="preview-total-row preview-grand-total"><span>Balance</span><span>${Utils.formatCurrency(balance)}</span></div>` : ''}
                </div>
            </div>
        `;
    },

    _renderNotesBlock() {
        const text = [this._doc.clientMessage, this._doc.paymentTerms, this._doc.notes].filter(Boolean).join('\n\n');
        return text ? `
            <div style="margin-top:18px;">
                <div style="font-weight:700; color:#1c1c1e; margin-bottom:3px; font-size:13px;">Notes</div>
                <div style="color:#444; line-height:1.45; font-size:11.5px; white-space:pre-wrap;">${Utils.escapeHtml(text)}</div>
            </div>
        ` : '';
    },

    _renderPreviewActivity() {
        const activity = (this._doc.activity || []).slice(-5).reverse();
        return `
            <div class="ios-section">
                <div class="ios-section-header">Delivery Timeline</div>
                <div class="ios-section-content">
                    ${activity.length ? activity.map(item => `
                        <div class="activity-row">
                            <div class="activity-dot ${Utils.escapeHtml(item.type || 'created')}"></div>
                            <div class="activity-body">
                                <div class="activity-title">${Utils.escapeHtml(item.title || 'Update')}</div>
                                <div class="activity-subtitle">${Utils.escapeHtml(item.detail || '')}${item.detail ? ' · ' : ''}${Utils.formatDate(item.date)}</div>
                            </div>
                        </div>
                    `).join('') : '<div class="empty-inline">Send, reminder, signature, and payment events will appear here.</div>'}
                </div>
            </div>
        `;
    },

    // ── Unified Table Builder ──
    _renderTable() {
        const th = 'background: var(--brand-color); color: white; border: none; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; padding: 7px 10px;';
        const td = 'padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 12px; color: #1c1c1e; line-height: 1.35;';
        const sectionTd = 'padding: 8px 10px 5px; border-bottom: 1.5px solid var(--brand-color); background: #f7f8fa;';
        const items = this._doc.lineItems || [];
        const hasSections = items.some(i => i.type === 'section');
        return `
            <table class="preview-table" style="margin: 0 0 14px;">
                <thead>
                    <tr>
                        <th style="${th} text-align: left;">Description</th>
                        <th style="${th} text-align: right;">Qty</th>
                        <th style="${th} text-align: right;">Unit price</th>
                        ${this._doc.isTaxEnabled ? `<th style="${th} text-align: right;">Tax</th>` : ''}
                        <th style="${th} text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, index) => {
                        if (item.type === 'section') {
                            return `
                        <tr>
                            <td colspan="${this._doc.isTaxEnabled ? 5 : 4}" style="${sectionTd} font-weight: 800; color: #1c1c1e; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">${Utils.escapeHtml(item.itemDescription || 'Section')}</td>
                        </tr>`;
                        }
                        return `
                        <tr>
                            <td style="${td}${hasSections ? ' padding-left: 22px;' : ''}">
                                <span style="font-weight: ${hasSections ? '600' : '700'}; color: ${hasSections ? '#1c1c1e' : 'var(--brand-color)'}; text-transform: ${hasSections ? 'none' : 'uppercase'}; letter-spacing: 0.2px;">${Utils.escapeHtml(item.itemDescription || '—')}</span>
                                ${item.itemNote ? `<div style="color: #777; font-size: 10.5px; margin-top: 1px;">${Utils.escapeHtml(item.itemNote)}</div>` : ''}
                            </td>
                            <td style="${td} text-align: right;">${item.quantity || 0}</td>
                            <td style="${td} text-align: right;">${Utils.formatCurrency(item.unitPrice)}</td>
                            ${this._doc.isTaxEnabled ? `<td style="${td} text-align: right;">${item.taxRate || 0}%</td>` : ''}
                            <td style="${td} text-align: right;">${Utils.formatCurrency(Utils.lineTotal(item, this._doc.isTaxEnabled))}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    // ── Bind action buttons ──
    _bindEvents(container) {
        container.querySelectorAll('[data-preview-preset]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const preset = Utils.getBrandPreset(btn.dataset.previewPreset);
                Utils.applyPresetToDocument(this._doc, preset.id);
                this._doc.brandColor = preset.color;
                await db.saveDocument(this._doc);
                Utils.applyAccent(preset.color);
                Toast.show(`${preset.name} previewed`, 'success');
                this.render(container, this._doc.id);
            });
        });

        container.querySelector('#preview-print').addEventListener('click', () => {
            Utils.haptic('medium');
            this._exportPDF();
        });

        const shareBtn = container.querySelector('#preview-share');
        if (shareBtn) {
            shareBtn.addEventListener('click', async () => {
                Utils.haptic('light');
                await this._shareDocument();
            });
        }

        container.querySelector('#preview-copy-pay').addEventListener('click', async () => {
            await this._copyPaymentRequest(container);
        });

        container.querySelector('#preview-mark-sent').addEventListener('click', async () => {
            await this._markSent(container);
        });

        const receiptBtn = container.querySelector('#preview-receipt');
        if (receiptBtn) {
            receiptBtn.addEventListener('click', () => {
                Utils.haptic('medium');
                this._exportReceipt();
            });
        }

        const reminderBtn = container.querySelector('#preview-reminder');
        if (reminderBtn) {
            reminderBtn.addEventListener('click', async () => {
                Utils.haptic('light');
                await this._sendReminder(container);
            });
        }
    },

    async _copyPaymentRequest(container) {
        try {
            await navigator.clipboard.writeText(Utils.paymentRequestText(this._doc, this._company, this._payments));
            Utils.addActivity(this._doc, 'payment', 'Payment request copied', this._doc.paymentLink ? 'Link included' : 'No link configured');
            await db.saveDocument(this._doc);
            Toast.show('Payment request copied', 'success');
            this.render(container, this._doc.id);
        } catch (err) {
            Toast.show('Copy failed', 'error');
        }
    },

    async _markSent(container) {
        this._doc.status = 'sent';
        this._doc.lastSentAt = new Date().toISOString();
        Utils.addActivity(this._doc, 'sent', 'Marked as sent', this._doc.clientName || '');
        await db.saveDocument(this._doc);
        Toast.show('Marked as sent', 'success');
        this.render(container, this._doc.id);
    },

    // ── Export via print ──
    _exportPDF() {
        const card = document.getElementById('preview-card');
        const typeLabel = this._doc.documentType === 'invoice' ? 'Invoice' : 'Estimate';
        const title = `${typeLabel} ${this._doc.documentID}`;

        // Build a standalone print window
        const printWin = window.open('', '_blank', 'width=800,height=1100');
        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Inter', -apple-system, sans-serif;
                        color: #1a1a1a;
                        padding: 24px 32px;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    ${this._getPrintStyles()}
                </style>
            </head>
            <body>
                ${card.outerHTML}
                <script>
                    window.onload = function() {
                        setTimeout(function() { window.print(); window.close(); }, 300);
                    };
                </script>
            </body>
            </html>
        `);
        printWin.document.close();

        Utils.addActivity(this._doc, 'exported', 'PDF export prepared', title);
        db.saveDocument(this._doc);
        Toast.show('Preparing PDF…', 'info');
    },

    _exportReceipt() {
        const paid = Utils.documentPaidTotal(this._doc, this._payments);
        const balance = Utils.documentBalance(this._doc, this._payments);
        const title = `Receipt ${this._doc.documentID}`;
        const receiptHtml = `
            <div style="max-width:640px; margin:0 auto; font-family:Inter,-apple-system,sans-serif; color:#1a1a1a;">
                <div style="display:flex; justify-content:space-between; border-bottom:3px solid ${this._company.brandColor || '#007aff'}; padding-bottom:18px; margin-bottom:26px;">
                    <div>
                        <div style="font-size:13px; color:${this._company.brandColor || '#007aff'}; font-weight:800; text-transform:uppercase;">Payment Receipt</div>
                        <h1 style="margin:4px 0 0;">${Utils.escapeHtml(this._doc.documentID)}</h1>
                    </div>
                    <div style="text-align:right;">
                        <strong>${Utils.escapeHtml(this._company.name || 'Your Company')}</strong><br>
                        ${Utils.escapeHtml(this._company.email || '')}
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px;">
                    <div><div style="color:#666; font-size:12px; text-transform:uppercase;">Received From</div><strong>${Utils.escapeHtml(this._doc.clientName || 'No Client')}</strong></div>
                    <div><div style="color:#666; font-size:12px; text-transform:uppercase;">Receipt Date</div><strong>${Utils.formatDate(Utils.today())}</strong></div>
                </div>
                <div style="background:#f6f7f9; padding:20px; border-radius:10px; margin-bottom:20px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;"><span>Total Paid</span><strong>${Utils.formatCurrency(paid)}</strong></div>
                    <div style="display:flex; justify-content:space-between;"><span>Remaining Balance</span><strong>${Utils.formatCurrency(balance)}</strong></div>
                </div>
                <table style="width:100%; border-collapse:collapse;">
                    <thead><tr><th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Date</th><th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Method</th><th style="text-align:right; border-bottom:1px solid #ddd; padding:8px;">Amount</th></tr></thead>
                    <tbody>${this._payments.map(p => `<tr><td style="padding:8px; border-bottom:1px solid #eee;">${Utils.formatDate(p.paymentDate)}</td><td style="padding:8px; border-bottom:1px solid #eee;">${Utils.escapeHtml(p.method || 'Payment')}</td><td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${Utils.formatCurrency(p.amount)}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        `;
        const printWin = window.open('', '_blank', 'width=800,height=900');
        printWin.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title></head><body style="padding:40px;">${receiptHtml}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);};</script></body></html>`);
        printWin.document.close();
        Toast.show('Preparing receipt…', 'info');
    },

    async _sendReminder(container) {
        const balance = Utils.documentBalance(this._doc, this._payments);
        const subject = `Reminder: ${this._doc.documentID} balance due`;
        const body = `Hello ${this._doc.clientName || ''},\n\nThis is a friendly reminder that ${this._doc.documentID} has a remaining balance of ${Utils.formatCurrency(balance)} due ${Utils.formatDate(this._doc.dueDate)}.\n\nThank you.`;
        this._doc.lastReminderAt = new Date().toISOString();
        Utils.addActivity(this._doc, 'reminder', 'Reminder prepared', Utils.formatCurrency(balance));
        await db.saveDocument(this._doc);
        if (navigator.share) {
            navigator.share({ title: subject, text: body }).catch(() => {});
        } else {
            window.location.href = `mailto:${encodeURIComponent(this._client?.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
        if (container) this.render(container, this._doc.id);
    },

    // ── Share with Web Share API ──
    async _shareDocument() {
        const typeLabel = this._doc.documentType === 'invoice' ? 'Invoice' : 'Estimate';
        const total = Utils.formatCurrency(Utils.docTotal(this._doc.lineItems, this._doc.isTaxEnabled, this._doc));
        const title = `${typeLabel} ${this._doc.documentID}`;
        const text = `${title}\nClient: ${this._doc.clientName || 'N/A'}\nTotal: ${total}\nDue: ${Utils.formatDate(this._doc.dueDate)}`;

        try {
            await navigator.share({
                title: title,
                text: text,
            });
            this._doc.status = this._doc.status === 'draft' ? 'sent' : this._doc.status;
            this._doc.lastSentAt = new Date().toISOString();
            Utils.addActivity(this._doc, 'shared', 'Shared from preview', title);
            await db.saveDocument(this._doc);
            Toast.show('Shared successfully', 'success');
        } catch (err) {
            if (err.name !== 'AbortError') {
                Toast.show('Sharing failed', 'error');
            }
        }
    },

    // ── Print-specific styles ──
    _getPrintStyles() {
        return `
            .preview-card {
                --color-label: #1c1c1e;
                --color-label-secondary: #5f6368;
                --color-label-tertiary: #8a8f98;
                max-width: 720px;
                margin: 0 auto;
                background: #ffffff;
                color: #1c1c1e;
                font-family: var(--invoice-font, 'Inter', -apple-system, sans-serif);
            }
            .invoice-title {
                margin: 0;
                color: #121317;
                line-height: 0.95;
                text-transform: uppercase;
                overflow-wrap: anywhere;
            }
            .invoice-title-modern { font-size: 38px; font-weight: 800; }
            .invoice-title-classic { margin-bottom: 10px; font-size: 30px; font-weight: 500; letter-spacing: 1.5px; }
            .invoice-title-bold {
                display: inline-block;
                padding: 6px 14px;
                background: #ffffff;
                color: #101114;
                border: 2px solid #101114;
                font-size: 36px;
                font-weight: 900;
            }
            .invoice-title-contractor { margin-top: 4px; font-size: 32px; font-weight: 900; }
            .invoice-title-minimal { font-size: 27px; font-weight: 650; text-transform: none; }
            .invoice-company-title { margin: 0; color: #111827; font-size: 28px; font-weight: 800; }
            .invoice-company-title-large { font-size: 32px; }
            .bold-title-lockup {
                position: relative;
                z-index: 2;
                text-align: center;
                margin-top: -48px;
                margin-bottom: 22px;
            }
            .preview-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 20px;
                margin-bottom: 4px;
            }
            .preview-company {
                display: flex;
                align-items: flex-start;
                gap: 14px;
            }
            .preview-logo {
                width: 56px;
                height: 56px;
                border-radius: 12px;
                object-fit: cover;
            }
            .preview-logo-text {
                width: 56px;
                height: 56px;
                border-radius: 12px;
                background: #f0f0f5;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 18px;
                color: #666;
            }
            .preview-company-name {
                font-size: 18px;
                font-weight: 700;
                margin-bottom: 2px;
            }
            .preview-company-detail {
                font-size: 12px;
                color: #666;
                line-height: 1.4;
            }
            .preview-doc-badge {
                text-align: right;
            }
            .preview-doc-type {
                font-size: 26px;
                font-weight: 700;
                color: #007aff;
                letter-spacing: -0.5px;
            }
            .preview-doc-number {
                font-size: 13px;
                color: #888;
                font-weight: 500;
            }
            .preview-divider {
                height: 1px;
                background: #e5e5ea;
                margin: 20px 0;
            }
            .preview-meta-row {
                display: flex;
                justify-content: space-between;
                gap: 20px;
            }
            .preview-meta-block { flex: 1; }
            .preview-meta-right {
                text-align: right;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .preview-meta-row-item {
                display: flex;
                justify-content: space-between;
                gap: 16px;
            }
            .preview-meta-label {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: #888;
                margin-bottom: 4px;
            }
            .preview-meta-value {
                font-size: 14px;
                font-weight: 600;
            }
            .preview-meta-sub {
                font-size: 12px;
                color: #666;
                line-height: 1.4;
            }
            .preview-status-badge {
                font-size: 11px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 10px;
                display: inline-block;
            }
            .preview-status-badge.draft { background: #f0f0f5; color: #888; }
            .preview-status-badge.sent { background: #e5f1ff; color: #007aff; }
            .preview-status-badge.paid { background: #e5f9ed; color: #34c759; }
            .preview-status-badge.accepted { background: #f3e8fa; color: #af52de; }
            .preview-table {
                width: 100%;
                border-collapse: collapse;
                margin: 4px 0 20px;
                font-size: 13px;
            }
            .preview-table thead {
                border-bottom: 2px solid #e5e5ea;
            }
            .preview-table th {
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: #888;
                padding: 8px 8px;
                text-align: left;
            }
            .preview-th-num, .preview-td-num {
                text-align: right !important;
            }
            .preview-table td {
                padding: 10px 8px;
                border-bottom: 1px solid #f0f0f5;
                font-size: 13px;
            }
            .preview-td-desc { font-weight: 500; }
            .preview-totals {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 6px;
                padding-right: 8px;
            }
            .preview-total-row {
                display: flex;
                justify-content: space-between;
                width: 200px;
                font-size: 13px;
                color: #666;
            }
            .preview-grand-total {
                font-size: 16px;
                font-weight: 700;
                color: #1a1a1a;
                padding-top: 8px;
                margin-top: 4px;
                border-top: 2px solid #1a1a1a;
            }
            .preview-notes {
                margin-top: 4px;
            }
            .preview-notes-text {
                font-size: 13px;
                color: #444;
                line-height: 1.5;
                white-space: pre-wrap;
            }
            .preview-footer {
                margin-top: 40px;
                padding-top: 16px;
                border-top: 1px solid #e5e5ea;
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                color: #aaa;
            }
            .preview-actions { display: none; }
            .preview-company-info { min-width: 0; }

            /* Classic Print */
            .template-classic { font-family: Georgia, serif; }
            .template-classic .preview-doc-type { text-transform: uppercase; color: #333; letter-spacing: 2px; }
            .template-classic .preview-table th { border-bottom: 2px solid #333; border-top: 2px solid #333; }
            .template-classic .preview-grand-total { border-top: 2px solid #333; border-bottom: 2px double #333; }
            .template-classic .preview-divider { background: #ccc; }

            /* Bold Print */
            .template-bold { background: white; }
            .template-bold .preview-header { background: #5856d6; padding: 24px; margin: -24px -20px 24px -20px; border-radius: 12px 12px 0 0; color: white; }
            .template-bold .preview-doc-type,
            .template-bold .preview-company-detail,
            .template-bold .preview-doc-number,
            .template-bold .preview-company-name,
            .template-bold .preview-logo-text { color: white; }
            .template-bold .preview-logo-text { background: rgba(255,255,255,0.2); }
            .template-bold .preview-table th { background: #f0f0f5; color: #1a1a1a; }
            .template-bold .preview-grand-total { color: #5856d6; }
        `;
    },
};
