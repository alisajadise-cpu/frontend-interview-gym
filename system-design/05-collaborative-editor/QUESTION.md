# 05 · Design a Collaborative Document Editor (Google Docs)

**Difficulty:** Very hard · **Time:** 60 min

## The prompt (as the interviewer says it)

> "Design a collaborative rich-text editor like Google Docs. Several people can edit the same document at the same time and see each other's changes and cursors live. It should keep working when someone's connection drops."

## Clarifying questions to ask (and the assumed answers)

| Question | Assumed answer |
|---|---|
| Rich text features? | Paragraphs, headings, bold/italic/links, lists, images, tables (tables can be v2). |
| How many people edit at once? | Usually 1–10. Up to ~50 viewers/editors on a popular doc. |
| Document size? | Up to ~100 pages. |
| Real-time cursors and selections? | Yes, with names and colors. |
| Offline editing? | Yes: keep editing offline and merge when back online. |
| Comments and suggestions mode? | Comments yes (anchored to text). Suggestion mode is v2. |
| Version history? | Yes: view and restore past versions. |
| Undo? | Per-user undo (undo my changes, not other people's). |
| Permissions? | Owner, editor, commenter, viewer. |
| Do we build the server too? | Focus on the client and the sync protocol. The server is a box. |

## What the interviewer is looking for

- A clear **document model** (not raw `contenteditable` HTML).
- The **conflict resolution** approach: **OT vs CRDT**, the trade-offs, and which one you pick.
- The **sync protocol**: local-first edits, operations/updates, acknowledgements, reconnect, snapshots.
- **Presence** (cursors, selections) as separate, lossy, ephemeral data.
- **Offline** support and what happens on reconnect.
- **Undo in a shared document.**
- Performance for large documents, and accessibility of an editor.

## Suggested time split

- Requirements: 7 min
- Architecture + editor model: 12 min
- OT vs CRDT + sync protocol: 15 min
- Presence, offline, undo, history: 15 min
- Performance, a11y, security: 8 min
- Wrap-up: 3 min
