import { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { read, utils, writeFile, WorkBook } from 'xlsx';

interface BulkImportCostsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface CostImportRow {
  codigo_producto?: string;
  familia: string;
  medida: string;
  caracteristica: string;
  precio_venta: number;
  moneda_precio: 'ARS' | 'USD';
  cantidad_fabricar: number;
  cantidad_hora: number;
  iibb_porcentaje: number;
  precio_dolar: number;
  materiales: Array<{
    nombre: string;
    kg_por_unidad: number;
    precio: number;
    moneda: 'ARS' | 'USD';
  }>;
}

export function BulkImportCostsModal({ onClose, onSuccess }: BulkImportCostsModalProps) {
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<{
    imported: number;
    errors: number;
    errorDetails: string[];
  } | null>(null);

  const parseExcel = (file: File): Promise<CostImportRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = utils.sheet_to_json(firstSheet, { defval: '' }) as any[];

          if (jsonData.length === 0) {
            reject(new Error('El archivo está vacío'));
            return;
          }

          // Verificar columnas requeridas (con variaciones posibles)
          const requiredColumnsMap: Record<string, string[]> = {
            'Familia': ['Familia', 'familia', 'FAMILIA'],
            'Medida': ['Medida', 'medida', 'MEDIDA'],
            'Característica': ['Característica', 'Caracteristica', 'característica', 'caracteristica', 'CARACTERÍSTICA', 'CARACTERISTICA'],
            'Precio_Venta': ['Precio_Venta', 'Precio Venta', 'precio_venta', 'PRECIO_VENTA'],
            'Moneda_Precio': ['Moneda_Precio', 'Moneda Precio', 'moneda_precio', 'MONEDA_PRECIO'],
            'Cantidad_Fabricar': ['Cantidad_Fabricar', 'Cantidad Fabricar', 'cantidad_fabricar', 'CANTIDAD_FABRICAR'],
            'Cantidad_Hora': ['Cantidad_Hora', 'Cantidad Hora', 'cantidad_hora', 'CANTIDAD_HORA'],
            'IIBB_Porcentaje': ['IIBB_Porcentaje', 'IIBB Porcentaje', 'iibb_porcentaje', 'IIBB_PORCENTAJE'],
            'Precio_Dolar': ['Precio_Dolar', 'Precio Dolar', 'precio_dolar', 'PRECIO_DOLAR', 'Precio_Dólar', 'Precio Dólar']
          };
          
          const firstRow = jsonData[0];
          const availableColumns = Object.keys(firstRow);
          const missingColumns: string[] = [];
          
          // Verificar cada columna requerida
          for (const [requiredCol, variations] of Object.entries(requiredColumnsMap)) {
            const found = variations.some(variation => availableColumns.includes(variation));
            if (!found) {
              missingColumns.push(requiredCol);
            }
          }
          
          if (missingColumns.length > 0) {
            reject(new Error(`Faltan las siguientes columnas: ${missingColumns.join(', ')}. Columnas disponibles: ${availableColumns.slice(0, 10).join(', ')}...`));
            return;
          }

          const rows: CostImportRow[] = [];
          let skippedRows = 0;
          const skippedRowDetails: string[] = [];

          for (let index = 0; index < jsonData.length; index++) {
            const row = jsonData[index];
            const rowNumber = index + 2; // +2 porque index es 0-based y la fila 1 es el header
            
            // Detectar materiales (columnas que empiezan con "Material_" o tienen patrón similar)
            const materialColumns: Array<{ nombre: string; cantidad: string; precio: string; moneda: string }> = [];
            const materialesData: Record<string, { nombre?: string; cantidad?: string; precio?: string; moneda?: string }> = {};
            
            // Método 1: Buscar columnas con formato Material_N_Nombre, Material_N_Cantidad, etc.
            Object.keys(row).forEach(key => {
              const keyLower = key.toLowerCase();
              if (keyLower.includes('material')) {
                // Patrón: Material_1_Nombre, Material_1_Cantidad, Material_1_Precio, Material_1_Moneda
                const match1 = key.match(/Material[_\s]*(\d+)[_\s]*[_-]?[_\s]*(Nombre|Cantidad|Precio|Moneda|Kg|KG)/i);
                if (match1) {
                  const num = match1[1];
                  const tipo = match1[2]?.toLowerCase() || '';
                  
                  if (!materialesData[num]) {
                    materialesData[num] = {};
                  }
                  
                  const valor = String(row[key] || '').trim();
                  if (valor && valor !== '') {
                    if (tipo.includes('nombre')) {
                      materialesData[num].nombre = valor;
                    } else if (tipo.includes('cantidad') || tipo.includes('kg')) {
                      materialesData[num].cantidad = valor;
                    } else if (tipo.includes('precio')) {
                      materialesData[num].precio = valor;
                    } else if (tipo.includes('moneda')) {
                      materialesData[num].moneda = valor.toUpperCase();
                    }
                  }
                } else {
                  // Patrón alternativo: Material_1, Material_2 (solo nombre)
                  const match2 = key.match(/Material[_\s]*(\d+)$/i);
                  if (match2) {
                    const num = match2[1];
                    if (!materialesData[num]) {
                      materialesData[num] = {};
                    }
                    const valor = String(row[key] || '').trim();
                    if (valor && valor !== '') {
                      materialesData[num].nombre = valor;
                    }
                  }
                }
              }
            });

            // Convertir materialesData a materialColumns
            Object.keys(materialesData).sort((a, b) => parseInt(a) - parseInt(b)).forEach(num => {
              const mat = materialesData[num];
              if (mat.nombre && mat.nombre.trim()) {
                materialColumns.push({
                  nombre: mat.nombre || `Material ${num}`,
                  cantidad: mat.cantidad || '1',
                  precio: mat.precio || '0',
                  moneda: mat.moneda || 'ARS'
                });
              }
            });

            // Método 2: Si no se detectaron materiales, buscar columnas simples que contengan "Material"
            if (materialColumns.length === 0) {
              const materialKeys = Object.keys(row).filter(k => {
                const kLower = k.toLowerCase();
                return kLower.includes('material') && 
                       !kLower.includes('nombre') && 
                       !kLower.includes('cantidad') && 
                       !kLower.includes('precio') && 
                       !kLower.includes('moneda') &&
                       !kLower.includes('kg');
              });
              
              materialKeys.forEach((key, idx) => {
                const valor = String(row[key] || '').trim();
                if (valor && valor !== '') {
                  materialColumns.push({
                    nombre: valor,
                    cantidad: '1', // Default
                    precio: '0',
                    moneda: 'ARS'
                  });
                }
              });
            }

            // Parsear valores (buscando variaciones de nombres de columnas)
            const codigo_producto = String(
              row['Código_Producto'] || row['Codigo_Producto'] || row['Código'] || row['Codigo'] || 
              row['codigo_producto'] || row['codigo'] || ''
            ).trim() || undefined;
            
            const familia = String(
              row['Familia'] || row['familia'] || row['FAMILIA'] || ''
            ).trim();
            
            const medida = String(
              row['Medida'] || row['medida'] || row['MEDIDA'] || ''
            ).trim();
            
            const caracteristica = String(
              row['Característica'] || row['Caracteristica'] || row['característica'] || 
              row['caracteristica'] || row['CARACTERÍSTICA'] || row['CARACTERISTICA'] || ''
            ).trim();
            
            // Validación más flexible: permitir filas con al menos familia
            // Si falta familia, es una fila inválida
            if (!familia || familia.trim() === '') {
              skippedRows++;
              skippedRowDetails.push(`Fila ${rowNumber}: Falta Familia (Familia: "${familia}", Medida: "${medida}", Característica: "${caracteristica}")`);
              continue; // Saltar filas sin familia
            }
            
            // Si falta medida o característica, usar valores por defecto en lugar de saltar
            const medidaFinal = medida || 'Sin medida';
            const caracteristicaFinal = caracteristica || 'Sin característica';

            // Parsear precio de venta (puede venir con formato complejo)
            // Formatos soportados:
            // - "u$s 7.20" o "u$s 7,20" -> USD
            // - "7.20 USD" o "7,20 USD" -> USD
            // - "101,32" o "101.32" -> ARS (por defecto)
            // - "1345,33 ARS" -> ARS explícito
            let precio_venta = 0;
            let moneda_precio: 'ARS' | 'USD' = 'ARS';
            const precioVentaRaw = String(
              row['Precio_Venta'] || row['Precio Venta'] || row['precio_venta'] || row['PRECIO_VENTA'] || ''
            ).trim();
            
            if (precioVentaRaw) {
              const precioVentaUpper = precioVentaRaw.toUpperCase();
              
              // Caso 1: Formato "u$s 7.20" o "u$s 7,20" (USD con prefijo u$s)
              if (precioVentaUpper.includes('U$S') || precioVentaUpper.includes('U$')) {
                const match = precioVentaRaw.match(/u\$s?\s*([\d.,]+)/i);
                if (match) {
                  precio_venta = parseFloat(match[1].replace(',', '.'));
                  moneda_precio = 'USD';
                }
              }
              // Caso 2: Formato "7.20 USD" o "7,20 USD" (USD explícito al final)
              else if (precioVentaUpper.endsWith(' USD')) {
                const precioStr = precioVentaRaw.slice(0, -4).trim().replace(',', '.');
                precio_venta = parseFloat(precioStr) || 0;
                moneda_precio = 'USD';
              }
              // Caso 3: Formato "1345,33 ARS" (ARS explícito al final)
              else if (precioVentaUpper.endsWith(' ARS')) {
                const precioStr = precioVentaRaw.slice(0, -4).trim().replace(',', '.');
                precio_venta = parseFloat(precioStr) || 0;
                moneda_precio = 'ARS';
              }
              // Caso 4: Solo número - detectar por formato
              else {
                // Si tiene punto como separador de miles y coma como decimal -> ARS (ej: "1.075,60")
                // Si tiene solo punto como decimal -> puede ser USD o ARS, verificar contexto
                // Si tiene coma como decimal -> ARS (ej: "101,32")
                
                // Limpiar el string para extraer solo números
                let precioStr = precioVentaRaw.replace(/[^\d.,-]/g, '').trim();
                
                // Detectar formato: si tiene punto y coma, el punto es miles y la coma es decimal (ARS)
                if (precioStr.includes('.') && precioStr.includes(',')) {
                  // Formato: "1.075,60" -> ARS
                  precio_venta = parseFloat(precioStr.replace(/\./g, '').replace(',', '.'));
                  moneda_precio = 'ARS';
                }
                // Si solo tiene coma, es decimal (ARS)
                else if (precioStr.includes(',') && !precioStr.includes('.')) {
                  precio_venta = parseFloat(precioStr.replace(',', '.'));
                  moneda_precio = 'ARS';
                }
                // Si solo tiene punto, puede ser decimal (USD o ARS)
                else if (precioStr.includes('.') && !precioStr.includes(',')) {
                  // Si el punto está en una posición que sugiere decimal (últimos 3 caracteres), es USD
                  // Ej: "7.20" -> USD, "30.66" -> USD
                  const parts = precioStr.split('.');
                  if (parts.length === 2 && parts[1].length <= 2) {
                    // Probablemente decimal (USD)
                    precio_venta = parseFloat(precioStr);
                    moneda_precio = 'USD';
                  } else {
                    // Probablemente miles (ARS)
                    precio_venta = parseFloat(precioStr.replace(/\./g, ''));
                    moneda_precio = 'ARS';
                  }
                }
                // Si no tiene separadores, es un número entero (ARS por defecto)
                else {
                  precio_venta = parseFloat(precioStr) || 0;
                  moneda_precio = 'ARS';
                }
              }
            }

            // Usar moneda explícita si está en la columna (tiene prioridad sobre la detección automática)
            const monedaPrecioRaw = String(
              row['Moneda_Precio'] || row['Moneda Precio'] || row['moneda_precio'] || row['MONEDA_PRECIO'] || ''
            ).trim().toUpperCase();
            if (monedaPrecioRaw === 'USD' || monedaPrecioRaw === 'ARS') {
              moneda_precio = monedaPrecioRaw as 'ARS' | 'USD';
              console.log(`  → Moneda explícita detectada en columna: ${moneda_precio}`);
            }

            const cantidad_fabricar = parseFloat(
              String(row['Cantidad_Fabricar'] || row['Cantidad Fabricar'] || row['cantidad_fabricar'] || row['CANTIDAD_FABRICAR'] || '0')
                .replace(',', '.')
            ) || 0;
            
            const cantidad_hora = parseFloat(
              String(row['Cantidad_Hora'] || row['Cantidad Hora'] || row['cantidad_hora'] || row['CANTIDAD_HORA'] || '0')
                .replace(',', '.')
            ) || 0;
            
            const iibb_porcentaje = parseFloat(
              String(row['IIBB_Porcentaje'] || row['IIBB Porcentaje'] || row['iibb_porcentaje'] || row['IIBB_PORCENTAJE'] || '0')
                .replace(',', '.')
            ) || 0;
            
            const precio_dolar = parseFloat(
              String(row['Precio_Dolar'] || row['Precio Dolar'] || row['Precio_Dólar'] || row['Precio Dólar'] || row['precio_dolar'] || row['PRECIO_DOLAR'] || '0')
                .replace(',', '.')
            ) || 0;

            // Convertir precio de venta de USD a ARS si es necesario
            // Siempre guardamos el precio_venta en ARS
            let precio_venta_final = precio_venta;
            let moneda_precio_final: 'ARS' | 'USD' = moneda_precio;
            
            if (moneda_precio === 'USD' && precio_venta > 0) {
              if (precio_dolar > 0) {
                // Convertir USD a ARS usando el precio del dólar
                precio_venta_final = precio_venta * precio_dolar;
              } else {
                // Usar precio del dólar por defecto si no está disponible
                const precio_dolar_default = 1515;
                precio_venta_final = precio_venta * precio_dolar_default;
              }
              // Siempre guardamos en ARS después de la conversión
              moneda_precio_final = 'ARS';
            } else if (moneda_precio === 'ARS') {
              precio_venta_final = precio_venta;
            }

            // Procesar materiales
            const materiales = materialColumns
              .filter(m => m.nombre && m.nombre.trim() && m.nombre.trim() !== '')
              .map(m => {
                const nombre = m.nombre.trim();
                // Parsear cantidad (kg por unidad)
                const cantidadStr = String(m.cantidad || '1').trim();
                const cantidadClean = cantidadStr.replace(/[^\d.,-]/g, '').replace(',', '.');
                const kg_por_unidad = parseFloat(cantidadClean) || 1;
                
                // Parsear precio (aunque no se use directamente, se obtiene del stock)
                const precioStr = String(m.precio || '0').trim();
                const precioClean = precioStr.replace(/[^\d.,-]/g, '').replace(',', '.');
                const precio = parseFloat(precioClean) || 0;
                
                const moneda = (m.moneda?.toUpperCase() === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD';
                
                return { nombre, kg_por_unidad, precio, moneda };
              });
              // NO filtrar por precio > 0, ya que los materiales pueden no tener precio en el Excel
              // El precio se obtendrá del stock_materials cuando se calcule el costo
            

            rows.push({
              codigo_producto,
              familia,
              medida: medidaFinal,
              caracteristica: caracteristicaFinal,
              precio_venta: precio_venta_final, // Usar precio convertido a ARS
              moneda_precio: moneda_precio_final, // Siempre 'ARS' después de conversión
              cantidad_fabricar,
              cantidad_hora,
              iibb_porcentaje,
              precio_dolar,
              materiales,
            });
          }

          
          resolve(rows);
        } catch (error: any) {
          reject(new Error(`Error al leer el archivo: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Error al leer el archivo'));
      };

      if (file.name.endsWith('.csv')) {
        // Para CSV, leer como texto y parsear
        const textReader = new FileReader();
        textReader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) {
              reject(new Error('El archivo CSV está vacío o no tiene datos'));
              return;
            }

            // Parsear CSV (asumiendo separador ; o ,)
            const separator = lines[0].includes(';') ? ';' : ',';
            const headers = lines[0].split(separator).map(h => h.trim());
            
            // Similar al procesamiento de Excel pero para CSV
            // Por simplicidad, rechazamos CSV por ahora y pedimos Excel
            reject(new Error('Por favor, use un archivo Excel (.xlsx) en lugar de CSV'));
          } catch (error: any) {
            reject(new Error(`Error al leer el CSV: ${error.message}`));
          }
        };
        textReader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResultMessage(null);
    setErrorMessage(null);
    setImportResults(null);

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setErrorMessage('Por favor, seleccione un archivo Excel (.xlsx o .xls)');
      return;
    }

    setLoading(true);
    try {
      const rows = await parseExcel(file);

      if (rows.length === 0) {
        setErrorMessage('El archivo no contiene filas válidas. Verifica el formato.');
        setLoading(false);
        return;
      }

      // Procesar importación
      let imported = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const rowNumber = index + 1;
        let productId: string | null = null;
        let productCreated = false;
        
        try {
          // Crear o buscar producto (para simulación de costos)
          const productName = `${row.familia} - ${row.medida} - ${row.caracteristica}`;
          
          // Buscar producto existente por código (más preciso)
          let existingProduct = null;
          if (row.codigo_producto) {
            const { data, error } = await supabase
              .from('products')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('codigo_producto', row.codigo_producto)
              .maybeSingle();
            if (!error && data) {
              existingProduct = data;
            }
          }
          
          // Si no se encontró por código, buscar por nombre exacto (más estricto)
          if (!existingProduct) {
            const { data, error } = await supabase
              .from('products')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('nombre', productName) // Usar eq en lugar de ilike para coincidencia exacta
              .maybeSingle();
            if (!error && data) {
              existingProduct = data;
            }
          }

          if (existingProduct) {
            productId = existingProduct.id;
            productCreated = false;
            
            // Calcular peso unidad (suma de materiales)
            const peso_unidad = row.materiales.reduce((sum, m) => sum + m.kg_por_unidad, 0);
            
            // Actualizar producto existente con todos los datos de la simulación
            // IMPORTANTE: No actualizar cantidad_fabricar ni estado - estos son solo para simulación de costos
            // No debe afectar producción en lo más mínimo
            const { error: updateError } = await supabase
              .from('products')
              .update({
                codigo_producto: row.codigo_producto || null,
                nombre: productName,
                familia: row.familia,
                medida: row.medida,
                caracteristica: row.caracteristica,
                peso_unidad: peso_unidad,
                precio_venta: row.precio_venta || null,
                // NO actualizar cantidad_fabricar - solo para simulación de costos
                cantidad_por_hora: row.cantidad_hora,
                iibb_porcentaje: row.iibb_porcentaje,
                moneda_precio: row.moneda_precio,
                otros_costos: 0, // Se puede agregar al Excel si es necesario
                // NO actualizar estado - no debe afectar producción
              })
              .eq('id', productId);
            
            if (updateError) {
              throw new Error(`Error actualizando producto: ${updateError.message}`);
            }
          } else {
            productCreated = true;
            
            // Calcular peso unidad (suma de materiales)
            const peso_unidad = row.materiales.reduce((sum, m) => sum + m.kg_por_unidad, 0);

            // Crear nuevo producto para simulación
            // IMPORTANTE: cantidad_fabricar = 0 y NO establecer estado
            // Esto asegura que NO aparezca en producción (el filtro requiere cantidad_fabricar > 0)
            // La importación masiva es completamente independiente de producción
            const { data: newProduct, error: productError } = await supabase
              .from('products')
              .insert({
                tenant_id: tenantId,
                nombre: productName,
                codigo_producto: row.codigo_producto || null,
                familia: row.familia,
                medida: row.medida,
                caracteristica: row.caracteristica,
                peso_unidad,
                precio_venta: row.precio_venta || null,
                cantidad_fabricar: 0, // IMPORTANTE: 0 para que NO aparezca en producción
                cantidad_por_hora: row.cantidad_hora,
                iibb_porcentaje: row.iibb_porcentaje,
                moneda_precio: row.moneda_precio,
                // NO establecer estado - dejar que use el default o null
                // La importación masiva es completamente independiente de producción
              })
              .select('id')
              .single();

            if (productError) {
              throw new Error(`Error creando producto: ${productError.message}`);
            }
            productId = newProduct.id;
          }

          // Eliminar materiales existentes del producto (solo si el producto ya existía)
          if (!productCreated) {
            await supabase
              .from('product_materials')
              .delete()
              .eq('product_id', productId);
          }

          // Agregar materiales
          if (row.materiales && row.materiales.length > 0) {
            for (const material of row.materiales) {
              const { error: materialError } = await supabase
                .from('product_materials')
                .insert({
                  product_id: productId,
                  material_name: material.nombre,
                  kg_por_unidad: material.kg_por_unidad,
                });
              
              if (materialError) {
                // Continuar con los demás materiales aunque uno falle
              }
            }
          }

          // Agregar a simulación de costos
          // Primero obtener o crear simulación
          const { data: simulation } = await supabase
            .from('cost_simulations')
            .select('id')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          let simulationId: string;
          if (simulation) {
            simulationId = simulation.id;
          } else {
            const { data: newSim, error: simError } = await supabase
              .from('cost_simulations')
              .insert({
                tenant_id: tenantId,
                nombre: 'Simulación de Costos',
              })
              .select('id')
              .single();

            if (simError) throw simError;
            simulationId = newSim.id;
          }

          // Verificar y limpiar duplicados antes de agregar/actualizar
          const { data: allSimulationItems, error: checkError } = await supabase
            .from('cost_simulation_items')
            .select('id')
            .eq('simulation_id', simulationId)
            .eq('product_id', productId);

          if (checkError) {
            throw new Error(`Error verificando items de simulación: ${checkError.message}`);
          }

          if (allSimulationItems && allSimulationItems.length > 0) {
            // Si hay múltiples items duplicados, eliminar los extras y mantener solo el más reciente
            if (allSimulationItems.length > 1) {
              const itemsToDelete = allSimulationItems.slice(1).map(item => item.id);
              await supabase
                .from('cost_simulation_items')
                .delete()
                .in('id', itemsToDelete);
            }
            
            // Actualizar el item existente (el que quedó)
            const existingItemId = allSimulationItems[0].id;
            const { error: updateError } = await supabase
              .from('cost_simulation_items')
              .update({
                precio_venta: row.precio_venta,
                descuento_pct: 0,
                cantidad_fabricar: row.cantidad_fabricar,
              })
              .eq('id', existingItemId);
            
            if (updateError) {
              throw new Error(`Error actualizando item de simulación: ${updateError.message}`);
            }
          } else {
            // No existe ningún item, crear uno nuevo
            const { data: newSimulationItem, error: insertError } = await supabase
              .from('cost_simulation_items')
              .insert({
                simulation_id: simulationId,
                product_id: productId,
                precio_venta: row.precio_venta,
                descuento_pct: 0,
                cantidad_fabricar: row.cantidad_fabricar,
              })
              .select('id')
              .single();
            
            if (insertError) {
              throw new Error(`Error insertando item de simulación: ${insertError.message}`);
            }
          }

          imported++;
        } catch (error: any) {
          errors++;
          const errorMsg = error.message || String(error);
          errorDetails.push(`${row.familia} - ${row.medida} - ${row.caracteristica}: ${errorMsg}`);
        }
      }


      setImportResults({ imported, errors, errorDetails });
      setResultMessage(
        `Importación completada: ${imported} productos procesados${errors > 0 ? `, ${errors} errores` : ''}`
      );

      if (imported > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Crear datos de ejemplo para la plantilla
    const templateData = [
      {
        'Código_Producto': 'PROD-001',
        'Familia': 'Ejemplo',
        'Medida': '100x50',
        'Característica': 'Estándar',
        'Precio_Venta': '1000',
        'Moneda_Precio': 'ARS',
        'Cantidad_Fabricar': '100',
        'Cantidad_Hora': '10',
        'IIBB_Porcentaje': '3',
        'Precio_Dolar': '1000',
        'Material_1_Nombre': 'Acero',
        'Material_1_Cantidad': '2.5',
        'Material_1_Precio': '500',
        'Material_1_Moneda': 'ARS',
        'Material_2_Nombre': 'Plástico',
        'Material_2_Cantidad': '1.0',
        'Material_2_Precio': '200',
        'Material_2_Moneda': 'ARS',
      }
    ];

    const ws = utils.json_to_sheet(templateData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Datos');
    writeFile(wb, 'plantilla_importacion_costos.xlsx');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Importar Costos Masivamente</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Instrucciones:</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>El archivo debe ser Excel (.xlsx o .xls)</li>
              <li>Debe contener las columnas: Familia, Medida, Característica, Precio_Venta, Moneda_Precio, Cantidad_Fabricar, Cantidad_Hora, IIBB_Porcentaje, Precio_Dolar</li>
              <li>Código_Producto es opcional pero recomendado para identificación única</li>
              <li>Los materiales deben estar en columnas como: Material_1_Nombre, Material_1_Cantidad, Material_1_Precio, Material_1_Moneda</li>
              <li>Puede descargar la plantilla de ejemplo haciendo clic en el botón de abajo</li>
            </ul>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <Download className="w-4 h-4" />
              Descargar Plantilla
            </button>
          </div>

          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
            <input
              type="file"
              id="file-upload"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={loading}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <FileSpreadsheet className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {fileName || 'Seleccionar archivo Excel'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Solo archivos .xlsx o .xls
              </span>
            </label>
          </div>

          {loading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Procesando archivo...</p>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Error</p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          {resultMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">Éxito</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">{resultMessage}</p>
                {importResults && importResults.errorDetails.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-green-800 dark:text-green-300">Detalles de errores:</p>
                    <ul className="text-xs text-green-700 dark:text-green-400 mt-1 space-y-1 max-h-32 overflow-y-auto">
                      {importResults.errorDetails.map((detail, idx) => (
                        <li key={idx}>• {detail}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              disabled={loading}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

