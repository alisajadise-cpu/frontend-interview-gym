# 09 · Spreadsheet — Solution

## 1. Requirements

### Functional
1. A huge grid (1M rows × 1,000 columns addressable) with column/row headers, resizable columns and rows, frozen header rows/columns.
2. Enter values (numbers, text, dates, booleans) and formulas (`=SUM(A1:A10) * $B$2`).
3. Results recalculate automatically when inputs change.
4. Selection: active cell, ranges, multiple ranges, full rows/columns. Fill handle (drag to fill) as a stretch.
5. Copy/cut/paste within the app and with Excel/Google Sheets.
6. Formatting: number formats, text styles, colors, alignment.
7. Undo/redo.
8. Multiple sheets (tabs) with cross-sheet references.
9. Designed for real-time collaboration later.

### Non-functional
- **60 fps scrolling** over any area of the grid.
- **Instant editing:** typing in a cell has no lag. Recalculation of typical sheets < 100 ms, and big recalculations never freeze the UI.
- **Memory proportional to filled cells**, not to grid size.
- **Correct formulas:** deterministic order, cycle detection, Excel-compatible error values (`#REF!`, `#DIV/0!`, `#NAME?`, `#VALUE!`, `#CYCLE!`/`#REF!`).
- **Accessible:** keyboard-first, screen reader support (ARIA grid).
- Localized: number/date formats, decimal separators (`1,5` vs `1.5`), function names, RTL sheets.

---

## 2. Architecture

```
┌────────────────────────────────────────── Browser ──────────────────────────────────────────┐
│                                                                                              │
│  Main thread                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ App shell (React): toolbar, formula bar, sheet tabs, menus, dialogs                     │ │
│  ├────────────────────────────────────────────────────────────────────────────────────────┤ │
│  │ Grid view                                                                               │ │
│  │  ┌──────────────────────────────┐  ┌──────────────────────────────────────────────┐    │ │
│  │  │ Canvas layer(s): cells,      │  │ DOM overlay: cell editor (<textarea>),       │    │ │
│  │  │ gridlines, headers, selection│  │ hidden a11y grid for visible cells,          │    │ │
│  │  │ (draw visible range only)    │  │ comments, dropdowns, resize handles          │    │ │
│  │  └──────────────▲───────────────┘  └───────────────▲──────────────────────────────┘    │ │
│  │                 │ viewport (row/col range, scroll offsets)                              │ │
│  │  ┌──────────────┴─────────────────────────────────┴─────────────────────────────────┐  │ │
│  │  │ Viewport/layout model: prefix sums of row heights & col widths, frozen panes     │  │ │
│  │  ├───────────────────────────────────────────────────────────────────────────────────┤  │ │
│  │  │ Interaction controller: selection, keyboard, mouse, clipboard, fill, resize       │  │ │
│  │  ├───────────────────────────────────────────────────────────────────────────────────┤  │ │
│  │  │ Command layer: every change = command → undo stack (+ later: collab ops)          │  │ │
│  │  ├───────────────────────────────────────────────────────────────────────────────────┤  │ │
│  │  │ Document store (main-thread mirror): values, formats, computed results (visible)  │  │ │
│  │  └──────────────────────────────────────▲───────────────────────┬────────────────────┘  │ │
│  └─────────────────────────────────────────┼───────────────────────┼──────────────────────┘ │
│                     computed values (dirty │ visible first)        │ edits (cell inputs)    │
│  ┌──────────────────────────────────────────┴───────────────────────▼─────────────────────┐ │
│  │ Calc worker: parser · AST cache · dependency graph · scheduler · function library      │ │
│  └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│  IndexedDB: local copy + pending ops (offline)                                               │
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               │ REST (load/save chunks) · WebSocket (collab ops)
                                    ┌──────────▼──────────┐
                                    │ Sheet service        │
                                    └──────────────────────┘
```

### Rendering decision: DOM vs Canvas

| | DOM (virtualized divs) | Canvas |
|---|---|---|
| Speed for many visible cells (a big monitor shows ~2,000+ cells) | Many nodes, style/layout cost during fast scroll | One draw call loop, very fast |
| Text quality, selection, IME | Native | Must handle yourself (but the editor is a DOM overlay anyway) |
| Accessibility | Native semantics possible | Needs a hidden accessible DOM mirror |
| Rich content (links, checkboxes, images) | Easy | Must draw and hit-test |
| Find in page / browser features | Work for visible cells | Don't work |

**Choice:** **Canvas for the grid** (this is what Google Sheets and Excel Online do for performance), with **DOM overlays** for anything interactive: the cell editor, dropdowns, comments, and a **hidden ARIA grid** for accessibility. For a smaller-scale product (< ~10k rows, moderate columns), a virtualized DOM grid is simpler and a fine answer. Say this trade-off.

---

## 3. Data model

```ts
type SheetId = string;
type CellKey = number;      // row * MAX_COLS + col (fast Map key), or `${row}:${col}`

type CellValue =
  | { t: 'empty' }
  | { t: 'number'; v: number }
  | { t: 'string'; v: string }
  | { t: 'boolean'; v: boolean }
  | { t: 'error'; v: '#REF!' | '#DIV/0!' | '#NAME?' | '#VALUE!' | '#N/A' | '#CYCLE!' };

interface Cell {
  input: string;            // what the user typed: "42", "=A1*2", "Hello"
  formula?: FormulaRef;     // parsed + compiled formula (in the worker)
  value: CellValue;         // computed value (for formulas) or parsed literal
  styleId?: number;         // index into a shared style table (dedupe formats)
}

interface Sheet {
  id: SheetId;
  name: string;
  // SPARSE storage: only filled cells exist
  cells: Map<CellKey, Cell>;
  rowCount: number;          // logical size (1,000,000)
  colCount: number;
  // only non-default sizes stored
  rowHeights: Map<number, number>;
  colWidths: Map<number, number>;
  defaultRowHeight: number;  // 21
  defaultColWidth: number;   // 100
  frozen: { rows: number; cols: number };
  merges: Array<{ r1: number; c1: number; r2: number; c2: number }>;
}

interface Style {          // shared, interned: 100k cells with "bold" share one Style
  bold?: boolean; italic?: boolean; color?: string; bg?: string;
  align?: 'start' | 'center' | 'end';
  numberFormat?: string;   // "0.00", "#,##0", "yyyy-mm-dd", "0%"
}

interface Selection {
  ranges: Array<{ r1: number; c1: number; r2: number; c2: number }>;
  active: { row: number; col: number };   // the cell with the cursor
  anchor: { row: number; col: number };   // where shift-selection started
}
```

**Why sparse?** 1M × 1,000 = 1 billion cells. An array of that size is impossible. A `Map` of filled cells (or per-row maps, or chunked blocks of 256×64 cells for locality and lazy loading) keeps memory proportional to real data.

**Row/column positions with variable sizes:** "what is the y-position of row 500,000?" must be fast. Store only non-default heights; position = `row × default + sum of (custom − default)` for custom rows before it. Use a **Fenwick tree (binary indexed tree) or segment tree** over size deltas: O(log n) for "position of row r", "which row is at y" (binary search), and updating a height. Hidden rows are height 0.

---

## 4. Interface (API)

```
GET  /api/sheets/:id                       → { meta, sheets: [{ id, name, rowCount, colCount, frozen, ... }] }
GET  /api/sheets/:id/s/:sheetId/chunks?r=0-511&c=0-63
→ { cells: Array<[row, col, input, styleId]>, styles: Style[] }        // load data near the viewport first
POST /api/sheets/:id/ops     { baseVersion, ops: Op[] }  → { version }   // batched edits (v1 without collab)
WSS  /collab/:id              ops + presence (v2)

type Op =
  | { type: 'setCell'; sheet: SheetId; row: number; col: number; input: string }
  | { type: 'setStyle'; sheet: SheetId; range: Range; styleDelta: Partial<Style> }
  | { type: 'insertRows'; sheet: SheetId; at: number; count: number }
  | { type: 'deleteCols'; sheet: SheetId; at: number; count: number }
  | { type: 'resizeCol'; sheet: SheetId; col: number; width: number };
```

**Loading strategy:** large sheets are loaded **in chunks**: first the chunk around the initial viewport, then the rest in the background (or on scroll). Formulas need their inputs, so the server can also send **cached computed values** for display, and the worker computes as data arrives.

---

## 5. Deep dives

### 5.1 2D virtualization and scrolling

- Visible range: from the scroll offsets, binary-search the row/col index at `scrollTop`/`scrollLeft` (Fenwick tree), then walk forward until the viewport height/width is filled. Add a small overscan.
- **Scroll container:** a native scrolling `div` with a huge "spacer" sized to total width/height, so scrollbars, touchpads, and momentum feel native. The canvas stays fixed (sticky) and redraws for the new offsets.
- Browsers limit element sizes (roughly 33.5 million px in Chrome, less in some others). 1M rows × 21 px = 21M px is close to the limit. For bigger sheets, **scale the scroll space** (map a smaller spacer to the real offset) or implement custom scrolling.
- **Frozen panes:** draw four regions: corner (frozen rows+cols), top (frozen rows, scrolls horizontally), left (frozen cols, scrolls vertically), and main. Each clipped on the canvas.
- Redraw on `scroll` within a `requestAnimationFrame`. Cache rendered **tiles** (e.g. 512×512 px offscreen canvases) and blit them for fast scrolling, redrawing only tiles with changed cells.
- Handle `devicePixelRatio` and crisp 1px gridlines (offset by 0.5 px).
- Text drawing is the expensive part: cache `measureText` results per (font, string), and clip/elide overflowing text. Text can overflow into empty neighbor cells (like Excel), which needs a check of neighbors.

### 5.2 Formula engine

**Parse:** tokenize and parse `=SUM(A1:A10) * $B$2` into an AST (recursive descent or Pratt parser with operator precedence: `^`, `*` `/`, `+` `-`, `&`, comparisons). Store references **relative** (R1C1 style: `R[-1]C[0]`), so copying a formula down a column shares the same compiled AST and makes fill/copy adjustments trivial. Cache parsed ASTs by normalized R1C1 text.

**Dependency graph:**
- For each formula cell, extract its **precedents** (cells/ranges it reads).
- Keep the reverse edges: **dependents** (who reads me).
- Ranges are a problem: `=SUM(A:A)` depends on a million cells. Don't expand ranges into individual edges. Store **range dependencies** in an interval/R-tree-like index. "Which formulas depend on cell A500?" = which stored ranges contain it.

**Recalculation after an edit:**
1. Mark the edited cell dirty.
2. Find all **transitive dependents** (BFS over dependents).
3. **Topologically sort** them (Kahn's algorithm) so every cell is computed after its inputs.
4. Evaluate in that order. Each evaluation reads computed values of precedents.
5. **Cycles:** if the topological sort can't finish (or a DFS finds a back edge), mark the cells in the cycle as `#CYCLE!`/circular reference error (unless iterative calculation is enabled).
6. Send changed values to the main thread, **visible cells first**, then the rest.

**Volatile functions** (`NOW()`, `RAND()`, `TODAY()`) recalculate on every recalc or on a timer, and make their dependents dirty.

**Errors propagate:** `=A1+1` where `A1` is `#DIV/0!` → `#DIV/0!`. `IF`/`IFERROR` evaluate lazily (only the taken branch), so the evaluator must support lazy arguments.

**Where it runs:** in a **Web Worker**. Typing stays responsive even if a recalc takes 2 seconds. Long recalcs are **chunked** (yield every ~10 ms to accept new edits) and **cancellable**: a new edit restarts the dirty set. The UI shows the old value with a subtle "calculating" indicator in the meantime.

**Structural changes** (insert/delete rows/cols): every reference after the change shifts. With R1C1-relative storage and range indexes, update affected references; references to deleted cells become `#REF!`. This is one of the hardest parts to get right; describe it, don't implement it in the interview.

### 5.3 Selection and keyboard

- Arrow keys move the active cell. `Shift+Arrow` extends the range. `Ctrl/Cmd+Arrow` jumps to the edge of the data region (needs a fast "next filled cell in this row/column" query: per-row/per-column sorted indexes of filled cells).
- `Tab`/`Enter` move right/down (and `Shift` reverses). `Ctrl+A`, `Shift+Space` (row), `Ctrl+Space` (column).
- Mouse: click, drag to select (auto-scroll when dragging near the edge), `Shift+click`, `Ctrl+click` adds a range.
- **Selection is drawn on the canvas** (or an overlay canvas), not as DOM elements per cell.
- Selected-range stats in the status bar (sum, average, count): computed from the worker for big ranges.

### 5.4 Editing

- A **single DOM `<textarea>`** positioned over the active cell acts as the editor. It handles IME (Persian, CJK), spellcheck, and text selection natively.
- Typing a character on a selected cell starts editing (replacing the value). `F2`/double-click edits with the existing value. `Enter` commits, `Esc` cancels.
- **Formula editing:** clicking or arrowing to other cells while typing a formula inserts references (point mode), with colored highlights for each referenced range. Autocomplete for function names and an argument hint tooltip.
- The **formula bar** mirrors the editor (two views of the same edit state).
- Input parsing on commit: locale-aware numbers (`1,5` in `de-DE`/`fa-IR` contexts), dates, percentages (`10%` → 0.1 with a percent format), and leading `'` to force text.

### 5.5 Clipboard

- **Copy:** write both `text/plain` (TSV: tabs between columns, newlines between rows, values quoted when they contain tabs/newlines/quotes) and `text/html` (a `<table>` with basic styles). Also an app-specific JSON format with formulas and styles, for copy/paste inside the app (in a custom MIME type where supported, or embedded in the HTML as a data attribute).
- **Paste:** prefer the internal format (keeps formulas, **adjusting relative references** by the paste offset), then HTML table (from Excel/Sheets/web pages, sanitized), then TSV.
- Use the `copy`/`paste` events on the focused element (works everywhere and gives synchronous access to `clipboardData`). The async Clipboard API needs permissions for reading.
- Big pastes (100k cells): parse in the worker, apply as **one command** (one undo step), show progress.
- **Cut** = copy + clear on paste (Excel semantics: references to cut cells move with them).

### 5.6 Undo/redo with commands

- Every change is a **command** with `apply` and `invert` (`setCell` stores the old input; `insertRows` inverts to `deleteRows` with the saved content).
- Group related changes (a paste, a fill, a sort) into one transaction = one undo step.
- The undo stack stores commands, not snapshots of the whole sheet (memory).
- **Collaboration-ready:** the same commands become **operations** sent to the server. With multiple users, undo should only undo **my** operations, transformed against others' later operations.

### 5.7 Collaboration (v2)

- Each cell edit is an operation on a cell **address**. Concurrent edits on **different cells** don't conflict. Same cell: last write wins (server order), which is what users expect in spreadsheets.
- Hard part: **structural operations** (insert/delete rows/cols) move addresses. A concurrent `setCell(B10)` and `insertRows(at 5)` must be transformed (`B10` → `B11`). This is classic **OT** with a central server ordering ops, which fits spreadsheets well (Google Sheets uses a server-ordered approach). A CRDT alternative stores rows/columns as lists with stable ids, so cell keys are `(rowId, colId)`: inserts don't change other cells' identities.
- Presence: other users' selections drawn on the canvas in their colors, names on hover.
- Formula recalculation stays local and deterministic: every client computes the same results from the same inputs (avoid locale-dependent or time-dependent results without care).

### 5.8 Performance summary

- Canvas + tile cache for drawing; DOM only for the editor and overlays.
- Sparse, chunked data. Interned styles. Typed arrays for numeric columns in large datasets.
- Fenwick trees for row/col positions.
- Formula engine in a worker with incremental, topologically ordered, cancellable recalc. Visible cells first.
- Batch worker → main thread updates per frame.
- Lazy-load features: charts, pivot tables, conditional-formatting editor, function help.
- Save edits in batches (every ~1 s or on idle), with an offline queue in IndexedDB.

### 5.9 Accessibility

- Canvas is invisible to screen readers, so maintain a **hidden DOM ARIA grid** for the visible region: `role="grid"` with `aria-rowcount`/`aria-colcount` set to the full size, `role="row"` with `aria-rowindex`, `role="gridcell"` with `aria-colindex`, column headers as `role="columnheader"`.
- Move **real focus** (or `aria-activedescendant`) with the active cell, so screen readers announce "B12, 42, formula SUM of B2 to B11".
- Announce selection changes ("Selected A1 to C10, 30 cells") politely.
- High-contrast mode support (`forced-colors` media query: draw with system colors).
- Keyboard shortcuts documented and discoverable (`Ctrl+/`).
- Zoom: the grid scales with browser zoom and an in-app zoom.

### 5.10 i18n and RTL

- Locale-aware parsing and formatting of numbers and dates (`Intl.NumberFormat`, custom formatting engine for Excel-style patterns like `#,##0.00`).
- Localized function names (Excel localizes `SUM`; Google Sheets mostly uses English names with localized argument separators `;` vs `,`). Store formulas in a canonical (English, `,`) form and display localized.
- **RTL sheets:** column A starts on the right, scrolling and the canvas drawing are mirrored, keyboard arrows follow visual direction. Cell text uses `dir="auto"`-like bidi logic when drawn (Canvas `direction` property).

### 5.11 Security

- Cell values are rendered as text on canvas (no HTML injection there). Links in cells are validated (`http/https`) before opening.
- Pasted HTML is parsed into data only (never inserted into the DOM unsanitized).
- **CSV/formula injection:** when **exporting** to CSV, values starting with `=`, `+`, `-`, `@` can execute in Excel. Escape them (prefix with `'`).
- Custom functions / scripts (Apps Script-like) must run sandboxed (worker or iframe with a strict CSP), never in the page context.
- Permission checks on the server for every op.

### 5.12 Observability

- Metrics: time to first visible cells, scroll frame times, edit → visible result latency, recalc duration and dirty-set size, worker queue length, save failures, memory.
- Error reports for formula engine crashes with the formula pattern (not the user's data).

---

## 6. Trade-offs

| Topic | Options | Choice |
|---|---|---|
| Rendering | Virtualized DOM / Canvas | **Canvas + DOM overlays** at this scale. DOM is fine for small grids. |
| Data | Dense arrays / sparse maps / chunks | **Sparse + chunked**, interned styles. |
| Row positions | Linear sums / Fenwick tree | **Fenwick tree** (O(log n) queries and updates). |
| Formula location | Main thread / worker / server | **Worker** (responsive UI). Server recalculation for API access and huge sheets. |
| Recalc | Recompute all / dependency graph | **Dependency graph + topological order**, range-aware index. |
| References | A1 absolute positions / R1C1 relative | **R1C1 relative internally**: shared ASTs, easy fill/copy. |
| Collaboration | OT / CRDT | **Server-ordered OT** fits cell + structural ops. CRDT with row/col ids is a valid alternative. |
| Undo | Snapshots / commands | **Commands** with inverses; collab-ready. |

---

## 7. Follow-up questions

**"How do you sort a range of 100k rows?"**
Sorting moves data, not formulas' meaning. Do it in the worker: compute the permutation, apply as one command (one undo step). References that point into the sorted range keep pointing at the same addresses (Excel behavior), which can surprise users; warn when formulas reference the range.

**"How do you implement `VLOOKUP` on 100k rows fast?"**
Exact match: build and cache a hash index for the lookup column, invalidated when that column changes. Approximate match on sorted data: binary search.

**"How would conditional formatting work?"**
Rules (range + condition + style) evaluated in the worker for visible cells first, results cached per cell and invalidated by the dependency graph like formulas.

**"A sheet with 2M formulas takes 10 s to recalc. What can you do?"**
Recompute only what's dirty (already), make sure ranges aren't expanded into millions of edges, parallelize independent subgraphs across several workers, use typed arrays for numeric columns, and cache function results. Optionally recalc on the server and stream values.

**"How do you keep the main-thread mirror and the worker consistent?"**
The worker is the source of truth for computed values. Each edit has a version number. The worker returns values tagged with the version they were computed for, and the main thread ignores results from older versions.

---

## 8. What separates a senior answer from a mid-level one

- **Mid-level:** "Render a big `<table>` with virtualization, store cells in a 2D array, re-evaluate all formulas on change."
- **Senior:**
  - Chooses **canvas with DOM overlays** and explains the a11y cost and the hidden ARIA grid.
  - **Sparse, chunked data**, interned styles, **Fenwick tree** for variable row/col sizes, browser max element size limit.
  - A real **formula engine**: AST, **R1C1 references**, **dependency graph with range indexes**, **topological recalc**, cycle detection, volatile functions, lazy `IF`.
  - Recalc in a **worker**, cancellable, **visible cells first**, version-tagged results.
  - **Clipboard interop** (TSV + HTML + internal format, reference adjustment) and CSV injection.
  - **Commands for undo** that become **collab ops**, and the structural-op transformation problem.
