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
        };
    },

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
                    </div>
                    ${recent.length ? recent.map(c => `
                        <div class="compact-row check-row">
                            <div class="compact-icon ${c.voided ? 'warning' : 'primary'}">#</div>
                            <div class="compact-body">
                                <div class="compact-title">${Utils.escapeHtml(c.payee || 'No payee')}${c.voided ? ' — VOID' : ''}</div>
                                <div class="compact-subtitle">#${Utils.escapeHtml(c.checkNumber || '—')} · ${Utils.formatDate(c.checkDate)}${c.memo ? ' · ' + Utils.escapeHtml(c.memo) : ''}</div>
                            </div>
                            <div class="compact-value">${Utils.formatCurrency(c.amount)}</div>
                            <button class="check-print-btn" data-print-check="${c.id}">Print</button>
                            <button class="row-delete-btn" data-delete-check="${c.id}">×</button>
                        </div>
                    `).join('') : '<div class="empty-inline">Print onto pre-printed check stock. Align the printer once before using real checks.</div>'}
                </div>
            </div>
        `;
    },

    bind(container, state, onChange) {
        const write = container.querySelector('#write-check');
        if (write) write.addEventListener('click', () => this._showWriteModal(state, onChange));

        const cal = container.querySelector('#calibrate-checks');
        if (cal) cal.addEventListener('click', () => this._showCalibration(state, onChange));

        container.querySelectorAll('[data-print-check]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const check = (state.checks || []).find(c => c.id === parseInt(btn.dataset.printCheck, 10));
                if (check) this.print(check, state.company);
            });
        });

        container.querySelectorAll('[data-delete-check]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                /* Deleting breaks the register, which is the one thing the
                   register exists to prevent. Voiding keeps the number in the
                   sequence, which is what reconciliation needs. */
                if (!confirm('Delete this check from the register?\n\nIf the paper check was printed, Void it instead so the number stays in your records.')) return;
                await db.deleteCheck(parseInt(btn.dataset.deleteCheck, 10));
                Toast.show('Removed from register', 'success');
                onChange();
            });
        });
    },

    // ── Write ──
    _showWriteModal(state, onChange) {
        const overlay = this._sheet(`
            <div class="modal-title">Write Check</div>
            <div class="modal-form">
                <label>Check number<input id="check-number" inputmode="numeric" placeholder="the number printed on the sheet"></label>
                <label>Pay to the order of<input id="check-payee" placeholder="Sherwin-Williams"></label>
                <label>Amount<input id="check-amount" type="number" step="0.01" min="0" value="0"></label>
                <label>Date<input id="check-date" type="date" value="${Utils.today()}"></label>
                <label>Memo<input id="check-memo" placeholder="Job address or invoice #"></label>
            </div>
            <div class="modal-message" id="check-words-preview" style="text-align:left;"></div>
            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="save-print-check">Save &amp; Print</button>
                <button class="modal-action-btn" id="save-check">Save Only</button>
                <button class="modal-action-btn modal-action-cancel" id="cancel-check">Cancel</button>
            </div>
        `);

        const amountEl = overlay.querySelector('#check-amount');
        const preview = overlay.querySelector('#check-words-preview');
        /* Show the written amount as it is typed. It is the legal amount on a
           check — where words and figures disagree, the words are paid — so it
           should never be a surprise that only appears on paper. */
        const refresh = () => {
            const v = parseFloat(amountEl.value) || 0;
            preview.textContent = v > 0 ? Utils.amountInWords(v) : '';
        };
        amountEl.addEventListener('input', refresh);
        refresh();

        overlay.querySelector('#cancel-check').addEventListener('click', () => overlay.remove());

        const collect = () => {
            const payee = overlay.querySelector('#check-payee').value.trim();
            const amount = parseFloat(overlay.querySelector('#check-amount').value) || 0;
            if (!payee) { Toast.show('Payee required', 'error'); return null; }
            if (amount <= 0) { Toast.show('Amount must be more than zero', 'error'); return null; }
            return {
                checkNumber: overlay.querySelector('#check-number').value.trim(),
                payee,
                amount,
                checkDate: overlay.querySelector('#check-date').value || Utils.today(),
                memo: overlay.querySelector('#check-memo').value.trim(),
                voided: false,
                createdAt: new Date().toISOString(),
            };
        };

        const save = async (thenPrint) => {
            const check = collect();
            if (!check) return;
            const id = await db.saveCheck(check);
            overlay.remove();
            Toast.show('Check saved', 'success');
            if (thenPrint) this.print({ ...check, id }, state.company);
            onChange();
        };

        overlay.querySelector('#save-check').addEventListener('click', () => save(false));
        overlay.querySelector('#save-print-check').addEventListener('click', () => save(true));
    },

    // ── Calibration ──
    _showCalibration(state, onChange) {
        const layout = this._layout(state.company);
        const hasLogo = !!(state.company && state.company.logoData);

        const overlay = this._sheet(`
            <div class="modal-title">Printer Alignment</div>
            <div class="modal-message" style="text-align:left;">
                Test on <strong>plain paper</strong>, hold it against a real check at a window, then nudge.
                Inches — a sixteenth is 0.0625.
                <strong>Print at 100%</strong>, “Fit to Page” off, or no offset can help.
            </div>

            <div class="cal-group-title">Check — date, payee, amount</div>
            <div class="modal-form cal-pair">
                <label>Right (in)<input id="cal-x" type="number" step="0.0625" value="${layout.offsetX}"></label>
                <label>Down (in)<input id="cal-y" type="number" step="0.0625" value="${layout.offsetY}"></label>
            </div>

            <div class="cal-group-title">Stubs — the two tear-off records</div>
            <div class="modal-form cal-pair">
                <label>Right (in)<input id="cal-sx" type="number" step="0.0625" value="${layout.stubOffsetX}"></label>
                <label>Down (in)<input id="cal-sy" type="number" step="0.0625" value="${layout.stubOffsetY}"></label>
            </div>

            <div class="cal-group-title">Logo on stubs</div>
            ${hasLogo ? `
                <div class="modal-form cal-pair">
                    <label class="modal-check"><input type="checkbox" id="cal-logo" ${layout.stubLogo ? 'checked' : ''}> Show logo</label>
                    <label>Height (in)<input id="cal-logo-h" type="number" step="0.05" min="0.1" max="1.5" value="${layout.stubLogoHeight}"></label>
                </div>
            ` : `<div class="modal-message" style="text-align:left;">
                    No logo saved — add one under Settings → Business Profile.
                 </div>`}

            <div class="modal-actions">
                <button class="modal-action-btn modal-action-primary" id="cal-test">Print Test Page</button>
                <button class="modal-action-btn" id="cal-save">Save Alignment</button>
                <button class="modal-action-btn modal-action-cancel" id="cal-cancel">Close</button>
            </div>
        `);

        const read = () => {
            const n = (sel, dflt = 0) => {
                const el = overlay.querySelector(sel);
                const v = el ? parseFloat(el.value) : NaN;
                return Number.isFinite(v) ? v : dflt;
            };
            const logoEl = overlay.querySelector('#cal-logo');
            return {
                offsetX: n('#cal-x'),
                offsetY: n('#cal-y'),
                stubOffsetX: n('#cal-sx'),
                stubOffsetY: n('#cal-sy'),
                stubLogo: logoEl ? logoEl.checked : layout.stubLogo,
                stubLogoHeight: n('#cal-logo-h', layout.stubLogoHeight),
            };
        };

        overlay.querySelector('#cal-cancel').addEventListener('click', () => overlay.remove());

        overlay.querySelector('#cal-test').addEventListener('click', () => {
            // Prints with the values currently typed in, not the saved ones —
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
        const logo = layout.stubLogo && company && company.logoData
            ? `<img src="${Utils.escapeHtml(company.logoData)}" alt=""
                    style="height:${layout.stubLogoHeight.toFixed(3)}in; display:block; margin-bottom:0.06in;">`
            : '';

        const stubs = this.STUB_TOPS.map(top => `
            <div style="position:absolute; left:${(0.75 + sx).toFixed(4)}in; top:${(top + sy).toFixed(4)}in;
                 font-size:10pt; line-height:1.6;">
                ${logo}
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

        const html = `
            <div style="position:relative; width:8.5in; height:11in; font-family:'Helvetica Neue',Arial,sans-serif; color:#000;">
                ${rulers}
                ${field('date', Utils.formatDate(check.checkDate))}
                ${field('payee', check.payee || '')}
                ${field('amountNum', '**$' + amountNumeric)}
                ${wordsField}
                ${field('memo', check.memo || '')}
                ${stubs}
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
