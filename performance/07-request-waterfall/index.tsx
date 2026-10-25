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

// ⚠️ Production code with a request waterfall. Review it, then fix it.

export function ProfilePage({ userId, api }: { userId: string; api: ProfileApi }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.getUser(userId).then(setUser);
  }, [userId]);

  if (!user) return <p>Loading profile…</p>;

  return (
    <section aria-label="Profile">
      <h1>{user.name}</h1>
      <Posts user={user} api={api} filters={{ sort: 'new' }} />
    </section>
  );
}

function Posts({ user, api, filters }: { user: User; api: ProfileApi; filters: PostFilters }) {
  const [posts, setPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    api.getPosts(user.id, filters).then(setPosts);
  }, [user.id, filters]);

  if (!posts) return <p>Loading posts…</p>;

  return (
    <ul aria-label="Posts">
      {posts.map((post) => (
        <PostItem key={post.id} post={post} api={api} />
      ))}
    </ul>
  );
}

function PostItem({ post, api }: { post: Post; api: ProfileApi }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    api.getCommentCount(post.id).then(setCount);
  }, [post.id]);

  return (
    <li>
      {post.title} — {count ?? '…'} comments
    </li>
  );
}
