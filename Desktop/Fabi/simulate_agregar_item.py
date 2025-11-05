#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para simular completamente la función agregar_item_costos
"""

import sys
import os

# Agregar el directorio actual al path para importar el módulo
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def simulate_agregar_item_costos():
    """Simular la función agregar_item_costos con datos de la imagen"""
    print("=== SIMULACION COMPLETA DE agregar_item_costos ===")
    
    # Datos de la imagen
    familia = "Producto z"
    medida = "100x50"
    caracteristica = "Estándar"
    venta = "15000.0"
    venta_moneda = "ARS"
    iibb_porcentaje = "0"
    cant_fab = "100"
    cant_hora = "10.0"
    
    # Materiales simulados
    materiales_costos_form = [
        {
            "nombre": "Acero",
            "kg_por_unidad": "2.500",
            "costo_por_kg": "800.00",
            "moneda": "ARS"
        }
    ]
    
    print(f"1. Datos obtenidos:")
    print(f"   Familia: '{familia}'")
    print(f"   Medida: '{medida}'")
    print(f"   Caracteristica: '{caracteristica}'")
    print(f"   Precio: '{venta}', Moneda: '{venta_moneda}'")
    print(f"   IIBB: '{iibb_porcentaje}'")
    print(f"   Cantidades - Fab: '{cant_fab}', Hora: '{cant_hora}'")
    
    # Calcular peso total de materiales
    try:
        peso_total = sum(float(m.get('kg_por_unidad', 0)) for m in materiales_costos_form)
        print(f"2. Peso total calculado: {peso_total}")
        print(f"   Materiales en formulario: {len(materiales_costos_form)}")
    except Exception as e:
        print(f"ERROR en cálculo de peso: {e}")
        return False
    
    # Validar familia
    if not familia:
        print("ERROR: Complete al menos la Familia.")
        return False
    print("3. Familia válida")
    
    # Usar valores por defecto para campos opcionales
    if not medida:
        medida = 'Sin Medida'
    if not caracteristica:
        caracteristica = 'Sin Característica'
    if not cant_fab:
        cant_fab = '0'
    if not cant_hora:
        cant_hora = '0'
    
    # Procesar precio de venta
    precio_venta_final = 0
    print(f"4. Procesando precio de venta: '{venta}'")
    if venta:
        try:
            precio_venta = float(venta)
            print(f"   Precio convertido a float: {precio_venta}")
            if precio_venta <= 0:
                print("ERROR: El precio de venta debe ser mayor a 0.")
                return False
            
            # Si es USD, convertir a pesos usando el precio del dólar del formulario
            if venta_moneda == 'USD':
                valor_dolar_form = 123  # Simulado del formulario
                if valor_dolar_form > 0:
                    precio_venta_final = precio_venta * valor_dolar_form
                    print(f"   Precio en USD convertido: ${precio_venta} USD × {valor_dolar_form} = ${precio_venta_final} ARS")
                else:
                    precio_venta_final = precio_venta
                    print(f"   WARNING: Precio en USD pero no hay precio del dólar disponible: ${precio_venta} USD")
            else:
                precio_venta_final = precio_venta
                print(f"   Precio en ARS: ${precio_venta_final}")
                
        except ValueError:
            print("ERROR: El precio de venta debe ser un número válido.")
            return False
    else:
        print("   WARNING: No hay precio de venta, usando 0 como valor por defecto")
    
    # Crear el nombre combinado para el producto
    nombre = f"{familia} - {medida} - {caracteristica}"
    print(f"5. Nombre del producto: '{nombre}'")
    
    # Validar materiales
    if not materiales_costos_form:
        print("ERROR: Agregue al menos un material.")
        return False
    print("6. Materiales válidos")
    
    # Simular empleados
    empleados = []  # Lista vacía para simplificar
    valor_hora_ajustado_promedio = 0
    if empleados:
        valor_hora_ajustado_promedio = sum(e.valor_hora_efectivo for e in empleados) / len(empleados)
    print(f"7. Valor hora promedio: {valor_hora_ajustado_promedio}")
    
    # Simular creación del producto
    try:
        print("8. Iniciando creación del producto")
        valor_dolar_costos = 123  # Simulado del formulario
        print(f"   Valor del dólar obtenido: {valor_dolar_costos}")
        
        # Simular mapa de precios de materiales
        precios_materiales = {
            "Acero": {
                "costo_kilo_usd": 0.0,  # No hay costo en USD
                "valor_dolar": 0.0
            }
        }
        
        print("9. Producto creado exitosamente")
        
        # Simular agregar a la lista
        print("10. Modo agregar - agregando nuevo item")
        items_costos = []  # Lista simulada
        items_costos.append("PRODUCTO_SIMULADO")
        
        print(f"11. Total de items en planilla: {len(items_costos)}")
        print("12. Mostrando mensaje de éxito")
        
        return True
        
    except Exception as e:
        print(f"ERROR en creación del producto: {e}")
        return False

if __name__ == "__main__":
    print("SIMULACION: Boton 'Actualizar Planilla' con datos de la imagen")
    print("=" * 70)
    
    result = simulate_agregar_item_costos()
    
    print("\n" + "=" * 70)
    print(f"RESULTADO: {'EXITOSO' if result else 'FALLIDO'}")
    
    if result:
        print("La simulacion paso todas las validaciones.")
        print("El problema puede estar en:")
        print("1. La interfaz grafica (tkinter)")
        print("2. Alguna variable no inicializada")
        print("3. Alguna excepcion no capturada")
    else:
        print("La simulacion fallo en alguna validacion.")






