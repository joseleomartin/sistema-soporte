# EmpleadosPlus

Plataforma SaaS multitenant para gestión de recibos de sueldo construida con Next.js 15, Supabase y Mercado Pago.

## Características

- 🔐 **Autenticación Segura**: Sistema de autenticación con Supabase Auth
- 👥 **Multitenancy**: Aislamiento total por tenant con Row Level Security (RLS)
- 📄 **Gestión de Recibos**: Subida y descarga de recibos de sueldo en formato PDF
- 💰 **Facturación Automática**: Cobro automático de $1.000 ARS por recibo cargado
- 💳 **Integración Mercado Pago**: Procesamiento de pagos integrado
- 🎨 **UI Moderna**: Interfaz construida con Tailwind CSS y Shadcn/UI
- 🚀 **Deploy en Vercel**: Optimizado para Vercel con Serverless Functions

## Stack Tecnológico

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, Shadcn/UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Pagos**: Mercado Pago
- **Hosting**: Vercel

## Estructura del Proyecto

```
empleadosplus/
├── app/                    # Next.js App Router
│   ├── (dashboard)/       # Rutas protegidas del dashboard
│   │   ├── admin/         # Dashboard de administrador
│   │   └── employee/      # Dashboard de empleado
│   ├── api/               # API Routes
│   ├── login/             # Página de login
│   └── middleware.ts      # Middleware de autenticación
├── components/            # Componentes React
│   ├── ui/               # Componentes de Shadcn/UI
│   ├── admin/            # Componentes del admin
│   └── employee/         # Componentes del empleado
├── lib/                   # Utilidades y lógica
│   ├── actions/          # Server Actions
│   ├── supabase/         # Clientes de Supabase
│   └── utils/            # Utilidades generales
├── supabase/             # Scripts SQL de Supabase
│   └── migrations/       # Migraciones de base de datos
└── types/                # Tipos TypeScript
```

## Instalación

### Requisitos

- Node.js 18+ 
- npm o yarn
- Cuenta de Supabase
- Cuenta de Mercado Pago (opcional, para producción)

### Pasos

1. Clona el repositorio:
```bash
git clone <tu-repositorio>
cd empleadosplus
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno:
```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales:
- `NEXT_PUBLIC_SUPABASE_URL`: URL de tu proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave anónima de Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Clave de servicio de Supabase (⚠️ NUNCA exponer)
- `MERCADOPAGO_ACCESS_TOKEN`: Token de acceso de Mercado Pago
- `NEXT_PUBLIC_APP_URL`: URL de tu aplicación (localhost:3000 para desarrollo)

4. Configura Supabase:
   - Ejecuta las migraciones SQL en el SQL Editor de Supabase
   - Crea el bucket de Storage `recibos`
   - Configura las políticas de Storage

5. Ejecuta el servidor de desarrollo:
```bash
npm run dev
```

6. Abre [http://localhost:3000](http://localhost:3000) en tu navegador

## Uso

### Crear Primer Usuario Admin

Para crear el primer usuario administrador, ejecuta este script SQL en Supabase después de crear el usuario en auth.users:

```sql
-- Crear tenant
INSERT INTO public.tenants (id, name) 
VALUES (gen_random_uuid(), 'Mi Empresa');

-- Crear perfil admin (reemplaza con el ID del usuario de auth.users)
INSERT INTO public.profiles (id, tenant_id, email, role, full_name)
VALUES (
  'USER_ID_FROM_AUTH_USERS',
  (SELECT id FROM tenants WHERE name = 'Mi Empresa'),
  'admin@empresa.com',
  'admin',
  'Administrador'
);
```

### Flujo de Trabajo

1. **Admin crea empleados**: Desde `/admin/employees`, el admin puede crear cuentas para empleados
2. **Empleados suben recibos**: Los empleados pueden subir PDFs desde `/employee/paystubs`
3. **Facturación automática**: Cada recibo genera un registro de facturación de $1.000 ARS
4. **Pago**: El admin puede pagar la facturación desde `/admin/billing` usando Mercado Pago
5. **Webhook**: Mercado Pago notifica a la app cuando el pago se completa

## Desarrollo

### Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo
- `npm run build`: Construye la aplicación para producción
- `npm run start`: Inicia el servidor de producción
- `npm run lint`: Ejecuta el linter

### Arquitectura

- **Multitenancy**: Implementado con Row Level Security (RLS) en Supabase
- **Server Actions**: Todas las operaciones de escritura usan Server Actions
- **Middleware**: Protege rutas y maneja autenticación
- **Storage**: PDFs almacenados en Supabase Storage con estructura `/recibos/{tenant_id}/{user_id}/`

## Seguridad

- ✅ Row Level Security (RLS) habilitado en todas las tablas
- ✅ Service Role Key solo usado en Server Actions (nunca expuesto al cliente)
- ✅ Validación de tipos con Zod en formularios
- ✅ Sanitización de nombres de archivo antes de subir
- ✅ Verificación de tipo MIME (solo PDF)
- ✅ Middleware protege todas las rutas sensibles

## Deployment

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para instrucciones detalladas de deployment en Vercel.

## Licencia

Este proyecto es privado y propietario.

## Contribuciones

Este es un proyecto privado. No se aceptan contribuciones externas.
