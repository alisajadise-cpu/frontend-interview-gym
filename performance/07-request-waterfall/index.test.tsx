import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage, type Post, type ProfileApi, type User } from './index';

const USERS: Record<string, User> = { u1: { id: 'u1', name: 'Ada' }, u2: { id: 'u2', name: 'Bob' } };
const POSTS: Record<string, Post[]> = {
  u1: [
    { id: 'p1', title: 'Hello' },
    { id: 'p2', title: 'Second post' },
    { id: 'p3', title: 'Waterfalls' },
  ],
  u2: [{ id: 'p9', title: 'Bob writes' }],
};
const COUNTS: Record<string, number> = { p1: 3, p2: 0, p3: 12, p9: 7 };

/** Every endpoint answers after `latency(userId)` ms (default 100). */
function makeApi(latency: (userId: string) => number = () => 100) {
  const after = <T,>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
  const api = {
    getUser: vi.fn((id: string) => after(latency(id), USERS[id])),
    getPosts: vi.fn((userId: string) => after(latency(userId), POSTS[userId])),
    getCommentCount: vi.fn((postId: string) => after(100, COUNTS[postId])),
    getCommentCounts: vi.fn((ids: string[]) => after(100, Object.fromEntries(ids.map((id) => [id, COUNTS[id]])))),
  };
  return api satisfies ProfileApi;
}

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const postTexts = () =>
  within(screen.getByRole('list', { name: 'Posts' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

beforeEach(() => {
  vi.useFakeTimers();
});

describe('ProfilePage', () => {
  it('starts loading the user and the posts at the same time', () => {
    const api = makeApi();
    render(<ProfilePage userId="u1" api={api} />);
    expect(api.getUser).toHaveBeenCalledWith('u1');
    expect(api.getPosts).toHaveBeenCalledTimes(1);
    expect(api.getPosts.mock.calls[0][0]).toBe('u1');
    expect(screen.getByText('Loading profile…')).toBeInTheDocument();
    expect(screen.getByText('Loading posts…')).toBeInTheDocument();
  });

  it('shows everything within 200ms (two round trips, not three)', async () => {
    const api = makeApi();
    render(<ProfilePage userId="u1" api={api} />);
    await advance(200);
    expect(screen.getByRole('heading', { name: 'Ada' })).toBeInTheDocument();
    expect(postTexts()).toEqual(['Hello — 3 comments', 'Second post — 0 comments', 'Waterfalls — 12 comments']);
  });

  it('loads comment counts with one batched request (no N+1)', async () => {
    const api = makeApi();
    render(<ProfilePage userId="u1" api={api} />);
    await advance(500);
    expect(api.getCommentCount).not.toHaveBeenCalled();
    expect(api.getCommentCounts).toHaveBeenCalledTimes(1);
    expect(api.getCommentCounts).toHaveBeenCalledWith(['p1', 'p2', 'p3']);
  });

  it('does not refetch when the parent re-renders', async () => {
    const api = makeApi();
    const { rerender } = render(<ProfilePage userId="u1" api={api} />);
    await advance(500);
    for (let i = 0; i < 3; i++) rerender(<ProfilePage userId="u1" api={api} />);
    await advance(500);
    expect(api.getUser).toHaveBeenCalledTimes(1);
    expect(api.getPosts).toHaveBeenCalledTimes(1);
    expect(api.getCommentCounts.mock.calls.length + api.getCommentCount.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('never shows the previous user’s data after userId changes (race)', async () => {
    // u1 is slow, u2 is fast: u1's responses arrive last.
    const api = makeApi((id) => (id === 'u1' ? 300 : 50));
    const { rerender } = render(<ProfilePage userId="u1" api={api} />);
    await advance(10);
    rerender(<ProfilePage userId="u2" api={api} />);
    await advance(1000);
    expect(screen.getByRole('heading', { name: 'Bob' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ada' })).toBeNull();
    expect(postTexts()).toEqual(['Bob writes — 7 comments']);
  });
});
