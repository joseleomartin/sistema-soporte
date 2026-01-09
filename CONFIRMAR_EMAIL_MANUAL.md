# ✅ Confirmar Email Manualmente

Como el servicio de email de Supabase tiene problemas y no está enviando los emails de confirmación, puedes confirmar los emails manualmente de varias formas:

## 🔧 Método 1: Desde el Dashboard de Supabase (Más Fácil)

1. Ve a **Authentication** → **Users** en Supabase
2. Busca el usuario por email
3. Haz clic en los tres puntos (⋯) junto al usuario
4. Selecciona **"Confirm email"**
5. ¡Listo! El email quedará confirmado

## 🔧 Método 2: Usando SQL (Para múltiples usuarios)

### Confirmar un email específico:

```sql
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'fabinsa@estudiomartin.com';
```

### Confirmar todos los emails de un tenant:

```sql
-- Confirmar todos los emails del tenant "fabinsa"
SELECT confirm_all_emails_for_tenant('fabinsa');
```

### Ver usuarios sin confirmar:

```sql
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  p.full_name,
  t.name as tenant_name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE u.email_confirmed_at IS NULL
ORDER BY u.created_at DESC;
```

### Confirmar todos los emails (solo desarrollo):

```sql
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email_confirmed_at IS NULL;
```

## 📋 Script Completo

He creado el archivo `confirmar_emails_manual.sql` con todas estas opciones. Puedes ejecutarlo en el SQL Editor de Supabase.

## 🚀 Solución Rápida para Fabinsa

Si quieres confirmar el email de Fabinsa rápidamente:

1. **Opción A (Dashboard):**
   - Ve a Authentication → Users
   - Busca `fabinsa@estudiomartin.com`
   - Haz clic en ⋯ → Confirm email

2. **Opción B (SQL):**
   ```sql
   UPDATE auth.users
   SET email_confirmed_at = NOW()
   WHERE email = 'fabinsa@estudiomartin.com';
   ```

## ⚠️ Nota Importante

- Estos métodos son útiles para **desarrollo** o cuando el servicio de email no funciona
- En **producción**, es mejor configurar SMTP personalizado para que los emails funcionen correctamente
- Una vez confirmado el email, el usuario podrá iniciar sesión normalmente







