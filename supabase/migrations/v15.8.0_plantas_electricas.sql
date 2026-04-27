-- ============================================================
-- v15.8.0 — Catálogo maestro de Plantas Eléctricas
--
-- Crea la tabla plantas_electricas (entidad nueva) + columna
-- planta_id en proyectos (1 planta puede tener varios proyectos).
--
-- APLICAR EN SUPABASE:
--   1. Abrir https://supabase.com/dashboard/project/twwqmjumtqwhhwxrmlse/sql/new
--   2. SQL Editor → New query → pegar todo este archivo → Run
--   3. Verificar en Table Editor que aparece "plantas_electricas"
--      y que "proyectos" tiene la nueva columna "planta_id"
-- ============================================================

create table if not exists public.plantas_electricas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null,
  cliente_id uuid references public.clientes(id) on delete set null,
  capacidad_mw numeric(10, 3),
  tipo_tecnologia text check (tipo_tecnologia in (
    'Fotovoltaica', 'Eolica', 'Termoelectrica', 'Hidroelectrica',
    'Cogeneracion', 'Biomasa', 'Geotermica', 'Ciclo combinado',
    'Almacenamiento BESS', 'Hibrido', 'Otra'
  )),
  ubicacion text,
  estado_geo text,
  coordenadas text,
  estado text not null default 'Planeacion' check (estado in (
    'Planeacion', 'En construccion', 'En operacion', 'Mantenimiento', 'Retirada'
  )),
  fecha_operacion_comercial date,
  punto_interconexion text,
  voltaje_kv numeric(10, 2),
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_plantas_electricas_cliente on public.plantas_electricas(cliente_id);
create index if not exists idx_plantas_electricas_estado on public.plantas_electricas(estado);

-- Vinculación con proyectos: 1 planta puede tener N proyectos
alter table public.proyectos
  add column if not exists planta_id uuid references public.plantas_electricas(id) on delete set null;

create index if not exists idx_proyectos_planta on public.proyectos(planta_id);

-- Row Level Security
alter table public.plantas_electricas enable row level security;

drop policy if exists "lectura_plantas_authenticated" on public.plantas_electricas;
create policy "lectura_plantas_authenticated"
  on public.plantas_electricas for select
  to authenticated
  using (true);

drop policy if exists "escritura_plantas_directores" on public.plantas_electricas;
create policy "escritura_plantas_directores"
  on public.plantas_electricas for all
  to authenticated
  using (
    exists (
      select 1 from public.usuarios
      where auth_id = auth.uid()
        and rol in ('direccion', 'director_proyectos', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.usuarios
      where auth_id = auth.uid()
        and rol in ('direccion', 'director_proyectos', 'admin')
    )
  );

-- Trigger updated_at
create or replace function public.set_updated_at_plantas()
  returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_plantas_electricas_updated on public.plantas_electricas;
create trigger trg_plantas_electricas_updated
  before update on public.plantas_electricas
  for each row execute function public.set_updated_at_plantas();
