# 🔧 Configurar Root Directory en Vercel

## Problema
Vercel está buscando el `package.json` en la raíz del repositorio, pero el proyecto está en el subdirectorio `project`.

## Solución

### Paso 1: Ir al Dashboard de Vercel
1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto

### Paso 2: Configurar Root Directory
1. Ve a **Settings** → **General**
2. Busca la sección **"Root Directory"**
3. Haz clic en **"Edit"**
4. Ingresa: `project`
5. Haz clic en **"Save"**

### Paso 3: Redesplegar
1. Ve a **Deployments**
2. Haz clic en el menú de los 3 puntos (⋯) del último deployment
3. Selecciona **"Redeploy"**
4. Confirma el redespliegue

## Alternativa: Si no puedes configurar Root Directory

Si por alguna razón no puedes configurar el Root Directory en Vercel, puedes:

1. Mover todos los archivos del proyecto de `project/` a la raíz del repositorio
2. O crear un script de build que maneje el cambio de directorio

Pero la solución recomendada es configurar el Root Directory como se indica arriba.
