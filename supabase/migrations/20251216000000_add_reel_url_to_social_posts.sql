-- Agregar campo para links de posts/reels de redes sociales
ALTER TABLE social_posts
ADD COLUMN IF NOT EXISTS reel_url TEXT,
ADD COLUMN IF NOT EXISTS reel_platform TEXT CHECK (reel_platform IN ('instagram', 'tiktok', 'x', 'twitter', 'facebook'));

-- Comentarios
COMMENT ON COLUMN social_posts.reel_url IS 'URL del post o reel de Instagram, TikTok, X, Facebook';
COMMENT ON COLUMN social_posts.reel_platform IS 'Plataforma del post/reel: instagram, tiktok, x, twitter o facebook';

