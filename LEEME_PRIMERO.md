# 👋 ¡LÉEME PRIMERO!

## 🎯 Sistema de Extracción de Extractos Bancarios

Este proyecto incluye un sistema completo para extraer datos de extractos bancarios en PDF y convertirlos a Excel.

## 📖 ¿Qué documento necesito?

Elige según tu situación:

### 🚀 Solo quiero empezar YA
→ Lee: **`CHECKLIST_INICIO.md`**
- Lista de verificación paso a paso
- Todo lo que necesitas en una página

### 📱 Primera vez usando el sistema
→ Lee: **`GUIA_RAPIDA_EXTRACTORES.md`**
- Guía de usuario simple
- Instrucciones de uso
- Problemas comunes

### 💻 Necesito instalar/configurar
→ Lee: **`INSTRUCCIONES_INICIO.md`**
- Instrucciones detalladas de instalación
- Requisitos del sistema
- Solución de problemas completa

### 🔧 Soy desarrollador/técnico
→ Lee: **`RESUMEN_EXTRACTORES.md`**
- Arquitectura del sistema
- Documentación técnica
- API y endpoints

### 📚 Backend/Python
→ Lee: **`backend/README.md`**
- Documentación del servidor Flask
- Cómo agregar nuevos extractores
- API endpoints

---

## ⚡ Inicio Ultra-Rápido (2 comandos)

Si tienes Python y Node.js instalados:

```bash
# Terminal 1 - Backend
cd backend && start.bat  # Windows
cd backend && ./start.sh  # Linux/Mac

# Terminal 2 - Frontend
npm run dev
```

Abre: http://localhost:5173

---

## 📂 Estructura de Documentación

```
project/
├── LEEME_PRIMERO.md ← ¡Estás aquí!
├── CHECKLIST_INICIO.md ← Inicio rápido
├── GUIA_RAPIDA_EXTRACTORES.md ← Guía de usuario
├── INSTRUCCIONES_INICIO.md ← Instalación detallada
├── RESUMEN_EXTRACTORES.md ← Documentación técnica
└── backend/
    └── README.md ← Documentación del backend
```

---

## 🏦 ¿Qué Bancos Soporta?

17 bancos argentinos:

✅ Galicia | ✅ Galicia Más | ✅ Mercado Pago | ✅ Comafi
✅ JP Morgan | ✅ BIND | ✅ Supervielle | ✅ Cabal
✅ Credicoop | ✅ CMF | ✅ Santander | ✅ Del Sol
✅ Ciudad | ✅ BBVA | ✅ ICBC | ✅ Macro | ✅ Nación

---

## 🎯 ¿Qué Hace el Sistema?

1. **Cargas** un PDF de extracto bancario
2. **Seleccionas** el banco correspondiente
3. **Procesas** con un click
4. **Descargas** un Excel con todos los datos extraídos

**Resultado:** Todas tus transacciones en formato Excel, listas para usar.

---

## 🆘 Ayuda Rápida

### No funciona nada
→ `INSTRUCCIONES_INICIO.md` (Sección: Solución de Problemas)

### Backend no inicia
```bash
cd backend
python check_setup.py
```

### Error de conexión
→ Verifica que el backend esté corriendo
→ Abre: http://localhost:5000/health

### Falta Python o Node.js
→ `INSTRUCCIONES_INICIO.md` (Sección: Requisitos del Sistema)

---

## 📞 Contacto

Para soporte o preguntas, contacta al equipo de desarrollo.

---

## 🎉 ¡Comienza Ahora!

**Siguiente paso:** Abre `CHECKLIST_INICIO.md` y sigue los pasos.

**Tiempo estimado:** 5 minutos hasta tu primer extracto procesado.

---

**Versión:** 1.0.0
**Fecha:** 11 de Noviembre, 2025
**Estado:** ✅ Listo para usar





