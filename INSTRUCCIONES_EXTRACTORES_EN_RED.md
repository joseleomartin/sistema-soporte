# 🌐 Ejecutar el backend de extractores en la red local

Estos pasos permiten que otros equipos de tu red utilicen los extractores y el OCR sin necesidad de instalar nada en sus máquinas.

---

## 1. Configurar variables de entorno (opcional)

El script `project/backend/start.bat` ya define valores por defecto:

- `EXTRACTOR_HOST=0.0.0.0` (escucha en todas las interfaces)
- `EXTRACTOR_PORT=5000`

Si quieres cambiar el puerto o limitar el acceso a una IP específica:

```bat
set EXTRACTOR_HOST=192.168.0.10
set EXTRACTOR_PORT=6000
start.bat
```

> Reemplaza `192.168.0.10` por la IP de la PC que ejecuta el backend.

---

## 2. Abrir el puerto en Windows Firewall

1. Abre **Panel de control → Firewall de Windows → Configuración avanzada**.
2. Crea una **Regla de entrada**:
   - Tipo: *Puerto*
   - Protocolo: *TCP*
   - Puerto: `5000` (o el que uses)
   - Acción: *Permitir conexión*
3. Repite para una **Regla de salida** si fuese necesario.

---

## 3. Ejecutar el backend

En la carpeta `project/backend`:

```bat
start.bat
```

El script:

1. Activa el entorno virtual (creándolo si no existe).
2. Instala dependencias (`pip install -r requirements.txt`).
3. Verifica la configuración (`check_setup.py`).
4. Inicia `server.py` escuchando en `http://EXTRACTOR_HOST:EXTRACTOR_PORT`.

Mientras el backend esté corriendo, no cierres la ventana.

---

## 4. Configurar el frontend

1. Crea un archivo `project/.env` (o `.env.local`) y define:

   ```env
   VITE_EXTRACTOR_API_URL=http://IP_SERVIDOR:5000
   ```

   > Ejemplo: `http://192.168.0.10:5000`

2. Reinicia el servidor de desarrollo (`npm run dev`) o despliega nuevamente para que Vite lea la variable.

En producción, configura la misma variable en Vercel (`Project Settings → Environment Variables`).

---

## 5. Probar desde otra máquina

1. Abre la app web desde la PC cliente.
2. En la sección **Extractor de Tablas** sube un PDF.
3. El formulario enviará la solicitud al backend de la red y la campanita mostrará la notificación cuando el archivo esté listo.
4. El link de descarga usará la IP del servidor gracias a `request.host_url`.

---

## 6. Consejos adicionales

- 🤔 **¿El archivo no descarga?** Asegúrate de que la PC cliente pueda acceder a `http://IP_SERVIDOR:5000/download/...` (prueba en el navegador).
- 🔄 **¿Cambiaste el puerto?** Actualiza `VITE_EXTRACTOR_API_URL` y vuelve a desplegar el frontend.
- 🔒 **Seguridad:** Si se expone fuera de la LAN, considera poner el backend detrás de un proxy con HTTPS (ej. Nginx) o usar una VPN.

Con esto, los extractores quedan disponibles para toda tu red local. 🚀
















