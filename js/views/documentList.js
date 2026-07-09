// ============================================================
// documentList.js — Invoice/Estimate List View
// ============================================================
// Renders a filtered, sorted list of documents with status
// badges, amount totals, search, and swipe-to-delete.
// Mirrors the native iOS grouped-list aesthetic.
// ============================================================

const DocumentListView = {
    _currentType: null,
    _allDocs: [],
    _searchQuery: '',
    _swipeCloseBound: false,

    // ── Render the full list view ──
    async render(container, documentType) {
        this._currentType = documentType;
        this._allDocs = await db.getDocumentsByType(documentType);
        this._searchQuery = '';
        const typeLabel = documentType === 'invoice' ? 'Invoice' : 'Estimate';
        const typePlural = typeLabel + 's';

        // Build the search bar + list container
        container.innerHTML = `
            <div class="search-container" id="search-bar-wrap">
                <div class="search-input-wrapper">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="search-input" id="search-input" placeholder="Search ${typePlural.toLowerCase()}…" autocomplete="off">
                    <button class="search-clear" id="search-clear" aria-label="Clear search">✕</button>
                </div>
            </div>
            <div id="doc-list-content"></div>
        `;

        // Render the initial list
        this._renderList(container);

        // Bind search events
        const searchInput = container.querySelector('#search-input');
        const searchClear = container.querySelector('#search-clear');

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

        // Add the FAB
        this._addFAB(container, documentType);
    },

    // ── Render the list content (filtered) ──
    _renderList(container) {
        const listContainer = container.querySelector('#doc-list-content');
        const typeLabel = this._currentType === 'invoice' ? 'Invoice' : 'Estimate';
        const typePlural = typeLabel + 's';

        // Filter by search query
        let docs = this._allDocs;
        if (this._searchQuery) {
            docs = docs.filter(doc => {
                const searchable = [
                    doc.clientName,
                    doc.documentID,
                    Utils.statusMeta(Utils.statusForDocument(doc)).label,
                    Utils.formatCurrency(Utils.docTotal(doc.lineItems, doc.isTaxEnabled, doc)),
                ].join(' ').toLowerCase();
                return searchable.includes(this._searchQuery);
            });
        }

        if (this._allDocs.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">${this._currentType === 'invoice' ? '📄' : '📋'}</div>
                    <div class="empty-state-title">No ${typePlural}</div>
                    <div class="empty-state-description">
                        Tap the + button to create your first ${typeLabel.toLowerCase()}.
                    </div>
                </div>
            `;
        } else if (docs.length === 0) {
            listContainer.innerHTML = `
                <div class="no-results">No results for "${Utils.escapeHtml(this._searchQuery)}"</div>
            `;
        } else {
            // Summary stats
            const totalAmount = docs.reduce((sum, d) => sum + Utils.docTotal(d.lineItems, d.isTaxEnabled, d), 0);
            const overdueCount = this._currentType === 'invoice'
                ? docs.filter(d => d.status !== 'paid' && d.status !== 'accepted' && Utils.isOverdue(d.dueDate)).length
                : 0;

            const listHtml = docs.map(doc => this._renderRow(doc)).join('');
            listContainer.innerHTML = `
                <!-- Summary Cards -->
                <div class="list-summary">
                    <div class="summary-card">
                        <div class="summary-value">${docs.length}</div>
                        <div class="summary-label">${docs.length === 1 ? typeLabel : typePlural}</div>
                    </div>
                    <div class="summary-card summary-card-primary">
                        <div class="summary-value">${Utils.formatCurrency(totalAmount)}</div>
                        <div class="summary-label">Total</div>
                    </div>
                    ${overdueCount > 0 ? `
                    <div class="summary-card summary-card-danger">
                        <div class="summary-value">${overdueCount}</div>
                        <div class="summary-label">Overdue</div>
                    </div>
                    ` : ''}
                </div>

                <div class="ios-form">
                    <div class="ios-section" style="margin-top: 8px;">
                        <div class="ios-section-header">${docs.length} ${docs.length === 1 ? typeLabel : typePlural}</div>
                        <div class="ios-section-content">
                            ${listHtml}
                        </div>
                    </div>
                </div>
            `;

            // Bind row click + swipe handlers
            this._bindRowEvents(container);
        }
    },

    // ── Single document row (wrapped for swipe) ──
    _renderRow(doc) {
        const effectiveStatus = Utils.statusForDocument(doc);
        const meta = Utils.statusMeta(effectiveStatus);
        const clientName = Utils.escapeHtml(doc.clientName || 'No Client');
        const total = Utils.formatCurrency(Utils.docTotal(doc.lineItems, doc.isTaxEnabled, doc));
        const date = Utils.formatDate(doc.creationDate);
        const docNum = Utils.escapeHtml(doc.documentID || '—');

        return `
            <div class="swipe-row-wrapper" data-id="${doc.id}">
                <div class="swipe-delete-action" data-delete-id="${doc.id}">Delete</div>
                <div class="doc-row" data-id="${doc.id}">
                    <div class="doc-row-icon ${meta.cssClass}">
                        ${meta.icon}
                    </div>
                    <div class="doc-row-body">
                        <div class="doc-row-title">${clientName}</div>
                        <div class="doc-row-sub">
                            ${docNum}
                            <span class="status-dot ${meta.cssClass}"></span>
                            <span class="text-${meta.color === 'secondary' ? 'secondary' : meta.color}">${meta.label}</span>
                        </div>
                    </div>
                    <div class="doc-row-right">
                        <div class="doc-row-amount">${total}</div>
                        <div class="doc-row-date">${date}</div>
                    </div>
                </div>
            </div>
        `;
    },

    // ── Bind row click & swipe ──
    _bindRowEvents(container) {
        // Click to open
        container.querySelectorAll('.doc-row').forEach(row => {
            row.addEventListener('click', () => {
                const wrapper = row.closest('.swipe-row-wrapper');
                if (wrapper && wrapper.classList.contains('swiped')) return;
                const docId = parseInt(row.dataset.id, 10);
                Utils.haptic('light');
                App.navigateToEditor(docId);
            });
        });

        // Swipe-to-delete touch gestures
        container.querySelectorAll('.swipe-row-wrapper').forEach(wrapper => {
            let startX = 0;
            let startY = 0;
            let dx = 0;
            let isSwiping = false;
            let moved = false;
            const row = wrapper.querySelector('.doc-row');
            const threshold = 60;

            wrapper.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                dx = 0;
                moved = false;
                isSwiping = true;
                row.style.transition = 'none';
            }, { passive: true });

            wrapper.addEventListener('touchmove', (e) => {
                if (!isSwiping) return;
                dx = e.touches[0].clientX - startX;
                const dy = e.touches[0].clientY - startY;
                // Only count as a swipe once the finger actually moves
                if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
                const clamped = Math.min(0, Math.max(-80, dx));
                row.style.transform = `translateX(${clamped}px)`;
            }, { passive: true });

            wrapper.addEventListener('touchend', () => {
                if (!isSwiping) return;
                isSwiping = false;
                row.style.transition = '';
                // A clean tap (no movement) must never register as a swipe —
                // otherwise the click handler treats it as swiped and won't open.
                if (moved && dx < -threshold) {
                    wrapper.classList.add('swiped');
                    row.style.transform = '';
                    Utils.haptic('medium');
                    // Auto-close other swiped rows
                    container.querySelectorAll('.swipe-row-wrapper.swiped').forEach(w => {
                        if (w !== wrapper) {
                            w.classList.remove('swiped');
                        }
                    });
                } else {
                    wrapper.classList.remove('swiped');
                    row.style.transform = '';
                }
            });
        });

        // Delete button tap
        container.querySelectorAll('.swipe-delete-action').forEach(btn => {
            btn.addEventListener('click', async () => {
                const docId = parseInt(btn.dataset.deleteId, 10);
                const doc = await db.getDocument(docId);
                const typeLabel = doc ? (doc.documentType === 'invoice' ? 'Invoice' : 'Estimate') : 'Document';
                await db.deleteDocument(docId);
                this._allDocs = this._allDocs.filter(d => d.id !== docId);
                Utils.haptic('success');
                this._renderList(container);
                Toast.show(`${typeLabel} deleted`, 'success');
            });
        });

        // Close swiped rows when tapping elsewhere.
        // Bound once for the app lifetime (this runs on every re-render).
        if (!DocumentListView._swipeCloseBound) {
            DocumentListView._swipeCloseBound = true;
            document.addEventListener('touchstart', (e) => {
                if (!e.target.closest('.swipe-row-wrapper')) {
                    document.querySelectorAll('.swipe-row-wrapper.swiped').forEach(w => {
                        w.classList.remove('swiped');
                    });
                }
            }, { passive: true });
        }
    },

    // ── Floating Action Button ──
    _addFAB(container, documentType) {
        // Remove existing FAB
        document.querySelectorAll('.fab').forEach(f => f.remove());

        const fab = document.createElement('button');
        fab.className = 'fab';
        fab.setAttribute('aria-label', `New ${documentType === 'invoice' ? 'Invoice' : 'Estimate'}`);
        fab.innerHTML = '+';
        fab.addEventListener('click', () => {
            Utils.haptic('medium');
            App.showDocumentComposer(documentType);
        });
        document.getElementById('app').appendChild(fab);
    },

    // ── Remove FAB when leaving view ──
    removeFAB() {
        document.querySelectorAll('.fab').forEach(f => f.remove());
    },
};
