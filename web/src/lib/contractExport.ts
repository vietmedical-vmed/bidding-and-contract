// "Xuất Excel" of the contract list: one row per contract item, same layout as the
// workbook contract-management produced (formulas for status and remaining quota).

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
};

const HEADERS = [
  "Loại BV", "Tên Bệnh viện", "Số hợp đồng", "Ngày ký hđ", "Ngày hết hạn",
  "Thời hạn HĐ", "Sale phụ trách", "Mã chung", "Mã NCC", "Tên chung",
  "Đơn giá", "Phân loại", "SL trúng thầu", "Sử dụng sd", "Quota Còn lại",
];
const WIDTHS = [8, 36, 31, 13, 15, 13, 19, 13, 16, 43, 16, 16, 15, 13, 15];

/** yyyy-mm-dd as a local date, so Excel shows the same day in every timezone. */
function localDate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function downloadContractsXlsx(rows: ExportRow[]) {
  const ExcelJS = (await import("exceljs")).default; // ~1 MB, loaded only when exporting
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  const font = { name: "Calibri", size: 12 };
  const thin = { style: "thin" as const, color: { argb: "FFD9D9D9" } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  ws.columns = WIDTHS.map((width, i) => ({ width, key: `c${i}` }));

  const header = ws.addRow(HEADERS);
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
      r.so_luong_hd || 0, r.so_luong_da_ban || 0,
      { formula: `M${n}-N${n}` },
    ]);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = font;
      cell.border = border;
      if (col === 4 || col === 5) {
        cell.numFmt = "yyyy-mm-dd";
        cell.alignment = { horizontal: "center" };
      } else if (col === 6) {
        cell.alignment = { horizontal: "center" };
      } else if (col === 11 || col >= 13) {
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
