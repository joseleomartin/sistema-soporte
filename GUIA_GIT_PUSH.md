# 📤 Guía: Subir Cambios a GitHub

## 🚀 Pasos para Subir Cambios

### 1. Verificar Estado Actual

```bash
cd C:\Users\relim\Desktop\bolt\project
git status
```

### 2. Agregar Archivos Modificados (si hay cambios sin commitear)

Si hay archivos modificados que no están en el commit:

```bash
# Ver qué archivos están modificados
git status

# Agregar todos los archivos modificados
git add .

# O agregar archivos específicos
git add src/components/Dashboard/UserDashboard.tsx
git add supabase/migrations/20251112180001_fix_task_assignments_rls.sql
```

### 3. Crear Commit (si hay cambios sin commitear)

```bash
git commit -m "Fix: Admin ve todas las tareas en dashboard y usuarios ven todos los asignados"
```

### 4. Subir a GitHub

```bash
git push origin main
```

Si es la primera vez o hay conflictos:

```bash
# Si hay conflictos, primero hacer pull
git pull origin main

# Resolver conflictos si los hay, luego:
git push origin main
```

---

## 📝 Resumen de Cambios Recientes

### Archivos Modificados:

1. **`src/components/Dashboard/UserDashboard.tsx`**
   - ✅ Cambio de "Antigüedad" a "Tareas Asignadas"
   - ✅ Admin cuenta todas las tareas (no solo las asignadas)
   - ✅ Logging mejorado para diagnóstico

2. **`src/components/Tasks/TasksList.tsx`**
   - ✅ Muestra todos los usuarios asignados
   - ✅ Destaca al usuario actual con "Tú"
   - ✅ Mejora en agrupamiento de asignaciones

3. **`src/components/Tasks/TaskDetail.tsx`**
   - ✅ Nueva sección "Asignados" con todos los usuarios
   - ✅ Carga automática de asignaciones
   - ✅ Destacado del usuario actual

4. **`src/components/Dashboard/UserDashboard.tsx` (calendario)**
   - ✅ Tareas aparecen en el calendario como eventos
   - ✅ Colores según prioridad (rojo/azul/verde)
   - ✅ Navegación a tareas desde el calendario

5. **`supabase/migrations/20251112180001_fix_task_assignments_rls.sql`**
   - ✅ Nueva política RLS para ver todas las asignaciones
   - ✅ Función SECURITY DEFINER para evitar recursión

6. **`supabase/migrations/20251112180002_restore_and_fix_assignments_rls.sql`**
   - ✅ Migración alternativa para restaurar funcionalidad

---

## 🔍 Verificar Antes de Push

### Ver qué se va a subir:

```bash
git log origin/main..HEAD --oneline
```

### Ver diferencias:

```bash
git diff origin/main..HEAD
```

---

## ⚠️ Si Hay Errores

### Error: "Updates were rejected"

```bash
# Hacer pull primero
git pull origin main --rebase

# Resolver conflictos si los hay
# Luego push
git push origin main
```

### Error: "Permission denied"

Verifica que tengas permisos de escritura en el repositorio.

### Error: "Branch is behind"

```bash
git pull origin main
git push origin main
```

---

## 📋 Comandos Rápidos (Copy-Paste)

```bash
# 1. Ir al directorio del proyecto
cd C:\Users\relim\Desktop\bolt\project

# 2. Ver estado
git status

# 3. Agregar cambios (si hay)
git add .

# 4. Commit (si hay cambios)
git commit -m "Fix: Dashboard admin y visualización de asignados en tareas"

# 5. Push a GitHub
git push origin main
```

---

## ✅ Verificar que se Subió Correctamente

1. Ve a tu repositorio en GitHub
2. Verifica que el último commit aparezca
3. Revisa que los archivos modificados estén actualizados

---

## 🎯 Próximos Pasos Después del Push

1. **Si usas Railway/Vercel con auto-deploy:**
   - Los cambios se desplegarán automáticamente
   - Espera unos minutos y verifica el deploy

2. **Si necesitas ejecutar migraciones SQL:**
   - Ve a Supabase Dashboard
   - SQL Editor
   - Ejecuta las migraciones nuevas:
     - `20251112180001_fix_task_assignments_rls.sql`
     - `20251112180002_restore_and_fix_assignments_rls.sql` (si la primera no funciona)

3. **Verificar en producción:**
   - Recarga la aplicación
   - Verifica que el admin vea todas las tareas
   - Verifica que los usuarios vean todos los asignados



