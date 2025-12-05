#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Datos manuales de AGIP CABA para cuando el scraping dinámico no funciona
Estos datos se actualizan manualmente basándose en https://www.agip.gob.ar/vencimientos
"""

import pandas as pd

def obtener_agip_regimenes_informacion():
    """
    Regímenes de Información y Recaudación - AGIP CABA
    Período 11 - Retenciones y Percepciones - Presentación DDJJ y Pago
    """
    data = {
        'Periodo': ['Período 11 - Agentes de Recaudación Ingresos Brutos: Retenciones y Percepciones - Presentación DDJJ y Pago'],
        'Terminación 0 y 1': ['07/12/2025'],
        'Terminación 2 y 3': ['08/12/2025'],
        'Terminación 4 y 5': ['09/12/2025'],
        'Terminación 6 y 7': ['10/12/2025'],
        'Terminación 8 y 9': ['11/12/2025']
    }
    
    df = pd.DataFrame(data)
    return df

def obtener_agip_contribuyentes_locales():
    """
    Contribuyentes Locales AGIP CABA - Anticipos por terminación de CUIT
    """
    data = {
        'Anticipo': ['Anticipo N° 11'],
        'Terminación 0 y 1': ['11/12/2025'],
        'Terminación 2 y 3': ['12/12/2025'],
        'Terminación 4 y 5': ['15/12/2025'],
        'Terminación 6 y 7': ['16/12/2025'],
        'Terminación 8 y 9': ['17/12/2025']
    }
    
    df = pd.DataFrame(data)
    return df

def obtener_tablas_agip():
    """
    Retorna todas las tablas de AGIP CABA
    """
    tablas = []
    
    # Regímenes de Información y Recaudación
    df1 = obtener_agip_regimenes_informacion()
    df1.attrs['nombre'] = 'Regimenes_Informacion_Recaudacion_CABA'
    tablas.append(df1)
    
    # Contribuyentes Locales
    df2 = obtener_agip_contribuyentes_locales()
    df2.attrs['nombre'] = 'Contribuyentes_Locales_CABA'
    tablas.append(df2)
    
    return tablas

if __name__ == "__main__":
    print("Tablas de AGIP CABA:")
    tablas = obtener_tablas_agip()
    
    for df in tablas:
        nombre = df.attrs.get('nombre', 'Sin nombre')
        print(f"\n{'='*60}")
        print(f"Tabla: {nombre}")
        print(f"Shape: {df.shape}")
        print(df)

