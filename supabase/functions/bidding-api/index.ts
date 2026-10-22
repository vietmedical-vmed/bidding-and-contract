// Supabase Edge Function: bidding-api
// Verify HMAC token (do bidding-login hoặc app khác cùng TOKEN_SECRET phát) rồi dispatch theo `action`.
// Payload chuẩn: { action, token, payload }
//
// Quyền xem (giống contract-api / ccdc-api):
//   - admin, manager      : toàn bộ
//   - product_manager     : theo users.scope (danh sách nhóm sản phẩm)
//   - role khác           : theo users.mien (MB/MN/..., BOTH/ALL = toàn bộ)
//
// Deploy:
//   supabase functions deploy bidding-api --no-verify-jwt --project-ref nrfxymnfmjhbsgpipvkb

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const enc = new TextEncoder();

function b64urlDecode(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64url(bytes: Uint8Array) {
  const s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return new Uint8Array(sig);
}

type Session = {
  username: string;
  ho_ten: string;
  role: string;
  mien: string;
  bu: string;
  scope: string;
  exp: number;
};

// So sánh constant-time để không lộ chữ ký qua thời gian phản hồi.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyToken(token: string, secret: string): Promise<Session | null> {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [p, sig] = token.split(".");
  const expected = b64url(await hmac(secret, p));
  if (!timingSafeEqual(expected, sig)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as Session;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ─── Permission ──────────────────────────────────────────────────────────
const MIEN_NORM: Record<string, string> = {
  MB: "Miền Bắc", MN: "Miền Nam", MT: "Miền Trung",
  "Miền Bắc": "Miền Bắc", "Miền Nam": "Miền Nam", "Miền Trung": "Miền Trung",
};

type Scope = {
  mienIn: string[] | null; // null = không giới hạn
  nhomIn: string[] | null;
};

// users.mien có thể là nhiều miền "MB, MT" (area_manager). BOTH/ALL/rỗng = không giới hạn miền.
function mienList(raw: string): string[] | null {
  const list = String(raw || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (!list.length || list.some((m) => m.toUpperCase() === "BOTH" || m.toUpperCase() === "ALL")) return null;
  return [...new Set(list.map((m) => MIEN_NORM[m] ?? m))];
}

// users.scope "Cột sống Ulrich, Khớp UOC" -> tên nhóm đúng như trong dữ liệu (so khớp không phân biệt hoa thường).
async function nhomList(admin: SupabaseClient, raw: string): Promise<string[] | null> {
  const wanted = new Set(String(raw || "").split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean));
  if (!wanted.size) return null;
  const { data, error } = await admin.rpc("bid_filter_options", {});
  if (error) throw new Error(error.message);
  const all = ((data?.nhom_san_pham ?? []) as string[]);
  return all.filter((n) => wanted.has(n.toLowerCase()));
}

async function getScope(session: Session, admin: SupabaseClient): Promise<Scope> {
  switch (session.role) {
    case "admin":
    case "manager":
      return { mienIn: null, nhomIn: null };
    case "product_manager":
      return { mienIn: null, nhomIn: await nhomList(admin, session.scope) };
    default:
      return { mienIn: mienList(session.mien), nhomIn: null };
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────
type Filters = { nam?: number; bu?: string; sale?: string };

function readFilters(p: any): Filters {
  const nam = Number(p?.nam);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    nam: Number.isInteger(nam) && nam > 0 ? nam : undefined,
    bu: str(p?.bu),
    sale: str(p?.sale),
  };
}

// No year in the request = the latest year the user can see; nam="all" = every year.
async function withDefaultYear(admin: SupabaseClient, f: Filters, p: any, scope: Scope): Promise<Filters> {
  if (f.nam || p?.nam === "all") return f;
  const { data, error } = await admin.rpc("bid_filter_options", { p_mien_in: scope.mienIn, p_nhom_in: scope.nhomIn });
  if (error) throw new Error(error.message);
  return { ...f, nam: (data?.nam ?? [])[0] };
}

// "Dữ liệu cập nhật đến ngày": the Excel file's last-modified date of the latest successful sync,
// as yyyy-mm-dd in Vietnam time.
async function dataUpdatedAt(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .from("bid_sync_runs")
    .select("source_modified_at, finished_at")
    .eq("status", "success")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const ts = data?.source_modified_at ?? data?.finished_at;
  return ts ? new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }) : null;
}

// Nhóm SP / miền are multi-select: intersect the user's choice with what their role may see.
// An empty intersection must match nothing, so it becomes a value no row has.
function narrow(allowed: string[] | null, chosen: unknown): string[] | null {
  const picked = Array.isArray(chosen) ? chosen.filter((v): v is string => typeof v === "string" && v !== "") : [];
  if (!picked.length) return allowed;
  const out = allowed ? picked.filter((v) => allowed.includes(v)) : picked;
  return out.length ? out : ["\u0000"];
}

function effectiveScope(scope: Scope, p: any): Scope {
  return { mienIn: narrow(scope.mienIn, p?.mien), nhomIn: narrow(scope.nhomIn, p?.nhom) };
}

// Fiscal year runs T4 → T3, so "từ T11 đến T2" means 11, 12, 1, 2.
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

/** Months between `tu` and `den` (inclusive, fiscal order); null when no month filter is set. */
function monthRange(tu: unknown, den: unknown): number[] | null {
  const valid = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 12 ? Number(v) : null);
  const from = valid(tu);
  const to = valid(den);
  if (from === null && to === null) return null;
  let i = FISCAL_MONTHS.indexOf(from ?? 4);
  let j = FISCAL_MONTHS.indexOf(to ?? 3);
  if (i > j) [i, j] = [j, i];
  return FISCAL_MONTHS.slice(i, j + 1);
}

function sanitizeSearch(s: string): string {
  return String(s ?? "").replace(/[,()*\\%]/g, " ").trim();
}

// KPI counted by gói thầu (see migration 20261022000400_bid_package_kpi.sql).
async function kpi(admin: SupabaseClient, group: string | null, f: Filters, scope: Scope) {
  const { data, error } = await admin.rpc("bid_package_kpi", {
    p_group: group,
    p_nam: f.nam ?? null,
    p_bu: f.bu ?? null,
    p_sale: f.sale ?? null,
    p_mien_in: scope.mienIn,
    p_nhom_in: scope.nhomIn,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

const ITEM_COLUMNS =
  "id,nam,thang_du_thau,so_tbmt,ben_moi_thau,ten_goi_thau,danh_muc_hang,model,nhom_san_pham,bu,mien,sale," +
  "so_luong,don_gia,thanh_tien,ket_qua,ket_qua_thau,ngay_trung_thau";
const KET_QUA = new Set(["trung", "truot", "cho_kq", "huy"]);
const PAGE_SIZE = 50;

async function handleAction(action: string, p: any, session: Session, scope: Scope, admin: SupabaseClient) {
  switch (action) {
    case "whoami":
      return {
        ok: true,
        username: session.username,
        ho_ten: session.ho_ten,
        role: session.role,
        mien: session.mien,
        bu: session.bu,
        scope: session.scope,
      };

    case "filter-options": {
      const { data, error } = await admin.rpc("bid_filter_options", {
        p_mien_in: scope.mienIn,
        p_nhom_in: scope.nhomIn,
      });
      if (error) throw new Error(error.message);
      return { ok: true, options: data };
    }

    case "dashboard": {
      scope = effectiveScope(scope, p);
      const updatedAtP = dataUpdatedAt(admin);
      const f = await withDefaultYear(admin, readFilters(p), p, scope);
      // The month chart needs a single year: the filtered one, else the latest year with data.
      const monthYearP = f.nam
        ? Promise.resolve(f.nam)
        : kpi(admin, "nam", f, scope).then((rows) => Math.max(0, ...rows.map((r: any) => Number(r.grp) || 0)) || null);
      const [total, bu, nhom, mien, sale, lyDo, [monthYear, thang]] = await Promise.all([
        kpi(admin, null, f, scope),
        kpi(admin, "bu", f, scope),
        kpi(admin, "nhom_san_pham", f, scope),
        kpi(admin, "mien", f, scope),
        kpi(admin, "sale", f, scope),
        kpi(admin, "ly_do", f, scope),
        monthYearP.then(async (y) => [y, y ? await kpi(admin, "thang", { ...f, nam: y }, scope) : []] as const),
      ]);
      return {
        ok: true,
        nam: f.nam ?? null,
        updatedAt: await updatedAtP,
        total: total[0] ?? null,
        bu,
        nhom,
        mien,
        sale,
        lyDo,
        monthYear,
        thang,
      };
    }

    case "items": {
      scope = effectiveScope(scope, p);
      const f = await withDefaultYear(admin, readFilters(p), p, scope);
      const page = Math.max(1, Number(p?.page) || 1);
      const kq = KET_QUA.has(p?.kq) ? p.kq : undefined;
      const q = sanitizeSearch(p?.q);
      const months = monthRange(p?.tu, p?.den);

      let query = admin.from("bid_items").select(ITEM_COLUMNS, { count: "exact" });
      if (f.nam) query = query.eq("nam", f.nam);
      if (f.bu) query = query.eq("bu", f.bu);
      if (f.sale) query = query.eq("sale", f.sale);
      if (scope.mienIn) query = query.in("mien", scope.mienIn);
      if (scope.nhomIn) query = query.in("nhom_san_pham", scope.nhomIn);
      if (kq) query = query.eq("ket_qua", kq);
      if (months) query = query.in("thang_du_thau_so", months);
      if (q) {
        const like = `*${q}*`;
        query = query.or(
          ["danh_muc_hang", "ben_moi_thau", "so_tbmt", "model", "ten_goi_thau"].map((c) => `${c}.ilike.${like}`).join(","),
        );
      }

      const from = (page - 1) * PAGE_SIZE;
      const { data, count, error } = await query
        .order("nam", { ascending: false })
        .order("thang_du_thau_so", { ascending: false, nullsFirst: false })
        .order("so_tbmt")
        .order("source_row")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      return { ok: true, rows: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE };
    }

    case "missing-info": {
      // Packages whose items lack fields the dashboard groups by, or whose items disagree on
      // the region (a package belongs to one miền), with the Excel rows to fix.
      scope = effectiveScope(scope, p);
      const f = await withDefaultYear(admin, readFilters(p), p, scope);

      // Every item in the filters is needed to spot region conflicts; hosted PostgREST returns
      // at most 1000 rows per request, so read page by page.
      type Row = {
        nam: number; so_tbmt: string | null; ben_moi_thau: string | null; ten_goi_thau: string | null;
        sheet_name: string; source_row: number; phan_loai: string | null; nhom_san_pham: string | null;
        mien: string | null; sale: string | null;
      };
      const data: Row[] = [];
      for (let from = 0; ; from += 1000) {
        let query = admin
          .from("bid_items")
          .select("nam,so_tbmt,ben_moi_thau,ten_goi_thau,sheet_name,source_row,phan_loai,nhom_san_pham,mien,sale");
        if (f.nam) query = query.eq("nam", f.nam);
        if (f.bu) query = query.eq("bu", f.bu);
        if (f.sale) query = query.eq("sale", f.sale);
        if (scope.mienIn) query = query.in("mien", scope.mienIn);
        if (scope.nhomIn) query = query.in("nhom_san_pham", scope.nhomIn);
        const { data: page, error } = await query
          .order("nam", { ascending: false })
          .order("so_tbmt")
          .order("source_row")
          .range(from, from + 999);
        if (error) throw new Error(error.message);
        data.push(...((page ?? []) as Row[]));
        if (!page || page.length < 1000) break;
      }

      // Regions used by each package, to flag packages split across several.
      const pkgKey = (r: Row) => `${r.nam}|${r.so_tbmt ?? `row-${r.source_row}`}`;
      const regionsOf = new Map<string, Set<string>>();
      for (const r of data) {
        if (!r.mien) continue;
        const set = regionsOf.get(pkgKey(r)) ?? new Set<string>();
        set.add(r.mien);
        regionsOf.set(pkgKey(r), set);
      }

      type Gap = { field: string; rows: number[]; note?: string };
      const packages = new Map<string, {
        nam: number; so_tbmt: string | null; ben_moi_thau: string | null; ten_goi_thau: string | null;
        sheet: string; gaps: Map<string, Gap>;
      }>();
      const flagged = new Set<Row>();
      for (const r of data) {
        const key = pkgKey(r);
        const regions = regionsOf.get(key);
        const regionConflict = Boolean(regions && regions.size > 1);
        if (r.nhom_san_pham && r.mien && r.sale && !regionConflict) continue;

        let pkg = packages.get(key);
        if (!pkg) {
          pkg = { nam: r.nam, so_tbmt: r.so_tbmt, ben_moi_thau: r.ben_moi_thau, ten_goi_thau: r.ten_goi_thau, sheet: r.sheet_name, gaps: new Map() };
          packages.set(key, pkg);
        }
        const add = (field: string, note?: string) => {
          const gap = pkg!.gaps.get(field + (note ?? "")) ?? { field, rows: [], note };
          gap.rows.push(r.source_row);
          pkg!.gaps.set(field + (note ?? ""), gap);
          flagged.add(r);
        };
        if (!r.nhom_san_pham) {
          add("Phân loại", r.phan_loai ? `"${r.phan_loai}" chưa có trong bảng mapping nhóm sản phẩm` : undefined);
        }
        if (!r.mien) add("Miền");
        else if (regionConflict) add("Miền không thống nhất", `ghi "${r.mien}", các dòng khác của gói ghi miền khác`);
        if (!r.sale) add("Sale");
      }
      const list = [...packages.values()].map((pkg) => ({ ...pkg, gaps: [...pkg.gaps.values()] }));
      return { ok: true, nam: f.nam ?? null, packages: list, items: flagged.size };
    }

    default:
      return { ok: false, error: `unknown action: ${action}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  const secret = Deno.env.get("TOKEN_SECRET");
  if (!secret) return json({ ok: false, error: "TOKEN_SECRET chua duoc set" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad_body" }, 400); }

  const { action, token, payload } = body ?? {};
  if (!action) return json({ ok: false, error: "missing action" }, 400);

  const session = await verifyToken(token, secret);
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Token còn hạn chưa đủ: tài khoản bị khoá (shared.users.active = false) phải mất quyền ngay.
  const { data: dbUser, error: userErr } = await admin
    .schema("shared").from("users")
    .select("active")
    .eq("username", session.username)
    .maybeSingle();
  if (userErr) return json({ ok: false, error: "server_error" }, 500);
  if (!dbUser || dbUser.active === false) return json({ ok: false, error: "unauthorized" }, 401);

  try {
    const started = Date.now();
    const scope = await getScope(session, admin);
    const result = await handleAction(action, payload || {}, session, scope, admin);
    // took_ms lets the browser console show where time goes when a page feels slow.
    return json({ ...result, took_ms: Date.now() - started }, result.ok === false ? 400 : 200);
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
