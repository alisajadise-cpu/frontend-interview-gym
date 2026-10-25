# 03 · Design a Chat App (Messenger / WhatsApp Web)

**Difficulty:** Hard · **Time:** 45–60 min

## The prompt (as the interviewer says it)

> "Design the web client for a chat app like WhatsApp Web or Facebook Messenger. Users have a list of conversations, can open one, read the history, and send and receive messages in real time. Show when messages are delivered and read."

## Clarifying questions to ask (and the assumed answers)

| Question | Assumed answer |
|---|---|
| 1:1 only, or groups too? | Both. Groups up to 256 members. |
| Message types? | Text, images, replies to a message. Voice/video calls out of scope. |
| Delivery and read receipts? | Yes: sent ✓, delivered ✓✓, read (blue). In groups, "read by" details on demand. |
| Typing indicators and online presence? | Yes. |
| How much history? | Years. A conversation can have 100,000+ messages. |
| Offline? | Must queue messages when offline and send them later. Show cached conversations offline. |
| Multiple devices/tabs? | Yes. A message sent from the phone appears on the web too. Several tabs can be open. |
| End-to-end encryption? | Mention it, but don't design the crypto. |
| Search in messages? | Out of scope for v1 (server-side search, mention it). |
| Scale? | Millions of concurrent users. A busy group gets a few messages per second. |

## What the interviewer is looking for

- A **real-time transport** choice (WebSocket) with reconnection, heartbeats, and resync after a gap.
- **Message ordering** and **deduplication** (client ids, server sequence numbers).
- **Optimistic sending** with an **outbox**, retries, and idempotency.
- **Receipts** and presence that don't flood the network.
- **History**: cursor pagination backwards, **reverse virtualization**, scroll anchoring.
- **Local persistence** (IndexedDB) and multi-tab coordination.
- Accessibility of a live conversation.

## Suggested time split

- Requirements: 5–7 min
- Architecture: 10–12 min
- Data model: 7 min
- API / protocol: 8–10 min
- Optimizations / deep dive: 15 min
- Wrap-up: 3 min
