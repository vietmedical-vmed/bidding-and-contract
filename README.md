# Bidding management – ETL

Script tải file báo cáo thầu (Excel trên SharePoint), làm sạch dữ liệu rồi đẩy lên Supabase.

## Cài đặt

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
cp .env.example .env   # rồi điền giá trị
```

Tạo bảng trên Supabase thật (chạy migration trong `supabase/migrations/`):

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Sau đó điền `SUPABASE_URL` và `SUPABASE_SECRET_KEY` vào `.env`. Lấy hai giá trị này ở Project Settings → API Keys.

### Test với Supabase local

`supabase/config.toml` dùng dải port 564xx, vì dải 554xx bị Windows giữ và dải 543xx là của project local khác. Để test, chạy `supabase start`, sau đó chạy ETL với `SUPABASE_URL=http://127.0.0.1:56421` và `SERVICE_ROLE_KEY` lấy từ lệnh `supabase status -o env`. Studio xem dữ liệu ở http://127.0.0.1:56423.

## Nguồn dữ liệu

Hiện dùng file Excel `Bao cao Thầu KNK.xlsx` trên OneDrive (đường dẫn đặt ở `SOURCE_FILE`). File này được tải về định kỳ, lấy các sheet `So lieu 2025` (đã chốt) và `So lieu 2026` (cập nhật định kỳ).

Sheet nào có nội dung giống lần nạp trước (so bằng hash, lưu ở bảng `bid_sheets`) thì không đẩy lại. Vì vậy `So lieu 2025` chỉ được nạp lại khi có người sửa nó.

### Quy tắc nghiệp vụ (`etl/items.py`)

- Chỉ giữ **dòng mặt hàng**: có `DANH MỤC HÀNG` và có thêm Model, Số lượng, Kết quả thầu hoặc Giá trúng thầu. Bỏ dòng gói thầu và dòng phần/lô.
- Bỏ các cột `STT` (cả hai cột), `HS code`, `HÃNG`.
- Map cột `Phân loại` sang `nhom_san_pham` theo [mapping/phan_loai_nhom_san_pham.csv](mapping/phan_loai_nhom_san_pham.csv). Tên nhóm phải trùng với sheet `Danh mục Nhóm sản phẩm` của file `PRODUCT_CATALOG_FILE`. Từ file này script lấy thêm cột `bu`.
- Nếu một nhóm trong mapping không có trong danh mục, script dừng lại. Nếu gặp phân loại chưa có trong mapping, script ghi vào `out/issues.csv` (kind `mapping`).

Link chia sẻ chỉ mở được khi đã đăng nhập tài khoản trong tổ chức, nên script không tải ẩn danh được. Chọn một trong ba cách:

1. **File local**: đặt `SOURCE_FILE` (hoặc truyền `--file`). Dùng file tải tay, hoặc bấm *Add shortcut to My files* trên SharePoint để OneDrive tự đồng bộ file về máy.
2. **Graph + device code**: đăng ký app trên Entra ID (*App registrations* → *New registration*). Bật *Allow public client flows*, thêm quyền delegated `Files.Read.All`. Điền `AZURE_TENANT_ID` và `AZURE_CLIENT_ID`, để trống `AZURE_CLIENT_SECRET`. Lần chạy đầu, script in ra mã để đăng nhập trên trình duyệt. Token được lưu vào `.token_cache.json` để dùng cho các lần chạy sau.
3. **Graph app-only** (để chạy tự động trên server): admin cấp quyền application `Files.Read.All` (hoặc `Sites.Selected`) và tạo client secret. Điền thêm `AZURE_CLIENT_SECRET`.

## Chạy

```bash
.venv/Scripts/python -m etl --inspect     # xem các sheet, dòng tiêu đề, cột được nhận dạng
.venv/Scripts/python -m etl --dry-run     # làm sạch, ghi out/cleaned_<sheet>.csv và out/issues.csv
.venv/Scripts/python -m etl               # làm sạch rồi đẩy lên Supabase (bỏ qua nếu file không đổi)
.venv/Scripts/python -m etl --force       # đẩy lên kể cả khi file không đổi
```

## Các bước làm sạch

- Tự dò dòng tiêu đề, bỏ các dòng tiêu đề báo cáo phía trên (ghi đè bằng `HEADER_ROW`).
- Chuyển tên cột về dạng snake_case không dấu, ví dụ `Giá dự thầu` thành `gia_du_thau`.
- Chọn cách đọc mỗi cột theo tên cột:
  - cột ngày (`ngay_*`): đọc `dd/mm/yyyy`, ISO, số serial Excel;
  - cột số (`gia_*`, `so_luong`, ...): đọc được `1.234.567 đ`, `2,500,000`, `3.000.000,5`;
  - cột kết quả (`ket_qua`, `trang_thai`, ...): sinh thêm cột `<tên>_chuan` với các giá trị `trung / truot / huy / cho_kq / khong_nop / khac`.
- Bỏ dòng trống và dòng tổng (`Tổng cộng`, ...).
- Không đọc được thì ô để trống, đồng thời ghi lại vào `out/issues.csv`. Script không âm thầm bỏ qua lỗi.

## Dữ liệu trên Supabase

- `bid_sync_runs`: nhật ký mỗi lần sync (eTag, số dòng, số ô lỗi, trạng thái).
- `stg_bid_rows`: mỗi dòng Excel là một bản ghi `data jsonb`. Mỗi lần sync thay toàn bộ dữ liệu của sheet trong một transaction, qua hàm `replace_stg_bid_rows`.
- `bid_items` (view): mỗi dòng là một mặt hàng, các cột đã đổi sang đúng kiểu (`numeric`, `date`). Có thêm `nam`, `thang_du_thau_so`, và cột `ket_qua` lấy một trong các giá trị `trung / truot / huy / cho_kq / ...`. Web app đọc từ view này.
- RLS: người dùng web app đã đăng nhập (`authenticated`) chỉ được đọc. `anon` không đọc được. Chỉ ETL được ghi, bằng secret key.

## Web app

Dashboard và bảng chi tiết nằm trong thư mục [web/](web/). App là trang tĩnh trên GitHub Pages, đăng nhập bằng tài khoản dùng chung `shared.users` qua 2 Edge Function `bidding-login` và `bidding-api`, giống các app khác của org. Cách cấu hình và deploy xem ở [web/README.md](web/README.md).
