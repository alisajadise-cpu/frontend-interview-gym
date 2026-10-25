import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { probe } from '../../shared/probe';

export type User = { name: string };
export type Theme = 'light' | 'dark';

// One context per thing that changes at a different rate.
// A consumer re-renders only when the context it reads changes.
type ThemeValue = { theme: Theme; toggleTheme: () => void };
type UserValue = { user: User; setUser: (user: User) => void };

const ThemeContext = createContext<ThemeValue | null>(null);
const UserContext = createContext<UserValue | null>(null);
const NowContext = createContext<number | null>(null);

function required<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`${name} must be used inside <AppProvider>`);
  return value;
}

export function AppProvider({
  children,
  initialUser = { name: 'Ali' },
  initialTheme = 'light',
}: {
  children: ReactNode;
  initialUser?: User;
  initialTheme?: Theme;
}) {
  const [user, setUser] = useState(initialUser);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);
  // Memoized values: the object identity changes only when its content changes.
  const themeValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  const userValue = useMemo(() => ({ user, setUser }), [user]);

  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>
        <NowProvider>{children}</NowProvider>
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}

// The ticking state lives in its own small component. When it ticks, only this
// component and the NowContext consumers render. `children` is the same element
// as before, so React skips it.
function NowProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

export function useTheme() {
  return required(useContext(ThemeContext), 'useTheme');
}

export function useUser() {
  return required(useContext(UserContext), 'useUser');
}

export function useNow() {
  return required(useContext(NowContext), 'useNow');
}

// ---- Components (unchanged) ----

export function ThemedButton({ label }: { label: string }) {
  probe('ThemedButton');
  const { theme } = useTheme();
  return (
    <button data-theme={theme} style={theme === 'dark' ? { background: '#222', color: '#eee' } : undefined}>
      {label}
    </button>
  );
}

export function Clock() {
  probe('Clock');
  const now = useNow();
  return <time aria-label="Current time">{new Date(now).toISOString().slice(11, 19)}</time>;
}

export function UserBadge() {
  probe('UserBadge');
  const { user } = useUser();
  return <span aria-label="Signed in user">{user.name}</span>;
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>Switch to {theme === 'light' ? 'dark' : 'light'} theme</button>;
}

function RenameUser() {
  const { setUser } = useUser();
  return <button onClick={() => setUser({ name: 'Sara' })}>Rename user</button>;
}

export function Dashboard({ buttonCount = 200 }: { buttonCount?: number }) {
  return (
    <div>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Clock />
        <UserBadge />
        <ThemeToggle />
        <RenameUser />
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
        {Array.from({ length: buttonCount }, (_, i) => (
          <ThemedButton key={i} label={`Action ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}
