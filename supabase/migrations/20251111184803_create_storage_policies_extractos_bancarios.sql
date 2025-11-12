/*
  # Crear políticas de storage para extractos bancarios

  1. Políticas
    - Usuarios autenticados pueden subir sus propios extractos
    - Usuarios autenticados pueden leer sus propios extractos
    - Usuarios autenticados pueden eliminar sus propios extractos
*/

CREATE POLICY "Users can upload their own bank statements"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'extractos-bancarios' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read their own bank statements"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'extractos-bancarios' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own bank statements"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'extractos-bancarios' AND (storage.foldername(name))[1] = auth.uid()::text);
