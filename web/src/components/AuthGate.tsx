"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { AlertCircle } from "@/components/icons";
import { changePassword, clearSession, errorMessage, getToken, getUser, login, subscribeAuth, type User } from "@/lib/api";

const AuthContext = createContext<{ user: User; logout: () => void } | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthGate");
  return ctx;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  // undefined while prerendering (no storage there): the static HTML shows the boot spinner.
  const token = useSyncExternalStore(subscribeAuth, () => getToken() ?? "", () => undefined);
  const user = useMemo(() => (token ? getUser() : null), [token]);

  if (token === undefined) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-slate-50 text-[13px] text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" />
          Đang khởi động…
        </div>
      </div>
    );
  }
  if (!user) return <LoginGate />;
  return <AuthContext.Provider value={{ user, logout: clearSession }}>{children}</AuthContext.Provider>;
}

const inputClass =
  "w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

/** Login card in the sale-target style, with the same "Đổi mật khẩu" mode. */
function LoginGate() {
  const [mode, setMode] = useState<"login" | "change">("login");
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const isChange = mode === "change";

  function switchMode(next: "login" | "change") {
    setMode(next);
    setError("");
    setInfo("");
    setNewPw("");
    setConfirmPw("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!username.trim() || !pw) {
      setError("Vui lòng nhập tài khoản và mật khẩu");
      return;
    }
    if (isChange && newPw !== confirmPw) {
      setError("Xác nhận mật khẩu mới không khớp");
      return;
    }
    setBusy(true);
    try {
      if (isChange) {
        await changePassword(username.trim(), pw, newPw);
        switchMode("login");
        setPw("");
        setInfo("Đổi mật khẩu thành công, vui lòng đăng nhập lại");
      } else {
        await login(username.trim(), pw, remember); // AuthGate re-renders via subscribeAuth
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-[360px] rounded-lg border border-slate-200 bg-white p-6 shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimizer */}
        <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="VietMedical" className="mx-auto mb-6 block h-12" />
        <h2 className="mb-5 text-center text-lg font-bold uppercase">{isChange ? "Đổi mật khẩu" : "Kết quả thầu"}</h2>
        <div className="space-y-2.5">
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tài khoản"
            autoComplete="username"
            className={inputClass}
          />
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={isChange ? "Mật khẩu hiện tại" : "Mật khẩu"}
            autoComplete="current-password"
            className={inputClass}
          />
          {isChange && (
            <>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                autoComplete="new-password"
                className={inputClass}
              />
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Xác nhận mật khẩu mới"
                autoComplete="new-password"
                className={inputClass}
              />
            </>
          )}
        </div>
        {!isChange && (
          <label className="mt-2.5 flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Ghi nhớ đăng nhập trên thiết bị này
          </label>
        )}
        {info && <div className="mt-3 text-xs text-green-600">{info}</div>}
        {error && (
          <div role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle size={12} /> {error}
          </div>
        )}
        <button
          disabled={busy}
          className="mt-4 w-full rounded-md bg-blue-500 px-3 py-2 text-[15px] font-bold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? (isChange ? "Đang đổi…" : "Đang xác thực…") : isChange ? "Đổi mật khẩu" : "Đăng nhập"}
        </button>
        <div className="mt-3.5 text-center">
          <button
            type="button"
            onClick={() => switchMode(isChange ? "login" : "change")}
            className="text-[13px] text-blue-500 hover:underline"
          >
            {isChange ? "Quay lại đăng nhập" : "Đổi mật khẩu"}
          </button>
        </div>
      </form>
      <div className="mt-6 text-center text-[11px] text-slate-400">Designed and developed by Do Hoang Giang</div>
    </div>
  );
}
