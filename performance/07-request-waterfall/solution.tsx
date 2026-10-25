import { useEffect, useState } from 'react';

export type User = { id: string; name: string };
export type Post = { id: string; title: string };
export type PostFilters = { sort: 'new' | 'top' };
export type ProfileApi = {
  getUser(id: string): Promise<User>;
  getPosts(userId: string, filters: PostFilters): Promise<Post[]>;
  getCommentCount(postId: string): Promise<number>;
  /** Batch endpoint: one request for many posts. */
  getCommentCounts(postIds: string[]): Promise<Record<string, number>>;
};

// A module-level constant: the same object on every render, so it can't
// retrigger effects. (If filters come from the UI, depend on `filters.sort`.)
const DEFAULT_FILTERS: PostFilters = { sort: 'new' };

type State = {
  user: User | null;
  posts: Post[] | null;
  counts: Record<string, number> | null;
};

const EMPTY: State = { user: null, posts: null, counts: null };

export function ProfilePage({ userId, api }: { userId: string; api: ProfileApi }) {
  const [state, setState] = useState<State>(EMPTY);

  useEffect(() => {
    let ignore = false; // userId changed or unmounted: drop late responses
    setState(EMPTY);

    // Both requests only need `userId`, which we already have from the route.
    // Start them at the same time instead of user → posts.
    api.getUser(userId).then((user) => {
      if (!ignore) setState((s) => ({ ...s, user }));
    });

    api
      .getPosts(userId, DEFAULT_FILTERS)
      .then((posts) => {
        if (ignore) return null;
        setState((s) => ({ ...s, posts }));
        // One batched request instead of one request per post (N+1).
        return api.getCommentCounts(posts.map((p) => p.id));
      })
      .then((counts) => {
        if (!ignore && counts) setState((s) => ({ ...s, counts }));
      });

    return () => {
      ignore = true;
    };
  }, [api, userId]);

  const { user, posts, counts } = state;

  // Each part shows as soon as ITS data is ready.
  return (
    <section aria-label="Profile">
      {user ? <h1>{user.name}</h1> : <p>Loading profile…</p>}
      {posts ? (
        <ul aria-label="Posts">
          {posts.map((post) => (
            <li key={post.id}>
              {post.title} — {counts?.[post.id] ?? '…'} comments
            </li>
          ))}
        </ul>
      ) : (
        <p>Loading posts…</p>
      )}
    </section>
  );
}
