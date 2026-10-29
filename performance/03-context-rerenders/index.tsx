import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { probe } from "../../shared/probe";

export type User = { name: string };
export type Theme = "light" | "dark";

type TimeState = {
  now: number;
};

type ThemeState = {
  theme: Theme;
  toggleTheme: () => void;
};
type UserState = {
  user: User;
  setUser: (user: User) => void;
};

const TimeContext = createContext<TimeState | null>(null);
const ThemeContext = createContext<ThemeState | null>(null);
const UserContext = createContext<UserState | null>(null);

function useNow() {
  const ctx = useContext(TimeContext);
  if (!ctx) throw new Error("Wrap the app in <AppProvider>");
  return ctx.now;
}
function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("Wrap the app in <AppProvider>");
  return ctx;
}
function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("Wrap the app in <AppProvider>");
  return ctx;
}

export function AppProvider({
  children,
  initialUser = { name: "Ali" },
  initialTheme = "light",
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

  const timeValue = useMemo(() => ({ now }), [now]);
  const themeValue = useMemo(
    () => ({ theme, toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")) }),
    [theme],
  );
  const userValue = useMemo(
    () => ({
      user,
      setUser,
    }),
    [user],
  );

  return (
    <TimeContext.Provider value={timeValue}>
      <ThemeContext.Provider value={themeValue}>
        <UserContext.Provider value={userValue}>{children}</UserContext.Provider>
      </ThemeContext.Provider>
    </TimeContext.Provider>
  );
}

// ---- Components (keep the probe calls) ----

export function ThemedButton({ label }: { label: string }) {
  probe("ThemedButton");
  const { theme } = useTheme();
  return (
    <button
      data-theme={theme}
      style={theme === "dark" ? { background: "#222", color: "#eee" } : undefined}
    >
      {label}
    </button>
  );
}

export function Clock() {
  probe("Clock");
  const now = useNow();
  return <time aria-label="Current time">{new Date(now).toISOString().slice(11, 19)}</time>;
}

export function UserBadge() {
  probe("UserBadge");
  const { user } = useUser();
  return <span aria-label="Signed in user">{user.name}</span>;
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme}>Switch to {theme === "light" ? "dark" : "light"} theme</button>
  );
}

function RenameUser() {
  const { setUser } = useUser();
  return <button onClick={() => setUser({ name: "Sara" })}>Rename user</button>;
}

export function Dashboard({ buttonCount = 200 }: { buttonCount?: number }) {
  return (
    <div>
      <header style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Clock />
        <UserBadge />
        <ThemeToggle />
        <RenameUser />
      </header>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 12 }}>
        {Array.from({ length: buttonCount }, (_, i) => (
          <ThemedButton key={i} label={`Action ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}
