# Web app – Thầu & Hợp đồng

Ứng dụng Next.js 16, build thành trang tĩnh (`output: "export"`) để đưa lên GitHub Pages như các app khác của org. Có hai module, chuyển qua lại bằng nút trên header; `/` chuyển sang `/thau/`.

**Kết quả thầu** (`bidding-api`):

- `/thau/`: dashboard tỷ lệ trúng/trượt theo năm, BU, nhóm sản phẩm, miền, tháng và sale, kèm biểu đồ lý do trượt.
- `/thau/chi-tiet/`: bảng mặt hàng có bộ lọc, ô tìm kiếm, lọc theo kết quả và phân trang (50 dòng/trang).

**Hợp đồng** (`contract-api`, chuyển từ dashboard cũ của `contract-management`):

- `/hop-dong/`: số hợp đồng theo trạng thái trong năm tài chính (T4 → T3), tab Miền Bắc/Nam, HĐ sắp hết hạn và sản phẩm đã dùng quá ngưỡng thầu. Bấm thẻ trạng thái để mở danh sách đã lọc.
- `/hop-dong/danh-sach/`: danh sách hợp đồng (15 dòng/trang), lọc theo trạng thái, tìm kiếm, bấm dòng để xem sản phẩm và số lượng bán theo từng năm tài chính, nút **Xuất Excel**.
- Admin có thêm nút **Đồng bộ dữ liệu bán** (`fn_sync_sold_snapshot`, `fn_refresh_ngoai_khoa`) và **Cấu hình cảnh báo** (bảng `contract_alert_config`).

Bộ lọc của mỗi module nằm trên URL (`?bu=...&nhom=...`), nên có thể gửi link đã lọc.

## Đăng nhập và lấy dữ liệu

Cách làm giống `ccdc-management` và `sale-target`:

- **`bidding-login`** (Edge Function): đọc bảng `shared.users`, kiểm tra mật khẩu `SHA-256(salt:pw)`, rồi phát token HMAC ký bằng `TOKEN_SECRET`. `TOKEN_SECRET` dùng chung cho mọi app trong project, nên người dùng đăng nhập bằng tài khoản đã có.
- **`bidding-api`** (Edge Function): kiểm tra token, kiểm tra `active`, rồi gọi `bid_kpi`, `bid_filter_options` và `bid_items` bằng service role. Hàm hỗ trợ các action `whoami`, `filter-options`, `dashboard`, `items`.
- **`contract-api`** (Edge Function): cùng cách kiểm tra token. Không cần đăng nhập riêng, vì token của `bidding-login` cũng ký bằng `TOKEN_SECRET`.
- Quyền xem dữ liệu thầu:

  | Role | Được xem |
  |---|---|
  | `admin`, `manager` | Toàn bộ |
  | `product_manager` | Các nhóm sản phẩm trong `users.scope` |
  | Role khác | Miền trong `users.mien` (`BOTH`/`ALL` = toàn bộ) |

- Quyền xem hợp đồng: `admin`, `manager`, `product_manager` xem toàn bộ; role khác xem theo `users.mien`. Chỉ `admin` được đồng bộ và sửa cấu hình.
- Trình duyệt chỉ giữ anon key và token. Token lưu trong `sessionStorage`, hoặc `localStorage` nếu chọn "Ghi nhớ đăng nhập".

## Cấu hình

Tạo `web/.env.local` theo mẫu [.env.example](.env.example):

```
NEXT_PUBLIC_SUPABASE_URL=https://nrfxymnfmjhbsgpipvkb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key, giống các app khác>
NEXT_PUBLIC_BASE_PATH=
```

## Deploy

1. Chạy các migration trong `supabase/migrations/` theo thứ tự (phần hợp đồng xem [supabase/contract/](../supabase/contract/)). File `20261022000300_bid_access_via_edge_api.sql` thay hàm KPI và bỏ quyền đọc trực tiếp của người dùng Supabase Auth.
2. Deploy Edge Functions. Không cần set thêm secret, vì `TOKEN_SECRET` đã có sẵn trong project:

   ```bash
   supabase functions deploy bidding-login --no-verify-jwt --project-ref nrfxymnfmjhbsgpipvkb
   supabase functions deploy bidding-api --no-verify-jwt --project-ref nrfxymnfmjhbsgpipvkb
   supabase functions deploy contract-api --no-verify-jwt --project-ref nrfxymnfmjhbsgpipvkb
   ```

3. Trên repo GitHub:
   - Vào Settings → Secrets and variables → Actions, thêm `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Vào Settings → Pages → Source, chọn **GitHub Actions**.
4. Push lên nhánh `main`. Workflow [.github/workflows/deploy-pages.yml](../.github/workflows/deploy-pages.yml) sẽ build `web/` với `NEXT_PUBLIC_BASE_PATH=/<tên-repo>` rồi deploy.

## Chạy local

Cần Supabase local (`supabase start`, port 564xx) và edge functions:

```bash
supabase functions serve --env-file supabase/functions/.env.local --no-verify-jwt
cd web && npm run dev     # http://localhost:3000
```

Supabase local chỉ có dữ liệu thầu. Phần hợp đồng cần các bảng `shared.dm_vat_tu`, `app_contract.hoa_don_bovattu`... của app khác, nên trang `/hop-dong/` chạy local sẽ hiện số 0.

`supabase/seed.sql` tạo bảng `shared.users` và 3 tài khoản test (admin, sale miền Nam, product manager). Mật khẩu nằm trong `supabase/test-users.local.txt` (gitignored, chỉ có trên máy đã tạo seed). Bảng này chỉ dùng cho Supabase local; production đã có `shared.users` của các app khác.

Trên Windows, nếu build thử với basePath trong Git Bash thì thêm `MSYS_NO_PATHCONV=1`. Nếu không, Git Bash sẽ đổi `/bidding-and-contract` thành đường dẫn ổ đĩa.
