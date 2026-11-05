// "Xuất Excel" of the contract list: one row per contract item, same layout as the
// workbook contract-management produced (formulas for status and remaining quota),
// plus one "Bán FYxx" column per fiscal year, as in the expanded rows of the list page.

export type ExportRow = {
  loai_bv: string;
  ten_kh: string | null;
  so_hd: string | null;
  ngay_ky: string | null;
  thoi_han: string | null;
  ten_ps: string | null;
  ma_chung: string | null;
  ma_ncc: string | null;
  ten_hang_hoa: string | null;
  don_gia: number | null;
  nhom_sp: string;
  so_luong_hd: number | null;
  so_luong_da_ban: number;
  /** Sold per fiscal year, keyed `fy<yy>`; 0 for fiscal years outside the contract. */
  fy_sold?: Record<string, number>;
};

export type ExportFy = { fy: number; label: string };

const BEFORE_FY = [
  ["Loại BV", 8], ["Tên Bệnh viện", 36], ["Số hợp đồng", 31], ["Ngày ký hđ", 13], ["Ngày hết hạn", 15],
  ["Thời hạn HĐ", 13], ["Sale phụ trách", 19], ["Mã chung", 13], ["Mã NCC", 16], ["Tên chung", 43],
  ["Đơn giá", 16], ["Phân loại", 16], ["SL trúng thầu", 15],
] as const;
const AFTER_FY = [["Sử dụng sd", 13], ["Quota Còn lại", 15]] as const;
const FY_WIDTH = 12;

/** yyyy-mm-dd as a local date, so Excel shows the same day in every timezone. */
function localDate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 1-based column number to its Excel letters (1 → A, 27 → AA). */
function colLetter(n: number): string {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export async function downloadContractsXlsx(rows: ExportRow[], fyList: ExportFy[] = []) {
  const ExcelJS = (await import("exceljs")).default; // ~1 MB, loaded only when exporting
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  const font = { name: "Calibri", size: 12 };
  const thin = { style: "thin" as const, color: { argb: "FFD9D9D9" } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  const columns: (readonly [string, number])[] = [
    ...BEFORE_FY,
    ...fyList.map((fy) => [`Bán ${fy.label}`, FY_WIDTH] as const),
    ...AFTER_FY,
  ];
  // Columns holding the contract quantity, quantity sold and the remaining-quota formula.
  const colQty = BEFORE_FY.length; // "SL trúng thầu"
  const colSold = colQty + fyList.length + 1; // "Sử dụng sd"
  const qty = colLetter(colQty);
  const sold = colLetter(colSold);

  ws.columns = columns.map(([, width], i) => ({ width, key: `c${i}` }));

  const header = ws.addRow(columns.map(([title]) => title));
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { ...font, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border;
  });

  rows.forEach((r, i) => {
    const n = i + 2;
    const row = ws.addRow([
      r.loai_bv || "", r.ten_kh || "", r.so_hd || "",
      localDate(r.ngay_ky), localDate(r.thoi_han),
      { formula: `IF(E${n}<TODAY(),"hết hạn","còn hạn")` },
      r.ten_ps || "", r.ma_chung || "", r.ma_ncc || "", r.ten_hang_hoa || "",
      r.don_gia || 0, r.nhom_sp || "",
      r.so_luong_hd || 0,
      ...fyList.map((fy) => r.fy_sold?.[`fy${fy.fy % 100}`] ?? 0),
      r.so_luong_da_ban || 0,
      { formula: `${qty}${n}-${sold}${n}` },
    ]);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = font;
      cell.border = border;
      if (col === 4 || col === 5) {
        cell.numFmt = "yyyy-mm-dd";
        cell.alignment = { horizontal: "center" };
      } else if (col === 6) {
        cell.alignment = { horizontal: "center" };
      } else if (col === 11 || col >= colQty) {
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "Báo cáo theo dõi hợp đồng trúng thầu.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
