# Notices

This file documents third-party names, marks, and references that appear in TP
Studio's source code, user interface, and accompanying documentation.

## Trademark notice — Flying Logic

"Flying Logic" is a trademark of its owner (Flying Logic Inc. and/or its
predecessors and successors in interest). TP Studio is an independent,
open-source project. There is **no affiliation, endorsement, sponsorship, or
partnership** between TP Studio and the owner of the Flying Logic trademark.

Every reference to "Flying Logic" in this repository is **nominative** — used
only to identify the third-party product to which TP Studio relates by
interoperability, comparison, or factual reference. Specifically:

- **File format interoperability.** TP Studio can read and write the XML format
  used by Flying Logic 4 and 5. This support was implemented from the publicly
  documented format on `docs.flyinglogic.com`, for the purpose of letting users
  exchange diagrams between the two tools. Interoperability of this kind is
  recognized as a legitimate use of a trademark to identify the format being
  interoperated with.

- **Comparative reference.** TP Studio's documentation describes the project as
  "a focused, modern alternative to Flying Logic." That phrasing is comparative
  product positioning, not a claim of affiliation.

- **Book references.** TP Studio's accompanying practitioner guide
  (`docs/guide/`) refers to the third-party book *Thinking with Flying Logic*
  by title and by author attribution. Title references and commentary on
  published works are protected as fair use / fair dealing under the copyright
  laws of major jurisdictions.

Users of TP Studio who hold the Flying Logic trademark or its associated rights
and who believe any specific reference in this repository exceeds nominative
use are invited to contact the project maintainer via the repository's issue
tracker; we will revise the language in good faith.

## Trademark notice — other third-party products

Other product names appearing in TP Studio's documentation — including but not
limited to **OmniOutliner**, **Bike**, **Logseq**, **Mermaid**, **Graphviz /
DOT**, **VGL**, **PowerPoint**, **Microsoft Project**, **Apple Keynote**,
**Figma**, **Miro**, **MindManager**, **Lucidchart**, **Excalidraw**,
**tldraw**, **draw.io** — are the trademarks of their respective owners.
Their use in this repository is nominative or comparative; no affiliation or
endorsement is implied.

## Open-source dependencies

TP Studio's production runtime depends on third-party open-source software,
including React, React Flow (`@xyflow/react`), Zustand, dagre, jspdf,
svg2pdf.js, html-to-image, Lucide React, marked, micromark, DOMPurify, and
others. Each dependency carries its own license; the full list and license
texts are produced by the package manager's manifest (`package.json` +
`pnpm-lock.yaml`).

## TP Studio's own license

TP Studio does not currently distribute a public software license. The
repository is published in the open for transparency and reference, but
redistribution, modification, and commercial use are not yet covered by an
express license grant. A formal `LICENSE` file may be added in a future
session; if you intend to fork, redistribute, or build on this code, please
open an issue first.
