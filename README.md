# 🎯 Sistema de Gestión de Soporte

Sistema completo de gestión de tickets, clientes, salas de reunión y herramientas de procesamiento de documentos.

## ✨ Características

### 🎫 **Sistema de Tickets**
- Creación y gestión de tickets de soporte
- Comentarios y archivos adjuntos
- Estados y prioridades
- Asignación a usuarios

### 👥 **Gestión de Clientes (Foros)**
- Organización por clientes
- Subforos para cada cliente
- Sistema de mensajería
- Gestión de archivos y documentos
- Permisos granulares por usuario y departamento

### 📹 **Salas de Reunión**
- Videoconferencias integradas
- Contador de usuarios en tiempo real
- Historial de reuniones

### 🔧 **Herramientas**
- **Extractor de Tablas**: 17 extractores especializados para bancos
- **PDF a OCR**: Conversión de PDFs a texto con OCR

### 🏢 **Departamentos**
- Organización de usuarios en grupos
- Asignación de permisos por departamento
- Envío de eventos de calendario a departamentos completos

### 📅 **Calendario**
- Eventos personales
- Asignación de eventos a usuarios individuales
- Asignación de eventos a departamentos completos
- Vista mensual con eventos destacados

### 👤 **Gestión de Usuarios**
- Roles: Admin, Soporte, Usuario
- Fotos de perfil personalizadas
- Dashboard personalizado para cada rol

## 🛠️ Tecnologías

### **Frontend**
- React 18
- TypeScript
- Vite
- TailwindCSS
- Lucide Icons
- Supabase Client

### **Backend**
- Python 3.11
- Flask
- PDFPlumber
- Camelot
- Pytesseract
- OCRmyPDF

### **Base de Datos**
- Supabase (PostgreSQL)
- Row Level Security (RLS)
- Realtime subscriptions

### **Storage**
- Supabase Storage
- Buckets: avatars, ticket-attachments

## 📦 Instalación Local

### **Requisitos**
- Node.js 18+
- Python 3.11+
- Tesseract OCR

### **Frontend**

```bash
cd project
npm install
npm run dev
```

### **Backend**

```bash
cd project/backend
pip install -r requirements.txt
python server.py
```

## 🚀 Despliegue

Ver [GUIA_DESPLIEGUE.md](./GUIA_DESPLIEGUE.md) para instrucciones completas.

### **Resumen**
- **Frontend**: Vercel
- **Backend**: Railway o Render
- **Base de Datos**: Supabase

## 📝 Variables de Entorno

### **Frontend (.env)**

```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
VITE_API_URL=tu_backend_url
```

### **Backend**

```env
FLASK_ENV=production
PORT=8080
```

## 🗄️ Base de Datos

### **Tablas Principales**
- `profiles` - Usuarios del sistema
- `tickets` - Tickets de soporte
- `ticket_comments` - Comentarios en tickets
- `forums` - Foros/Clientes
- `subforums` - Subforos de clientes
- `forum_messages` - Mensajes en foros
- `departments` - Departamentos/Grupos
- `user_departments` - Asignación de usuarios a departamentos
- `department_forum_permissions` - Permisos de foros por departamento
- `calendar_events` - Eventos de calendario
- `meeting_rooms` - Salas de reunión
- `room_presence` - Presencia de usuarios en salas

### **Migraciones**

Ver carpeta `supabase/migrations/` para todas las migraciones SQL.

## 👨‍💼 Roles y Permisos

### **Admin**
- Acceso completo al sistema
- Gestión de usuarios
- Gestión de departamentos
- Asignación de permisos
- Creación de clientes/foros

### **Soporte**
- Ver todos los tickets
- Gestionar tickets
- Acceso a todos los clientes
- Crear clientes/foros
- Asignar eventos a usuarios

### **Usuario**
- Ver sus propios tickets
- Crear tickets
- Acceso a clientes asignados
- Crear eventos personales
- Ver eventos asignados

## 🔒 Seguridad

- Row Level Security (RLS) en todas las tablas
- Autenticación con Supabase Auth
- Tokens JWT
- CORS configurado
- Validación de permisos en backend y frontend

## 📊 Estructura del Proyecto

```
project/
├── src/                    # Frontend React
│   ├── components/         # Componentes React
│   ├── contexts/          # Context providers
│   ├── lib/               # Configuración Supabase
│   └── App.tsx            # Componente principal
├── backend/               # Backend Flask
│   ├── server.py          # Servidor principal
│   ├── extractores/       # Scripts de extracción
│   └── requirements.txt   # Dependencias Python
├── supabase/
│   └── migrations/        # Migraciones SQL
└── public/                # Archivos estáticos

```

## 🧪 Testing

```bash
# Frontend
npm run test

# Backend
cd backend
pytest
```

## 📄 Licencia

Propietario - Todos los derechos reservados

## 🤝 Contribución

Este es un proyecto privado. Para contribuir, contacta al administrador.

## 📞 Soporte

Para soporte técnico, crea un ticket en el sistema o contacta al administrador.

---

**Versión**: 1.0.0  
**Última actualización**: Noviembre 2025






















