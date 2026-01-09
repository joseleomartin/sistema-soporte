import { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { read, utils, writeFile } from 'xlsx';

interface BulkImportStockModalProps {
  onClose: () => void;
  onSuccess: () => void;
  importType: 'materials' | 'products' | 'resale';
}

interface MaterialImportRow {
  nombre: string;
  material: string;
  kg?: number;
  stock_minimo: number;
  costo_kilo_usd?: number;
  moneda: 'ARS' | 'USD';
  valor_dolar?: number;
}

interface ProductImportRow {
  nombre: string;
  cantidad: number;
  peso_unidad: number;
  costo_unit_total?: number;
  stock_minimo: number;
}

interface ResaleImportRow {
  nombre: string;
  cantidad: number;
  costo_unitario: number;
  otros_costos?: number;
  moneda: 'ARS' | 'USD';
  valor_dolar?: number;
  stock_minimo: number;
}

export function BulkImportStockModal({ onClose, onSuccess, importType }: BulkImportStockModalProps) {
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

  const getRequiredColumns = () => {
    switch (importType) {
      case 'materials':
        return ['Nombre', 'Material'];
      case 'products':
        return ['Nombre', 'Cantidad', 'Peso_Unidad'];
      case 'resale':
        return ['Nombre', 'Cantidad', 'Costo_Unitario', 'Moneda'];
      default:
        return [];
    }
  };

  const parseExcel = async (file: File): Promise<any[]> => {
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

          const requiredColumns = getRequiredColumns();
          const firstRow = jsonData[0];
          const missingColumns = requiredColumns.filter(col => !(col in firstRow));
          
          if (missingColumns.length > 0) {
            reject(new Error(`Faltan las siguientes columnas: ${missingColumns.join(', ')}`));
            return;
          }

          const rows: any[] = [];

          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            try {
              if (importType === 'materials') {
                const nombre = String(row['Nombre'] || '').trim();
                const material = String(row['Material'] || nombre).trim(); // Si no hay Material, usar Nombre
                
                if (!nombre || nombre.toLowerCase() === 'nombre' || nombre === '') {
                  // Saltar fila de encabezado o filas vacías
                  if (i > 0) { // Solo loguear si no es la primera fila (puede ser el header)
                    console.warn(`Fila ${i + 1} sin nombre válido, saltando:`, row);
                  }
                  continue;
                }

                // Parsear cantidad (puede venir como "Cantidad", "KG", "Kg" o "Cantidad_KG")
                const cantidadRaw = row['Cantidad'] || row['KG'] || row['Kg'] || row['Cantidad_KG'] || row['Cantidad_Kg'] || row['Cantidad (KG)'] || '';
                const kg = cantidadRaw ? parseFloat(String(cantidadRaw).replace(/[,]/g, '.').replace(/[^\d.-]/g, '')) : undefined;
                
                const stock_minimoRaw = row['Stock_Minimo'] || row['Stock Minimo'] || row['Stock_Mínimo'] || '0';
                const stock_minimo = parseFloat(String(stock_minimoRaw).replace(/[,]/g, '.').replace(/[^\d.-]/g, '')) || 0;
                
                // Parsear costo - puede estar en ARS o USD según la columna Moneda
                const costoRaw = row['Costo_Kilo_USD'] || row['Costo Kilo USD'] || row['Costo_Kilo'] || '';
                // Limpiar el string antes de parsear (remover espacios, comas como separador decimal)
                const costoStr = String(costoRaw).trim().replace(/[,]/g, '.').replace(/[^\d.-]/g, '');
                const costo_original = costoStr && costoStr !== '' && costoStr !== '-' ? parseFloat(costoStr) : null;
                
                const monedaRaw = String(row['Moneda'] || 'ARS').trim().toUpperCase();
                const moneda = (monedaRaw === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD';
                
                // Parsear valor del dólar - si no está, usar valor por defecto según moneda
                const valorDolarRaw = row['Valor_Dolar'] || row['Valor Dolar'] || row['Valor_Dólar'] || '';
                const valorDolarStr = String(valorDolarRaw).trim().replace(/[,]/g, '.').replace(/[^\d.-]/g, '');
                // Si es USD, valor_dolar puede ser 1 o el valor indicado. Si es ARS y no está, usar 1515 por defecto
                let valor_dolar: number | undefined = undefined;
                if (moneda === 'USD') {
                  valor_dolar = valorDolarStr && valorDolarStr !== '' ? parseFloat(valorDolarStr) : 1;
                } else {
                  valor_dolar = valorDolarStr && valorDolarStr !== '' ? parseFloat(valorDolarStr) : 1515; // Valor por defecto para ARS
                }
                
                // Calcular costo_kilo_usd: si es ARS, guardar tal cual sin convertir; si es USD, usar directamente
                let costo_kilo_usd: number | undefined = undefined;
                if (costo_original !== null && costo_original !== undefined && !isNaN(costo_original) && costo_original >= 0) {
                  if (moneda === 'ARS') {
                    // Si el costo está en ARS, guardarlo tal cual sin convertir a USD
                    costo_kilo_usd = costo_original;
                  } else {
                    // Si el costo ya está en USD, usarlo directamente
                    costo_kilo_usd = costo_original;
                  }
                } else {
                  // Si no hay costo, dejar como undefined (será 0 en la BD)
                  costo_kilo_usd = undefined;
                }

                // Asegurar que costo_kilo_usd sea un número válido (0 si es undefined/null)
                const costo_kilo_usd_final = costo_kilo_usd !== null && costo_kilo_usd !== undefined && !isNaN(costo_kilo_usd) 
                  ? costo_kilo_usd 
                  : 0;

                const materialData = {
                  nombre,
                  material,
                  kg,
                  stock_minimo,
                  costo_kilo_usd: costo_kilo_usd_final,
                  moneda,
                  valor_dolar,
                };
                rows.push(materialData);
                
                // Log detallado
                if (costo_original !== null && costo_original !== undefined) {
                  const logInfo = moneda === 'ARS' 
                    ? `${costo_kilo_usd_final.toFixed(2)} ARS (guardado tal cual)`
                    : `${costo_kilo_usd_final.toFixed(2)} USD`;
                  console.log(`Fila ${i + 1}: ${nombre} | Costo: ${logInfo} | Moneda: ${moneda}`);
                } else {
                  console.log(`Fila ${i + 1}: ${nombre} | Sin costo especificado`);
                }
              } else if (importType === 'products') {
                const nombre = String(row['Nombre'] || '').trim();
                const cantidad = parseFloat(String(row['Cantidad'] || '0').replace(',', '.')) || 0;
                const peso_unidad = parseFloat(String(row['Peso_Unidad'] || '0').replace(',', '.')) || 0;
                
                if (!nombre || cantidad <= 0 || peso_unidad <= 0) {
                  continue;
                }

                const costo_unit_total = row['Costo_Unit_Total'] ? parseFloat(String(row['Costo_Unit_Total']).replace(',', '.')) : undefined;
                const stock_minimo = parseFloat(String(row['Stock_Minimo'] || '0').replace(',', '.')) || 0;

                rows.push({
                  nombre,
                  cantidad,
                  peso_unidad,
                  costo_unit_total,
                  stock_minimo,
                });
              } else if (importType === 'resale') {
                const nombre = String(row['Nombre'] || '').trim();
                const cantidad = parseFloat(String(row['Cantidad'] || '0').replace(',', '.')) || 0;
                const costo_unitario = parseFloat(String(row['Costo_Unitario'] || '0').replace(',', '.')) || 0;
                const moneda = (String(row['Moneda'] || 'ARS').toUpperCase() === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD';
                
                if (!nombre || cantidad <= 0 || costo_unitario <= 0) {
                  continue;
                }

                const otros_costos = row['Otros_Costos'] ? parseFloat(String(row['Otros_Costos']).replace(',', '.')) : 0;
                const valor_dolar = row['Valor_Dolar'] ? parseFloat(String(row['Valor_Dolar']).replace(',', '.')) : undefined;
                const stock_minimo = parseFloat(String(row['Stock_Minimo'] || '0').replace(',', '.')) || 0;

                rows.push({
                  nombre,
                  cantidad,
                  costo_unitario,
                  otros_costos,
                  moneda,
                  valor_dolar,
                  stock_minimo,
                });
              }
            } catch (error: any) {
              console.error('Error parsing row:', error);
              // Continuar con la siguiente fila
            }
          }

          if (rows.length === 0) {
            reject(new Error('No se encontraron filas válidas en el archivo'));
            return;
          }

          resolve(rows);
        } catch (error: any) {
          reject(new Error(`Error al leer el archivo: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Error al leer el archivo'));
      };

      reader.readAsArrayBuffer(file);
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

      // Para materiales, NO deduplicar - cada fila del Excel debe procesarse
      // La deduplicación solo debe ocurrir cuando se busca en la BD
      let rowsToProcess = rows;
      if (importType === 'materials') {
        console.log(`Total de filas parseadas del Excel: ${rows.length}`);
        // No deduplicar aquí - dejar que la BD maneje los duplicados
        rowsToProcess = rows;
      }

      let imported = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      for (const row of rowsToProcess) {
        let wasExisting = false;
        try {
          if (importType === 'materials') {
            const materialRow = row as MaterialImportRow;
            
            // El costo_kilo_usd ya está calculado correctamente en el parseo (convertido a USD)
            // Usar 0 si no está definido
            let costo_kilo_usd = materialRow.costo_kilo_usd !== null && 
                                 materialRow.costo_kilo_usd !== undefined && 
                                 !isNaN(materialRow.costo_kilo_usd)
              ? materialRow.costo_kilo_usd 
              : 0;
            
            // El valor_dolar también ya está parseado correctamente
            const valor_dolar = materialRow.valor_dolar !== null && 
                               materialRow.valor_dolar !== undefined &&
                               !isNaN(materialRow.valor_dolar) &&
                               materialRow.valor_dolar > 0
              ? materialRow.valor_dolar
              : (materialRow.moneda === 'USD' ? 1 : 1515);

            // Verificar si ya existe SOLO por nombre exacto (case-insensitive)
            // Cada material debe tener un nombre único, aunque puedan compartir el mismo tipo de material
            const { data: existingByName } = await supabase
              .from('stock_materials')
              .select('id')
              .eq('tenant_id', tenantId)
              .ilike('nombre', materialRow.nombre)
              .maybeSingle();

            const existing = existingByName;
            wasExisting = !!existing;

            if (existing) {
              // Actualizar existente
              console.log(`Material existente encontrado: ${materialRow.nombre} (ID: ${existing.id}), actualizando...`);
              const updateData: any = {
                nombre: materialRow.nombre,
                material: materialRow.material, // Actualizar también el campo material
                stock_minimo: materialRow.stock_minimo || 0,
                costo_kilo_usd: costo_kilo_usd,
                moneda: materialRow.moneda,
                valor_dolar: valor_dolar,
              };
              
              // Si se proporciona cantidad, actualizarla
              if (materialRow.kg !== undefined && materialRow.kg !== null) {
                updateData.kg = materialRow.kg;
              }
              
              const { error: updateError } = await supabase
                .from('stock_materials')
                .update(updateData)
                .eq('id', existing.id);

              if (updateError) {
                console.error(`Error actualizando ${materialRow.nombre}:`, updateError);
                throw new Error(`Error al actualizar ${materialRow.nombre}: ${updateError.message}`);
              }
              console.log(`✓ Material actualizado: ${materialRow.nombre}`);
            } else {
              // Crear nuevo
              console.log(`Creando nuevo material: ${materialRow.nombre}`);
              const { error: insertError } = await supabase
                .from('stock_materials')
                .insert({
                  tenant_id: tenantId,
                  nombre: materialRow.nombre,
                  material: materialRow.material,
                  kg: materialRow.kg !== undefined && materialRow.kg !== null ? materialRow.kg : 0,
                  costo_kilo_usd: costo_kilo_usd,
                  valor_dolar: valor_dolar,
                  moneda: materialRow.moneda || 'ARS',
                  stock_minimo: materialRow.stock_minimo || 0,
                });

              if (insertError) {
                console.error(`Error creando ${materialRow.nombre}:`, insertError);
                throw new Error(`Error al crear ${materialRow.nombre}: ${insertError.message}`);
              }
              console.log(`✓ Material creado: ${materialRow.nombre}`);
            }
          } else if (importType === 'products') {
            const productRow = row as ProductImportRow;
            
            // Verificar si ya existe
            const { data: existing } = await supabase
              .from('stock_products')
              .select('id')
              .eq('tenant_id', tenantId)
              .ilike('nombre', productRow.nombre)
              .maybeSingle();

            if (existing) {
              // Actualizar existente
              await supabase
                .from('stock_products')
                .update({
                  cantidad: productRow.cantidad,
                  peso_unidad: productRow.peso_unidad,
                  costo_unit_total: productRow.costo_unit_total || null,
                  stock_minimo: productRow.stock_minimo,
                })
                .eq('id', existing.id);
            } else {
              // Crear nuevo
              await supabase
                .from('stock_products')
                .insert({
                  tenant_id: tenantId,
                  nombre: productRow.nombre,
                  cantidad: productRow.cantidad,
                  peso_unidad: productRow.peso_unidad,
                  costo_unit_total: productRow.costo_unit_total || null,
                  stock_minimo: productRow.stock_minimo,
                });
            }
          } else if (importType === 'resale') {
            const resaleRow = row as ResaleImportRow;
            const costo_unitario_final = resaleRow.costo_unitario + (resaleRow.otros_costos || 0);
            
            // Verificar si ya existe
            const { data: existing } = await supabase
              .from('resale_products')
              .select('id')
              .eq('tenant_id', tenantId)
              .ilike('nombre', resaleRow.nombre)
              .maybeSingle();

            if (existing) {
              // Actualizar existente
              await supabase
                .from('resale_products')
                .update({
                  cantidad: resaleRow.cantidad,
                  costo_unitario: resaleRow.costo_unitario,
                  otros_costos: resaleRow.otros_costos || 0,
                  costo_unitario_final,
                  moneda: resaleRow.moneda,
                  valor_dolar: resaleRow.valor_dolar || null,
                  stock_minimo: resaleRow.stock_minimo,
                })
                .eq('id', existing.id);
            } else {
              // Crear nuevo
              await supabase
                .from('resale_products')
                .insert({
                  tenant_id: tenantId,
                  nombre: resaleRow.nombre,
                  cantidad: resaleRow.cantidad,
                  costo_unitario: resaleRow.costo_unitario,
                  otros_costos: resaleRow.otros_costos || 0,
                  costo_unitario_final,
                  moneda: resaleRow.moneda,
                  valor_dolar: resaleRow.valor_dolar || null,
                  stock_minimo: resaleRow.stock_minimo,
                });
            }
          }

          imported++;
          const action = wasExisting ? 'actualizado' : 'creado';
          const itemName = row.nombre || (row as any).material || 'Sin nombre';
          console.log(`✓ ${action}: ${itemName}`);
        } catch (error: any) {
          errors++;
          const itemName = row.nombre || row.material || 'Sin nombre';
          const errorMsg = error.message || String(error);
          errorDetails.push(`${itemName}: ${errorMsg}`);
          console.error(`✗ Error en ${itemName}:`, error);
        }
      }

      setImportResults({ imported, errors, errorDetails });
      const totalInExcel = rowsToProcess.length;
      const successCount = imported - errors;
      setResultMessage(
        `Importación completada: ${successCount} items procesados exitosamente de ${totalInExcel} filas en el Excel${errors > 0 ? `. ${errors} con errores` : ''}`
      );
      console.log(`Resumen final: ${totalInExcel} filas en Excel, ${imported} procesadas, ${successCount} exitosas, ${errors} errores`);

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
    let templateData: any[] = [];

    if (importType === 'materials') {
      templateData = [
        {
          'Nombre': 'Madera',
          'Material': 'Madera',
          'Cantidad': '10000',
          'Stock_Minimo': '1000',
          'Costo_Kilo_USD': '1.00',
          'Moneda': 'USD',
          'Valor_Dolar': '1000',
        },
        {
          'Nombre': 'Chapa',
          'Material': 'Chapa',
          'Cantidad': '12000',
          'Stock_Minimo': '500',
          'Costo_Kilo_USD': '1000.00',
          'Moneda': 'ARS',
          'Valor_Dolar': '',
        },
        {
          'Nombre': 'Aceite',
          'Material': 'Aceite',
          'Cantidad': '0',
          'Stock_Minimo': '1000',
          'Costo_Kilo_USD': '1.50',
          'Moneda': 'USD',
          'Valor_Dolar': '1000',
        },
      ];
    } else if (importType === 'products') {
      templateData = [
        {
          'Nombre': 'Rejilla Ventilacion - 15 x 30',
          'Cantidad': '100',
          'Peso_Unidad': '0.29',
          'Costo_Unit_Total': '468.00',
          'Stock_Minimo': '50',
        },
      ];
    } else if (importType === 'resale') {
      templateData = [
        {
          'Nombre': 'Producto Reventa 1',
          'Cantidad': '50',
          'Costo_Unitario': '1000.00',
          'Otros_Costos': '50.00',
          'Moneda': 'ARS',
          'Valor_Dolar': '',
          'Stock_Minimo': '20',
        },
        {
          'Nombre': 'Producto Reventa 2',
          'Cantidad': '30',
          'Costo_Unitario': '10.00',
          'Otros_Costos': '0',
          'Moneda': 'USD',
          'Valor_Dolar': '1000',
          'Stock_Minimo': '10',
        },
      ];
    }

    const ws = utils.json_to_sheet(templateData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Datos');
    
    const fileName = `plantilla_importacion_${importType === 'materials' ? 'materia_prima' : importType === 'products' ? 'productos_fabricados' : 'productos_reventa'}.xlsx`;
    writeFile(wb, fileName);
  };

  const getInstructions = () => {
    switch (importType) {
      case 'materials':
        return {
          title: 'Importar Materia Prima',
          columns: 'Nombre, Material, Cantidad/KG (opcional), Stock_Minimo (opcional), Costo_Kilo_USD (opcional), Moneda (ARS/USD), Valor_Dolar (opcional)',
        };
      case 'products':
        return {
          title: 'Importar Productos Fabricados',
          columns: 'Nombre, Cantidad, Peso_Unidad (kg), Costo_Unit_Total (opcional), Stock_Minimo (opcional)',
        };
      case 'resale':
        return {
          title: 'Importar Productos de Reventa',
          columns: 'Nombre, Cantidad, Costo_Unitario, Otros_Costos (opcional), Moneda (ARS/USD), Valor_Dolar (opcional si es USD), Stock_Minimo (opcional)',
        };
      default:
        return { title: 'Importar', columns: '' };
    }
  };

  const instructions = getInstructions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{instructions.title}</h3>
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
              <li>Debe contener las columnas: {instructions.columns}</li>
              <li>Las columnas marcadas como (opcional) pueden omitirse</li>
              <li>Puede descargar la plantilla de ejemplo haciendo clic en el botón de abajo</li>
              <li>Si un item ya existe (mismo nombre/material), se actualizará en lugar de crear uno nuevo</li>
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

