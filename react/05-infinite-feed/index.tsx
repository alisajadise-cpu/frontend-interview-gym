export type FeedItem = { id: string; title: string };
export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

export type InfiniteFeedProps = {
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<FeedPage>;
};

export function InfiniteFeed(props: InfiniteFeedProps) {
  // TODO: implement. See README.md for the full spec.
  return <div>TODO: implement InfiniteFeed</div>;
}
