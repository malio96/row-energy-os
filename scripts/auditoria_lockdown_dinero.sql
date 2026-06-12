-- ============================================================
-- AUDITORÍA LOCKDOWN DE DINERO — Row Energy OS
-- ============================================================
-- REGLA INNEGOCIABLE (dirección): director_proyectos y equipo_proyectos
-- NO ven NADA de dinero. Administración y Proyectos están separados.
--
-- Correr DESPUÉS de cualquier cambio de permisos/RLS/módulos:
--   supabase db query --linked "$(cat scripts/auditoria_lockdown_dinero.sql)"
-- o vía MCP execute_sql. TODA superficie debe dar 0 (excepto 'proyectos', >0).
-- Si alguna da >0: HAY FUGA — revertir el cambio que la causó.
-- ============================================================
BEGIN;
CREATE TEMP TABLE _audit(rol text, superficie text, filas_visibles bigint) ON COMMIT DROP;
GRANT ALL ON _audit TO authenticated;

DO $$
DECLARE v_rol text; v_auth uuid;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['equipo_proyectos','director_proyectos'] LOOP
    SELECT auth_id INTO v_auth FROM public.usuarios WHERE rol=v_rol AND activo AND auth_id IS NOT NULL LIMIT 1;
    IF v_auth IS NULL THEN RAISE NOTICE 'Sin usuario activo de rol %', v_rol; CONTINUE; END IF;
    PERFORM set_config('role','authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role','authenticated')::text, true);

    INSERT INTO _audit SELECT v_rol,'cotizaciones',count(*) FROM public.cotizaciones;
    INSERT INTO _audit SELECT v_rol,'cotizacion_items',count(*) FROM public.cotizacion_items;
    INSERT INTO _audit SELECT v_rol,'leads (ajenos)',count(*) FROM public.leads WHERE owner_id IS DISTINCT FROM public.app_user_id();
    INSERT INTO _audit SELECT v_rol,'hitos_cobranza',count(*) FROM public.hitos_cobranza;
    INSERT INTO _audit SELECT v_rol,'facturas',count(*) FROM public.facturas;
    INSERT INTO _audit SELECT v_rol,'contratos',count(*) FROM public.contratos;
    INSERT INTO _audit SELECT v_rol,'compras',count(*) FROM public.compras;
    INSERT INTO _audit SELECT v_rol,'cuentas_por_pagar',count(*) FROM public.cuentas_por_pagar;
    INSERT INTO _audit SELECT v_rol,'gastos_variables',count(*) FROM public.gastos_variables;
    INSERT INTO _audit SELECT v_rol,'proyectos_montos',count(*) FROM public.proyectos_montos;
    INSERT INTO _audit SELECT v_rol,'precios_servicios',count(*) FROM public.precios_servicios;
    INSERT INTO _audit SELECT v_rol,'notif. de otros roles',count(*) FROM public.notificaciones WHERE destinatario_id IS NULL AND destinatario_rol IS DISTINCT FROM v_rol;
    INSERT INTO _audit SELECT v_rol,'proyectos (su trabajo, >0 OK)',count(*) FROM public.proyectos;
    PERFORM set_config('role','postgres', true);
  END LOOP;
END $$;

-- Resultado + veredicto automático
SELECT rol, superficie, filas_visibles,
  CASE WHEN superficie LIKE 'proyectos (%' THEN (CASE WHEN filas_visibles > 0 THEN 'OK' ELSE '⚠ REVISAR' END)
       ELSE (CASE WHEN filas_visibles = 0 THEN 'OK' ELSE '🚨 FUGA' END) END AS veredicto
FROM _audit ORDER BY rol, superficie;
ROLLBACK;
