#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para probar la conversión del precio 15000.0
"""

def test_price_conversion():
    """Probar la conversión del precio específico"""
    venta = "15000.0"
    
    print(f"Precio original: '{venta}'")
    print(f"Tipo: {type(venta)}")
    
    try:
        precio_venta = float(venta)
        print(f"Precio convertido: {precio_venta}")
        print(f"Tipo convertido: {type(precio_venta)}")
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

if __name__ == "__main__":
    print("=== PRUEBA DE CONVERSION DE PRECIO 15000.0 ===")
    result = test_price_conversion()
    print(f"Resultado: {'EXITOSO' if result else 'FALLIDO'}")






