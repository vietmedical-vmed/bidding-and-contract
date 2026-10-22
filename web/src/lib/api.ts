// Client for the bidding-login / bidding-api Edge Functions (org-wide login pattern,
// same as contract-management and ccdc-management).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const FN_LOGIN = "bidding-login";
const FN_API = "bidding-api";
const TOKEN_KEY = "bidding.token.v1";
const USER_KEY = "bidding.user.v1";

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

export function getUser(): User | null {
  if (!read(TOKEN_KEY)) return null;
  try {
    const raw = read(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
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

export function clearSession() {
  for (const store of [sessionStorage, localStorage]) {
    store.removeItem(TOKEN_KEY);
    store.removeItem(USER_KEY);
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

async function call<T>(fn: string, body: unknown): Promise<T> {
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
    });
  } catch {
    throw new ApiError("network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    if (data.error === "unauthorized") clearSession();
    throw new ApiError(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function login(username: string, password: string, remember: boolean): Promise<User> {
  const res = await call<User & { token: string }>(FN_LOGIN, { username, password });
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

export function api<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  return call<T>(FN_API, { action, token: read(TOKEN_KEY), payload });
}

export function errorMessage(err: unknown): string {
  const m = String(err instanceof Error ? err.message : err).toLowerCase();
  if (m.includes("invalid") || m.includes("not found")) return "Sai tên đăng nhập hoặc mật khẩu";
  if (m.includes("unauthorized")) return "Phiên hết hạn, vui lòng đăng nhập lại";
  if (m.includes("network") || m.includes("fetch")) return "Lỗi kết nối, vui lòng thử lại";
  return err instanceof Error ? err.message : "Lỗi không xác định";
}
