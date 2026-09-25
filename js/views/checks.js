// ============================================================
// checks.js — Write and print business checks
// ============================================================
// Prints onto PRE-PRINTED laser check stock (the Chase "Laser
// QuickBooks" voucher pack). The bank name, business name and the
// magnetic MICR line are already on the paper; this only adds the
// variable fields — date, payee, amount, amount in words, memo.
//
// It deliberately does NOT print:
//   • the signature   — signed by hand, in pen, every time
//   • the check number — pre-printed on the stock. Alex types the
//     number that is on the sheet he is feeding, so the register
//     matches the paper instead of inventing a parallel sequence.
//
// The register is half the point. A printed check with no record of
// which number went to whom is a question that cannot be answered at
// reconciliation time.
// ============================================================

const ChecksView = {
    /* Field positions in INCHES from the top-left corner of the page.
       These are STARTING ESTIMATES for standard voucher stock, not gospel —
       vendors vary by a sixteenth or two. Alex corrects the whole layout with
       the calibration offset rather than editing these, which is why every
       position is relative to the same origin. */
    FIELDS: {
        date:        { x: 6.40, y: 0.85, size: 11 },
        payee:       { x: 0.90, y: 1.35, size: 12 },
        amountNum:   { x: 6.55, y: 1.35, size: 12, bold: true },
        amountWords: { x: 0.55, y: 1.78, size: 11 },
        memo:        { x: 0.65, y: 2.75, size: 10 },
    },
    /* Rules under each field, for handwriting a check in the field. Derived
       from the same page origin as FIELDS above, so the alignment Alex has
       already dialled in carries the lines with it — no second calibration.
       `dy` drops the rule below the text baseline; `from`/`to` are the span. */
    GUIDES: {
        date:        { from: 6.30, to: 7.95, dy: 0.22 },
        payee:       { from: 0.85, to: 6.35, dy: 0.24 },
        amountWords: { from: 0.50, to: 7.95, dy: 0.24 },
        memo:        { from: 0.60, to: 3.80, dy: 0.22 },
    },

    /* Voucher stock is one letter sheet in three bands. The stubs are plain
       paper — nothing has to go on them, but job/invoice detail there is what
       makes a check answerable six months later. */
    STUB_TOPS: [3.55, 7.05],

    /* Check fields and stubs move independently. They are printed in one pass
       on one sheet, but they line up against different things: the check
       against pre-printed rules the bank reads, the stubs against nothing at
       all. Sharing one offset meant correcting the check pushed the stubs out
       of the paper's own bands. */
    _layout(company) {
        const saved = (company && company.checkLayout) || {};
        const num = (v, dflt = 0) => (Number.isFinite(+v) ? +v : dflt);
        return {
            offsetX: num(saved.offsetX),
            offsetY: num(saved.offsetY),
            // Fall back to the check offset so a layout saved before stubs were
            // separately adjustable keeps printing exactly where it did.
            stubOffsetX: saved.stubOffsetX === undefined ? num(saved.offsetX) : num(saved.stubOffsetX),
            stubOffsetY: saved.stubOffsetY === undefined ? num(saved.offsetY) : num(saved.stubOffsetY),
            stubLogo: saved.stubLogo !== false,
            stubLogoHeight: num(saved.stubLogoHeight, 0.45),
            /* Measured from the CENTRE of each stub, not the page corner —
               "put it in the middle and move from there" is how you place a
               watermark, and it keeps both stubs identical without two sets of
               numbers. */
            stubLogoX: num(saved.stubLogoX),
            stubLogoY: num(saved.stubLogoY),
            /* Faint by default: centred at full strength it would sit under the
               payee and amount and make them unreadable. Raise it for a logo
               parked off to the side. */
            stubLogoOpacity: num(saved.stubLogoOpacity, 0.15),
            /* Off by default. Software-printed checks don't need a guide, and
               the stock Alex bought has none — adding them is a choice, not a
               correction. */
            guideLines: saved.guideLines === true,
        };
    },

    /* Each stub band is a letter page wide and STUB_HEIGHT tall; the logo hangs
       off the centre of that box. */
    STUB_HEIGHT: 3.5,
    PAGE_WIDTH: 8.5,

    // ── The Tools section ──
    sectionHtml(checks) {
        const recent = (checks || []).slice(0, 6);
        return `
            <div class="ios-section">
                <div class="ios-section-header">Checks</div>
                <div class="ios-section-content">
                    <div class="check-actions">
                        <button class="settings-action-btn settings-action-export" id="write-check">+ Write Check</button>
                        <button class="settings-action-btn settings-action-import" id="calibrate-checks">Align Printer</button>
                        <button class="settings-action-btn settings-action-import" id="stub-logo">Stub Logo</button>
                        <button class="settings-action-btn settings-action-import" id="guide-lines">Guide Lines</button>
                    </div>
                    ${recent.length ? recent.map(c => `
                        <div class="compact-row check-row ${c.voided ? 'is-void' : ''}" data-edit-check="${c.id}">
                            <div class="compact-icon ${c.voided ? 'warning' : 'primary'}">#</div>
                            <div class="compact-body">
                                <div class="compact-title">${Utils.escapeHtml(c.payee || 'No payee')}${c.voided ? ' — VOID' : ''}</div>
                                <div class="compact-subtitle">#${Utils.escapeHtml(c.checkNumber || '—')} · ${Utils.formatDate(c.checkDate)}${c.memo ? ' · ' + Utils.escapeHtml(c.memo) : ''}</div>
                            </div>
                            <div class="compact-value">${Utils.formatCurrency(c.amount)}</div>
                            ${c.voided ? '' : `<button class="check-print-btn" data-print-check="${c.id}">Print</button>`}
                        </div>
                    `).join('') : '<div class="empty-inline">Print onto pre-printed check stock. Align the printer once before using real checks.</div>'}
                </div>
            </div>
        `;
    },

    bind(container, state, onChange) {
        const write = container.querySelector('#write-check');
        if (write) write.addEventListener('click', () => this._showCheckModal(state, onChange));

        const cal = container.querySelector('#calibrate-checks');
        if (cal) cal.addEventListener('click', () => this._showCalibration(state, onChange));

        const logo = container.querySelector('#stub-logo');
        if (logo) logo.addEventListener('click', () => this._showLogoModal(state, onChange));

        const guides = container.querySelector('#guide-lines');
        if (guides) guides.addEventListener('click', () => this._showGuidesModal(state, onChange));

        container.querySelectorAll('[data-print-check]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const check = (state.checks || []).find(c => c.id === parseInt(btn.dataset.printCheck, 10));
                if (check) this.print(check, state.company);
            });
        });

        /* Delete and Void both live in the edit sheet rather than as a row
           button. Deleting breaks the register — the one thing the register
           exists to prevent — so it should take a deliberate look at the check
           first, with Void sitting right next to it. */
        container.querySelectorAll('[data-edit-check]').forEach(row => {
            row.addEventListener('click', () => {
                const check = (state.checks || []).find(c => c.id === parseInt(row.dataset.editCheck, 10));
                if (check) this._showCheckModal(state, onChange, check);
            });
        });
    },

    // ── Write / edit ──
    /* One form for both. A separate edit modal would duplicate the
       amount-in-words preview and the validation, and those two are exactly
       where a check must not drift between code paths. */
    _showCheckModal(state, onChange, existing = null) {
        const editing = !!existing;
        const c = existing || {};

        const overlay = this._sheet(`
            <div class="modal-title">${editing ? 'Edit Check' : 'Write Check'}</div>
            <div class="modal-form">
                <label>Check number<input id="check-number" inputmode="numeric"
                    placeholder="the number printed on the sheet" value="${Utils.escapeHtml(c.checkNumber || '')}"></label>
                <label>Pay to the order of<input id="check-payee" placeholder="Sherwin-Williams"
                    value="${Utils.escapeHtml(c.payee || '')}"></label>
                <label>Amount<input id="check-amount" type="number" step="0.01" min="0"
                    value="${c.amount != null ? c.amount : 0}"></label>
                <label>Date<input id="check-date" type="date" value="${Utils.escapeHtml(c.checkDate || Utils.today())}"></label>
                <label>Memo<input id="check-memo" placeholder="Job address or invoice #"
                    value="${Utils.escapeHtml(c.memo || '')}"></label>
                ${editing ? `
                    <label class="modal-check"><input type="checkbox" id="check-void" ${c.voided ? 'checked' : ''}>
                        Voided — keeps the number in the register</label>
                ` : ''}
            </div>
            <div class="modal-message" id="check-words-preview" style="text-align:left;"></div>
            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="save-print-check">Save &amp; Print</button>
                <div class="modal-actions-row">
                    <button class="modal-action-btn" id="save-check">Save${editing ? '' : ' Only'}</button>
                    <button class="modal-action-btn modal-action-cancel" id="cancel-check">Cancel</button>
                </div>
                ${editing ? `<button class="modal-action-btn modal-action-destructive" id="delete-check">Delete</button>` : ''}
            </div>
        `);

        const q = (sel) => overlay.querySelector(sel);
        const amountEl = q('#check-amount');
        const preview = q('#check-words-preview');
        const voidEl = q('#check-void');
        const printBtn = q('#save-print-check');

        /* Show the written amount as it is typed. It is the legal amount on a
           check — where words and figures disagree, the words are paid — so it
           should never be a surprise that only appears on paper. */
        const refresh = () => {
            const v = parseFloat(amountEl.value) || 0;
            preview.textContent = v > 0 ? Utils.amountInWords(v) : '';
            // A voided check must not be printable. Printing one would put a
            // second piece of paper into the world carrying a number the
            // register says is dead.
            if (voidEl) printBtn.style.display = voidEl.checked ? 'none' : '';
        };
        amountEl.addEventListener('input', refresh);
        if (voidEl) voidEl.addEventListener('change', refresh);
        refresh();

        q('#cancel-check').addEventListener('click', () => overlay.remove());

        const collect = () => {
            const payee = q('#check-payee').value.trim();
            const amount = parseFloat(amountEl.value) || 0;
            if (!payee) { Toast.show('Payee required', 'error'); return null; }
            if (amount <= 0) { Toast.show('Amount must be more than zero', 'error'); return null; }
            return {
                // Carry the id and anything else the record already holds, so
                // editing never quietly drops a field added later.
                ...c,
                checkNumber: q('#check-number').value.trim(),
                payee,
                amount,
                checkDate: q('#check-date').value || Utils.today(),
                memo: q('#check-memo').value.trim(),
                voided: voidEl ? voidEl.checked : !!c.voided,
                createdAt: c.createdAt || new Date().toISOString(),
            };
        };

        const save = async (thenPrint) => {
            const check = collect();
            if (!check) return;
            const id = await db.saveCheck(check);
            overlay.remove();
            Toast.show(editing ? 'Check updated' : 'Check saved', 'success');
            if (thenPrint) this.print({ ...check, id: check.id || id }, state.company);
            onChange();
        };

        q('#save-check').addEventListener('click', () => save(false));
        printBtn.addEventListener('click', () => save(true));

        const del = q('#delete-check');
        if (del) del.addEventListener('click', async () => {
            if (!confirm('Delete this check from the register?\n\nIf the paper check was printed, tick Voided instead — that keeps the number in your records, which is what reconciliation needs.')) return;
            await db.deleteCheck(c.id);
            overlay.remove();
            Toast.show('Removed from register', 'success');
            onChange();
        });
    },

    // ── Calibration ──
    /* One nudge = 1/16", which is about the smallest shift worth making and
       lines up with how check stock is actually off. */
    NUDGE: 0.0625,

    /* Arrows rather than a bare number box. Moving something UP or LEFT means a
       negative offset, and "type -0.1875" is a miserable instruction to follow
       on a phone keyboard while standing at a printer. The field stays editable
       for anyone who knows the exact number they want. */
    _nudgeRow(label, id, negLabel, posLabel, value) {
        return `
            <div class="nudge-row">
                <span class="nudge-label">${label}</span>
                <button type="button" class="nudge-btn" data-nudge="${id}:-1">${negLabel}</button>
                <input id="${id}" type="number" step="${this.NUDGE}" value="${value}">
                <button type="button" class="nudge-btn" data-nudge="${id}:1">${posLabel}</button>
            </div>`;
    },

    _showCalibration(state, onChange) {
        const layout = this._layout(state.company);

        const overlay = this._sheet(`
            <div class="modal-title">Printer Alignment</div>
            <div class="modal-message" style="text-align:left;">
                Test on <strong>plain paper</strong>, hold it against a real check at a window, then nudge.
                Each tap is a sixteenth of an inch.
                <strong>Print at 100%</strong>, “Fit to Page” off, or no offset can help.
            </div>

            <div class="cal-group-title">Check — date, payee, amount</div>
            ${this._nudgeRow('Across', 'cal-x', '← Left', 'Right →', layout.offsetX)}
            ${this._nudgeRow('Up / down', 'cal-y', '↑ Up', 'Down ↓', layout.offsetY)}

            <div class="cal-group-title">Stubs — the two tear-off records</div>
            ${this._nudgeRow('Across', 'cal-sx', '← Left', 'Right →', layout.stubOffsetX)}
            ${this._nudgeRow('Up / down', 'cal-sy', '↑ Up', 'Down ↓', layout.stubOffsetY)}


            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="cal-test">Print Test Page</button>
                <button class="modal-action-btn" id="cal-save">Save Alignment</button>
                <button class="modal-action-btn modal-action-cancel" id="cal-cancel">Close</button>
            </div>
        `);

        // Arrows move the field they belong to; everything else reads the fields.
        overlay.querySelectorAll('[data-nudge]').forEach(btn => {
            btn.addEventListener('click', () => {
                const [id, dir] = btn.dataset.nudge.split(':');
                const el = overlay.querySelector('#' + id);
                const current = parseFloat(el.value);
                const next = (Number.isFinite(current) ? current : 0) + this.NUDGE * Number(dir);
                // Rounded so repeated taps can't drift into 0.18750000000000003.
                el.value = Math.round(next * 10000) / 10000;
                Utils.haptic && Utils.haptic('light');
            });
        });

        const read = () => {
            const n = (sel, dflt = 0) => {
                const el = overlay.querySelector(sel);
                const v = el ? parseFloat(el.value) : NaN;
                return Number.isFinite(v) ? v : dflt;
            };
            // Logo settings live in their own panel — carry them through
            // untouched so saving alignment never resets them.
            return {
                ...layout,
                offsetX: n('#cal-x'),
                offsetY: n('#cal-y'),
                stubOffsetX: n('#cal-sx'),
                stubOffsetY: n('#cal-sy'),
            };
        };

        overlay.querySelector('#cal-cancel').addEventListener('click', () => overlay.remove());

        overlay.querySelector('#cal-test').addEventListener('click', () => {
            // Prints with the values currently on screen, not the saved ones —
            // otherwise every adjustment needs a save before it can be tested.
            const company = { ...state.company, checkLayout: read() };
            this.print({
                checkNumber: '0000',
                payee: 'ALIGNMENT TEST — do not sign',
                amount: 1234.56,
                checkDate: Utils.today(),
                memo: 'Test print — plain paper only',
            }, company, { rulers: true });
        });

        overlay.querySelector('#cal-save').addEventListener('click', async () => {
            state.company.checkLayout = read();
            await db.saveCompanyProfile(state.company);
            overlay.remove();
            Toast.show('Alignment saved', 'success');
            onChange();
        });
    },

    // ── Stub logo ──
    /* Separate from printer alignment on purpose. Alignment is a one-time
       correction for a physical printer; this is a design choice that gets
       fiddled with. Sharing one panel made it too tall for a phone, which is
       the same failure that made the Align button feel broken. */
    _showLogoModal(state, onChange) {
        const layout = this._layout(state.company);
        const logoData = state.company && state.company.logoData;

        if (!logoData) {
            const warn = this._sheet(`
                <div class="modal-title">Stub Logo</div>
                <div class="modal-message">No logo saved yet. Add one under
                    <strong>Settings → Business Profile</strong>, then come back.</div>
                <div class="modal-actions">
                    <button class="modal-action-btn modal-action-cancel" id="logo-close">Close</button>
                </div>`);
            warn.querySelector('#logo-close').addEventListener('click', () => warn.remove());
            return;
        }

        const overlay = this._sheet(`
            <div class="modal-title">Stub Logo</div>
            <div class="logo-preview" id="logo-preview">
                <img id="logo-preview-img" src="${Utils.escapeHtml(logoData)}" alt="">
                <span class="logo-preview-text">Walex Pro Finishes</span>
                <span class="logo-preview-tag">one stub, to scale</span>
            </div>

            <div class="nudge-row">
                <label class="modal-check nudge-label"><input type="checkbox" id="logo-on" ${layout.stubLogo ? 'checked' : ''}> Show</label>
            </div>

            <div class="cal-group-title">Position</div>
            ${this._nudgeRow('Across', 'logo-x', '← Left', 'Right →', layout.stubLogoX)}
            ${this._nudgeRow('Up / down', 'logo-y', '↑ Up', 'Down ↓', layout.stubLogoY)}

            <div class="cal-group-title">Size</div>
            <div class="nudge-row">
                <span class="nudge-label">Height</span>
                <button type="button" class="nudge-btn" data-size="-1">−</button>
                <input id="logo-h" type="number" step="0.05" min="0.1" max="3" value="${layout.stubLogoHeight}">
                <button type="button" class="nudge-btn" data-size="1">+</button>
            </div>

            <div class="cal-group-title">Opacity</div>
            <div class="nudge-row">
                <input type="range" id="logo-op" class="logo-slider" min="0.05" max="1" step="0.05" value="${layout.stubLogoOpacity}">
                <span class="nudge-sublabel" id="logo-op-val">${Math.round(layout.stubLogoOpacity * 100)}%</span>
            </div>

            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="logo-test">Print Test Page</button>
                <div class="modal-actions-row">
                    <button class="modal-action-btn" id="logo-save">Save Logo</button>
                    <button class="modal-action-btn modal-action-cancel" id="logo-cancel">Close</button>
                </div>
            </div>
        `);

        const q = (sel) => overlay.querySelector(sel);
        const num = (sel, dflt = 0) => {
            const v = parseFloat(q(sel).value);
            return Number.isFinite(v) ? v : dflt;
        };
        const read = () => ({
            ...layout,
            stubLogo: q('#logo-on').checked,
            stubLogoX: num('#logo-x'),
            stubLogoY: num('#logo-y'),
            stubLogoHeight: num('#logo-h', 0.45),
            stubLogoOpacity: num('#logo-op', 0.15),
        });

        /* Live preview, drawn to the same scale as the paper: the box is one
           stub, so inches map onto it by the same factor in both directions
           and what you see is what prints. */
        const preview = q('#logo-preview');
        const img = q('#logo-preview-img');
        const paint = () => {
            const v = read();
            const perInch = preview.clientWidth / this.PAGE_WIDTH;
            img.style.height = (v.stubLogoHeight * perInch) + 'px';
            img.style.left = (preview.clientWidth / 2 + v.stubLogoX * perInch) + 'px';
            img.style.top = (preview.clientHeight / 2 + v.stubLogoY * perInch) + 'px';
            img.style.opacity = v.stubLogoOpacity;
            img.style.display = v.stubLogo ? 'block' : 'none';
            q('#logo-op-val').textContent = Math.round(v.stubLogoOpacity * 100) + '%';
        };

        overlay.querySelectorAll('[data-nudge]').forEach(btn => {
            btn.addEventListener('click', () => {
                const [id, dir] = btn.dataset.nudge.split(':');
                const el = q('#' + id);
                const cur = parseFloat(el.value);
                el.value = Math.round(((Number.isFinite(cur) ? cur : 0) + this.NUDGE * Number(dir)) * 10000) / 10000;
                paint();
            });
        });
        overlay.querySelectorAll('[data-size]').forEach(btn => {
            btn.addEventListener('click', () => {
                const el = q('#logo-h');
                const cur = parseFloat(el.value);
                const next = (Number.isFinite(cur) ? cur : 0.45) + 0.05 * Number(btn.dataset.size);
                el.value = Math.round(Math.min(3, Math.max(0.1, next)) * 100) / 100;
                paint();
            });
        });
        ['#logo-on', '#logo-x', '#logo-y', '#logo-h', '#logo-op'].forEach(sel =>
            q(sel).addEventListener('input', paint));

        /* The sheet slides up over ~350ms, and clientWidth is 0 until that
           settles — an rAF here painted the logo at zero size. A ResizeObserver
           repaints the moment the box actually has a width, and again on
           rotation or a window resize. */
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => { if (preview.clientWidth) paint(); }).observe(preview);
        } else {
            setTimeout(paint, 400);
        }
        paint();

        q('#logo-cancel').addEventListener('click', () => overlay.remove());

        q('#logo-test').addEventListener('click', () => {
            this.print({
                checkNumber: '0000',
                payee: 'ALIGNMENT TEST — do not sign',
                amount: 1234.56,
                checkDate: Utils.today(),
                memo: 'Test print — plain paper only',
            }, { ...state.company, checkLayout: read() }, { rulers: true });
        });

        q('#logo-save').addEventListener('click', async () => {
            state.company.checkLayout = read();
            await db.saveCompanyProfile(state.company);
            overlay.remove();
            Toast.show('Logo saved', 'success');
            onChange();
        });
    },

    // ── Guide lines ──
    /* Alex wants a batch of stock pre-printed with just the rules, so a check
       written by hand from the truck still comes out straight and legible.
       That is a different print job from a check: lines, no data. */
    _showGuidesModal(state, onChange) {
        const layout = this._layout(state.company);

        const overlay = this._sheet(`
            <div class="modal-title">Guide Lines</div>
            <div class="modal-message" style="text-align:left;">
                Rules under the date, payee, amount and memo — so a check written by hand
                stays straight. Run a few sheets of stock through and keep them for the truck.
            </div>

            <div class="nudge-row">
                <label class="modal-check nudge-label" style="flex:1 1 auto;">
                    <input type="checkbox" id="guides-on" ${layout.guideLines ? 'checked' : ''}>
                    Also print them on checks from this app
                </label>
            </div>

            <div class="modal-message modal-message-warn" style="text-align:left;">
                ⚠️ A rule is not fraud protection — it spans the field whether you have written
                on it or not. <strong>When writing by hand, draw a line from the end of your
                words to the end of the amount field.</strong> That is the part the printed rule
                cannot do for you.
            </div>

            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="guides-print">Print Guide Sheet</button>
                <div class="modal-actions-row">
                    <button class="modal-action-btn" id="guides-save">Save</button>
                    <button class="modal-action-btn modal-action-cancel" id="guides-cancel">Close</button>
                </div>
            </div>
        `);

        const q = (sel) => overlay.querySelector(sel);

        q('#guides-cancel').addEventListener('click', () => overlay.remove());

        q('#guides-print').addEventListener('click', () => {
            /* Rules only — no date, payee, amount or stubs. This goes onto real
               stock, so anything printed here is on the check for good. */
            this.print({}, state.company, { guidesOnly: true });
        });

        q('#guides-save').addEventListener('click', async () => {
            state.company.checkLayout = { ...layout, guideLines: q('#guides-on').checked };
            await db.saveCompanyProfile(state.company);
            overlay.remove();
            Toast.show('Saved', 'success');
            onChange();
        });
    },

    // ── Print ──
    /* Not reusing the invoice print path on purpose: that one sets
       `@page { margin: 12.7mm }`, and every position here is measured from the
       PHYSICAL page edge. A page margin would shift the whole layout down and
       right, and no calibration offset could tell the difference. */
    print(check, company, options = {}) {
        const layout = this._layout(company);
        const dx = layout.offsetX;
        const dy = layout.offsetY;

        const field = (key, text, extra = '') => {
            const f = this.FIELDS[key];
            if (!f || !text) return '';
            return `<div style="position:absolute; left:${(f.x + dx).toFixed(4)}in; top:${(f.y + dy).toFixed(4)}in;
                font-size:${f.size}pt; ${f.bold ? 'font-weight:700;' : ''} ${extra}">${Utils.escapeHtml(text)}</div>`;
        };

        const words = Utils.amountInWords(check.amount);
        /* The trailing rule matters: the gap after the written amount is where
           a figure gets added. Drawn to the edge of the field so there is no
           gap to fill in. */
        const wordsField = (() => {
            const f = this.FIELDS.amountWords;
            return `<div style="position:absolute; left:${(f.x + dx).toFixed(4)}in; top:${(f.y + dy).toFixed(4)}in;
                width:${(6.0).toFixed(2)}in; font-size:${f.size}pt; white-space:nowrap; overflow:hidden;">
                <span>${Utils.escapeHtml(words)}</span>
                <span style="display:inline-block; border-bottom:1px solid #000; width:100%; margin-left:6px; vertical-align:middle;"></span>
            </div>`;
        })();

        const amountNumeric = Number(check.amount || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        });

        /* The stubs: plain paper, so this is a record, not a form. They take
           their OWN offset — see _layout. */
        const sx = layout.stubOffsetX;
        const sy = layout.stubOffsetY;
        /* The logo is its own absolutely-positioned element per stub, drawn
           BEFORE the text so the text paints on top — a watermark has to sit
           behind the thing it watermarks. It rides the stub offset too, so
           aligning the stubs carries the logo with them. */
        const logoAt = (top) => {
            if (!layout.stubLogo || !company || !company.logoData) return '';
            const cx = this.PAGE_WIDTH / 2 + layout.stubLogoX + sx;
            const cy = top + this.STUB_HEIGHT / 2 + layout.stubLogoY + sy;
            return `<img src="${Utils.escapeHtml(company.logoData)}" alt=""
                style="position:absolute; left:${cx.toFixed(4)}in; top:${cy.toFixed(4)}in;
                       height:${layout.stubLogoHeight.toFixed(3)}in; width:auto;
                       transform:translate(-50%,-50%);
                       opacity:${layout.stubLogoOpacity.toFixed(3)}; z-index:0;">`;
        };

        const stubs = this.STUB_TOPS.map(top => `
            ${logoAt(top)}
            <div style="position:absolute; left:${(0.75 + sx).toFixed(4)}in; top:${(top + sy).toFixed(4)}in;
                 font-size:10pt; line-height:1.6; z-index:1;">
                <div><strong>${Utils.escapeHtml(company && company.name || '')}</strong></div>
                <div>Check #${Utils.escapeHtml(check.checkNumber || '—')} &nbsp;·&nbsp; ${Utils.formatDate(check.checkDate)}</div>
                <div>Pay to: ${Utils.escapeHtml(check.payee || '')}</div>
                <div>Amount: $${amountNumeric}</div>
                ${check.memo ? `<div>Memo: ${Utils.escapeHtml(check.memo)}</div>` : ''}
            </div>
        `).join('');

        /* Rulers only on the calibration page. Inch marks down the left and
           across the top turn "it's a bit low" into a number to type in. */
        const rulers = options.rulers ? (() => {
            let marks = '';
            for (let i = 1; i <= 10; i++) {
                marks += `<div style="position:absolute; left:0; top:${i}in; width:0.35in; border-top:1px solid #999; font-size:7pt; color:#999;">${i}"</div>`;
            }
            for (let i = 1; i <= 8; i++) {
                marks += `<div style="position:absolute; top:0; left:${i}in; height:0.35in; border-left:1px solid #999; font-size:7pt; color:#999;"><span style="margin-left:2px;">${i}"</span></div>`;
            }
            return marks + `<div style="position:absolute; left:0.3in; top:0.3in; font-size:8pt; color:#999;">
                PLAIN PAPER TEST — hold against a real check up to a window</div>`;
        })() : '';

        /* Rules under each field. Drawn first so printed text sits on them,
           the way writing sits on the line of a handwritten check. */
        const guides = (layout.guideLines || options.guidesOnly)
            ? Object.entries(this.GUIDES).map(([key, g]) => {
                const f = this.FIELDS[key];
                return `<div style="position:absolute;
                    left:${(g.from + dx).toFixed(4)}in;
                    top:${(f.y + g.dy + dy).toFixed(4)}in;
                    width:${(g.to - g.from).toFixed(4)}in;
                    border-bottom:0.75pt solid #000;"></div>`;
              }).join('')
            : '';

        const html = `
            <div style="position:relative; width:8.5in; height:11in; font-family:'Helvetica Neue',Arial,sans-serif; color:#000;">
                ${rulers}
                ${guides}
                ${options.guidesOnly ? '' : `
                    ${field('date', Utils.formatDate(check.checkDate))}
                    ${field('payee', check.payee || '')}
                    ${field('amountNum', '**$' + amountNumeric)}
                    ${wordsField}
                    ${field('memo', check.memo || '')}
                    ${stubs}
                `}
            </div>`;

        this._printPage(html, `Check ${check.checkNumber || ''}`.trim());
    },

    /* Isolated iframe, same technique the invoice export uses — whole-page
       window.print() is a silent no-op in iOS Safari and the installed PWA. */
    _printPage(innerHtml, title) {
        document.querySelectorAll('#check-print-frame').forEach(f => f.remove());
        const frame = document.createElement('iframe');
        frame.id = 'check-print-frame';
        frame.style.cssText = 'position:fixed; top:0; left:0; width:816px; height:1056px; border:0; opacity:0; pointer-events:none; z-index:-1;';
        document.body.appendChild(frame);

        const fdoc = frame.contentDocument || frame.contentWindow.document;
        fdoc.open();
        fdoc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
            <style>
                /* margin:0 is load-bearing — every coordinate in this document
                   is measured from the physical corner of the sheet. */
                @page { size: letter; margin: 0; }
                html, body { margin:0; padding:0; background:#fff; }
                * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            </style></head><body>${innerHtml}</body></html>`);
        fdoc.close();

        const doPrint = () => {
            try {
                frame.contentWindow.focus();
                frame.contentWindow.print();
            } catch (err) {
                console.warn('Check print failed', err);
                Toast.show('Could not open print dialog', 'error');
            }
        };
        if (fdoc.readyState === 'complete') setTimeout(doPrint, 250);
        else frame.onload = () => setTimeout(doPrint, 250);
    },

    _sheet(innerHtml) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-sheet modal-sheet-tall"><div class="modal-handle"></div>${innerHtml}</div>`;
        document.getElementById('app').appendChild(overlay);
        Utils.dismissOnBackdrop(overlay);
        return overlay;
    },
};
