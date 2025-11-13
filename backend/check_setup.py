#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script de verificación de configuración del backend
Verifica que todas las dependencias y extractores estén correctamente instalados
"""

import sys
import os
from pathlib import Path

def print_header(text):
    """Imprime un encabezado formateado"""
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)

def check_python_version():
    """Verifica la versión de Python"""
    print_header("Verificando Python")
    version = sys.version_info
    print(f"Python {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ ERROR: Se requiere Python 3.8 o superior")
        return False
    else:
        print("✅ Versión de Python correcta")
        return True

def check_dependencies():
    """Verifica las dependencias instaladas"""
    print_header("Verificando Dependencias")
    
    dependencies = [
        'flask',
        'flask_cors',
        'pandas',
        'pdfplumber',
        'camelot',
        'openpyxl',
    ]
    
    all_ok = True
    for dep in dependencies:
        try:
            __import__(dep)
            print(f"✅ {dep}")
        except ImportError:
            print(f"❌ {dep} - NO INSTALADO")
            all_ok = False
    
    if not all_ok:
        print("\n⚠️  Instala las dependencias faltantes con:")
        print("   pip install -r requirements.txt")
    
    return all_ok

def check_extractors():
    """Verifica los extractores disponibles"""
    print_header("Verificando Extractores")
    
    extractores_dir = Path(__file__).parent / 'extractores'
    
    if not extractores_dir.exists():
        print("❌ ERROR: No se encontró el directorio 'extractores'")
        return False
    
    expected_extractors = [
        'extractor_banco_galicia.py',
        'extractor_banco_galicia_mas.py',
        'extractor_mercado_pago_directo.py',
        'extractor_banco_comafi.py',
        'extractor_banco_jpmorgan.py',
        'extractor_banco_bind.py',
        'extractor_banco_supervielle.py',
        'extractor_banco_cabal.py',
        'extractor_banco_credicoop_v3.py',
        'extractor_banco_cmf.py',
        'extractor_santander_simple.py',
        'extractor_banco_del_sol_v1.py',
        'extractor_banco_ciudad.py',
        'extractor_bbva_mejorado.py',
        'extractor_banco_icbc.py',
        'extractor_banco_macro.py',
        'nacion.py',
    ]
    
    found = 0
    missing = []
    
    for extractor in expected_extractors:
        extractor_path = extractores_dir / extractor
        if extractor_path.exists():
            found += 1
            print(f"✅ {extractor}")
        else:
            missing.append(extractor)
            print(f"❌ {extractor} - NO ENCONTRADO")
    
    print(f"\nExtractores encontrados: {found}/{len(expected_extractors)}")
    
    if missing:
        print(f"\n⚠️  Faltan {len(missing)} extractores:")
        for ext in missing:
            print(f"   - {ext}")
    
    return len(missing) == 0

def check_ports():
    """Verifica que el puerto 5000 esté disponible"""
    print_header("Verificando Puerto")
    
    import socket
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', 5000))
    sock.close()
    
    if result == 0:
        print("⚠️  El puerto 5000 está en uso")
        print("   Puede que el servidor ya esté ejecutándose")
        print("   o que otro proceso esté usando el puerto")
        return False
    else:
        print("✅ Puerto 5000 disponible")
        return True

def check_temp_directory():
    """Verifica que se pueda crear el directorio temporal"""
    print_header("Verificando Directorio Temporal")
    
    import tempfile
    temp_dir = Path(tempfile.gettempdir()) / 'extractores_temp'
    
    try:
        temp_dir.mkdir(exist_ok=True)
        test_file = temp_dir / 'test.txt'
        test_file.write_text('test')
        test_file.unlink()
        print(f"✅ Directorio temporal: {temp_dir}")
        return True
    except Exception as e:
        print(f"❌ Error al crear directorio temporal: {e}")
        return False

def main():
    """Función principal"""
    print("\n" + "█" * 60)
    print("█" + " " * 58 + "█")
    print("█" + "  VERIFICACIÓN DE CONFIGURACIÓN - BACKEND EXTRACTORES".center(58) + "█")
    print("█" + " " * 58 + "█")
    print("█" * 60)
    
    results = {
        'Python': check_python_version(),
        'Dependencias': check_dependencies(),
        'Extractores': check_extractors(),
        'Puerto': check_ports(),
        'Directorio Temporal': check_temp_directory(),
    }
    
    print_header("RESUMEN")
    
    all_ok = True
    for check, result in results.items():
        status = "✅ OK" if result else "❌ FALLO"
        print(f"{check:.<40} {status}")
        if not result:
            all_ok = False
    
    print("\n" + "=" * 60)
    
    if all_ok:
        print("\n🎉 ¡TODO LISTO! El backend está correctamente configurado.")
        print("\nPuedes iniciar el servidor con:")
        print("   python server.py")
    else:
        print("\n⚠️  Hay problemas que necesitan ser resueltos.")
        print("\nRevisa los mensajes de error arriba y:")
        print("   1. Instala las dependencias faltantes")
        print("   2. Verifica que los extractores estén en su lugar")
        print("   3. Asegúrate de que el puerto 5000 esté libre")
    
    print("\n" + "=" * 60 + "\n")
    
    return 0 if all_ok else 1

if __name__ == '__main__':
    sys.exit(main())




