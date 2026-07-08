// ============================================================
// utils.js — Shared Utilities
// ============================================================

const Utils = {
    // ── Currency Formatting ──
    formatCurrency(amount, currency) {
        const cur = currency || Utils.getPreferredCurrency();
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: cur,
            minimumFractionDigits: 2,
        }).format(amount || 0);
    },

    // ── Get/Set preferred currency ──
    getPreferredCurrency() {
        return localStorage.getItem('invoiceMagic_currency') || 'USD';
    },
    setPreferredCurrency(code) {
        localStorage.setItem('invoiceMagic_currency', code);
    },

    // ── Available currencies ──
    currencies: [
        { code: 'USD', name: 'US Dollar', symbol: '$' },
        { code: 'EUR', name: 'Euro', symbol: '€' },
        { code: 'GBP', name: 'British Pound', symbol: '£' },
        { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
        { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
        { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
        { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
        { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
        { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
        { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
        { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
        { code: 'KRW', name: 'Korean Won', symbol: '₩' },
        { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
        { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
        { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
        { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
        { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
        { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
        { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
        { code: 'COP', name: 'Colombian Peso', symbol: 'COL$' },
    ],

    // ── Brand Presets / Templates ──
    templates: [
        { id: 'modern', name: 'Modern', presetId: 'apple-clean' },
        { id: 'classic', name: 'Classic', presetId: 'legal-classic' },
        { id: 'bold', name: 'Bold', presetId: 'creative-bold' },
        { id: 'studio', name: 'Studio', presetId: 'studio-pro' },
        { id: 'contractor', name: 'Contractor', presetId: 'field-contractor' },
        { id: 'minimal', name: 'Minimal', presetId: 'consultant-minimal' },
    ],

    accentThemes: [
        { id: 'blue', name: 'Pacific', color: '#007aff' },
        { id: 'emerald', name: 'Emerald', color: '#0a8f5a' },
        { id: 'graphite', name: 'Graphite', color: '#30343f' },
        { id: 'rose', name: 'Rose', color: '#c2415d' },
        { id: 'amber', name: 'Amber', color: '#b86b00' },
    ],

    brandPresets: [
        {
            id: 'apple-clean',
            name: 'Apple Clean',
            shortName: 'Clean',
            templateId: 'modern',
            color: '#007aff',
            accentTheme: 'blue',
            tone: 'Modern, simple, and highly readable',
            audience: 'general service businesses',
            dueDays: 30,
            defaultTerms: 'Payment due within 30 days. Thank you for your business.',
            message: 'Thanks for working with us. Please review the invoice and reach out with any questions.',
            tableStyle: 'clean',
            fontStack: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
        },
        {
            id: 'studio-pro',
            name: 'Studio Pro',
            shortName: 'Studio',
            templateId: 'studio',
            color: '#c2415d',
            accentTheme: 'rose',
            tone: 'Editorial, polished, and brand-forward',
            audience: 'creative studios and consultants',
            dueDays: 14,
            defaultTerms: 'Payment due within 14 days. A 50% deposit may be required before production begins.',
            message: 'Here is the latest project invoice. We appreciate the collaboration.',
            tableStyle: 'editorial',
            fontStack: "'Avenir Next', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        },
        {
            id: 'field-contractor',
            name: 'Field Contractor',
            shortName: 'Field',
            templateId: 'contractor',
            color: '#b86b00',
            accentTheme: 'amber',
            tone: 'Direct, job-ready, and easy to scan on site',
            audience: 'contractors, installers, and field teams',
            dueDays: 15,
            defaultTerms: 'Payment due within 15 days. Materials, labor, and reimbursable costs are listed below.',
            message: 'Please review the attached job invoice and payment details.',
            tableStyle: 'work-order',
            fontStack: "'Helvetica Neue', Arial, sans-serif",
        },
        {
            id: 'consultant-minimal',
            name: 'Consultant Minimal',
            shortName: 'Minimal',
            templateId: 'minimal',
            color: '#30343f',
            accentTheme: 'graphite',
            tone: 'Quiet, confident, and executive',
            audience: 'consultants, advisors, and retainers',
            dueDays: 30,
            defaultTerms: 'Payment due within 30 days. Retainers and recurring services are billed as agreed.',
            message: 'Attached is the invoice for the current engagement period.',
            tableStyle: 'minimal',
            fontStack: "'SF Pro Text', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        },
        {
            id: 'legal-classic',
            name: 'Legal Classic',
            shortName: 'Classic',
            templateId: 'classic',
            color: '#30343f',
            accentTheme: 'graphite',
            tone: 'Formal, detailed, and document-first',
            audience: 'legal, bookkeeping, and professional offices',
            dueDays: 30,
            defaultTerms: 'Payment due within 30 days. Please reference the invoice number with payment.',
            message: 'Please find the invoice details below for your records.',
            tableStyle: 'formal',
            fontStack: "Georgia, 'Times New Roman', serif",
        },
        {
            id: 'creative-bold',
            name: 'Creative Bold',
            shortName: 'Bold',
            templateId: 'bold',
            color: '#5856d6',
            accentTheme: 'blue',
            tone: 'High-contrast, memorable, and premium',
            audience: 'makers, boutiques, and independent brands',
            dueDays: 10,
            defaultTerms: 'Payment due within 10 days. Custom work begins after deposit confirmation when applicable.',
            message: 'Thank you for choosing us. Your invoice and next steps are ready.',
            tableStyle: 'bold',
            fontStack: "'Arial Black', 'Avenir Next', 'Inter', sans-serif",
        },
    ],

    getBrandPreset(id) {
        return this.brandPresets.find(p => p.id === id) ||
            this.brandPresets.find(p => p.templateId === id) ||
            this.brandPresets[0];
    },

    getPresetForTemplate(templateId) {
        return this.brandPresets.find(p => p.templateId === templateId) || this.brandPresets[0];
    },

    applyPresetToDocument(doc, presetId, company = null) {
        const preset = this.getBrandPreset(presetId);
        if (!doc || !preset) return doc;
        doc.brandPresetId = preset.id;
        doc.templateId = preset.templateId;
        doc.brandColor = preset.color;
        doc.paymentTerms = doc.paymentTerms || preset.defaultTerms;
        doc.clientMessage = doc.clientMessage || preset.message;
        if (!doc.dueDate || doc.dueDate === this.thirtyDaysFromNow()) {
            doc.dueDate = this.addDays(doc.creationDate || this.today(), preset.dueDays || 30);
        }
        if (company && !company.brandColor) {
            company.brandColor = preset.color;
            company.accentTheme = preset.accentTheme;
        }
        this.addActivity(doc, 'preset', 'Preset applied', preset.name);
        return doc;
    },

    ensureDocumentDefaults(doc, company = null) {
        if (!doc) return doc;
        const preset = this.getBrandPreset(doc.brandPresetId || doc.templateId || company?.defaultPresetId);
        doc.brandPresetId = doc.brandPresetId || preset.id;
        doc.templateId = doc.templateId || preset.templateId;
        doc.brandColor = doc.brandColor || company?.brandColor || preset.color;
        doc.clientMessage = doc.clientMessage || preset.message;
        doc.paymentTerms = doc.paymentTerms || company?.defaultTerms || preset.defaultTerms;
        doc.depositType = doc.depositType || 'none';
        doc.depositValue = parseFloat(doc.depositValue) || 0;
        doc.paymentLink = doc.paymentLink || company?.paymentUrl || '';
        doc.attachments = Array.isArray(doc.attachments) ? doc.attachments : [];
        doc.activity = Array.isArray(doc.activity) ? doc.activity : [];
        doc.lineItems = (doc.lineItems || []).map(item => ({
            itemNote: '',
            ...item,
        }));
        return doc;
    },

    addActivity(doc, type, title, detail = '') {
        if (!doc) return;
        doc.activity = Array.isArray(doc.activity) ? doc.activity : [];
        const last = doc.activity[doc.activity.length - 1];
        if (last && last.type === type && last.title === title && last.detail === detail) return;
        doc.activity.push({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            type,
            title,
            detail,
            date: new Date().toISOString(),
        });
    },

    paymentRequestText(doc, company = {}, payments = []) {
        const total = this.docTotal(doc.lineItems, doc.isTaxEnabled, doc);
        const balance = this.documentBalance(doc, payments);
        const amount = balance || total;
        const link = doc.paymentLink || company.paymentUrl || '';
        return [
            `${doc.documentType === 'estimate' ? 'Estimate' : 'Invoice'} ${doc.documentID}`,
            `Client: ${doc.clientName || 'No client'}`,
            `Amount due: ${this.formatCurrency(amount)}`,
            `Due: ${this.formatDate(doc.dueDate)}`,
            link ? `Pay here: ${link}` : 'Payment link not configured yet.',
        ].join('\n');
    },

    // ── Dark Mode Preferences ──
    getThemePreference() {
        return localStorage.getItem('invoiceMagic_theme') || 'system';
    },
    setThemePreference(theme) {
        localStorage.setItem('invoiceMagic_theme', theme);
        Utils.applyTheme(theme);
    },
    applyTheme(theme) {
        const t = theme || Utils.getThemePreference();
        document.documentElement.removeAttribute('data-theme');
        if (t === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else if (t === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        // 'system' -> no attribute, CSS media queries handle it
    },

    applyAccent(color) {
        if (!color) return;
        document.documentElement.style.setProperty('--color-blue', color);
    },

    // ── Date Formatting ──
    parseDate(dateStr) {
        if (!dateStr) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        return new Date(dateStr);
    },

    formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = this.parseDate(dateStr);
        return d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    },

    // ── Date for input[type=date] ──
    toInputDate(dateStr) {
        if (!dateStr) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        const d = this.parseDate(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    // ── Today's date string ──
    today() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    // ── 30 days from now ──
    thirtyDaysFromNow() {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    addDays(dateStr, days) {
        const d = dateStr ? this.parseDate(dateStr) : new Date();
        d.setDate(d.getDate() + days);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    // ── Check if a date is past due ──
    isOverdue(dateStr) {
        if (!dateStr) return false;
        const due = this.parseDate(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        return due < today;
    },

    // ── Compute line item values ──
    lineSubtotal(item) {
        if (item.type === 'section') return 0;
        return (item.quantity || 0) * (item.unitPrice || 0);
    },

    lineTax(item, isTaxEnabled = true) {
        if (!isTaxEnabled) return 0;
        return this.lineSubtotal(item) * ((item.taxRate || 0) / 100);
    },

    lineTotal(item, isTaxEnabled = true) {
        return this.lineSubtotal(item) + this.lineTax(item, isTaxEnabled);
    },

    // ── Subtotal of the items under a section header (up to the next section) ──
    sectionSubtotal(lineItems, sectionIndex, isTaxEnabled = true) {
        let sum = 0;
        for (let i = sectionIndex + 1; i < (lineItems || []).length; i++) {
            if (lineItems[i].type === 'section') break;
            sum += this.lineTotal(lineItems[i], isTaxEnabled);
        }
        return sum;
    },

    // ── Compute document totals ──
    docSubtotal(lineItems) {
        return (lineItems || []).reduce((sum, item) => sum + this.lineSubtotal(item), 0);
    },

    docTax(lineItems, isTaxEnabled = true) {
        return (lineItems || []).reduce((sum, item) => sum + this.lineTax(item, isTaxEnabled), 0);
    },

    docDiscount(doc) {
        if (!doc) return 0;
        const subtotal = this.docSubtotal(doc.lineItems);
        const value = parseFloat(doc.discountValue) || 0;
        if (value <= 0) return 0;
        if (doc.discountType === 'percent') return subtotal * (value / 100);
        return Math.min(value, subtotal);
    },

    docTotal(lineItems, isTaxEnabled = true, doc = null) {
        const subtotal = this.docSubtotal(lineItems);
        const discount = doc ? this.docDiscount(doc) : 0;
        const taxableItems = (lineItems || []).map(item => {
            if (!discount || subtotal <= 0) return item;
            const share = this.lineSubtotal(item) / subtotal;
            const discountedSubtotal = Math.max(0, this.lineSubtotal(item) - (discount * share));
            return {
                ...item,
                unitPrice: item.quantity ? discountedSubtotal / item.quantity : 0,
            };
        });
        return Math.max(0, subtotal - discount) + this.docTax(taxableItems, isTaxEnabled);
    },

    docDeposit(doc) {
        if (!doc || !doc.depositType || doc.depositType === 'none') return 0;
        const total = this.docTotal(doc.lineItems, doc.isTaxEnabled, doc);
        const value = parseFloat(doc.depositValue) || 0;
        if (value <= 0) return 0;
        if (doc.depositType === 'percent') return total * (value / 100);
        return Math.min(value, total);
    },

    paymentTotal(payments) {
        return (payments || []).reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
    },

    documentPaidTotal(doc, payments = []) {
        if (!doc) return 0;
        const explicit = this.paymentTotal(payments);
        if (explicit > 0) return explicit;
        return doc.status === 'paid' ? this.docTotal(doc.lineItems, doc.isTaxEnabled, doc) : 0;
    },

    documentBalance(doc, payments = []) {
        if (!doc) return 0;
        return Math.max(0, this.docTotal(doc.lineItems, doc.isTaxEnabled, doc) - this.documentPaidTotal(doc, payments));
    },

    isInvoiceOpen(doc, payments = []) {
        return doc && doc.documentType === 'invoice' && this.documentBalance(doc, payments) > 0;
    },

    monthKey(dateStr) {
        const d = dateStr ? this.parseDate(dateStr) : new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    },

    formatHours(minutes) {
        const total = parseFloat(minutes) || 0;
        const hours = Math.floor(total / 60);
        const mins = Math.round(total % 60);
        if (hours && mins) return `${hours}h ${mins}m`;
        if (hours) return `${hours}h`;
        return `${mins}m`;
    },

    statusForDocument(doc, payments = []) {
        if (!doc) return 'draft';
        const paid = this.documentPaidTotal(doc, payments);
        const total = this.docTotal(doc.lineItems, doc.isTaxEnabled, doc);
        if (doc.documentType === 'invoice' && this.documentBalance(doc, payments) <= 0 && this.docTotal(doc.lineItems, doc.isTaxEnabled, doc) > 0) {
            return 'paid';
        }
        if (doc.documentType === 'invoice' && paid > 0 && paid < total) return 'partial';
        if (doc.status !== 'paid' && doc.status !== 'accepted' && this.isOverdue(doc.dueDate)) return 'overdue';
        return doc.status || 'draft';
    },

    // ── Status metadata ──
    statusMeta(status) {
        const map = {
            draft:    { label: 'Draft',    icon: '📄', cssClass: 'draft',    color: 'secondary' },
            sent:     { label: 'Sent',     icon: '✈️', cssClass: 'sent',     color: 'blue' },
            viewed:   { label: 'Viewed',   icon: '👁️', cssClass: 'viewed',   color: 'blue' },
            partial:  { label: 'Partial',  icon: '◐', cssClass: 'partial',  color: 'orange' },
            paid:     { label: 'Paid',     icon: '✅', cssClass: 'paid',     color: 'green' },
            signed:   { label: 'Signed',   icon: '✍️', cssClass: 'signed',   color: 'green' },
            accepted: { label: 'Accepted', icon: '👍', cssClass: 'accepted', color: 'purple' },
            overdue:  { label: 'Overdue',  icon: '⚠️', cssClass: 'overdue',  color: 'orange' },
        };
        return map[status] || map.draft;
    },

    // ── Short client code for per-client document numbering ──
    // "John Smith" → "JS", "Acme" → "ACM", "3M Corp" → "3C"
    clientCode(name) {
        const clean = (name || '').replace(/[^A-Za-z0-9\s]/g, ' ').trim();
        if (!clean) return 'CLI';
        const words = clean.split(/\s+/);
        let code = words.map(w => w[0]).join('').toUpperCase();
        if (code.length < 2) {
            code = clean.replace(/\s+/g, '').toUpperCase().slice(0, 3);
        }
        return code.slice(0, 3);
    },

    // ── Generate initials from name ──
    initials(name) {
        if (!name) return '?';
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    },

    // ── Debounce ──
    debounce(func, wait = 300) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(null, args), wait);
        };
    },

    // ── Create a blank document template ──
    createBlankDocument(type, documentID, presetId = 'apple-clean') {
        const preset = this.getBrandPreset(presetId);
        return {
            documentID: documentID,
            documentType: type,
            templateId: preset.templateId,
            brandPresetId: preset.id,
            brandColor: preset.color,
            status: 'draft',
            creationDate: this.today(),
            dueDate: this.addDays(this.today(), preset.dueDays || 30),
            notes: '',
            clientMessage: preset.message,
            clientId: null,
            clientName: '',
            isTaxEnabled: true,
            discountType: 'none',
            discountValue: 0,
            depositType: 'none',
            depositValue: 0,
            paymentLink: '',
            paymentTerms: preset.defaultTerms,
            recurring: 'none',
            attachments: [],
            activity: [{
                id: `${Date.now()}-created`,
                type: 'created',
                title: `${type === 'invoice' ? 'Invoice' : 'Estimate'} created`,
                detail: preset.name,
                date: new Date().toISOString(),
            }],
            lineItems: [
                { itemDescription: '', itemNote: '', quantity: 1, unitPrice: 0, taxRate: 0 }
            ],
        };
    },

    // ── Deep clone a document for conversion ──
    cloneDocumentForConversion(estimate, newDocID) {
        return {
            documentID: newDocID,
            documentType: 'invoice',
            templateId: estimate.templateId || 'modern',
            brandPresetId: estimate.brandPresetId || this.getPresetForTemplate(estimate.templateId || 'modern').id,
            brandColor: estimate.brandColor || this.getBrandPreset(estimate.brandPresetId || estimate.templateId).color,
            status: 'draft',
            creationDate: this.today(),
            dueDate: this.thirtyDaysFromNow(),
            notes: estimate.notes || '',
            clientMessage: estimate.clientMessage || '',
            clientId: estimate.clientId,
            clientName: estimate.clientName || '',
            isTaxEnabled: estimate.isTaxEnabled !== false,
            discountType: estimate.discountType || 'none',
            discountValue: estimate.discountValue || 0,
            depositType: estimate.depositType || 'none',
            depositValue: estimate.depositValue || 0,
            paymentLink: estimate.paymentLink || '',
            paymentTerms: estimate.paymentTerms || 'Payment due within 30 days.',
            recurring: 'none',
            attachments: (estimate.attachments || []).map(item => ({ ...item })),
            activity: [{
                id: `${Date.now()}-converted`,
                type: 'converted',
                title: 'Converted from estimate',
                detail: estimate.documentID || '',
                date: new Date().toISOString(),
            }],
            lineItems: (estimate.lineItems || []).map(item => ({
                type: item.type || 'item',
                itemDescription: item.itemDescription,
                itemNote: item.itemNote || '',
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate,
            })),
        };
    },

    // ── Escape HTML ──
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ── Haptic Feedback ──
    haptic(type = 'light') {
        if ('vibrate' in navigator) {
            const patterns = {
                light: 10,
                medium: 20,
                heavy: 30,
                success: [10, 50, 20],
                error: [30, 50, 30, 50, 30],
            };
            navigator.vibrate(patterns[type] || 10);
        }
    },
};
