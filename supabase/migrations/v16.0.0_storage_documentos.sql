-- v16.0.0: Storage de documentos
-- Bucket privado proyectos-docs + RLS estrictas con verificación de scope.
-- Path convention: {scope}/{scopeId}/{categoria}/{timestamp}_{filename}
-- scope ∈ ('proyectos','plantas','clientes')
-- categoria ∈ ('contratos','planos','entregables','fotos','facturas','permisos')

-- 1. Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proyectos-docs',
  'proyectos-docs',
  false,
  52428800,  -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip', 'application/x-zip-compressed',
    'text/plain', 'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies RLS para storage.objects (limpieza por si existen)
DROP POLICY IF EXISTS "proyectos_docs_select" ON storage.objects;
DROP POLICY IF EXISTS "proyectos_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "proyectos_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "proyectos_docs_delete" ON storage.objects;

-- SELECT: authenticated puede leer SI el path apunta a un recurso al que tiene
-- acceso vía las RLS de la tabla padre (EXISTS respeta RLS automáticamente).
CREATE POLICY "proyectos_docs_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'proyectos-docs' AND (
    ((storage.foldername(name))[1] = 'proyectos' AND
     EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id::text = (storage.foldername(name))[2]))
    OR
    ((storage.foldername(name))[1] = 'plantas' AND
     EXISTS (SELECT 1 FROM public.plantas_electricas pe WHERE pe.id::text = (storage.foldername(name))[2]))
    OR
    ((storage.foldername(name))[1] = 'clientes' AND
     EXISTS (SELECT 1 FROM public.clientes c WHERE c.id::text = (storage.foldername(name))[2]))
  )
);

-- INSERT (upload): roles operativos pueden subir.
CREATE POLICY "proyectos_docs_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proyectos-docs' AND
  public.app_has_any_rol('direccion','admin','director_proyectos','ventas','cobranza','equipo_proyectos') AND
  (storage.foldername(name))[1] IN ('proyectos', 'plantas', 'clientes')
);

-- UPDATE (replace via upsert): edición fuerte solo direccion/admin/director_proyectos.
CREATE POLICY "proyectos_docs_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'proyectos-docs' AND
  public.app_has_any_rol('direccion','admin','director_proyectos')
)
WITH CHECK (
  bucket_id = 'proyectos-docs' AND
  public.app_has_any_rol('direccion','admin','director_proyectos')
);

-- DELETE: solo direccion + admin.
CREATE POLICY "proyectos_docs_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'proyectos-docs' AND
  public.app_has_any_rol('direccion','admin')
);
