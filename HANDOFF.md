# Handoff — 2026-08-21 — Four real bugs fixed; all live

## Status: DONE, verified in-browser, deployed. Assets at **v33**.
Branch `main`, remote `github.com/ElCibernetico86/invoice-magic.git`, pushed.
Working tree clean except this untracked `HANDOFF.md` (Alex's choice — don't commit it).

**Deployment question from the last handoff is answered: Invoice Magic deploys on
VERCEL, not GitHub Pages.** Project `invoice-magic` under `ivanmunoza10-9930s-projects`,
production domain `www.invoicemagic.live`, auto-deploys on push to `main`. The Vercel CLI
is installed and logged in, so `vercel project ls` / `vercel deploy --prod` work from the folder.

---

## What was fixed this session

### 1. `e657a3b` — Payments/discount/balance missing from exported PDFs
**Alex's report:** recorded two prior payments; the editor showed the balance, the exported
PDF showed the full TOTAL. Nearly sent an invoice asking for money already paid.

**It was not an export bug.** Four of the six templates — `modern`, `classic`, `bold`, and
`studio` (which wraps modern) — render their own totals footer with only SUBTOTAL / TAX /
TOTAL. Only `contractor` and `minimal` called `_renderTotalsBlock()`, the single place PAID
and BALANCE existed. Alex's documents are `templateId: 'modern'`, which is also the default,
so those rows were unreachable for him in preview *or* export.

Added `_renderDiscountRow()` and `_renderBalanceRows()` in `documentPreview.js`, taking
per-template style strings so each keeps its own type treatment. **This also restored
DISCOUNT and DEPOSIT DUE**, which those four templates dropped for the same reason — a
discounted invoice was exporting at the undiscounted total.

### 2. `56cd591` — Three fixes
**Addresses now print on two lines** (street / city-state-ZIP). `Utils.formatAddressHtml()`
honours typed line breaks first, then falls back to splitting on a trailing
`City, ST 12345` pattern so existing single-line records render right without retyping.
No match → returned untouched. Both address fields are now `<textarea>`.

**Client-suggestion bug — this was silently destroying data.** Tapping a suggestion blurs
the input first, and the blur handler creates a client from whatever is typed. Picking
"Adaptive Renovations" after typing "Adap" saved a NEW client called "Adap", *then* selected
the real one. **Every junk contact in Alex's data is this bug** — `bu`, `J`, `Ad`, `Adap`,
`Adapt`, each a fragment of a name he was mid-typing. Fixed with `preventDefault` on
`pointerdown` (focus never leaves → blur never fires) plus a flag fallback.

**Delete Client added.** `db.deleteClient()` existed but nothing called it. Warns when
documents reference the client; those keep their stored `clientName` so history still reads.

**Drag-to-reorder actually drags now.** `pointermove`/`pointerup` were bound to the drag
handle, but `reorderAt()` moves the card with `insertBefore`, which detaches and reattaches
the handle and **silently drops pointer capture**. `pointermove` then stopped firing and
`lastY` froze — the only thing still running was the rAF loop reading that stale value, which
is exactly why items moved only while the page scrolled. Listeners moved to `document` so they
survive the DOM move. Also: auto-scroll called `window.scrollBy()` but the app scrolls
`#main-content`; and the hit test now compares card midpoints instead of requiring the pointer
inside a card's rect.

### 3. `6ea593f` — Delete in the editor silently re-created the document
**Alex's report:** deleting an estimate from the editor navigated to the list and left it there.

The delete worked. **Every navigation path calls `DocumentEditorView.saveNow()`**, which
writes `_currentDoc` back under its original id — so `App.navigateBack()` immediately after
the delete re-created the row. A queued 300ms `_autoSave()` could do the same. Now the working
copy and pending debounce are cleared *before* the delete, so `saveNow()` and `_autoSave()`
no-op (both already guard on `_currentDoc`).

Not a mobile/desktop difference — swipe-to-delete in the list works because it never opens the
editor and so never calls `saveNow()`.

---

## How these were verified
Driven through the real UI in a browser, not just reasoned about:
- part-paid $5,000 invoice → all six templates render TOTAL $5,000 / PAID -$2,500 /
  BALANCE DUE $2,500; unpaid invoices and estimates add no extra rows; $500 discount +
  $1,000 paid → $3,500 balance
- dragging item 1 past item 3 reorders on `pointermove` alone, model matches DOM
- typing "Adap" then tapping the suggestion creates **no** junk client
- delete tested on estimate AND invoice, including editing a field immediately before
  deleting so a save was genuinely queued — both stay deleted
- **regression:** normal edit → Done still saves (the delete fix touches the save path)

---

## ⚠️ Rules for any future change here
1. **Bump BOTH** `?v=NN` on every asset in `index.html` AND `CACHE_NAME` in `sw.js`, or the
   PWA serves stale code:
   ```
   sed -i '' 's/?v=33/?v=34/g' index.html && sed -i '' 's/invoice-magic-v33/invoice-magic-v34/' sw.js
   ```
   Then fully close and reopen the installed app (can take two loads to activate).
2. **Six templates, not one.** `classic`, `bold`, `modern`, `studio`, `contractor`, `minimal`.
   Anything added to a totals footer must be added to all of them or it silently won't appear
   for Alex — he uses `modern`, which is also the default.
3. **`saveNow()` runs on every navigation.** Any destructive action must clear `_currentDoc`
   first or the record comes straight back.
4. Local dev: `node server.js` (port 3002).

---

## Open / not addressed
- **Five junk clients still in Alex's data** (`bu`, `J`, `Ad`, `Adap`, `Adapt`) — the cause is
  fixed but the records remain. Offered to clean them; he hasn't said yes. Don't delete
  records without asking.
- Mobile drag was verified only synthetically (dispatched pointer events). `touch-action: none`
  was already on the handle so it should be fine, but Alex should confirm on his phone.
- No page numbers on multi-page exports — would need a real PDF-library path. Documented
  fallback is a **locally bundled** library; do NOT reintroduce the CDN lazy-load (breaks
  offline) or the popup-window approach (crashed iOS).
- iPhone uses 3 pages where MacBook uses 2 (A4 vs Letter). Alex is fine with it.
- **Estimator merge deferred** — `service-apps/WALEX Estimator/` was evaluated for merging into
  Invoice Magic and postponed until Alex has used the standalone on real jobs. Invoice Magic's
  existing Firebase cloud backup is why Supabase is probably unnecessary. See that app's HANDOFF.

## Next step
Nothing pending. Alex said "everything works perfect" after the v32 fixes and reported only
the delete bug, now fixed in v33.
