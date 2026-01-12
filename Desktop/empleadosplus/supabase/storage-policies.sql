-- Storage Bucket: recibos
-- Este script debe ejecutarse en el SQL Editor de Supabase después de crear el bucket manualmente
-- O puedes crear el bucket programáticamente desde el código

-- Crear el bucket (ejecutar una vez en Supabase Dashboard o mediante código)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('recibos', 'recibos', false);

-- Política de Storage: Los usuarios pueden subir archivos a su propia carpeta
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'recibos'
    AND (storage.foldername(name))[1] = 'recibos'
    AND (storage.foldername(name))[2]::uuid = (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (storage.foldername(name))[3]::uuid = auth.uid()
);

-- Política de Storage: Los usuarios pueden leer sus propios archivos
CREATE POLICY "Users can read their own files"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'recibos'
    AND (
        (storage.foldername(name))[3]::uuid = auth.uid()
        OR (
            (storage.foldername(name))[2]::uuid = (
                SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
            )
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    )
);

-- Política de Storage: Los usuarios pueden eliminar sus propios archivos
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'recibos'
    AND (
        (storage.foldername(name))[3]::uuid = auth.uid()
        OR (
            (storage.foldername(name))[2]::uuid = (
                SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
            )
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    )
);
