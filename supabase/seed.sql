-- LOCAL ONLY (supabase db reset). Production already has shared.users from the other org apps.
-- Test accounts: test_admin (admin), test_sale_mn (sale, MN), test_pm (product_manager, scope Khớp UOC + NSK Arthrex).
-- Their passwords are in supabase/test-users.local.txt (gitignored, local machine only).

create schema if not exists shared;

create table if not exists shared.users (
  username text primary key,
  password_hash text not null,
  salt text,
  role text,
  scope text,
  bu text,
  mien text,
  ho_va_ten text,
  active boolean default true
);

grant usage on schema shared to service_role;
grant select, update on shared.users to service_role;

insert into shared.users (username, password_hash, salt, role, scope, bu, mien, ho_va_ten) values
  ('test_admin', '4285c986bd1a7f813bc8c3b32331b5ad10dc002b547ed6f4192e6a973cca2d89', 'e4182b3c03a84dba', 'admin', '', '', 'BOTH', 'Test admin'),
  ('test_sale_mn', 'd63a0bd1265fc7baa4ef6b90e4f5dde4207a96097d9555fee2ac6cc246d095e9', 'e43269badb55d13e', 'sale', '', '', 'MN', 'Test sale'),
  ('test_pm', 'fa515c1822118c5810ba8366e1fe12a849e0d408b0eff44fa0f0ab11f16709b0', 'f6908a96645c3998', 'product_manager', 'Khớp UOC, NSK Arthrex', '', 'BOTH', 'Test product_manager')
on conflict (username) do nothing;
