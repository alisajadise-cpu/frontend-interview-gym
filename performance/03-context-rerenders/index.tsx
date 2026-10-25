import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { probe } from '../../shared/probe';

export type User = { name: string };
export type Theme = 'light' | 'dark';

// ⚠️ Production code with performance problems. Review it, then fix it.

type AppState = {
  user: User;
  setUser: (user: User) => void;
  theme: Theme;
  toggleTheme: () => void;
  now: number;
};

const AppContext = createContext<AppState | null>(null);

function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('Wrap the app in <AppProvider>');
  return ctx;
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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <AppContext.Provider
      value={{ user, setUser, theme, toggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')), now }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useTheme() {
  const { theme, toggleTheme } = useApp();
  return { theme, toggleTheme };
}

export function useUser() {
  const { user, setUser } = useApp();
  return { user, setUser };
}

export function useNow() {
  return useApp().now;
}

// ---- Components (keep the probe calls) ----

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
