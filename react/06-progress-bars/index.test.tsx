import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressBars } from './index';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const values = () => screen.queryAllByRole('progressbar').map((b) => Number(b.getAttribute('aria-valuenow')));
const add = (n = 1) => {
  for (let i = 0; i < n; i++) fireEvent.click(screen.getByRole('button', { name: 'Add' }));
};

describe('ProgressBars', () => {
  it('adds an empty, accessible progress bar', () => {
    render(<ProgressBars />);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
    add();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });

  it('fills a bar over durationMs', async () => {
    render(<ProgressBars />);
    add();
    await wait(500);
    expect(values()).toEqual([25]);
    await wait(500);
    expect(values()).toEqual([50]);
    await wait(1000);
    expect(values()).toEqual([100]);
    await wait(1000);
    expect(values()).toEqual([100]);
  });

  it('fills at most 3 bars at once, the rest wait in order', async () => {
    render(<ProgressBars />);
    add(5);
    await wait(1000);
    expect(values()).toEqual([50, 50, 50, 0, 0]);
    await wait(1000);
    expect(values()).toEqual([100, 100, 100, 0, 0]);
    await wait(1000);
    expect(values()).toEqual([100, 100, 100, 50, 50]);
    await wait(1000);
    expect(values()).toEqual([100, 100, 100, 100, 100]);
  });

  it('a bar added while others fill starts at once when a slot is free', async () => {
    render(<ProgressBars />);
    add();
    await wait(1000);
    add();
    await wait(500);
    expect(values()).toEqual([75, 25]);
  });

  it('respects custom durationMs and concurrency', async () => {
    render(<ProgressBars durationMs={1000} concurrency={1} />);
    add(2);
    await wait(500);
    expect(values()).toEqual([50, 0]);
    await wait(500);
    expect(values()).toEqual([100, 0]);
    await wait(250);
    expect(values()).toEqual([100, 25]);
  });

  it('Pause keeps progress and Resume continues', async () => {
    render(<ProgressBars />);
    add(4);
    await wait(600);
    expect(values()).toEqual([30, 30, 30, 0]);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    await wait(5000);
    expect(values()).toEqual([30, 30, 30, 0]);
    add(); // adding while paused does not start anything
    await wait(1000);
    expect(values()).toEqual([30, 30, 30, 0, 0]);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await wait(1400);
    expect(values()).toEqual([100, 100, 100, 0, 0]);
    await wait(600);
    expect(values()).toEqual([100, 100, 100, 30, 30]);
  });

  it('runs no timers while paused, idle, or finished', async () => {
    render(<ProgressBars />);
    expect(vi.getTimerCount()).toBe(0);
    add();
    expect(vi.getTimerCount()).toBe(1); // ONE interval, not one per bar
    add(2);
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await wait(3000);
    expect(values()).toEqual([100, 100, 100]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Reset removes all bars and un-pauses', async () => {
    render(<ProgressBars />);
    add(2);
    await wait(400);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    add();
    await wait(1000);
    expect(values()).toEqual([50]);
  });

  it('leaves no timers after unmount', async () => {
    const { unmount } = render(<ProgressBars />);
    add(5);
    await wait(300);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports integer percentages', async () => {
    render(<ProgressBars durationMs={3000} />);
    add();
    await wait(100); // 3.33%
    expect(values()).toEqual([3]);
  });
});
