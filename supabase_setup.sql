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

-- ============================================================
-- 6. Tabla de rutas (caravanas)
-- ============================================================
create table if not exists public.routes (
  id          int primary key,
  name        text not null,
  station     text not null,
  description text,
  time        text,
  duration    text,
  current     int not null default 0,
  max         int not null default 15,
  color       text,
  text_color  text,
  updated_at  timestamptz default now()
);

alter table public.routes enable row level security;

-- Cualquiera puede leer las rutas (incluso sin sesión)
create policy "Todos leen rutas"
  on public.routes for select
  using (true);

-- Solo usuarios autenticados pueden actualizar via RPC
create policy "Auth actualiza rutas"
  on public.routes for update
  using (auth.role() = 'authenticated');

-- ============================================================
-- 7. Datos iniciales de rutas (solo las 5 rutas activas)
-- ============================================================
insert into public.routes (id, name, station, description, time, duration, current, max, color, text_color)
values
  (1, 'Entrada U → Estación Las Aguas', 'ESTACIÓN LAS AGUAS', 'Por Carrera 4 hasta Calle 10. Ruta iluminada con presencia policial.',                                  '01:15 PM', '8 min caminando',  0, 15, '#FFC107', '#3E2723'),
  (2, 'Entrada U → Av. Jiménez',        'AV. JIMÉNEZ',        'Por Calle 12 hacia el occidente. Parada SITP frente al Banco de la República.',                         '02:00 PM', '10 min caminando', 0, 10, '#FFA000', '#fff'),
  (3, 'Entrada U → San Victorino',      'SAN VICTORINO',      'Por Calle 13. Mayor vigilancia en el recorrido. Recomendada en grupo.',                                  '05:30 PM', '18 min caminando', 0, 20, '#3E2723', '#fff'),
  (4, 'Entrada U → La Candelaria',      'LA CANDELARIA',      'Por Carrera 2. Zona histórica. Evitar después de las 7 pm.',                                             '03:45 PM', '12 min caminando', 0, 12, '#D32F2F', '#fff'),
  (5, 'Entrada U → Museo Nacional',     'MUSEO NACIONAL',     'Por Carrera 7 hacia el norte. Acera amplia y vigilada. Ideal para quienes toman SITP por la 26.',       '05:00 PM', '22 min caminando', 0, 10, '#00838F', '#fff')
on conflict (id) do nothing;

-- ============================================================
-- 8. Función RPC atómica para incrementar personas en una ruta
--    Solo usuarios autenticados pueden llamarla.
-- ============================================================
create or replace function increment_route(route_id int)
returns json
language plpgsql
security definer
as $$
declare
  r public.routes;
begin
  -- Verificar que el usuario esté autenticado
  if auth.uid() is null then
    return json_build_object('success', false, 'error', 'unauthenticated');
  end if;

  -- Bloquear la fila para evitar race conditions
  select * into r from public.routes where id = route_id for update;

  if not found then
    return json_build_object('success', false, 'error', 'not_found');
  end if;

  if r.current >= r.max then
    return json_build_object('success', false, 'error', 'full');
  end if;

  update public.routes
    set current = current + 1, updated_at = now()
    where id = route_id;

  return json_build_object('success', true, 'current', r.current + 1, 'max', r.max);
end;
$$;

-- ============================================================
-- 9. Función para reiniciar todas las rutas cada 10 minutos
--    Elimina las filas y las vuelve a insertar con current = 0.
--    security definer para saltarse RLS en DELETE/INSERT.
-- ============================================================
create or replace function reset_routes()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.routes;

  insert into public.routes (id, name, station, description, time, duration, current, max, color, text_color)
  values
    (1, 'Entrada U → Estación Las Aguas', 'ESTACIÓN LAS AGUAS', 'Por Carrera 4 hasta Calle 10. Ruta iluminada con presencia policial.',                                  '01:15 PM', '8 min caminando',  0, 15, '#FFC107', '#3E2723'),
    (2, 'Entrada U → Av. Jiménez',        'AV. JIMÉNEZ',        'Por Calle 12 hacia el occidente. Parada SITP frente al Banco de la República.',                         '02:00 PM', '10 min caminando', 0, 10, '#FFA000', '#fff'),
    (3, 'Entrada U → San Victorino',      'SAN VICTORINO',      'Por Calle 13. Mayor vigilancia en el recorrido. Recomendada en grupo.',                                  '05:30 PM', '18 min caminando', 0, 20, '#3E2723', '#fff'),
    (4, 'Entrada U → La Candelaria',      'LA CANDELARIA',      'Por Carrera 2. Zona histórica. Evitar después de las 7 pm.',                                             '03:45 PM', '12 min caminando', 0, 12, '#D32F2F', '#fff'),
    (5, 'Entrada U → Museo Nacional',     'MUSEO NACIONAL',     'Por Carrera 7 hacia el norte. Acera amplia y vigilada. Ideal para quienes toman SITP por la 26.',       '05:00 PM', '22 min caminando', 0, 10, '#00838F', '#fff');
end;
$$;

-- ============================================================
-- 10. Programar el reinicio automático cada 10 minutos
--     IMPORTANTE: Primero habilita la extensión pg_cron en
--     Supabase → Database → Extensions → busca "pg_cron" → Enable
-- ============================================================
select cron.schedule(
  'reset-routes-every-10min',   -- nombre del job (único)
  '*/10 * * * *',               -- cada 10 minutos (:00, :10, :20, ...)
  $$ select reset_routes(); $$
);

