# Chapter 17 — Workshops with TP Studio

> *TOC workshops have a particular shape. Three to eight participants, one facilitator, four to six hours, one CRT or one EC built collaboratively. The patterns that make them work are mostly about discipline and rhythm; the tool plays a supporting role.*

## Setting up the room (or the call)

Before the workshop opens, you'll want:

- **Browse Lock OFF.** You're going to edit live. Make sure the lock icon is unlocked. (Lock it during breaks if you're walking away from the laptop.)
- **Reading Instructions strip visible** on EC docs — `Cmd+K → Toggle EC reading guide` if it's currently hidden. New participants need the 1/2/3 reminder of EC reading direction.
- **System Scope filled.** Document Inspector → System Scope section. Answer the seven CRT-Step-1 questions before you start. "What system are we analyzing?" "Who are the stakeholders?" "What's the boundary?" The workshop will be 30% less productive if you skip this.
- **Method Checklist visible** in the Document Inspector. The canonical recipe is right there; refer back to it during the workshop to keep the group on the rails.

For remote workshops:

- **One person drives.** Screen-shared. Everyone else watches.
- **Use a video call with view-only screen share, not a tool that lets remote participants click on your canvas.** Multi-cursor editing of a CRT is chaos.
- **Capture snapshots at every transition** — between CRT and EC, before the negative-branch hunt, before re-reading. The snapshot history is the workshop's memory.

## Facilitator gestures

Five gestures the facilitator uses repeatedly:

1. **Zoom-up annotation.** When a participant says "wait, that one — the third one from the left," hover over the node and let the zoom-up overlay surface its full title and description. Solves the "which entity?" problem instantly.
2. **Walkthrough overlay** (`Cmd+K → Start read-through`). When the group has been building for 20 minutes and is starting to lose the thread, switch to walkthrough. Reading the diagram aloud one edge at a time *re-centers* the group on what's been said.
3. **Side-by-side compare.** When a structural choice is being debated ("should we group these as AND or as two separate causes?"), branch first, try option A, snapshot, restore, try option B, snapshot. Now compare the two. The right answer is often obvious; the wrong answer was a function of having only seen one.
4. **CLR walkthrough.** Near the end of the workshop, run `Cmd+K → Start CLR walkthrough` to surface every open reservation. Address each as a group — even the dismissals are conversations.
5. **EC Workshop Sheet PDF.** For EC workshops, generate the workshop sheet PDF and print copies before the session. Each participant gets one; they write candidate assumptions on it during the cloud-construction phase, you transcribe the best onto the canvas.

## A 4-hour CRT workshop — example agenda

This is one viable shape. Adapt to your context.

| Time | Activity | TP Studio gesture |
| --- | --- | --- |
| 0:00–0:15 | Intro + ground rules. Verbalisation discipline explained. | — |
| 0:15–0:30 | System Scope. Fill the seven questions live. | Document Inspector → System Scope |
| 0:30–1:15 | UDE brainstorm. Each participant offers 1-3 UDEs. Capture as `Undesirable Effect` entities. | Double-click + Type → UDE |
| 1:15–1:30 | Break + verbalise. Read aloud all UDEs in sequence. | — |
| 1:30–2:30 | First cause chain (highest-impact UDE). Ask why. Build downward. Capture snapshot when done. | `Cmd+K → Capture snapshot` |
| 2:30–2:45 | Break. | — |
| 2:45–3:15 | Second cause chain. Look for convergence with the first. | — |
| 3:15–3:45 | Find core driver. CLR walkthrough. Dismiss with notes. | `Cmd+K → Find core driver`, then `Start CLR walkthrough` |
| 3:45–4:00 | Walk through final CRT. Capture final snapshot. Export reasoning narrative for distribution. | `Start read-through` then `Export → Reasoning narrative` |

The EC workshop is shorter — typically 2 hours — but follows the same shape: scope, build, verbalise, validate.

## What goes wrong, and what to do

- **One participant dominates.** The verbalisation discipline helps. So does rotating who reads aloud. If one voice is over-claiming, hand them the read-aloud job for the next five minutes.
- **The group disagrees on a cause.** Branch the doc and explore both. Reconverge at the snapshot.
- **A cause-claim "feels wrong" but no one can articulate why.** That's a CLR check waiting to be raised. Open the Inspector's Warnings list on the contested edge; usually a `cause-effect existence` or `cause-effect reversal` warning is already firing.
- **The workshop runs long.** Snapshot, set a hard stop, schedule a follow-up. A half-finished CRT is more valuable than a forced-completion one.
- **The CRT looks like a project plan.** You're confusing CRT (diagnosis) with PRT/TT (planning). Re-set: this diagram is *why things are the way they are now*, not *what we'll do about it*.

## Sidebars

> **🛠 How TP Studio helps**
> - **System Scope dialog** (Document Inspector) — "Step 0" for any analysis.
> - **Method Checklist** — the canonical recipe per diagram type, always visible.
> - **Zoom-up annotation** — readable titles at any zoom.
> - **Walkthrough overlay** — re-centers the group on the diagram's reading.
> - **Side-by-side compare** — for structural disagreements.
> - **CLR walkthrough** — final discipline pass.
> - **EC Workshop Sheet** — printed participant artifact.
> - **Browse Lock** — read-only mode for demos and screen recording.
> - **Capture snapshot** — workshop memory.

> **💡 Practitioner tips**
> - **Capture a snapshot every 20 minutes** in a workshop. Even unlabeled ones — you'll appreciate the rollback option.
> - **Read the diagram aloud at least three times** in a 4-hour workshop. Once after first cause chain, once after second, once at end.
> - **End with the exports.** Send the reasoning narrative + a PDF of the final CRT to participants within 24 hours.

> **⚠ Common mistakes**
> - **Skipping System Scope** because "we all know what we're analysing." You don't all know. The first 15 minutes are not optional.
> - **Multiple cursors on the canvas.** Cooperative editing of a TOC diagram does not work. One driver, one canvas.
> - **No verbalisation during build.** Just typing into entity titles is not a workshop; it's a brainstorm with a fancy outline tool. The aloud-reading is *the* gesture.

🔁 **End of Part 4.** The appendices are reference material — keyboard shortcuts, CLR rule details, settings, a worked end-to-end case study, glossary, further reading.

---

→ Continue to [Appendix A — End-to-end case study](appendix-a-case-study.md)
