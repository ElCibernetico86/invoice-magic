# Handoff — 2026-09-25 — Check printing

## Status: DONE, verified in-browser, pushed. Assets at **v38**.
Commits `8fccb55` (build) + `e390b0d` (touch/offsets/logo) + `b8f0e9e` (direction buttons).

**Alex can write and print checks onto the Chase pre-printed laser stock.**
Tools → Checks. Full background in
`painting-business/templates/printing-business-checks_guide.md`.

- Prints ONLY the variable fields — date, payee, amount, amount in words, memo.
  **Never the signature** (hand-signed) and **never the check number** (pre-printed; he types
  the number on the sheet he is feeding so the register matches the paper).
- **Register is half the point** — new `CHECKS` store, `DB_VERSION 2 → 3`, additive only.
  Cloud backup iterates `Object.values(STORES)` so it was picked up with no change.
- **Alignment**: inch coordinates from the physical page corner, **separate X/Y offsets for the
  check and for the stubs**, and a test page with inch rulers for plain paper. A layout saved
  before the split keeps its stubs following the check offset, so nothing calibrated moves.
- **Stub logo is a watermark** (`Tools → Checks → Stub Logo`, its own panel): positioned from the
  **centre of each stub**, freely nudged, resizable, with an opacity slider and a live
  to-scale preview. Drawn **before** the text at `z-index:0` vs the text's `1`, so it sits
  behind it. **Default opacity 0.15** — centred at full strength it hides the payee and amount.
  It rides the stub offset, so aligning stubs carries the logo with them. (`5260aa9`)
- **Alignment is nudged with ← Left / Right → / ↑ Up / Down ↓ buttons**, one sixteenth per tap.
  The fields still accept a typed number. Moving up or left is a NEGATIVE offset, and "type
  -0.1875" is a bad instruction to follow at a printer — hence the buttons. Taps are rounded to
  4dp so repeated presses can't drift into `0.18750000000000003`.

### ⚠️ TOUCH: modals used to dismiss themselves — fixed app-wide in `e390b0d`

Alex reported "Align Printer needs a double tap and closes itself." It was **not** that button —
it was **every bottom sheet in the app, in twelve places**, and invisible with a mouse.

`click` + `e.target === overlay` breaks on touch: a tap fires touchend and **then a synthesized
click up to ~300ms later**. The overlay is appended during the first event, so the ghost click
lands on a backdrop that did not exist when the finger went down. The sheet occupies only the
bottom half (`align-items:flex-end`, `max-height:50vh`), so **any button in the top half opens a
modal that closes itself.**

**Always use `Utils.dismissOnBackdrop(overlay)`** — it requires the press to start *and* end on
the backdrop. Never re-introduce the bare `click` check.

### ⚠️ Two base classes set NO color — a bare one is invisible

- `.modal-action-btn` — measured **1.15:1** (white on near-white) before `e390b0d` gave the base
  rule a legible default. Four buttons were in that state, two of them pre-existing.
- `.settings-action-btn` — still needs `settings-action-export` or `settings-action-import`.

If a button looks "greyed out", measure the contrast before assuming it is disabled.

### ⚠️ CSS gotchas this area has already hit twice

- **A `margin:` shorthand after `margin-left/right: auto` silently resets them.** Cost one
  round trip on the logo preview. Keep centring in ONE shorthand: `margin: 6px auto 2px`.
- **`width: auto` with `aspect-ratio` ignores the ratio** and fills the container. Use
  `width: fit-content` when the ratio should decide the width.
- **`clientWidth` is 0 until the sheet finishes its ~350ms slide-up.** An `rAF` measurement
  painted the preview at zero size. Use a `ResizeObserver`, not a timer.
- **Measuring element positions inside a batched script right after opening a modal reads
  mid-animation** and reports buttons off-screen when they are not. Measure in a separate
  call, or trust the screenshot.

### ⚠️ The sheet is 50vh — watch what you add to a modal

The calibration panel grew past it and pushed Save below the fold on a phone, which reads as the
same "button is broken" problem. Check at 375px after adding to any modal.

### ⚠️ Rules specific to checks

- **Check printing must stay at `@page { margin: 0 }`.** The invoice path uses `12.7mm`; a page
  margin shifts the whole layout and is indistinguishable from a calibration error.
- **The default field coordinates are estimates.** No reliable published spec exists for this
  stock. If Alex reports a field off, prefer moving the shared offset; only edit `FIELDS` if the
  fields are wrong *relative to each other*.
- **Tell him to print at 100%** — "Fit to Page" silently rescales and no offset can correct it.
- **`.settings-action-btn` sets no color.** Used without `settings-action-export` /
  `settings-action-import` it renders white-on-white (measured 1.15:1).
- **Any new JS file must be added to `ASSETS` in `sw.js`** or the app breaks offline — which is
  where it is used.

---

# Handoff — 2026-09-14 — Job-site addresses per document

## Status: DONE, verified in-browser, pushed. Assets were **v34**.
Branch `main`, remote `github.com/ElCibernetico86/invoice-magic.git`, commit `3017d3d`.
Deploys on **Vercel** (project `invoice-magic`, production `www.invoicemagic.live`),
auto-deploys on push to `main`.

⚠️ **Alex must fully close and reopen the installed app** to pick up v34 — it's a PWA and the
service worker serves the old cache until then. It can take two launches.

---

## What shipped this session

**Each estimate and invoice now carries its own job-site address, and clients keep a list of
properties.** Full write-up, including the verification list, is in
**`multi-address-clients_done.md`** — read that before touching this area.

The short version of *why*, because it changes how you think about the data:

> Documents didn't store an address at all. The editor's Address box wrote to the **client
> record**, and templates read the client's **current** address at render time. Typing the
> address for a new job retroactively changed the address on every past invoice for that
> contractor. An invoice is an accounting record — it must not change after it's issued.

`doc.siteAddress` is a **copy**, never a reference. A reference to "property #3" would be the
same bug in a new costume: fixing a typo in a saved address would still alter sent invoices.

---

## ⚠️ Rules for any future change here

1. **Bump BOTH** `?v=NN` on every asset in `index.html` AND `CACHE_NAME` in `sw.js`, or the
   PWA serves stale code:
   ```
   sed -i '' 's/?v=34/?v=35/g' index.html && sed -i '' 's/invoice-magic-v34/invoice-magic-v35/' sw.js
   ```
   Then fully close and reopen the installed app (can take two loads to activate).
2. **Six templates, not one.** `classic`, `bold`, `modern`, `studio`, `contractor`, `minimal`.
   Anything added to a totals footer or a client block must be added to all of them or it
   silently won't appear for Alex — he uses `modern`, which is also the default.
   *(`minimal` printed no address at all until this session. That's the trap working.)*
3. **`saveNow()` runs on every navigation.** Any destructive action must clear `_currentDoc`
   first or the record comes straight back.
4. **`Utils.cloneDocumentForConversion` lists document fields one by one.** Add any new
   document field there too, or accepting an estimate drops it. This session it would have
   billed the wrong house.
5. **Never delete `client.address`.** It looks like dead duplicate data. It is the frozen
   fallback for every document written before 2026-09-14; deleting it blanks their addresses.
   New writes go to `client.addresses`.
6. **A missing `siteAddress` key ≠ an empty one.** No key = predates the feature (inherit the
   client's old address). Empty = undecided. `Utils.createBlankDocument` must keep setting the
   empty key, and `_adoptSiteAddress` must keep running **before**
   `Utils.ensureDocumentDefaults`, which fills the key in.
7. Local dev: `node server.js` (port 3002).
   ⚠️ The Browser **preview tool resolves `.claude/launch.json` from the session's original
   project root**, not the cwd — in a session started elsewhere it will start that project's
   server instead and ignore the name you pass. Run `node server.js` and navigate to
   `localhost:3002` directly.

---

## Open / not addressed

- **Reporting by property.** `doc.siteAddressId` is stored but nothing reads it. "All jobs at
  the Willow reno" is now answerable and has no screen.
- **A separate billing address.** Alex chose job-site-only for the printed document
  (asked and answered this session). If a GC ever wants invoices posted to an office rather
  than the house, that's a second field and the design leaves room.
- **Five junk clients still in Alex's data** (`bu`, `J`, `Ad`, `Adap`, `Adapt`) — the cause
  was fixed in v33 but the records remain. Offered to clean them; he hasn't said yes.
  **Don't delete records without asking.**
- Mobile drag was verified only synthetically (dispatched pointer events). `touch-action: none`
  is on the handle so it should be fine, but Alex should confirm on his phone.
- No page numbers on multi-page exports — would need a real PDF-library path. Documented
  fallback is a **locally bundled** library; do NOT reintroduce the CDN lazy-load (breaks
  offline) or the popup-window approach (crashed iOS).
- iPhone uses 3 pages where MacBook uses 2 (A4 vs Letter). Alex is fine with it.
- **Estimator merge deferred** — `service-apps/WALEX Estimator/` was evaluated for merging into
  Invoice Magic and postponed until Alex has used the standalone on real jobs. That app already
  snapshots its rate card onto every estimate for exactly the reason documents now snapshot
  their address — same principle, worth keeping consistent if they ever merge.

## Next step

Nothing pending. Alex should add properties to his real contractors under
**Clients → Edit Client**, then confirm on a live job that a new invoice picks the right house
and an old one is unchanged.
