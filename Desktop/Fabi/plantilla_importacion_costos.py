import pandas as pd
import os

def crear_plantilla_importacion():
    """Crear plantilla de ejemplo para importación de datos de costos"""
    
    # Datos de ejemplo
    datos_ejemplo = {
        'Familia': ['Producto A', 'Producto B'],
        'Medida': ['100x50', '200x100'],
        'Característica': ['Estándar', 'Premium'],
        'Precio_Venta': [15000, 25000],
        'Moneda_Precio': ['ARS', 'USD'],
        'Cantidad_Fabricar': [100, 50],
        'Cantidad_Hora': [10, 8],
        'IIBB_Porcentaje': [3.5, 4.0],
        'Precio_Dolar': [1200, 1200],
        
        # Materiales para el primer producto
        'Material_1_Nombre': ['Acero', 'Pintura'],
        'Material_1_Cantidad': [2.5, 0.5],
        'Material_1_Precio': [800, 200],
        'Material_1_Moneda': ['ARS', 'ARS'],
        
        # Materiales para el segundo producto
        'Material_2_Nombre': ['Aluminio', 'Barniz'],
        'Material_2_Cantidad': [1.8, 0.3],
        'Material_2_Precio': [15, 25],
        'Material_2_Moneda': ['USD', 'USD'],
        
        # Materiales adicionales (opcional)
        'Material_3_Nombre': ['', ''],
        'Material_3_Cantidad': ['', ''],
        'Material_3_Precio': ['', ''],
        'Material_3_Moneda': ['', '']
    }
    
    # Crear DataFrame
    df = pd.DataFrame(datos_ejemplo)
    
    # Guardar como Excel
    archivo_plantilla = 'plantilla_importacion_costos.xlsx'
    df.to_excel(archivo_plantilla, index=False)
    
    print(f"Plantilla creada: {archivo_plantilla}")
    print("\nEstructura de columnas:")
    print("- Familia: Nombre de la familia del producto")
    print("- Medida: Medida del producto")
    print("- Característica: Característica del producto")
    print("- Precio_Venta: Precio de venta del producto")
    print("- Moneda_Precio: Moneda del precio (ARS o USD)")
    print("- Cantidad_Fabricar: Cantidad a fabricar")
    print("- Cantidad_Hora: Cantidad por hora")
    print("- IIBB_Porcentaje: Porcentaje de IIBB")
    print("- Precio_Dolar: Precio del dólar para conversiones")
    print("- Material_X_Nombre: Nombre del material X")
    print("- Material_X_Cantidad: Cantidad del material X en kg")
    print("- Material_X_Precio: Precio del material X")
    print("- Material_X_Moneda: Moneda del material X (ARS o USD)")
    
    return archivo_plantilla

if __name__ == "__main__":
    crear_plantilla_importacion()








