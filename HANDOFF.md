# Handoff — 2026-09-14 — Job-site addresses per document

## Status: DONE, verified in-browser, pushed. Assets at **v34**.
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
