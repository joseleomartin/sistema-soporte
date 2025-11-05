#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para debuggear el problema con el botón "Actualizar Planilla"
"""

import sys
import os

# Agregar el directorio actual al path para importar el módulo
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_price_conversion():
    """Probar la conversión de precios"""
    print("=== PRUEBA DE CONVERSIÓN DE PRECIOS ===")
    
    # Datos de la imagen
    venta = "15000.0"
    venta_moneda = "ARS"
    
    print(f"Precio de venta: {venta}")
    print(f"Moneda: {venta_moneda}")
    
    try:
        precio_venta = float(venta)
        print(f"Precio convertido a float: {precio_venta}")
        print(f"Precio > 0: {precio_venta > 0}")
        print(f"Precio <= 0: {precio_venta <= 0}")
        
        if precio_venta <= 0:
            print("ERROR: El precio de venta debe ser mayor a 0.")
            return False
        else:
            print("OK: Precio valido")
            return True
        
    except ValueError as e:
        print(f"ERROR en conversion: {e}")
        return False

def test_validation_logic():
    """Probar la lógica de validación completa"""
    print("\n=== PRUEBA DE LÓGICA DE VALIDACIÓN ===")
    
    # Datos de la imagen
    familia = "Producto z"
    medida = "100x50"
    caracteristica = "Estándar"
    venta = "15000.0"
    venta_moneda = "ARS"
    iibb_porcentaje = "0"
    cant_fab = "100"
    cant_hora = "10.0"
    
    print(f"Familia: '{familia}'")
    print(f"Medida: '{medida}'")
    print(f"Característica: '{caracteristica}'")
    print(f"Precio venta: '{venta}'")
    print(f"Moneda: '{venta_moneda}'")
    print(f"IIBB %: '{iibb_porcentaje}'")
    print(f"Cant. fabricar: '{cant_fab}'")
    print(f"Cant. por hora: '{cant_hora}'")
    
    # Validar familia
    if not familia.strip():
        print("ERROR: Complete al menos la Familia.")
        return False
    else:
        print("OK: Familia valida")
    
    # Validar precio
    if venta:
        try:
            precio_venta = float(venta)
            if precio_venta <= 0:
                print("ERROR: El precio de venta debe ser mayor a 0.")
                return False
            else:
                print("OK: Precio valido")
        except ValueError:
            print("ERROR: El precio de venta debe ser un numero valido.")
            return False
    else:
        print("WARNING: No hay precio de venta, usando 0 como valor por defecto")
    
    # Validar materiales (simulado)
    materiales_costos_form = [{"kg_por_unidad": "2.500", "nombre": "Acero", "costo_por_kg": "800.00", "moneda": "ARS"}]
    
    if not materiales_costos_form:
        print("ERROR: Agregue al menos un material.")
        return False
    else:
        print("OK: Materiales validos")
    
    print("OK: Todas las validaciones pasaron")
    return True

def test_material_calculation():
    """Probar el cálculo de materiales"""
    print("\n=== PRUEBA DE CÁLCULO DE MATERIALES ===")
    
    materiales_costos_form = [
        {"kg_por_unidad": "2.500", "nombre": "Acero", "costo_por_kg": "800.00", "moneda": "ARS"}
    ]
    
    try:
        peso_total = sum(float(m.get('kg_por_unidad', 0)) for m in materiales_costos_form)
        print(f"Peso total calculado: {peso_total}")
        
        for i, material in enumerate(materiales_costos_form):
            kg = float(material.get('kg_por_unidad', 0))
            costo = float(material.get('costo_por_kg', 0))
            total = kg * costo
            print(f"Material {i+1}: {kg} kg × ${costo} = ${total}")
            
    except Exception as e:
        print(f"ERROR en calculo de materiales: {e}")
        return False
    
    print("OK: Calculo de materiales exitoso")
    return True

if __name__ == "__main__":
    print("DEBUGGING: Boton 'Actualizar Planilla' no funciona")
    print("=" * 60)
    
    # Ejecutar todas las pruebas
    tests = [
        test_price_conversion,
        test_validation_logic,
        test_material_calculation
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"ERROR en {test.__name__}: {e}")
            results.append(False)
    
    print("\n" + "=" * 60)
    print("RESUMEN DE PRUEBAS:")
    for i, (test, result) in enumerate(zip(tests, results)):
        status = "PASS" if result else "FAIL"
        print(f"{i+1}. {test.__name__}: {status}")
    
    if all(results):
        print("\nTodas las pruebas pasaron. El problema puede estar en otra parte.")
    else:
        print("\nAlgunas pruebas fallaron. Revisar la logica de validacion.")
