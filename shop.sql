-- SHOP / Supabase
-- À exécuter dans Supabase SQL Editor.
-- Après création du premier utilisateur Auth, ajoutez son UUID dans admin_users
-- avec : INSERT INTO public.admin_users (user_id) VALUES ('UUID_ICI');

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0 check (price >= 0),
  category_id uuid references public.categories(id) on delete set null,
  image_path text,
  active boolean not null default true,
  is_new boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_sizes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null check (size in ('S','M','L','XL','XXL')),
  quantity integer not null default 0 check (quantity >= 0),
  enabled boolean not null default false,
  unique(product_id,size)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$ select exists(select 1 from public.admin_users where user_id = uid); $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_sizes enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "public read active categories" on public.categories;
create policy "public read active categories" on public.categories for select using (active = true);

drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products for select using (active = true);

drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "public read sizes of active products" on public.product_sizes;
create policy "public read sizes of active products" on public.product_sizes for select using (
  exists(select 1 from public.products p where p.id = product_id and p.active = true)
);

drop policy if exists "admins manage sizes" on public.product_sizes;
create policy "admins manage sizes" on public.product_sizes for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Ne laissez jamais les visiteurs lire la liste des administrateurs.
-- La fonction is_admin() est SECURITY DEFINER pour permettre la vérification sans exposer cette table.

-- Storage : bucket public pour les images visibles par la boutique.
insert into storage.buckets (id, name, public)
values ('product-images','product-images',true)
on conflict (id) do update set public = true;

drop policy if exists "public can view product images" on storage.objects;
create policy "public can view product images"
on storage.objects for select
using (bucket_id = 'product-images');

drop policy if exists "admins upload product images" on storage.objects;
create policy "admins upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.is_admin(auth.uid()));

drop policy if exists "admins update product images" on storage.objects;
create policy "admins update product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.is_admin(auth.uid()))
with check (bucket_id = 'product-images' and public.is_admin(auth.uid()));

drop policy if exists "admins delete product images" on storage.objects;
create policy "admins delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.is_admin(auth.uid()));

-- Realtime
alter table public.products replica identity full;
alter table public.product_sizes replica identity full;
alter table public.categories replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.product_sizes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.categories;
exception when duplicate_object then null; end $$;

-- Catégories initiales
insert into public.categories (name, sort_order) values
('Running',0),('Ensembles',1),('Hauts',2),('Bas',3),('Promotions',4)
on conflict (name) do nothing;

-- Exemple de bootstrap admin :
-- 1) Supabase Dashboard > Authentication > Users > Add user
-- 2) Copiez son UUID
-- 3) Décommentez et exécutez :
-- insert into public.admin_users(user_id) values ('UUID_DU_COMPTE_AUTH');
