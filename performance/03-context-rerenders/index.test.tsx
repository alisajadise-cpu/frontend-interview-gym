import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { probeCount, resetProbes } from '../../shared/probe';
import { AppProvider, Dashboard } from './index';

const N = 50;

function setup() {
  const utils = render(
    <AppProvider initialUser={{ name: 'Ali' }}>
      <Dashboard buttonCount={N} />
    </AppProvider>,
  );
  resetProbes();
  return utils;
}

const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-01-01T10:00:00Z') });
});

describe('Context re-renders', () => {
  it('the clock ticks every second', async () => {
    setup();
    expect(screen.getByLabelText('Current time')).toHaveTextContent('10:00:00');
    for (let i = 0; i < 5; i++) await tick(1000);
    expect(screen.getByLabelText('Current time')).toHaveTextContent('10:00:05');
    expect(probeCount('Clock')).toBe(5);
  });

  it('clock ticks do not re-render the themed buttons', async () => {
    setup();
    for (let i = 0; i < 5; i++) await tick(1000);
    expect(probeCount('Clock')).toBe(5);
    expect(probeCount('ThemedButton')).toBe(0);
    expect(probeCount('UserBadge')).toBe(0);
  });

  it('toggling the theme re-renders every button once', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(probeCount('ThemedButton')).toBe(N);
    expect(screen.getByRole('button', { name: 'Action 1' })).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('renaming the user does not re-render the themed buttons', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Rename user' }));
    expect(screen.getByLabelText('Signed in user')).toHaveTextContent('Sara');
    expect(probeCount('UserBadge')).toBe(1);
    expect(probeCount('ThemedButton')).toBe(0);
    expect(probeCount('Clock')).toBe(0);
  });

  it('toggling the theme does not re-render the clock or the user badge', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(probeCount('Clock')).toBe(0);
    expect(probeCount('UserBadge')).toBe(0);
  });

  it('stops the timer on unmount', () => {
    const { unmount } = setup();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
