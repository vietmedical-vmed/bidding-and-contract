"use client";

import { useState } from "react";
import { AlertTriangle } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { fmtInt, type Filters } from "@/lib/bids";
import { useApi } from "@/lib/useApi";

type Gap = { field: string; rows: number[]; note?: string };
type Package = {
  nam: number;
  so_tbmt: string | null;
  ben_moi_thau: string | null;
  ten_goi_thau: string | null;
  sheet: string;
  gaps: Gap[];
};
type MissingResp = { packages: Package[]; items: number; nam: number | null };

/** "12, 13, 14, 20" -> "12–14, 20": Excel row numbers, compact. */
function rowRanges(rows: number[]): string {
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${sorted[i]}–${sorted[j]}` : String(sorted[i]));
    i = j;
  }
  return parts.join(", ");
}

const BUCKET: Record<string, string> = {
  "Phân loại": "(Chưa phân loại)",
  Miền: "(Chưa ghi miền)",
  Sale: "(Chưa ghi sale)",
};

/** Warning button (only when something is missing) that lists the packages to fix in Excel. */
export function MissingInfoButton({ filters }: { filters: Filters }) {
  const [open, setOpen] = useState(false);
  const res = useApi<MissingResp>("missing-info", { ...filters });
  const pkgs = res.data?.packages ?? [];
  if (!pkgs.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[13px] font-medium text-amber-800 hover:bg-amber-100"
      >
        <AlertTriangle size={14} />
        {fmtInt(pkgs.length)} gói thầu thiếu thông tin
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        width={860}
        title={`Gói thầu thiếu thông tin${res.data?.nam ? ` – năm ${res.data.nam}` : ""}`}
        icon={<AlertTriangle size={16} className="text-amber-500" />}
      >
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-[12px] leading-relaxed text-amber-900">
          {fmtInt(pkgs.length)} gói thầu ({fmtInt(res.data?.items ?? 0)} mặt hàng) thiếu thông tin nên đang nằm ở dòng
          &nbsp;<b>(Chưa phân loại)</b> / <b>(Chưa ghi miền)</b> trên dashboard. Vui lòng bổ sung trong file Excel báo cáo
          thầu theo sheet và số dòng bên dưới; dữ liệu sẽ tự cập nhật ở lần đồng bộ tiếp theo.
        </div>
        <div className="scroll-shadow max-h-[60vh] overflow-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0">
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 text-left font-semibold">Gói thầu</th>
                <th colSpan={2} className="px-2 py-2 text-left font-semibold">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
                    <span>Thiếu</span>
                    <span>Vị trí trong Excel</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {pkgs.map((p, i) => (
                <tr key={`${p.nam}-${p.so_tbmt}-${i}`} className={`align-top ${i % 2 ? "bg-slate-50/50" : "bg-white"}`}>
                  <td className="max-w-[340px] px-4 py-2">
                    <div className="font-medium tabular-nums text-slate-800">{p.so_tbmt ?? "(Không có số TBMT)"}</div>
                    <div className="line-clamp-1 text-[12px] text-slate-600" title={p.ben_moi_thau ?? ""}>
                      {p.ben_moi_thau}
                    </div>
                    <div className="line-clamp-1 text-[11px] text-slate-400" title={p.ten_goi_thau ?? ""}>
                      {p.ten_goi_thau}
                    </div>
                  </td>
                  <td className="px-2 py-2" colSpan={2}>
                    <ul className="space-y-1.5">
                      {p.gaps.map((g) => (
                        <li key={g.field + (g.note ?? "")} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
                          <span>
                            <span className="inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                              {g.field}
                            </span>
                            <span className="ml-1.5 text-[11px] text-slate-400">
                              {g.note ?? `đang tính vào ${BUCKET[g.field] ?? "nhóm trống"}`}
                            </span>
                          </span>
                          <span className="pr-2 text-[12px] text-slate-600">
                            Sheet <b className="font-medium text-slate-800">{p.sheet}</b>, dòng{" "}
                            <b className="font-medium tabular-nums text-slate-800">{rowRanges(g.rows)}</b>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}
