# 09 · Design a Spreadsheet (Google Sheets)

**Difficulty:** Very hard · **Time:** 60 min

## The prompt (as the interviewer says it)

> "Design the frontend of a spreadsheet app like Google Sheets. Users can scroll a huge grid, type values and formulas, select ranges, copy and paste, and see results update instantly. Later, several people will edit the same sheet."

## Clarifying questions to ask (and the assumed answers)

| Question | Assumed answer |
|---|---|
| Grid size? | Up to 1,000,000 rows × 1,000 columns addressable. Typical sheets have under 100k filled cells. |
| Formulas? | Yes: arithmetic, references (`A1`, `$A$1`, ranges `A1:B10`), common functions (`SUM`, `AVERAGE`, `IF`, `VLOOKUP`), cross-sheet references. |
| Formatting? | Number formats, bold/colors, column widths, row heights, merged cells (v2). |
| Selection? | Single cell, ranges, multiple ranges (Ctrl+click), whole rows/columns. |
| Copy/paste? | Within the app and to/from Excel/Google Sheets (TSV/HTML). |
| Undo/redo? | Yes. |
| Collaboration? | Not in v1, but the design must allow it (live cursors, concurrent edits). |
| Offline? | Nice to have. |
| Performance target? | Scrolling at 60 fps. Editing a cell and seeing dependent results in under ~100 ms for typical sheets. |
| Accessibility? | Must be usable with a keyboard and a screen reader. |

## What the interviewer is looking for

- **2D virtualization**: rendering only visible cells, variable column widths and row heights, frozen rows/columns.
- **DOM vs canvas** rendering decision and its trade-offs (and a11y consequences).
- A **sparse data model** for cells.
- A **formula engine**: parsing, a **dependency graph**, topological recalculation, cycle detection, and running it in a **Web Worker**.
- **Selection model** and **keyboard navigation**, editing overlay.
- **Clipboard** interoperability.
- **Undo/redo** as commands, and how it extends to **collaboration**.

## Suggested time split

- Requirements: 7 min
- Architecture + rendering decision: 12 min
- Data model: 8 min
- Formula engine deep dive: 12 min
- Selection, editing, clipboard, undo: 10 min
- Collaboration, a11y, performance wrap-up: 8 min
- Wrap-up: 3 min
