import { useEffect, useRef, useState } from "react";
import { C } from "vitest/dist/chunks/reporters.d.BuRON0I0.js";

export type FeedItem = { id: string; title: string };
export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

export type InfiniteFeedProps = {
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<FeedPage>;
};

/*On mount, load the first page with fetchPage(null, signal).
Render the list as an element with role="feed" and each item as an <article> (role article) that shows the item's title.
After the list, render a sentinel element and watch it with IntersectionObserver. When it intersects, load the next page using the last nextCursor.
Never have more than one request in flight. Intersections while loading are ignored.
Pages can overlap (new posts were added on the server). Dedupe items by id and keep the first occurrence.
While loading, the feed has aria-busy="true" (otherwise "false") and the text Loading… is shown.
If a request fails, show Something went wrong and a Retry button. Retry loads the same cursor again. Don't auto-load on intersection while in the error state.
When nextCursor is null, show You're all caught up and stop observing (disconnect the observer). No more requests.
On unmount, abort the in-flight request (signal.aborted === true) and disconnect the observer. Ignore results of aborted requests.
*/

type Status = "idle" | "error" | "loading" | "done";

export function InfiniteFeed({ fetchPage }: InfiniteFeedProps) {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const sentinel = useRef<HTMLDivElement>(null);

  const nextCursor = useRef<string>(null);
  const isDoneRef = useRef<boolean>(false);
  const seendIds = useRef<Set<string>>(new Set());
  const inFlight = useRef<AbortController | null>(null);

  const load = () => {
    if (isDoneRef.current === true || inFlight.current) return;
    setStatus("loading");
    inFlight.current = new AbortController();
    fetchPage(nextCursor.current, inFlight.current.signal)
      .then((res) => {
        console.log(res);
        nextCursor.current = res.nextCursor;
        isDoneRef.current = nextCursor.current === null;
        const notSeenItems = res.items.filter((item) => !seendIds.current.has(item.id));
        for (const notSeenItem of notSeenItems) {
          seendIds.current.add(notSeenItem.id);
        }
        setFeedItems((prev) => [...prev, ...notSeenItems]);
        setStatus(isDoneRef.current === true ? "done" : "idle");
        inFlight.current = null;
      })
      .catch(() => {
        setStatus("error");
        inFlight.current = null;
      });
  };

  useEffect(() => {
    load();
    return () => {
      inFlight.current?.abort();
      inFlight.current = null;
    };
  }, []);

  const shouldObserve = status === "idle";

  useEffect(() => {
    if (!shouldObserve) return;
    if (!sentinel.current) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        load();
      });
    });
    observer.observe(sentinel.current);

    return () => {
      observer.disconnect();
    };
  }, [shouldObserve]);

  const handleRetry = () => {
    load();
  };
  return (
    <div
      role="feed"
      aria-busy={status === "loading"}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      {feedItems.map((item) => (
        <article
          key={item.id}
          role="article"
          style={{ borderBottom: "1px solid grey", padding: 8 }}
        >
          {item.title}
        </article>
      ))}

      <div ref={sentinel} />

      {status === "loading" && <p>Loading…</p>}
      {status === "error" && (
        <div>
          <p>Something went wrong!</p>
          <button onClick={handleRetry}>Retry</button>
        </div>
      )}
      {status === "done" && "You're all caught up"}
    </div>
  );
}
