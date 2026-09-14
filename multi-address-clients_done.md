# Multiple addresses per client — BUILT

**Raised and built 2026-09-14.** Shipped in `3017d3d`, assets **v34**, pushed to `main`
(auto-deploys to www.invoicemagic.live).

> "Most of the clients are contractors, which means that they manage multiple houses.
> Whenever I come back to an estimate or invoice I find that the address is the last one I
> used but doesn't necessarily belong to that project." — Alex

---

## What was actually wrong

Not a missing feature — a data model that rewrote history.

- The editor's Address box wrote to the **client record**, not the document.
- Every template rendered the client's **current** address at preview/export time.
- A client had exactly one address.

So typing the address for a new job didn't only mislabel the new estimate — it
retroactively changed the address printed on **every past estimate and invoice for that
contractor**. Reopening or re-exporting a six-month-old job showed the new house.

## What was built

**1. A document owns its address.** `doc.siteAddress` is a **copy**, taken when the job site
is chosen. `doc.siteAddressId` records which saved property it came from, for reporting
later — but the printed text never depends on it.

Copying is the design, not an implementation detail. Storing a *reference* to "property #3"
would be the same bug wearing a different hat: correcting a typo in a saved address would
still alter invoices already sent.

**2. Clients keep a list of properties.** `client.addresses = [{ id, label, address }]`,
managed under Clients → Edit Client. Labels are optional and exist because contractors say
"the Willow reno", not "77 Willow Ln".

## The migration — nothing to run

`client.address` (the old single field) is **kept and never written again**:

- It is the fallback for documents with no `siteAddress`.
- Because nothing updates it any more, those documents are frozen at what they have always
  displayed.
- A document with **no `siteAddress` key at all** predates the feature and inherits that
  value when opened. One with an **empty** key is simply undecided. New documents are born
  with the empty key — that difference is what tells the two apart, so
  `Utils.createBlankDocument` must keep setting it.

⚠️ **Do not "clean up" `client.address`.** Deleting it silently blanks the address on every
document written before 2026-09-14.

## Behaviour

| | |
|---|---|
| Switching client | clears the job site — carrying it across is the entire complaint |
| Client with one property | auto-fills |
| Client with several | never guesses; picker reads "Choose a property…" |
| Typed one-off address | offers **Save to client**, labelled from its street line |

The label is derived rather than prompted for on purpose: a keyboard prompt in a driveway is
what stops a feature like this getting used. Rename it under Clients.

## Two silent droppers caught while building

Both are the same shape as the handoff's "six templates" trap — an explicit list that
quietly omits a new field:

1. **`Utils.cloneDocumentForConversion` lists fields one by one.** Accepting an estimate
   would have produced an invoice with no job site — and, having no key, it would have
   inherited the client's old address. **Billing the wrong house.**
2. **`minimal` never printed an address at all.** All six templates now do. Adding a field
   to one template is never finished.

## Verified in the browser

Driven through the real UI against seeded data, not reasoned about:

- pre-list invoice with no `siteAddress` → still prints its original address
- three properties added to that client → **both** old invoices unchanged (one adopted on
  open, one never opened, on the fallback)
- new invoice at a different property → prints that one, old ones untouched
- all **six** templates print the job site
- typing a custom address updates the document and leaves the client record alone
- Save to client appends it and links the document to the new entry
- switching client clears the site; property-less client hides the picker
- email/phone still write to the client (regression)
- estimate at Oakmont → converted invoice bills Oakmont
- 375px phone width: no overflow

## Still open

- **Reporting by property** — `siteAddressId` is stored but nothing reads it yet. "All jobs
  at the Willow reno" is now answerable; it just has no screen.
- **A separate billing address.** Alex chose job-site-only for the printed document. If a GC
  ever wants invoices posted to an office rather than the house, that is a second field, and
  this design leaves room for it.
- **The five junk clients** (`bu`, `J`, `Ad`, `Adap`, `Adapt`) are still in his data — a
  pre-existing item from the v33 handoff. Don't delete records without asking.
