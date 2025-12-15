import { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface BulkImportClientsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ClientImportRow {
  workspace_name: string;
  client_name: string;
  description?: string;
  cuit?: string;
  email1?: string;
  email2?: string;
  phone1?: string;
  phone2?: string;
  economic_link?: string;
  contact_name?: string;
  client_type?: string;
  arca_user?: string;
  arca_password?: string;
  agip_user?: string;
  agip_password?: string;
  arba_user?: string;
  arba_password?: string;
  drive_link?: string;
}

// Encabezados amigables para Excel (en español)
const CSV_HEADERS = [
  'Nombre espacio de trabajo',
  'Nombre del cliente',
  'Descripción',
  'CUIT',
  'Email 1',
  'Email 2',
  'Teléfono 1',
  'Teléfono 2',
  'Vinculación económica',
  'Nombre de contacto',
  'Tipo de cliente',
  'Usuario ARCA',
  'Contraseña ARCA',
  'Usuario AGIP',
  'Contraseña AGIP',
  'Usuario ARBA',
  'Contraseña ARBA',
  'Link carpeta Google Drive',
];

export function BulkImportClientsModal({ onClose, onSuccess }: BulkImportClientsModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!profile) {
    return null;
  }

  const extractFolderIdFromLink = (link: string): string | null => {
    const foldersMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (foldersMatch) return foldersMatch[1];

    const openMatch = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (openMatch) return openMatch[1];

    if (/^[a-zA-Z0-9_-]+$/.test(link.trim())) {
      return link.trim();
    }

    return null;
  };

  const parseCsv = (text: string): ClientImportRow[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const rows: ClientImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      // La plantilla usa ';' como separador para que Excel en español lo abra en columnas
      const cols = lines[i].split(';').map((c) => c.trim());
      const getCol = (index: number) => (cols[index] ? cols[index].trim() : '');

      const client_name = getCol(1);
      if (!client_name) continue;

      rows.push({
        workspace_name: getCol(0) || client_name,
        client_name,
        description: getCol(2),
        cuit: getCol(3),
        email1: getCol(4),
        email2: getCol(5),
        phone1: getCol(6),
        phone2: getCol(7),
        economic_link: getCol(8),
        contact_name: getCol(9),
        client_type: getCol(10),
        arca_user: getCol(11),
        arca_password: getCol(12),
        agip_user: getCol(13),
        agip_password: getCol(14),
        arba_user: getCol(15),
        arba_password: getCol(16),
        drive_link: getCol(17),
      });
    }

    return rows;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResultMessage(null);
    setErrorMessage(null);

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      setErrorMessage('El archivo no contiene filas válidas. Verifica el formato del CSV.');
      return;
    }

    setLoading(true);
    try {
      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const row of rows) {
        try {
          // 1. Buscar o crear forum para el cliente
          let forumId: string;

          const { data: existingForum } = await supabase
            .from('forums')
            .select('id')
            .eq('name', row.client_name.trim())
            .maybeSingle();

          if (existingForum) {
            forumId = (existingForum as any).id;
          } else {
            const { data: newForum, error: forumError } = await supabase
              .from('forums')
              .insert({
                name: row.client_name.trim(),
                description: `Foro del cliente ${row.client_name.trim()}`,
                created_by: profile.id,
              } as any)
              .select('id')
              .single();

            if (forumError) throw forumError;
            forumId = (newForum as any).id;
          }

          const combinedEmail =
            [row.email1, row.email2].filter((v) => v && v.trim().length > 0).join(' / ') || null;
          const combinedPhone =
            [row.phone1, row.phone2].filter((v) => v && v.trim().length > 0).join(' / ') || null;

          const accessKeys =
            row.arca_user ||
            row.arca_password ||
            row.agip_user ||
            row.agip_password ||
            row.arba_user ||
            row.arba_password
              ? {
                  arca: { usuario: row.arca_user || '', contraseña: row.arca_password || '' },
                  agip: { usuario: row.agip_user || '', contraseña: row.agip_password || '' },
                  armba: { usuario: row.arba_user || '', contraseña: row.arba_password || '' },
                }
              : null;

          // 2. Buscar si ya existe un cliente con el mismo nombre o CUIT
          let existingSubforum: any = null;
          
          // Primero buscar por CUIT si está disponible
          if (row.cuit?.trim()) {
            const { data: subforumByCuit } = await supabase
              .from('subforums')
              .select('id, name, forum_id')
              .eq('cuit', row.cuit.trim())
              .maybeSingle();
            
            if (subforumByCuit) {
              existingSubforum = subforumByCuit;
            }
          }
          
          // Si no se encontró por CUIT, buscar por nombre de cliente
          if (!existingSubforum) {
            const { data: subforumByName } = await supabase
              .from('subforums')
              .select('id, name, forum_id')
              .eq('client_name', row.client_name.trim())
              .maybeSingle();
            
            if (subforumByName) {
              existingSubforum = subforumByName;
            }
          }

          let subforumId: string;
          let subforumName: string;

          if (existingSubforum) {
            // Actualizar cliente existente
            const updateData: any = {
              name: row.workspace_name.trim() || row.client_name.trim(),
              description: row.description?.trim() || null,
              client_name: row.client_name.trim(),
              cuit: row.cuit?.trim() || null,
              email: combinedEmail,
              access_keys: accessKeys,
              economic_link: row.economic_link?.trim() || null,
              contact_full_name: row.contact_name?.trim() || null,
              client_type: row.client_type?.trim() || null,
              phone: combinedPhone,
            };

            // Si el forum_id cambió, actualizarlo también
            if (existingSubforum.forum_id !== forumId) {
              updateData.forum_id = forumId;
            }

            const { data: updatedSubforum, error: updateError } = await supabase
              .from('subforums')
              .update(updateData)
              .eq('id', existingSubforum.id)
              .select('id, name')
              .single();

            if (updateError) throw updateError;
            subforumId = (updatedSubforum as any).id;
            subforumName = (updatedSubforum as any).name;
            updated += 1;
          } else {
            // Crear nuevo cliente
            const { data: newSubforum, error: subforumError } = await supabase
              .from('subforums')
              .insert({
                name: row.workspace_name.trim() || row.client_name.trim(),
                description: row.description?.trim() || null,
                client_name: row.client_name.trim(),
                cuit: row.cuit?.trim() || null,
                email: combinedEmail,
                access_keys: accessKeys,
                economic_link: row.economic_link?.trim() || null,
                contact_full_name: row.contact_name?.trim() || null,
                client_type: row.client_type?.trim() || null,
                phone: combinedPhone,
                forum_id: forumId,
                created_by: profile.id,
              } as any)
              .select('id, name')
              .single();

            if (subforumError) throw subforumError;
            subforumId = (newSubforum as any).id;
            subforumName = (newSubforum as any).name;
            created += 1;
          }

          // 3. Guardar mapeo de Google Drive si corresponde
          if (row.drive_link && subforumId) {
            const folderId = extractFolderIdFromLink(row.drive_link.trim());
            if (folderId) {
              await supabase.rpc('save_client_drive_mapping', {
                p_subforum_id: subforumId,
                p_google_drive_folder_id: folderId,
                p_folder_name: subforumName,
              } as any);
            }
          }
        } catch (error) {
          console.error('Error importando fila:', row, error);
          errors += 1;
        }
      }

      setResultMessage(
        `Importación finalizada. Creados: ${created}, actualizados: ${updated}, con error: ${errors}.`
      );
      onSuccess();
    } catch (error: any) {
      console.error('Error en importación masiva:', error);
      setErrorMessage(error.message || 'Error inesperado al importar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    // Usar BOM UTF-8 para que Excel abra correctamente los acentos
    const BOM = '\uFEFF';
    
    // Función para escapar valores CSV (si contienen comas, comillas o saltos de línea)
    const escapeCsvValue = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Usamos ';' porque en Windows/Excel en español el separador de listas suele ser ';'
    const separator = ';';

    const header = CSV_HEADERS.map(escapeCsvValue).join(separator);
    const exampleRow1 = [
      '360 ADV',
      '360 ADV',
      'Espacio de trabajo de 360 ADV',
      '30711283109',
      'cliente@ejemplo.com',
      'otro-correo@ejemplo.com',
      '+54 11 1234-5678',
      '+54 11 2222-3333',
      'Relacionado con Cliente X',
      'Leo Pérez',
      'Persona Jurídica',
      'user_arca',
      'pass_arca',
      'user_agip',
      'pass_agip',
      'user_arba',
      'pass_arba',
      'https://drive.google.com/drive/folders/ABC123',
    ].map(escapeCsvValue).join(separator);

    const csvContent = BOM + [header, exampleRow1].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_importacion_clientes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Importación masiva de clientes
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Sube un archivo CSV (compatible con Excel) usando la plantilla para crear muchos
              clientes de una vez.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 text-blue-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900 mb-1">
              Selecciona un archivo CSV exportado desde Excel
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Asegúrate de incluir la fila de encabezados según la plantilla.
            </p>
            <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-700 transition">
              Elegir archivo
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
                disabled={loading}
              />
            </label>
            {fileName && (
              <p className="mt-2 text-xs text-gray-600">Archivo seleccionado: {fileName}</p>
            )}
          </div>

          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
            <div className="text-xs text-blue-800 text-left">
              <p className="font-semibold mb-1">Formato de columnas esperado:</p>
              <p className="mb-1 break-words">
                workspace_name, client_name, description, cuit, email1, email2, phone1, phone2,
                economic_link, contact_name, client_type, arca_user, arca_password, agip_user,
                agip_password, arba_user, arba_password, drive_link
              </p>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="mt-2 inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900"
              >
                <FileSpreadsheet className="w-3 h-3" />
                Descargar plantilla de ejemplo (.csv)
              </button>
            </div>
          </div>

          {resultMessage && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
              <CheckCircle2 className="w-4 h-4 mt-0.5" />
              <p>{resultMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            disabled={loading}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}


