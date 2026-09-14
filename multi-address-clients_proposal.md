# Multiple addresses per client

**Raised by Alex, 2026-09-14.** Not started — captured mid-session while working on the
WALEX site, so nothing here has been built or tested yet.

> "Most of the clients are contractors, which means that they manage multiple houses.
> Whenever I come back to an estimate or invoice I find that the address is the last one I
> used but doesn't necessarily belong to that project."

---

## It is worse than a missing feature — it is silently rewriting history

I checked the code before writing this up, and the reported symptom is a side effect of
something bigger: **documents do not store an address at all.**

- The editor's Address box does not write to the document. It writes to the **client record**
  — `js/views/documentEditor.js:605-618` looks up the client and saves the field onto it.
- The preview then reads the address off the **live client record**, not the document —
  `js/views/documentPreview.js:181`, `:264`, `:336`, `:404` all use `this._client.address`.
- The client record has exactly one address string — `js/db.js:288`, `:308`.

So there is one address per contractor, shared by every document they ever appear on.

**The consequence Alex hasn't hit yet:** typing the address for a new job on Elm Street
doesn't just mislabel the new estimate — it retroactively changes the address printed on
every past estimate and invoice for that contractor. Reopen or re-export a job from six
months ago and it now shows the Elm Street address. An invoice is an accounting record; it
must not change after it is issued.

That means the fix has two parts, and **the first matters even if the second is never built.**

---

## Part 1 — a document owns its address (this is the bug)

Snapshot the address onto the document when it is created, and render from the document:

```js
doc.siteAddress = "1420 Elm St\nPlano, TX 75024"   // plain text, copied at creation
```

- The preview reads `doc.siteAddress`, falling back to the client's address only when the
  field is absent, so existing documents keep rendering as they do today.
- Editing the address on a document changes that document. Full stop. It stops reaching
  backwards into other people's paperwork.
- Copy, don't reference. A document holding "address #3" and looking it up later has the
  same problem in a new costume: correcting a typo in a saved address would still alter
  past invoices. The copy is the point.

**There is already a precedent for this in Alex's own tooling.** `WALEX Estimator/` snapshots
its rate card onto every estimate so that past estimates never re-price when rates change.
Same principle, same reason — a document is a record of what was true when it was issued.
Invoice Magic should do for addresses what the estimator already does for prices.

## Part 2 — clients keep a list of properties (this is the request)

```js
client.addresses = [
  { id, label: "Elm St spec house", address: "1420 Elm St\nPlano, TX 75024" },
  { id, label: "Willow reno",       address: "77 Willow Ln\nFrisco, TX 75035" },
]
```

- The editor's Address box becomes a picker over that client's saved properties, plus
  "New address…". Picking one copies its text into `doc.siteAddress` per Part 1.
- A label matters more than it looks: contractors talk about "the Willow reno", not
  "77 Willow Ln", and Alex is picking from this on a phone in a driveway.
- Saving a new address on a document should offer to add it to the client — not do it
  silently, or the list fills with typos and one-offs.

## Migration

Every existing client has a single `address` string. On load, a client with a non-empty
`address` and no `addresses` list gets a one-entry list built from it, labelled "Main".
Nothing to run by hand, and an old-format client keeps working if the migration is skipped.

---

## Open questions for Alex

1. **Does the property address belong next to the billing address, or replace it?** A
   contractor's office is where the invoice goes; the job site is where the work happened.
   Most trade invoices show both — worth confirming he wants two lines, not one.
2. **Should a document remember which saved property it came from**, so "all jobs at the
   Willow reno" is answerable later? That is a reporting feature, and it does not change
   Part 1 — the printed text is still a copy.

## Where the work lands

`js/db.js` (client shape + migration) · `js/views/clients.js` (managing the list) ·
`js/views/documentEditor.js` (picker, and stop writing to the client record) ·
`js/views/documentPreview.js` (render from the document) · `js/cloudSync.js` (check the
synced client shape travels).
