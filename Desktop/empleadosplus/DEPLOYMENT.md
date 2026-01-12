# Guía de Deployment - EmpleadosPlus

Esta guía te ayudará a desplegar la aplicación EmpleadosPlus en Vercel con Supabase y Mercado Pago.

## Requisitos Previos

- Cuenta en [Vercel](https://vercel.com)
- Proyecto en [Supabase](https://supabase.com)
- Cuenta en [Mercado Pago](https://www.mercadopago.com.ar) (para pagos)

## Paso 1: Configuración de Supabase

### 1.1 Crear Proyecto en Supabase

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Crea un nuevo proyecto
3. Espera a que se complete la configuración inicial

### 1.2 Ejecutar Migraciones SQL

1. En el Dashboard de Supabase, ve a **SQL Editor**
2. Ejecuta el contenido del archivo `supabase/migrations/001_initial_schema.sql`
3. Ejecuta el contenido del archivo `supabase/storage-policies.sql` (después de crear el bucket)

### 1.3 Configurar Storage Bucket

1. Ve a **Storage** en el Dashboard de Supabase
2. Crea un nuevo bucket llamado `recibos`
3. Marca el bucket como **Privado** (no público)
4. Ejecuta las políticas de Storage del archivo `supabase/storage-policies.sql`

### 1.4 Obtener Credenciales de Supabase

1. Ve a **Project Settings** > **API**
2. Copia los siguientes valores:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ NUNCA exponer al cliente)

## Paso 2: Configuración de Mercado Pago

### 2.1 Crear Aplicación en Mercado Pago

1. Ve a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
2. Crea una nueva aplicación
3. Obtén tu **Access Token** (production o test)
4. Configura la URL del webhook: `https://tu-dominio.vercel.app/api/mercadopago/webhook`

### 2.2 Configurar Webhook Secret (Opcional pero Recomendado)

1. En la configuración de tu aplicación, genera un webhook secret
2. Guárdalo como `MERCADOPAGO_WEBHOOK_SECRET`

## Paso 3: Deployment en Vercel

### 3.1 Conectar Repositorio

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Haz clic en **Add New Project**
3. Importa tu repositorio de GitHub/GitLab/Bitbucket
4. Vercel detectará automáticamente que es un proyecto Next.js

### 3.2 Configurar Variables de Entorno

En la sección **Environment Variables** de Vercel, agrega:

```
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_supabase_service_role_key
MERCADOPAGO_ACCESS_TOKEN=tu_mercadopago_access_token
MERCADOPAGO_WEBHOOK_SECRET=tu_mercadopago_webhook_secret
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
```

⚠️ **Importante**: 
- `SUPABASE_SERVICE_ROLE_KEY` solo debe estar en variables de entorno del servidor (nunca en `NEXT_PUBLIC_*`)
- `MERCADOPAGO_ACCESS_TOKEN` también debe ser privado
- `NEXT_PUBLIC_APP_URL` debe ser la URL de producción una vez desplegado

### 3.3 Configurar Build Settings

Vercel debería detectar automáticamente:
- **Framework Preset**: Next.js
- **Build Command**: `next build`
- **Output Directory**: `.next`

Si no, configúralo manualmente.

### 3.4 Deploy

1. Haz clic en **Deploy**
2. Espera a que se complete el build
3. Una vez desplegado, actualiza `NEXT_PUBLIC_APP_URL` con la URL de producción

## Paso 4: Configuración Post-Deployment

### 4.1 Actualizar URL del Webhook de Mercado Pago

1. Ve a la configuración de tu aplicación en Mercado Pago
2. Actualiza la URL del webhook a: `https://tu-dominio.vercel.app/api/mercadopago/webhook`

### 4.2 Crear Primer Usuario Admin

Para crear el primer usuario administrador, necesitarás:

1. Ejecutar un script SQL en Supabase SQL Editor:

```sql
-- Crear tenant inicial
INSERT INTO public.tenants (id, name) 
VALUES ('00000000-0000-0000-0000-000000000000', 'Mi Empresa');

-- Crear usuario admin manualmente en auth.users desde Supabase Dashboard
-- Luego ejecutar:
INSERT INTO public.profiles (id, tenant_id, email, role, full_name)
VALUES (
  'ID_DEL_USUARIO_CREADO_EN_AUTH',
  '00000000-0000-0000-0000-000000000000',
  'admin@empresa.com',
  'admin',
  'Administrador'
);
```

O usar el Service Role Key desde una función de Supabase o script local.

## Paso 5: Verificación

### 5.1 Verificar Funcionalidades

- [ ] Login funciona correctamente
- [ ] Admin puede crear empleados
- [ ] Empleados pueden subir recibos
- [ ] Los recibos se guardan en Storage
- [ ] La facturación se registra correctamente
- [ ] El botón de pago redirige a Mercado Pago
- [ ] El webhook actualiza el estado de facturación

### 5.2 Verificar Seguridad

- [ ] RLS está habilitado en todas las tablas
- [ ] Las rutas están protegidas por middleware
- [ ] Service Role Key no está expuesto al cliente
- [ ] Los archivos PDF solo son accesibles por usuarios autorizados

## Troubleshooting

### Error: "SUPABASE_SERVICE_ROLE_KEY no está configurada"

- Verifica que la variable de entorno esté configurada en Vercel
- Asegúrate de que no tenga espacios adicionales
- Reinicia el deployment después de agregar la variable

### Error: "No autorizado" al crear empleados

- Verifica que el usuario esté autenticado como admin
- Verifica que el Service Role Key sea correcto
- Revisa los logs de Vercel para más detalles

### Webhook de Mercado Pago no funciona

- Verifica que la URL del webhook sea accesible públicamente
- Verifica que la ruta `/api/mercadopago/webhook` esté correctamente configurada
- Revisa los logs de Vercel para ver las peticiones al webhook

### PDFs no se pueden descargar

- Verifica que el bucket `recibos` esté creado en Supabase
- Verifica las políticas de Storage
- Verifica que las signed URLs se generen correctamente

## Configuración de Desarrollo Local

1. Copia `.env.example` a `.env.local`
2. Completa todas las variables de entorno con tus credenciales
3. Ejecuta `npm install`
4. Ejecuta `npm run dev`
5. Abre `http://localhost:3000`

## Recursos Adicionales

- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs)
- [Documentación de Vercel](https://vercel.com/docs)

## Soporte

Si encuentras problemas, revisa:
- Los logs de Vercel en el dashboard
- Los logs de Supabase en el dashboard
- La consola del navegador para errores del cliente
