-- Golfam Production database schema
create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','operator');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.user_role not null default 'operator',
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.device_assignments (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  shift text check (shift in ('روز','شب','هر دو')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(device_id,user_id,shift)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_unit text not null,
  default_unit_weight numeric(14,3) not null default 0 check(default_unit_weight >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_unit text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date text not null, -- Persian date string e.g. 1405/08/22
  shift text not null check (shift in ('روز','شب','هر دو')),
  note text,
  created_by uuid not null references public.profiles(id),
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(report_date,shift)
);

create table public.production_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  device_id uuid not null references public.devices(id),
  operator_id uuid not null references public.profiles(id),
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check(quantity > 0),
  unit text not null,
  unit_weight_kg numeric(14,3) not null check(unit_weight_kg >= 0),
  total_weight_kg numeric(16,3) generated always as (quantity * unit_weight_kg) stored,
  batch_number text not null,
  created_at timestamptz not null default now()
);

create table public.material_usages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  device_id uuid not null references public.devices(id),
  operator_id uuid not null references public.profiles(id),
  material_id uuid not null references public.materials(id),
  quantity numeric(14,3) not null check(quantity > 0),
  unit text not null,
  batch_number text,
  created_at timestamptz not null default now()
);

create table public.downtime_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  device_id uuid not null references public.devices(id),
  operator_id uuid not null references public.profiles(id),
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null check(duration_minutes > 0 and duration_minutes <= 1440),
  reason text not null,
  created_at timestamptz not null default now()
);

create index on public.production_entries(report_id,device_id);
create index on public.material_usages(report_id,device_id);
create index on public.downtime_entries(report_id,device_id);

-- Create a profile automatically for each newly registered account.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), 'operator');
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

create or replace function public.is_assigned_to(p_device uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.device_assignments
    where device_id=p_device and user_id=auth.uid() and active=true);
$$;

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.device_assignments enable row level security;
alter table public.products enable row level security;
alter table public.materials enable row level security;
alter table public.daily_reports enable row level security;
alter table public.production_entries enable row level security;
alter table public.material_usages enable row level security;
alter table public.downtime_entries enable row level security;

-- Profiles: users can see own profile; admins can see all. Role changes are admin-only.
create policy "profiles read" on public.profiles for select to authenticated
using (id=auth.uid() or public.is_admin());
create policy "profiles admin update" on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "devices read authenticated" on public.devices for select to authenticated using (true);
create policy "devices admin all" on public.devices for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "assignments read own or admin" on public.device_assignments for select to authenticated
using (user_id=auth.uid() or public.is_admin());
create policy "assignments admin all" on public.device_assignments for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "products read" on public.products for select to authenticated using (true);
create policy "products admin all" on public.products for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "materials read" on public.materials for select to authenticated using (true);
create policy "materials admin all" on public.materials for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "reports read" on public.daily_reports for select to authenticated using (true);
create policy "reports admin insert" on public.daily_reports for insert to authenticated
with check (public.is_admin() and created_by=auth.uid());
create policy "reports admin update" on public.daily_reports for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "production read" on public.production_entries for select to authenticated
using (public.is_admin() or public.is_assigned_to(device_id));
create policy "production operator insert" on public.production_entries for insert to authenticated
with check (operator_id=auth.uid() and public.is_assigned_to(device_id)
  and exists(select 1 from public.daily_reports r where r.id=report_id and r.is_closed=false));
create policy "production admin update" on public.production_entries for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "usage read" on public.material_usages for select to authenticated
using (public.is_admin() or public.is_assigned_to(device_id));
create policy "usage operator insert" on public.material_usages for insert to authenticated
with check (operator_id=auth.uid() and public.is_assigned_to(device_id)
  and exists(select 1 from public.daily_reports r where r.id=report_id and r.is_closed=false));
create policy "usage admin update" on public.material_usages for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "downtime read" on public.downtime_entries for select to authenticated
using (public.is_admin() or public.is_assigned_to(device_id));
create policy "downtime operator insert" on public.downtime_entries for insert to authenticated
with check (operator_id=auth.uid() and public.is_assigned_to(device_id)
  and exists(select 1 from public.daily_reports r where r.id=report_id and r.is_closed=false));
create policy "downtime admin update" on public.downtime_entries for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- IMPORTANT: after creating your own account, run this once with your account email:
-- update public.profiles set role='admin' where id=(select id from auth.users where email='YOUR_EMAIL');
