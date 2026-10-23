// Client for the bidding-login / bidding-api / contract-api Edge Functions (org-wide login
// pattern, same as ccdc-management and sale-target). One token from bidding-login works for
// both APIs, since every function in the project signs and checks it with TOKEN_SECRET.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const FN_LOGIN = "bidding-login";
const FN_API = { bidding: "bidding-api", contract: "contract-api" } as const;
// All org apps share the github.io origin, so the keys must not collide with the old
// bidding-management / contract-management sites.
const TOKEN_KEY = "bidding-contract.token.v1";
const USER_KEY = "bidding-contract.user.v1";
const TIMEOUT_MS = 45_000;

export type Service = keyof typeof FN_API;

export type User = {
  username: string;
  ho_ten: string;
  role: string;
  scope?: string;
  bu?: string;
  mien?: string;
};

export class ApiError extends Error {}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string, remember: boolean) {
  (remember ? localStorage : sessionStorage).setItem(key, value);
}

const AUTH_EVENT = "bidding:auth";

/** For useSyncExternalStore: notifies on login/logout in this tab and in other tabs. */
export function subscribeAuth(onChange: () => void) {
  window.addEventListener(AUTH_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(AUTH_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getToken(): string | null {
  return read(TOKEN_KEY);
}

export function getUser(): User | null {
  if (!read(TOKEN_KEY)) return null;
  try {
    const raw = read(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  for (const store of [sessionStorage, localStorage]) {
    store.removeItem(TOKEN_KEY);
    store.removeItem(USER_KEY);
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

async function call<T>(fn: string, body: unknown, label: string): Promise<T> {
  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.warn(`[bidding] ${label} failed after ${Math.round(performance.now() - started)}ms`, err);
    throw new ApiError(err instanceof DOMException && err.name === "TimeoutError" ? "timeout" : "network");
  }
  const data = await res.json().catch(() => ({}));
  // Server time vs. round trip: tells a slow query apart from a slow network / cold start.
  console.info(`[bidding] ${label}: HTTP ${res.status}, ${Math.round(performance.now() - started)}ms (server ${data.took_ms ?? "?"}ms)`);
  if (!res.ok || data.ok === false) {
    if (data.error === "unauthorized") clearSession();
    throw new ApiError(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function login(username: string, password: string, remember: boolean): Promise<User> {
  const res = await call<User & { token: string }>(FN_LOGIN, { username, password }, "login");
  write(TOKEN_KEY, res.token, remember);
  const user: User = {
    username: res.username,
    ho_ten: res.ho_ten || res.username,
    role: String(res.role || "").toLowerCase(),
    scope: res.scope,
    bu: res.bu,
    mien: res.mien,
  };
  write(USER_KEY, JSON.stringify(user), remember);
  window.dispatchEvent(new Event(AUTH_EVENT));
  return user;
}

/** Same as the other apps: bidding-login checks the old password, then stores the new one. */
export async function changePassword(username: string, password: string, newPassword: string): Promise<void> {
  await call(FN_LOGIN, { username, password, newPassword }, "change-password");
}

export function api<T>(action: string, payload: Record<string, unknown> = {}, service: Service = "bidding"): Promise<T> {
  return call<T>(FN_API[service], { action, token: read(TOKEN_KEY), payload }, `${service}:${action}`);
}

export function errorMessage(err: unknown): string {
  const m = String(err instanceof Error ? err.message : err).toLowerCase();
  if (m.includes("invalid") || m.includes("not found")) return "Sai tài khoản hoặc mật khẩu";
  if (m.includes("weak_password")) return "Mật khẩu mới tối thiểu 6 ký tự";
  if (m.includes("same_password")) return "Mật khẩu mới phải khác mật khẩu cũ";
  if (m.includes("unauthorized")) return "Phiên hết hạn, vui lòng đăng nhập lại";
  if (m.includes("timeout")) return "Máy chủ phản hồi quá lâu, vui lòng bấm Reload";
  if (m.includes("network") || m.includes("fetch")) return "Lỗi kết nối, vui lòng thử lại";
  return err instanceof Error ? err.message : "Lỗi không xác định";
}
