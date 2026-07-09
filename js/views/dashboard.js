// ============================================================
// dashboard.js — Business Home View
// ============================================================

const DashboardView = {
    async render(container) {
        const [docs, clients, payments, expenses, timeEntries, mileageEntries] = await Promise.all([
            db.getAllDocuments(),
            db.getAllClients(),
            db.getAllPayments(),
            db.getAllExpenses(),
            db.getAllTimeEntries(),
            db.getAllMileageEntries(),
        ]);

        const paymentMap = this._paymentsByDocument(payments);
        const invoices = docs.filter(d => d.documentType === 'invoice');
        const estimates = docs.filter(d => d.documentType === 'estimate');
        const openInvoices = invoices.filter(d => Utils.documentBalance(d, paymentMap[d.id]) > 0);
        const unpaidTotal = openInvoices.reduce((sum, d) => sum + Utils.documentBalance(d, paymentMap[d.id]), 0);
        const overdue = openInvoices.filter(d => Utils.isOverdue(d.dueDate));
        const drafts = docs.filter(d => (d.status || 'draft') === 'draft');
        const dueSoon = openInvoices.filter(d => !Utils.isOverdue(d.dueDate) && new Date(d.dueDate) <= new Date(Utils.addDays(Utils.today(), 7)));
        const readyBillables = [
            ...expenses.filter(e => e.billable && !e.documentId),
            ...timeEntries.filter(e => e.billable !== false && !e.documentId),
            ...mileageEntries.filter(e => !e.documentId),
        ];
        const currentMonth = Utils.monthKey();
        const paidThisMonth = payments
            .filter(p => Utils.monthKey(p.paymentDate) === currentMonth)
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const expensesThisMonth = expenses
            .filter(e => Utils.monthKey(e.expenseDate) === currentMonth)
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const billableMinutes = timeEntries
            .filter(e => e.billable !== false)
            .reduce((sum, e) => sum + (parseFloat(e.minutes) || 0), 0);
        const totalMiles = mileageEntries.reduce((sum, e) => sum + (parseFloat(e.miles) || 0), 0);

        container.innerHTML = `
            <div class="dashboard view-enter">
                ${docs.length === 0 ? this._renderOnboarding() : ''}

                <div class="hero-panel">
                    <div>
                        <div class="hero-kicker">Business Snapshot</div>
                        <div class="hero-title">${Utils.formatCurrency(paidThisMonth - expensesThisMonth)}</div>
                        <div class="hero-subtitle">Estimated net this month</div>
                    </div>
                    <div class="hero-pill">${clients.length} clients</div>
                </div>

                <div class="metric-grid">
                    ${this._metric('Unpaid', Utils.formatCurrency(unpaidTotal), overdue.length ? `${overdue.length} overdue` : 'All current', overdue.length ? 'danger' : 'primary')}
                    ${this._metric('Paid Month', Utils.formatCurrency(paidThisMonth), `${payments.length} payments`, 'success')}
                    ${this._metric('Expenses', Utils.formatCurrency(expensesThisMonth), 'This month', 'warning')}
                    ${this._metric('Pipeline', Utils.formatCurrency(estimates.reduce((sum, d) => sum + Utils.docTotal(d.lineItems, d.isTaxEnabled, d), 0)), `${estimates.length} estimates`, 'purple')}
                </div>

                <div class="quick-actions">
                    <button class="quick-action-btn" data-create="invoice">
                        <span class="quick-action-icon">+</span>
                        <span>Invoice</span>
                    </button>
                    <button class="quick-action-btn" data-create="estimate">
                        <span class="quick-action-icon">+</span>
                        <span>Estimate</span>
                    </button>
                    <button class="quick-action-btn" data-nav="clients">
                        <span class="quick-action-icon">◎</span>
                        <span>Client</span>
                    </button>
                    <button class="quick-action-btn" data-nav="tools">
                        <span class="quick-action-icon">▦</span>
                        <span>Tools</span>
                    </button>
                </div>

                <div class="command-strip">
                    ${this._command('Overdue', overdue.length, overdue.length ? 'danger' : 'success')}
                    ${this._command('Due Soon', dueSoon.length, dueSoon.length ? 'warning' : 'primary')}
                    ${this._command('Drafts', drafts.length, drafts.length ? 'primary' : 'success')}
                    ${this._command('Billables', readyBillables.length, readyBillables.length ? 'warning' : 'success')}
                </div>

                <div class="ios-form">
                    <div class="ios-section">
                        <div class="ios-section-header">Attention</div>
                        <div class="ios-section-content">
                            ${overdue.length ? overdue.slice(0, 4).map(doc => this._renderAttentionRow(doc, paymentMap[doc.id])).join('') : `
                                <div class="insight-row">
                                    <div class="insight-icon success">✓</div>
                                    <div class="insight-body">
                                        <div class="insight-title">No overdue invoices</div>
                                        <div class="insight-subtitle">Your receivables are clean right now.</div>
                                    </div>
                                </div>
                            `}
                        </div>
                    </div>

                    <div class="ios-section">
                        <div class="ios-section-header">Workload</div>
                        <div class="ios-section-content">
                            <div class="insight-row">
                                <div class="insight-icon primary">⌚</div>
                                <div class="insight-body">
                                    <div class="insight-title">${Utils.formatHours(billableMinutes)} billable time</div>
                                    <div class="insight-subtitle">Ready to turn into invoice line items.</div>
                                </div>
                            </div>
                            <div class="insight-row">
                                <div class="insight-icon warning">↗</div>
                                <div class="insight-body">
                                    <div class="insight-title">${totalMiles.toFixed(1)} business miles</div>
                                    <div class="insight-subtitle">Track mileage for reimbursements and records.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="ios-section">
                        <div class="ios-section-header">Recent Documents</div>
                        <div class="ios-section-content">
                            ${docs.length ? docs.slice(0, 6).map(doc => this._renderDocRow(doc, paymentMap[doc.id])).join('') : `
                                <div class="empty-inline">Create an invoice or estimate to start building history.</div>
                            `}
                        </div>
                    </div>

                    ${this._renderCloudCTA()}
                </div>
            </div>
        `;

        container.querySelectorAll('[data-create]').forEach(btn => {
            btn.addEventListener('click', () => {
                App.showDocumentComposer(btn.dataset.create);
            });
        });
        container.querySelectorAll('[data-nav]').forEach(btn => {
            btn.addEventListener('click', () => App.navigate(btn.dataset.nav));
        });
        container.querySelectorAll('[data-doc-id]').forEach(row => {
            row.addEventListener('click', () => App.navigateToEditor(parseInt(row.dataset.docId, 10)));
        });

        const googleBtn = container.querySelector('#home-google-signin');
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                googleBtn.disabled = true;
                try {
                    await CloudSync.signInWithGoogle();
                } catch (err) {
                    Toast.show(CloudSync.friendlyAuthError(err), 'error');
                    googleBtn.disabled = false;
                }
            });
        }

        // Re-render Home when the user signs in/out so the button updates
        if (typeof CloudSync !== 'undefined' && CloudSync.isReady()) {
            CloudSync.onAuthChanged = () => {
                if (App._currentView === 'dashboard') DashboardView.render(container);
            };
        }
    },

    // ── Cloud sign-in call-to-action (bottom of Home) ──
    _renderCloudCTA() {
        const cloud = typeof CloudSync !== 'undefined' ? CloudSync : null;
        if (!cloud || !cloud.isReady()) return '';

        if (cloud.isSignedIn()) {
            return `
                <div class="ios-section" style="margin-bottom: 40px;">
                    <div class="ios-section-content">
                        <div class="cloud-home-status">
                            <span class="cloud-home-check">✓</span>
                            <div class="cloud-home-text">
                                <strong>Backed up to cloud</strong>
                                <span>${Utils.escapeHtml(cloud.userEmail())}</span>
                            </div>
                            <button class="cloud-home-manage" data-tab="settings">Manage</button>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="ios-section" style="margin-bottom: 40px;">
                <button class="google-signin-btn" id="home-google-signin">
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                    Sign in with Google to back up
                </button>
                <div class="ios-section-footer">Save your invoices, estimates, and clients to the cloud so you never lose them. You can also use email in Settings.</div>
            </div>
        `;
    },

    _paymentsByDocument(payments) {
        return payments.reduce((map, payment) => {
            const key = payment.documentId;
            if (!map[key]) map[key] = [];
            map[key].push(payment);
            return map;
        }, {});
    },

    _metric(label, value, detail, tone) {
        return `
            <div class="metric-card ${tone || ''}">
                <div class="metric-label">${label}</div>
                <div class="metric-value">${value}</div>
                <div class="metric-detail">${detail}</div>
            </div>
        `;
    },

    _command(label, value, tone) {
        return `
            <div class="command-pill ${tone || ''}">
                <strong>${value}</strong>
                <span>${label}</span>
            </div>
        `;
    },

    _renderOnboarding() {
        return `
            <div class="setup-card">
                <div class="setup-eyebrow">Setup checklist</div>
                <div class="setup-title">Make Invoice Magic feel ready for real work.</div>
                <div class="setup-list">
                    <button data-nav="settings">Add business profile</button>
                    <button data-nav="tools">Create service catalog</button>
                    <button data-create="invoice">Send first invoice</button>
                </div>
            </div>
        `;
    },

    _renderAttentionRow(doc, payments) {
        return `
            <div class="insight-row interactive" data-doc-id="${doc.id}">
                <div class="insight-icon danger">!</div>
                <div class="insight-body">
                    <div class="insight-title">${Utils.escapeHtml(doc.clientName || 'No Client')} owes ${Utils.formatCurrency(Utils.documentBalance(doc, payments))}</div>
                    <div class="insight-subtitle">${Utils.escapeHtml(doc.documentID)} was due ${Utils.formatDate(doc.dueDate)}</div>
                </div>
            </div>
        `;
    },

    _renderDocRow(doc, payments) {
        const status = Utils.statusForDocument(doc, payments);
        const meta = Utils.statusMeta(status);
        return `
            <div class="compact-row" data-doc-id="${doc.id}">
                <div class="compact-icon ${meta.cssClass}">${meta.icon}</div>
                <div class="compact-body">
                    <div class="compact-title">${Utils.escapeHtml(doc.clientName || 'No Client')}</div>
                    <div class="compact-subtitle">${Utils.escapeHtml(doc.documentID)} · ${meta.label}</div>
                </div>
                <div class="compact-value">${Utils.formatCurrency(Utils.docTotal(doc.lineItems, doc.isTaxEnabled, doc))}</div>
            </div>
        `;
    },
};
