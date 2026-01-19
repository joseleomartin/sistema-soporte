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

          // Verificar columnas requeridas
          const requiredColumns = ['Familia', 'Medida', 'Característica', 'Precio_Venta', 'Moneda_Precio', 
                                   'Cantidad_Fabricar', 'Cantidad_Hora', 'IIBB_Porcentaje', 'Precio_Dolar'];
          // Código_Producto es opcional
          
          const firstRow = jsonData[0];
          const missingColumns = requiredColumns.filter(col => !(col in firstRow));
          
          if (missingColumns.length > 0) {
            reject(new Error(`Faltan las siguientes columnas: ${missingColumns.join(', ')}`));
            return;
          }

          const rows: CostImportRow[] = [];

          for (const row of jsonData) {
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

            // Parsear valores
            const codigo_producto = String(row['Código_Producto'] || row['Codigo_Producto'] || row['Código'] || row['Codigo'] || '').trim() || undefined;
            const familia = String(row['Familia'] || '').trim();
            const medida = String(row['Medida'] || '').trim();
            const caracteristica = String(row['Característica'] || '').trim();
            
            if (!familia || !medida || !caracteristica) {
              continue; // Saltar filas incompletas
            }

            // Parsear precio de venta (puede venir con formato complejo)
            let precio_venta = 0;
            let moneda_precio: 'ARS' | 'USD' = 'ARS';
            const precioVentaRaw = String(row['Precio_Venta'] || '').trim();
            if (precioVentaRaw) {
              // Intentar extraer número y moneda
              const precioMatch = precioVentaRaw.match(/([\d.,]+)/);
              if (precioMatch) {
                precio_venta = parseFloat(precioMatch[1].replace(',', '.'));
              }
              if (precioVentaRaw.toUpperCase().includes('USD') || precioVentaRaw.includes('$')) {
                moneda_precio = 'USD';
              }
            }

            // Usar moneda explícita si está en la columna
            const monedaPrecioRaw = String(row['Moneda_Precio'] || '').trim().toUpperCase();
            if (monedaPrecioRaw === 'USD' || monedaPrecioRaw === 'ARS') {
              moneda_precio = monedaPrecioRaw as 'ARS' | 'USD';
            }

            const cantidad_fabricar = parseFloat(String(row['Cantidad_Fabricar'] || '0').replace(',', '.')) || 0;
            const cantidad_hora = parseFloat(String(row['Cantidad_Hora'] || '0').replace(',', '.')) || 0;
            const iibb_porcentaje = parseFloat(String(row['IIBB_Porcentaje'] || '0').replace(',', '.')) || 0;
            const precio_dolar = parseFloat(String(row['Precio_Dolar'] || '0').replace(',', '.')) || 0;

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
            
            // Debug: mostrar materiales detectados
            if (materiales.length > 0) {
              console.log(`Materiales detectados para ${familia} - ${medida} - ${caracteristica}:`, materiales);
            } else {
              console.warn(`No se detectaron materiales para ${familia} - ${medida} - ${caracteristica}. Columnas disponibles:`, Object.keys(row));
            }

            rows.push({
              codigo_producto,
              familia,
              medida,
              caracteristica,
              precio_venta,
              moneda_precio,
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

      for (const row of rows) {
        try {
          // Crear o buscar producto (para simulación de costos)
          const productName = `${row.familia} - ${row.medida} - ${row.caracteristica}`;
          
          // Buscar producto existente por código o nombre
          let existingProduct = null;
          if (row.codigo_producto) {
            const { data } = await supabase
              .from('products')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('codigo_producto', row.codigo_producto)
              .maybeSingle();
            existingProduct = data;
          }
          
          // Si no se encontró por código, buscar por nombre
          if (!existingProduct) {
            const { data } = await supabase
              .from('products')
              .select('id')
              .eq('tenant_id', tenantId)
              .ilike('nombre', productName)
              .maybeSingle();
            existingProduct = data;
          }

          let productId: string;

          if (existingProduct) {
            productId = existingProduct.id;
            // Calcular peso unidad (suma de materiales)
            const peso_unidad = row.materiales.reduce((sum, m) => sum + m.kg_por_unidad, 0);
            
            // Actualizar producto existente con todos los datos de la simulación
            await supabase
              .from('products')
              .update({
                codigo_producto: row.codigo_producto || null,
                nombre: productName,
                familia: row.familia,
                medida: row.medida,
                caracteristica: row.caracteristica,
                peso_unidad: peso_unidad,
                precio_venta: row.precio_venta || null,
                cantidad_fabricar: row.cantidad_fabricar,
                cantidad_por_hora: row.cantidad_hora,
                iibb_porcentaje: row.iibb_porcentaje,
                moneda_precio: row.moneda_precio,
                otros_costos: 0, // Se puede agregar al Excel si es necesario
              })
              .eq('id', productId);
          } else {
            // Calcular peso unidad (suma de materiales)
            const peso_unidad = row.materiales.reduce((sum, m) => sum + m.kg_por_unidad, 0);

            // Crear nuevo producto para simulación
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
                cantidad_fabricar: row.cantidad_fabricar,
                cantidad_por_hora: row.cantidad_hora,
                iibb_porcentaje: row.iibb_porcentaje,
                moneda_precio: row.moneda_precio,
                estado: 'pendiente', // Todos los productos nuevos se crean como pendientes
              })
              .select('id')
              .single();

            if (productError) throw productError;
            productId = newProduct.id;
          }

          // Eliminar materiales existentes del producto
          await supabase
            .from('product_materials')
            .delete()
            .eq('product_id', productId);

          // Agregar materiales
          if (row.materiales && row.materiales.length > 0) {
            console.log(`Agregando ${row.materiales.length} materiales para producto ${productName}:`, row.materiales);
            for (const material of row.materiales) {
              const { error: materialError } = await supabase
                .from('product_materials')
                .insert({
                  product_id: productId,
                  material_name: material.nombre,
                  kg_por_unidad: material.kg_por_unidad,
                });
              
              if (materialError) {
                console.error(`Error al agregar material ${material.nombre}:`, materialError);
                throw materialError;
              }
            }
          } else {
            console.warn(`No se encontraron materiales para el producto ${productName}`);
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

          // Verificar si ya existe un item de simulación para este producto
          const { data: existingSimulationItem } = await supabase
            .from('cost_simulation_items')
            .select('id')
            .eq('simulation_id', simulationId)
            .eq('product_id', productId)
            .maybeSingle();

          if (existingSimulationItem) {
            // Actualizar item de simulación existente
            await supabase
              .from('cost_simulation_items')
              .update({
                precio_venta: row.precio_venta,
                descuento_pct: 0,
                cantidad_fabricar: row.cantidad_fabricar,
              })
              .eq('id', existingSimulationItem.id);
          } else {
            // Agregar nuevo item a la simulación
            await supabase
              .from('cost_simulation_items')
              .insert({
                simulation_id: simulationId,
                product_id: productId,
                precio_venta: row.precio_venta,
                descuento_pct: 0,
                cantidad_fabricar: row.cantidad_fabricar,
              });
          }

          imported++;
        } catch (error: any) {
          errors++;
          errorDetails.push(`${row.familia} - ${row.medida} - ${row.caracteristica}: ${error.message}`);
        }
      }

      setImportResults({ imported, errors, errorDetails });
      setResultMessage(
        `Importación completada: ${imported} items importados${errors > 0 ? `, ${errors} errores` : ''}`
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

