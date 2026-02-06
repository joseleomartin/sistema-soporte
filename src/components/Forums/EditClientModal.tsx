import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { X, FolderOpen, User } from 'lucide-react';

interface EditClientModalProps {
  subforum: {
    id: string;
    name: string;
    description: string | null;
    client_name: string;
    forum_id: string;
    cuit?: string | null;
    email?: string | null;
    access_keys?: string | any | null;
    economic_link?: string | null;
    contact_full_name?: string | null;
    client_type?: string | null;
    vencimientos_responsable_id?: string | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

interface AccessKeys {
  arca: { usuario: string; contraseña: string };
  agip: { usuario: string; contraseña: string };
  armba: { usuario: string; contraseña: string };
}

const parseAccessKeys = (accessKeys: any): AccessKeys => {
  if (!accessKeys) {
    return {
      arca: { usuario: '', contraseña: '' },
      agip: { usuario: '', contraseña: '' },
      armba: { usuario: '', contraseña: '' },
    };
  }
  
  if (typeof accessKeys === 'string') {
    try {
      const parsed = JSON.parse(accessKeys);
      return {
        arca: parsed.arca || { usuario: '', contraseña: '' },
        agip: parsed.agip || { usuario: '', contraseña: '' },
        armba: parsed.armba || { usuario: '', contraseña: '' },
      };
    } catch {
      return {
        arca: { usuario: '', contraseña: '' },
        agip: { usuario: '', contraseña: '' },
        armba: { usuario: '', contraseña: '' },
      };
    }
  }
  
  return {
    arca: accessKeys.arca || { usuario: '', contraseña: '' },
    agip: accessKeys.agip || { usuario: '', contraseña: '' },
    armba: accessKeys.armba || { usuario: '', contraseña: '' },
  };
};

export function EditClientModal({ subforum, onClose, onSuccess }: EditClientModalProps) {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
  const [name, setName] = useState(subforum.name);
  const [clientName, setClientName] = useState(subforum.client_name);
  const [description, setDescription] = useState(subforum.description || '');
  const [cuit, setCuit] = useState(subforum.cuit || '');
  const [email, setEmail] = useState((subforum.email || '').split('/')[0]?.trim() || '');
  const [secondaryEmail, setSecondaryEmail] = useState(
    (subforum.email || '').split('/')[1]?.trim() || ''
  );
  const [accessKeys, setAccessKeys] = useState<AccessKeys>(parseAccessKeys(subforum.access_keys));
  const [economicLink, setEconomicLink] = useState(subforum.economic_link || '');
  const [contactFullName, setContactFullName] = useState(subforum.contact_full_name || '');
  const [clientType, setClientType] = useState(subforum.client_type || '');
  const [phone, setPhone] = useState((subforum as any).phone?.split('/')?.[0]?.trim() || '');
  const [secondaryPhone, setSecondaryPhone] = useState(
    (subforum as any).phone?.split('/')?.[1]?.trim() || ''
  );
  const [driveFolderLink, setDriveFolderLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableClients, setAvailableClients] = useState<string[]>([]);
  const [driveLinkError, setDriveLinkError] = useState<string | null>(null);
  
  // Tipos de vencimientos disponibles
  const tiposVencimientos = [
    'Autónomos',
    'Monotributo',
    'IVA',
    'Ingresos Brutos',
    'Relación de Dependencia',
    'Servicio Doméstico',
    'Personas Humanas',
    'Personas Jurídicas',
    'Retenciones'
  ];
  
  const [vencimientosTipos, setVencimientosTipos] = useState<string[]>(() => {
    // Cargar tipos de vencimientos desde el subforum
    if ((subforum as any).vencimientos_tipos && Array.isArray((subforum as any).vencimientos_tipos)) {
      return (subforum as any).vencimientos_tipos;
    }
    return [];
  });
  
  const [vencimientosResponsableId, setVencimientosResponsableId] = useState<string | null>(
    (subforum as any).vencimientos_responsable_id || null
  );
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);

  useEffect(() => {
    if (!profile?.id) return;

    const loadClients = async () => {
      const { data, error } = await supabase
        .from('subforums')
        .select('client_name')
        .order('client_name', { ascending: true });

      if (!error && data) {
        const names = Array.from(
          new Set(
            (data as any[])
              .map((s) => s.client_name as string | null)
              .filter((n): n is string => !!n)
          )
        );
        setAvailableClients(names);
      }
    };

    loadClients();
  }, [profile?.id]);

  useEffect(() => {
    if (!tenantId) return;

    const loadUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('tenant_id', tenantId)
        .order('full_name', { ascending: true });

      if (!error && data) {
        setUsers(data);
      }
    };

    loadUsers();
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    setLoading(true);
    setError('');

    try {
      // Preparar access_keys como JSONB
      const accessKeysJson = 
        (accessKeys.arca.usuario || accessKeys.arca.contraseña ||
         accessKeys.agip.usuario || accessKeys.agip.contraseña ||
         accessKeys.armba.usuario || accessKeys.armba.contraseña)
          ? accessKeys
          : null;

      const combinedEmail =
        [email.trim(), secondaryEmail.trim()].filter((v) => v.length > 0).join(' / ') || null;

      const combinedPhone =
        [phone.trim(), secondaryPhone.trim()].filter((v) => v.length > 0).join(' / ') || null;

      // Obtener el responsable anterior para comparar
      const { data: currentSubforum } = await supabase
        .from('subforums')
        .select('vencimientos_responsable_id, client_name, cuit')
        .eq('id', subforum.id)
        .single();

      const responsableAnterior = currentSubforum?.vencimientos_responsable_id;
      const responsableNuevo = vencimientosResponsableId || null;

      // Actualizar subforum (cliente)
      const { data: updatedSubforum, error: subforumError } = await supabase
        .from('subforums')
        .update({
          name: name.trim(),
          client_name: clientName.trim(),
          description: description.trim() || null,
          cuit: cuit.trim() || null,
          email: combinedEmail,
          access_keys: accessKeysJson,
          economic_link: economicLink.trim() || null,
          contact_full_name: contactFullName.trim() || null,
          client_type: clientType.trim() || null,
          phone: combinedPhone,
          vencimientos_tipos: vencimientosTipos.length > 0 ? vencimientosTipos : null,
          vencimientos_responsable_id: vencimientosResponsableId || null,
        })
        .eq('id', subforum.id)
        .select('id, name, tenant_id')
        .single();

      if (subforumError) throw subforumError;

      // Si se asignó un nuevo responsable, asignar TODOS los vencimientos del cliente
      if (responsableNuevo && responsableNuevo !== responsableAnterior && updatedSubforum?.tenant_id) {
        try {
          // Buscar TODOS los vencimientos del cliente (no solo pendientes)
          const { data: todosVencimientos, error: vencimientosError } = await supabase
            .from('vencimientos_gestion')
            .select('id')
            .eq('tenant_id', updatedSubforum.tenant_id)
            .eq('client_name', clientName.trim());

          if (vencimientosError) {
            console.warn('Error al buscar vencimientos del cliente:', vencimientosError);
          } else if (todosVencimientos && todosVencimientos.length > 0) {
            // Obtener vencimientos que ya tienen asignaciones al nuevo responsable
            const { data: asignacionesExistentes } = await supabase
              .from('vencimientos_gestion_assignments')
              .select('vencimiento_id')
              .eq('assigned_to_user', responsableNuevo)
              .in('vencimiento_id', todosVencimientos.map(v => v.id))
              .eq('tenant_id', updatedSubforum.tenant_id);

            const vencimientosYaAsignados = new Set(
              asignacionesExistentes?.map(a => a.vencimiento_id) || []
            );

            // Eliminar asignaciones anteriores del responsable anterior (si existía)
            if (responsableAnterior) {
              await supabase
                .from('vencimientos_gestion_assignments')
                .delete()
                .eq('assigned_to_user', responsableAnterior)
                .in('vencimiento_id', todosVencimientos.map(v => v.id))
                .eq('tenant_id', updatedSubforum.tenant_id);
            }

            // Crear nuevas asignaciones solo para vencimientos que no están ya asignados al nuevo responsable
            const vencimientosParaAsignar = todosVencimientos.filter(
              v => !vencimientosYaAsignados.has(v.id)
            );

            if (vencimientosParaAsignar.length > 0) {
              const nuevasAsignaciones = vencimientosParaAsignar.map(vencimiento => ({
                vencimiento_id: vencimiento.id,
                assigned_to_user: responsableNuevo,
                assigned_by: profile.id,
                tenant_id: updatedSubforum.tenant_id
              }));

              // Insertar en lotes para evitar problemas con muchos vencimientos
              const batchSize = 100;
              for (let i = 0; i < nuevasAsignaciones.length; i += batchSize) {
                const batch = nuevasAsignaciones.slice(i, i + batchSize);
                const { error: assignError } = await supabase
                  .from('vencimientos_gestion_assignments')
                  .insert(batch);

                if (assignError) {
                  console.warn('Error al asignar vencimientos en lote:', assignError);
                }
              }
            }
          }
        } catch (error) {
          console.warn('Error al asignar vencimientos al nuevo responsable:', error);
          // No bloquear la actualización del cliente si falla la asignación
        }
      } else if (!responsableNuevo && responsableAnterior) {
        // Si se removió el responsable, eliminar todas las asignaciones del responsable anterior
        try {
          const { data: vencimientosCliente } = await supabase
            .from('vencimientos_gestion')
            .select('id')
            .eq('tenant_id', updatedSubforum.tenant_id)
            .eq('client_name', clientName.trim());

          if (vencimientosCliente && vencimientosCliente.length > 0) {
            await supabase
              .from('vencimientos_gestion_assignments')
              .delete()
              .eq('assigned_to_user', responsableAnterior)
              .in('vencimiento_id', vencimientosCliente.map(v => v.id))
              .eq('tenant_id', updatedSubforum.tenant_id);
          }
        } catch (error) {
          console.warn('Error al remover asignaciones del responsable anterior:', error);
        }
      }

      // Si se proporcionó un enlace de Google Drive, actualizar el mapeo
      if (driveFolderLink.trim() && updatedSubforum?.id) {
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

        const folderId = extractFolderIdFromLink(driveFolderLink.trim());
        if (folderId) {
          try {
            const { error: driveError } = await supabase.rpc('save_client_drive_mapping', {
              p_subforum_id: updatedSubforum.id,
              p_google_drive_folder_id: folderId,
              p_folder_name: name.trim() || clientName.trim(),
            });

            if (driveError) {
              console.warn('No se pudo actualizar el mapeo de Google Drive:', driveError);
            }
          } catch (driveError: any) {
            console.warn('No se pudo actualizar el mapeo de Google Drive:', driveError);
          }
        } else {
          setDriveLinkError('El enlace de Google Drive no es válido.');
        }
      }

      // Mantener sincronizado el nombre del forum padre con el nombre del cliente
      if (clientName.trim() !== subforum.client_name.trim()) {
        const { error: forumError } = await supabase
          .from('forums')
          .update({
            name: clientName.trim(),
          })
          .eq('id', subforum.forum_id);

        if (forumError) {
          // No bloquear si falla esta parte, pero dejar log
          console.warn('No se pudo actualizar el nombre del forum padre:', forumError);
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error actualizando cliente:', err);
      setError(err.message || 'Error al actualizar el cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Editar Cliente</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="edit-client-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3 forums-scroll">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Espacio de Trabajo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              maxLength={100}
              placeholder="Ej: AF CLASSIC"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Cliente
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              maxLength={100}
              placeholder="Nombre legal o comercial del cliente"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              maxLength={500}
              placeholder="Descripción breve del cliente o del espacio de trabajo..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CUIT (opcional)
              </label>
              <input
                type="text"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: 20-12345678-9"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email 1 (opcional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="correo@cliente.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email 2 (opcional)
              </label>
              <input
                type="email"
                value={secondaryEmail}
                onChange={(e) => setSecondaryEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="otro-correo@cliente.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Claves de acceso / Portales (opcional)
            </label>
            <div className="space-y-3">
              {/* ARCA */}
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700 mb-2">ARCA</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Usuario</label>
                    <input
                      type="text"
                      value={accessKeys.arca.usuario}
                      onChange={(e) => setAccessKeys({
                        ...accessKeys,
                        arca: { ...accessKeys.arca, usuario: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Usuario ARCA"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={accessKeys.arca.contraseña}
                      onChange={(e) => setAccessKeys({
                        ...accessKeys,
                        arca: { ...accessKeys.arca, contraseña: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Contraseña ARCA"
                    />
                  </div>
                </div>
              </div>

              {/* AGIP */}
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700 mb-2">AGIP</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Usuario</label>
                    <input
                      type="text"
                      value={accessKeys.agip.usuario}
                      onChange={(e) => setAccessKeys({
                        ...accessKeys,
                        agip: { ...accessKeys.agip, usuario: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Usuario AGIP"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={accessKeys.agip.contraseña}
                      onChange={(e) => setAccessKeys({
                        ...accessKeys,
                        agip: { ...accessKeys.agip, contraseña: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Contraseña AGIP"
                    />
                  </div>
                </div>
              </div>

              {/* ARBA */}
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700 mb-2">ARBA</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Usuario</label>
                    <input
                      type="text"
                      value={accessKeys.armba.usuario}
                      onChange={(e) => setAccessKeys({
                        ...accessKeys,
                        armba: { ...accessKeys.armba, usuario: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Usuario ARBA"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={accessKeys.armba.contraseña}
                      onChange={(e) => setAccessKeys({
                        ...accessKeys,
                        armba: { ...accessKeys.armba, contraseña: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Contraseña ARBA"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vinculación económica (opcional)
            </label>
            <select
              value={economicLink}
              onChange={(e) => setEconomicLink(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Sin vinculación económica</option>
              {availableClients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Selecciona el cliente con el que este se encuentra vinculado económicamente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre y apellido (contacto)
              </label>
              <input
                type="text"
                value={contactFullName}
                onChange={(e) => setContactFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nombre del contacto principal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono 1
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: +54 11 1234-5678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono 2
              </label>
              <input
                type="text"
                value={secondaryPhone}
                onChange={(e) => setSecondaryPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Otro teléfono de contacto"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de cliente
            </label>
            <select
              value={clientType}
              onChange={(e) => setClientType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Seleccionar tipo de cliente</option>
              <option value="Monotributista">Monotributista</option>
              <option value="Responsable Inscripto">Responsable Inscripto</option>
              <option value="Persona Jurídica">Persona Jurídica</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipos de Vencimientos que Aplican (opcional)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Selecciona los tipos de vencimientos que aplican a este cliente. Esto determinará qué vencimientos se mostrarán en la columna de vencimientos.
            </p>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2 max-h-48 overflow-y-auto">
              {tiposVencimientos.map((tipo) => (
                <label
                  key={tipo}
                  className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={vencimientosTipos.includes(tipo)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setVencimientosTipos([...vencimientosTipos, tipo]);
                      } else {
                        setVencimientosTipos(vencimientosTipos.filter(t => t !== tipo));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{tipo}</span>
                </label>
              ))}
            </div>
            {vencimientosTipos.length === 0 && (
              <p className="text-xs text-gray-400 mt-2 italic">
                Si no seleccionas ningún tipo, se mostrarán todos los vencimientos según el último dígito del CUIT.
              </p>
            )}
            {vencimientosTipos.length > 0 && (
              <p className="text-xs text-blue-600 mt-2">
                {vencimientosTipos.length} tipo{vencimientosTipos.length !== 1 ? 's' : ''} seleccionado{vencimientosTipos.length !== 1 ? 's' : ''}: {vencimientosTipos.join(', ')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Usuario Responsable de Vencimientos
              </div>
            </label>
            <select
              value={vencimientosResponsableId || ''}
              onChange={(e) => setVencimientosResponsableId(e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sin asignar</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Este usuario será asignado automáticamente a todos los vencimientos creados para este cliente.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Carpeta de Google Drive (opcional)
              </div>
            </label>
            <input
              type="text"
              value={driveFolderLink}
              onChange={(e) => {
                setDriveFolderLink(e.target.value);
                if (e.target.value.trim()) {
                  // validación simple, la validación fuerte se hace en el submit
                  if (!e.target.value.includes('drive.google.com') && !/^[a-zA-Z0-9_-]+$/.test(e.target.value.trim())) {
                    setDriveLinkError('El enlace no parece ser una carpeta de Google Drive válida.');
                  } else {
                    setDriveLinkError(null);
                  }
                } else {
                  setDriveLinkError(null);
                }
              }}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                driveLinkError ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="https://drive.google.com/drive/folders/ABC123..."
            />
            {driveLinkError && (
              <p className="text-xs text-red-600 mt-1">{driveLinkError}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Si cambias el enlace, se actualizará la carpeta de Google Drive asociada a este cliente.
            </p>
          </div>

          <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-2">
            <FolderOpen className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
            <p>
              Esta edición solo cambia el nombre y la descripción del cliente dentro de la
              plataforma. Los archivos existentes y la carpeta de Google Drive asociada se
              mantienen sin cambios.
            </p>
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </form>

        <div className="flex gap-3 p-4 border-t border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="edit-client-form"
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}


