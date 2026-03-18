-- ============================================================
--  EXTERNADO MOVE — Supabase Setup
--  Ejecuta esto en: Supabase → SQL Editor → New Query
-- ============================================================

-- 1. Tabla de perfiles (datos extra al usuario de Auth)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  lastname    text not null,
  email       text not null,
  role        text not null default 'student',
  joined_at   timestamptz default now()
);

-- 2. Habilitar Row Level Security
alter table public.profiles enable row level security;

-- 3. Políticas de acceso
-- Cualquier usuario autenticado puede leer su propio perfil
create policy "Leer propio perfil"
  on public.profiles for select
  using (auth.uid() = id);

-- Cualquier usuario autenticado puede insertar su propio perfil
create policy "Insertar propio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Cualquier usuario autenticado puede actualizar su propio perfil
create policy "Actualizar propio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- El admin puede leer TODOS los perfiles (usamos service_role en admin panel)
create policy "Admin lee todos"
  on public.profiles for select
  using (true);

-- 4. Tabla de solicitudes de acompañamiento
create table if not exists public.requests (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  user_email  text,
  name        text,
  origin      text not null,
  destination text not null,
  time        text,
  people      text,
  notes       text,
  status      text not null default 'pending',
  created_at  timestamptz default now()
);

alter table public.requests enable row level security;

create policy "Usuarios ven sus solicitudes"
  on public.requests for select
  using (auth.uid() = user_id);

create policy "Usuarios insertan solicitudes"
  on public.requests for insert
  with check (auth.uid() = user_id);

create policy "Admin ve todas"
  on public.requests for select
  using (true);

create policy "Admin actualiza todas"
  on public.requests for update
  using (true);

-- 5. Tabla de reportes
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  user_email  text,
  type        text not null,
  location    text not null,
  description text not null,
  created_at  timestamptz default now()
);

alter table public.reports enable row level security;

create policy "Todos pueden leer reportes"
  on public.reports for select
  using (true);

create policy "Usuarios insertan reportes"
  on public.reports for insert
  with check (true);

create policy "Admin elimina reportes"
  on public.reports for delete
  using (true);
