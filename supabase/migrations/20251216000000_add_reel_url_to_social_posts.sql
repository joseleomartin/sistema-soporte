-- Agregar campo para links de posts/reels de redes sociales
ALTER TABLE social_posts
ADD COLUMN IF NOT EXISTS reel_url TEXT,
ADD COLUMN IF NOT EXISTS reel_platform TEXT;

-- Actualizar el CHECK constraint para incluir YouTube
DO $$
BEGIN
  -- Eliminar constraint existente si existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'social_posts_reel_platform_check'
  ) THEN
    ALTER TABLE social_posts DROP CONSTRAINT social_posts_reel_platform_check;
  END IF;
  
  -- Crear nuevo constraint con todas las plataformas incluyendo YouTube
  ALTER TABLE social_posts
  ADD CONSTRAINT social_posts_reel_platform_check 
  CHECK (reel_platform IS NULL OR reel_platform IN ('instagram', 'tiktok', 'x', 'twitter', 'facebook', 'youtube'));
END $$;

-- Comentarios
COMMENT ON COLUMN social_posts.reel_url IS 'URL del post o reel de Instagram, TikTok, X, Facebook, YouTube';
COMMENT ON COLUMN social_posts.reel_platform IS 'Plataforma del post/reel: instagram, tiktok, x, twitter, facebook o youtube';

