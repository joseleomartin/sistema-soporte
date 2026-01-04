import { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { read, utils, writeFile } from 'xlsx';

interface BulkImportSuppliersModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface SupplierImportRow {
  nombre: string;
  razon_social?: string;
  cuit?: string;
  telefono?: string;
  email?: string;
  provincia?: string;
  direccion?: string;
  observaciones?: string;
}

export function BulkImportSuppliersModal({ onClose, onSuccess }: BulkImportSuppliersModalProps) {
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

  const parseExcel = async (file: File): Promise<SupplierImportRow[]> => {
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
          const requiredColumns = ['Nombre'];
          const firstRow = jsonData[0];
          const missingColumns = requiredColumns.filter(col => !(col in firstRow));
          
          if (missingColumns.length > 0) {
            reject(new Error(`Faltan las siguientes columnas: ${missingColumns.join(', ')}`));
            return;
          }

          const rows: SupplierImportRow[] = [];

          for (const row of jsonData) {
            try {
              const nombre = String(row['Nombre'] || '').trim();
              
              if (!nombre) {
                continue;
              }

              // Parsear campos opcionales
              const razon_social = row['Razon_Social'] || row['Razón_Social'] ? String(row['Razon_Social'] || row['Razón_Social'] || '').trim() : undefined;
              const cuit = row['CUIT'] || row['Cuit'] ? String(row['CUIT'] || row['Cuit'] || '').trim() : undefined;
              const telefono = row['Telefono'] || row['Teléfono'] ? String(row['Telefono'] || row['Teléfono'] || '').trim() : undefined;
              const email = row['Email'] ? String(row['Email'] || '').trim() : undefined;
              const provincia = row['Provincia'] ? String(row['Provincia'] || '').trim() : undefined;
              const direccion = row['Direccion'] || row['Dirección'] ? String(row['Direccion'] || row['Dirección'] || '').trim() : undefined;
              const observaciones = row['Observaciones'] ? String(row['Observaciones'] || '').trim() : undefined;

              rows.push({
                nombre,
                razon_social: razon_social || undefined,
                cuit: cuit || undefined,
                telefono: telefono || undefined,
                email: email || undefined,
                provincia: provincia || undefined,
                direccion: direccion || undefined,
                observaciones: observaciones || undefined,
              });
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

      let imported = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      for (const row of rows) {
        try {
          // Verificar si ya existe un proveedor con el mismo nombre o CUIT
          let existing = null;
          
          if (row.cuit) {
            const { data: existingByCuit } = await supabase
              .from('suppliers')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('cuit', row.cuit)
              .maybeSingle();
            
            if (existingByCuit) {
              existing = existingByCuit;
            }
          }
          
          if (!existing) {
            const { data: existingByName } = await supabase
              .from('suppliers')
              .select('id')
              .eq('tenant_id', tenantId)
              .ilike('nombre', row.nombre)
              .maybeSingle();
            
            if (existingByName) {
              existing = existingByName;
            }
          }

          const supplierData: any = {
            tenant_id: tenantId,
            nombre: row.nombre,
            razon_social: row.razon_social || null,
            cuit: row.cuit || null,
            telefono: row.telefono || null,
            email: row.email || null,
            provincia: row.provincia || null,
            direccion: row.direccion || null,
            observaciones: row.observaciones || null,
          };

          if (existing) {
            // Actualizar existente
            await supabase
              .from('suppliers')
              .update(supplierData)
              .eq('id', existing.id);
          } else {
            // Crear nuevo
            await supabase
              .from('suppliers')
              .insert(supplierData);
          }

          imported++;
        } catch (error: any) {
          errors++;
          errorDetails.push(`${row.nombre}: ${error.message}`);
        }
      }

      setImportResults({ imported, errors, errorDetails });
      setResultMessage(
        `Importación completada: ${imported} proveedores importados${errors > 0 ? `, ${errors} errores` : ''}`
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
    const templateData = [
      {
        'Nombre': 'RUKA',
        'Razon_Social': '',
        'CUIT': '',
        'Telefono': '4266 0611',
        'Email': 'info@rukawork.com.ar',
        'Provincia': '',
        'Direccion': 'Humberto Primo 2070, Lanús',
        'Observaciones': '',
      },
      {
        'Nombre': 'INSUGAS CO SRL',
        'Razon_Social': '',
        'CUIT': '',
        'Telefono': '1160437496',
        'Email': '',
        'Provincia': '',
        'Direccion': 'CALLE 211A NRO 261, SOURIGUES, BUENOS AIRES',
        'Observaciones': '',
      },
      {
        'Nombre': 'DELMONTE',
        'Razon_Social': '',
        'CUIT': '',
        'Telefono': '1121728124',
        'Email': '',
        'Provincia': '',
        'Direccion': 'Oliden 925, VALENTIN ALSINA',
        'Observaciones': '',
      },
      {
        'Nombre': 'URIARTE',
        'Razon_Social': '',
        'CUIT': '',
        'Telefono': '',
        'Email': '',
        'Provincia': '',
        'Direccion': 'Defensa 2616, talar de pacheco',
        'Observaciones': '',
      },
      {
        'Nombre': 'DAMFER',
        'Razon_Social': '',
        'CUIT': '',
        'Telefono': '1158453333',
        'Email': '',
        'Provincia': '',
        'Direccion': 'ANDRES BARANDA 742, QUILMES',
        'Observaciones': '',
      },
    ];

    const ws = utils.json_to_sheet(templateData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Datos');
    writeFile(wb, 'plantilla_importacion_proveedores.xlsx');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Importar Proveedores Masivamente</h3>
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
              <li>Debe contener la columna: <strong>Nombre</strong> (requerida)</li>
              <li>Columnas opcionales: Razon_Social, CUIT, Telefono, Email, Provincia, Direccion, Observaciones</li>
              <li>Puede descargar la plantilla de ejemplo haciendo clic en el botón de abajo</li>
              <li>Si un proveedor ya existe (mismo nombre o CUIT), se actualizará en lugar de crear uno nuevo</li>
              <li>Las columnas pueden tener o no tildes (ej: "Razon_Social" o "Razón_Social")</li>
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

