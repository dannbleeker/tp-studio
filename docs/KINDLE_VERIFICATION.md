# Kindle hardware verification — handoff

*The EPUB build pipeline shipped Session 135. The one thing a build can't prove is the real-device round-trip: does Send-to-Kindle actually import the file, and does it read natively on the hardware? This needs a physical Kindle (or the Kindle app) + a few minutes. Claude can't do this part.*

## Artifact (confirmed present)

- `docs/guide/Causal-Thinking-with-TP-Studio.epub` — ~707 KB, EPUB 3.0, built `pnpm book:epub`.
- Companion: `docs/guide/Causal-Thinking-with-TP-Studio.pdf` — ~1.5 MB.

Rebuild either with `pnpm book` (both) or `pnpm book:epub` (EPUB only) after manuscript edits.

## Why EPUB over the PDF for Kindle

Send-to-Kindle has accepted `.epub` natively since 2022. EPUB reflows on any Kindle screen size, fixing the two problems the A4 PDF hits on a 6-inch device: "PDF shows up but won't open" and "text too small to read." The PDF stays the print/desktop format.

## Steps for Dann (pick one delivery path)

**Option A — email (simplest):**
1. Find your Send-to-Kindle address: Amazon → Account → *Content & Devices* → *Preferences* → *Personal Document Settings* → your `@kindle.com` address.
2. Make sure your sending email is on the *Approved Personal Document E-mail List* (same page).
3. Email the `.epub` as an attachment to that `@kindle.com` address. Subject/body don't matter.
4. Wait 1–5 min; it appears in your Kindle Library under *Docs* / *Books*.

**Option B — Send to Kindle web/app:**
1. Go to <https://www.amazon.com/sendtokindle> (or use the desktop/mobile Send-to-Kindle app).
2. Drag in `Causal-Thinking-with-TP-Studio.epub`, pick the target device, send.

**Option C — automated from CI (the `[kindle]` flag) — Session 151:**

The `Rebuild book artifacts` workflow can email the freshly-built EPUB to your Kindle whenever you want a fresh copy. One-time setup, then it's just a commit flag.

*One-time setup (you, not Claude — these involve credentials):*
1. In Amazon → *Personal Document Settings*: note your `@kindle.com` address, and add the email you'll send **from** to the *Approved Personal Document E-mail List*.
2. Add GitHub repo secrets (*Settings → Secrets and variables → Actions*):
   - `KINDLE_TO` — your `@kindle.com` address.
   - `SMTP_USER` — the approved sender email (e.g. a Gmail address).
   - `SMTP_PASS` — that account's password. For Gmail use a 16-char **App Password** (Google Account → Security → App passwords), *not* your login password.
   - *(optional)* `SMTP_HOST` / `SMTP_PORT` — default to Gmail SSL (`smtp.gmail.com` : `465`); set these only for a non-Gmail provider.

*Triggering a send:*
- Put `[kindle]` anywhere in a commit message that also changes the book (`docs/guide/*.md` etc.) — the workflow rebuilds, then emails the EPUB. Mirrors the `[skip pdf]` convention.
- Or send the latest as-is without editing the book: *Actions → Rebuild book artifacts → Run workflow*, tick **send_to_kindle**.

*Notes:*
- Send-to-Kindle **adds** a new document each time (it never replaces), so this is deliberately opt-in. The attachment is date-stamped (`Causal-Thinking-with-TP-Studio-YYYY-MM-DD.epub`) so the newest is obvious; delete old copies from *Manage Your Content* occasionally.
- It skips silently until `KINDLE_TO` is set, so the flag is a harmless no-op before setup.

## What to verify on the device

| ✓ | Check | Expected |
|---|---|---|
| ☐ | The file imports | Appears in Library within a few minutes; no "unsupported format" error. |
| ☐ | Opens natively | Opens as a book, not as a fixed-layout PDF blob. |
| ☐ | Text reflows | Change the font size — text reflows to fit; no horizontal scrolling. |
| ☐ | TOC / navigation works | The Kindle "Go To" / table-of-contents lists the chapters and jumps correctly. |
| ☐ | Screenshots render | The book's screenshots + the CLR-map diagram appear in-line, not broken/missing. |
| ☐ | Cover shows | The title page renders as the book cover in the Library grid. |
| ☐ | Metadata correct | Title + author read correctly in the Library (not "Unknown"). |

## If something fails

- **Won't import / "unsupported"** — confirm Send-to-Kindle is using the `.epub` (not a renamed file); try the web uploader (Option B) which gives clearer errors.
- **Images missing** — likely an image-path or MIME-type issue in `build-book-epub.mjs`'s OEBPS/images packing; note which images and re-open as a build bug.
- **No TOC** — check `nav.xhtml` / `toc.ncx` generation in the builder.
- **Bad metadata** — check the `content.opf` Dublin Core block in the builder.

Record the outcome below so we know the round-trip was actually validated on hardware.

### Verification log

- _YYYY-MM-DD_ — device: _(e.g. Kindle Paperwhite 11th gen / Kindle app iOS)_ — result:
