-- ============================================================
-- v15.7.0 — Workflow Declaración Operación Comercial SIM
--
-- Crea la tabla proyecto_sim_etapas: 1 fila por etapa por proyecto.
-- Etapas (orden de ejecución):
--   1. estudios — Estudios de Impacto / Instalaciones
--   2. contrato — Contrato de Conexión / Interconexión
--   3. poc — Puesta en Servicio (POC)
--   4. anexo — Anexos II y demás del POC
--   5. energizacion — Primera energización
--   6. doc — Declaración de Operación Comercial
--
-- APLICAR EN SUPABASE:
--   1. Abrir https://supabase.com/dashboard/project/twwqmjumtqwhhwxrmlse
--   2. SQL Editor → New query → pegar todo este archivo → Run
--   3. Verificar en Table Editor que aparece "proyecto_sim_etapas"
-- ============================================================

create table if not exists public.proyecto_sim_etapas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  etapa text not null check (etapa in ('estudios', 'contrato', 'poc', 'anexo', 'energizacion', 'doc')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'completada', 'bloqueada')),
  fecha_inicio date,
  fecha_fin date,
  notas text,
  responsable_id uuid references public.usuarios(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (proyecto_id, etapa)
);

create index if not exists idx_proyecto_sim_etapas_proyecto on public.proyecto_sim_etapas(proyecto_id);

-- Row Level Security
alter table public.proyecto_sim_etapas enable row level security;

-- Cualquier usuario autenticado puede LEER (necesario para que el equipo vea status)
drop policy if exists "lectura_authenticated_sim" on public.proyecto_sim_etapas;
create policy "lectura_authenticated_sim"
  on public.proyecto_sim_etapas for select
  to authenticated
  using (true);

-- Solo direccion / director_proyectos / admin pueden ESCRIBIR
drop policy if exists "escritura_directores_sim" on public.proyecto_sim_etapas;
create policy "escritura_directores_sim"
  on public.proyecto_sim_etapas for all
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

-- Trigger para mantener updated_at
create or replace function public.set_updated_at_sim()
  returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_proyecto_sim_etapas_updated on public.proyecto_sim_etapas;
create trigger trg_proyecto_sim_etapas_updated
  before update on public.proyecto_sim_etapas
  for each row execute function public.set_updated_at_sim();
