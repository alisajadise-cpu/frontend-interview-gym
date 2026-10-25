# 02 · Design a News Feed

**Difficulty:** Hard · **Time:** 45–60 min

## The prompt (as the interviewer says it)

> "Design the news feed for a social network like Facebook or Twitter. Users scroll an endless feed of posts from people they follow. They can create a post, react to posts, and see new posts that arrive while they're reading."

## Clarifying questions to ask (and the assumed answers)

| Question | Assumed answer |
|---|---|
| What's in a post? | Author, text, up to 4 images, a link preview, reaction counts, comment count, timestamp. |
| Post creation: text only or media too? | Text + images. Video is out of scope. |
| Reactions: one "like" or several types? | Several (like, love, haha…), one per user per post. |
| Comments? | Show the count and open a detail view. Comment threads are out of scope. |
| Ranking? | Server ranks the feed. The client just renders the order it gets. |
| Real-time new posts? | Yes. Show a "N new posts" pill, don't push content under the reader. |
| Platforms? | Web, desktop and mobile web. Many users on mid/low-end Android. |
| SEO? | The feed is behind login, so no. Single post pages are public and need SEO. |
| Scale? | Hundreds of millions of users. A heavy user scrolls 500+ posts in a session. |
| Offline? | Show the last feed when offline. Allow composing a post offline (nice to have). |
| i18n? | Yes, including RTL languages. |

## What the interviewer is looking for

- **Cursor-based pagination** and why offset breaks on a live feed.
- **Infinite scroll** done well: `IntersectionObserver`, prefetching, **virtualization** for long sessions, scroll restoration.
- A **normalized client store** (users and posts appear in many places).
- **Optimistic updates** for reactions and new posts, with rollback.
- Real-time updates (WebSocket/SSE/polling) without moving content under the user.
- Performance on low-end devices: images, bundle size, INP.
- Accessibility of an infinite feed (the `feed` ARIA role, keyboard navigation).

## Suggested time split

- Requirements: 5–7 min
- Architecture: 10 min
- Data model: 5–7 min
- API: 7–8 min
- Optimizations: 15–20 min
- Wrap-up: 3 min
