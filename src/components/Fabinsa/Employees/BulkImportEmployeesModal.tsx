import { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { read, utils, writeFile } from 'xlsx';

interface BulkImportEmployeesModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface EmployeeImportRow {
  nombre: string;
  valor_hora: number;
  dias_trabajados?: number;
  horas_dia?: number;
  ausencias?: number;
  vacaciones?: number;
  feriados?: number;
  lic_enfermedad?: number;
  otras_licencias?: number;
  horas_descanso?: number;
  carga_social?: number;
  horas_extras?: number;
  feriados_trabajados?: number;
}

export function BulkImportEmployeesModal({ onClose, onSuccess }: BulkImportEmployeesModalProps) {
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

  const parseExcel = async (file: File): Promise<EmployeeImportRow[]> => {
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
          const requiredColumns = ['Nombre', 'Valor_Hora'];
          const firstRow = jsonData[0];
          const missingColumns = requiredColumns.filter(col => !(col in firstRow));
          
          if (missingColumns.length > 0) {
            reject(new Error(`Faltan las siguientes columnas: ${missingColumns.join(', ')}`));
            return;
          }

          const rows: EmployeeImportRow[] = [];

          for (const row of jsonData) {
            try {
              const nombre = String(row['Nombre'] || '').trim();
              const valor_hora = parseFloat(String(row['Valor_Hora'] || '0').replace(',', '.'));
              
              if (!nombre || valor_hora <= 0) {
                continue;
              }

              // Parsear campos opcionales
              const dias_trabajados = row['Dias_Trabajados'] ? parseInt(String(row['Dias_Trabajados']).replace(',', '.')) : undefined;
              const horas_dia = row['Horas_Dia'] ? parseFloat(String(row['Horas_Dia']).replace(',', '.')) : undefined;
              const ausencias = row['Ausencias'] ? parseInt(String(row['Ausencias']).replace(',', '.')) : undefined;
              const vacaciones = row['Vacaciones'] ? parseInt(String(row['Vacaciones']).replace(',', '.')) : undefined;
              const feriados = row['Feriados'] ? parseInt(String(row['Feriados']).replace(',', '.')) : undefined;
              const lic_enfermedad = row['Lic_Enfermedad'] ? parseInt(String(row['Lic_Enfermedad']).replace(',', '.')) : undefined;
              const otras_licencias = row['Otras_Licencias'] ? parseInt(String(row['Otras_Licencias']).replace(',', '.')) : undefined;
              const horas_descanso = row['Horas_Descanso'] ? parseFloat(String(row['Horas_Descanso']).replace(',', '.')) : undefined;
              const carga_social = row['Carga_Social'] ? parseFloat(String(row['Carga_Social']).replace(',', '.')) : undefined;
              const horas_extras = row['Horas_Extras'] ? parseFloat(String(row['Horas_Extras']).replace(',', '.')) : undefined;
              const feriados_trabajados = row['Feriados_Trabajados'] ? parseInt(String(row['Feriados_Trabajados']).replace(',', '.')) : undefined;

              rows.push({
                nombre,
                valor_hora,
                dias_trabajados,
                horas_dia,
                ausencias,
                vacaciones,
                feriados,
                lic_enfermedad,
                otras_licencias,
                horas_descanso,
                carga_social,
                horas_extras,
                feriados_trabajados,
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
          // Verificar si ya existe un empleado con el mismo nombre
          const { data: existing } = await supabase
            .from('employees')
            .select('id')
            .eq('tenant_id', tenantId)
            .ilike('nombre', row.nombre)
            .maybeSingle();

          const employeeData: any = {
            tenant_id: tenantId,
            nombre: row.nombre,
            valor_hora: row.valor_hora,
            dias_trabajados: row.dias_trabajados ?? 0,
            horas_dia: row.horas_dia ?? 8,
            ausencias: row.ausencias ?? 0,
            vacaciones: row.vacaciones ?? 0,
            feriados: row.feriados ?? 0,
            lic_enfermedad: row.lic_enfermedad ?? 0,
            otras_licencias: row.otras_licencias ?? 0,
            horas_descanso: row.horas_descanso ?? 0,
            carga_social: row.carga_social ?? 43,
            horas_extras: row.horas_extras ?? 0,
            feriados_trabajados: row.feriados_trabajados ?? 0,
          };

          if (existing) {
            // Actualizar existente
            await supabase
              .from('employees')
              .update(employeeData)
              .eq('id', existing.id);
          } else {
            // Crear nuevo
            await supabase
              .from('employees')
              .insert(employeeData);
          }

          imported++;
        } catch (error: any) {
          errors++;
          errorDetails.push(`${row.nombre}: ${error.message}`);
        }
      }

      setImportResults({ imported, errors, errorDetails });
      setResultMessage(
        `Importación completada: ${imported} empleados importados${errors > 0 ? `, ${errors} errores` : ''}`
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
        'Nombre': 'Fabián Canoni',
        'Valor_Hora': '5000',
        'Dias_Trabajados': '220',
        'Horas_Dia': '8',
        'Ausencias': '0',
        'Vacaciones': '15',
        'Feriados': '10',
        'Lic_Enfermedad': '0',
        'Otras_Licencias': '0',
        'Horas_Descanso': '0.5',
        'Carga_Social': '43',
        'Horas_Extras': '0',
        'Feriados_Trabajados': '0',
      },
      {
        'Nombre': 'Juan Pérez',
        'Valor_Hora': '4500',
        'Dias_Trabajados': '220',
        'Horas_Dia': '8',
        'Ausencias': '2',
        'Vacaciones': '15',
        'Feriados': '10',
        'Lic_Enfermedad': '3',
        'Otras_Licencias': '0',
        'Horas_Descanso': '0.5',
        'Carga_Social': '43',
        'Horas_Extras': '20',
        'Feriados_Trabajados': '2',
      },
    ];

    const ws = utils.json_to_sheet(templateData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Datos');
    writeFile(wb, 'plantilla_importacion_empleados.xlsx');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Importar Empleados Masivamente</h3>
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
              <li>Debe contener las columnas: <strong>Nombre</strong> y <strong>Valor_Hora</strong> (requeridas)</li>
              <li>Columnas opcionales: Dias_Trabajados, Horas_Dia, Ausencias, Vacaciones, Feriados, Lic_Enfermedad, Otras_Licencias, Horas_Descanso, Carga_Social, Horas_Extras, Feriados_Trabajados</li>
              <li>Puede descargar la plantilla de ejemplo haciendo clic en el botón de abajo</li>
              <li>Si un empleado ya existe (mismo nombre), se actualizará en lugar de crear uno nuevo</li>
              <li>Los valores por defecto son: Horas_Dia=8, Carga_Social=43%, el resto=0</li>
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

