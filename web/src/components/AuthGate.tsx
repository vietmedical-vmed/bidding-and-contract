"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { clearSession, errorMessage, getToken, getUser, login, subscribeAuth, type User } from "@/lib/api";

const AuthContext = createContext<{ user: User; logout: () => void } | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthGate");
  return ctx;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  // undefined while prerendering (no storage there): the static HTML renders nothing.
  const token = useSyncExternalStore(subscribeAuth, () => getToken() ?? "", () => undefined);
  const user = useMemo(() => (token ? getUser() : null), [token]);

  if (token === undefined) return null;
  if (!user) return <LoginForm />;
  return <AuthContext.Provider value={{ user, logout: clearSession }}>{children}</AuthContext.Provider>;
}

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await login(username.trim(), password, remember); // AuthGate re-renders via subscribeAuth
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6">
        <div>
          <h1 className="text-lg font-semibold">Theo dõi kết quả thầu</h1>
          <p className="text-sm text-ink-2">Đăng nhập bằng tài khoản dùng chung của công ty.</p>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-ink-2">Tên đăng nhập</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="input w-full"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-ink-2">Mật khẩu</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="input w-full"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Ghi nhớ đăng nhập
        </label>
        {error && (
          <p role="alert" className="text-sm text-critical">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
