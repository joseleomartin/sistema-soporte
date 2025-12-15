import { X, User, Mail, KeyRound, FileText, Briefcase, Eye, EyeOff } from 'lucide-react';

interface AccessKeys {
  arca?: { usuario?: string; contraseña?: string };
  agip?: { usuario?: string; contraseña?: string };
  armba?: { usuario?: string; contraseña?: string };
}

interface ClientInfoModalProps {
  subforum: {
    name: string;
    client_name: string;
    cuit?: string | null;
    email?: string | null;
    phone?: string | null;
    access_keys?: string | AccessKeys | null;
    economic_link?: string | null;
    contact_full_name?: string | null;
    client_type?: string | null;
  };
  onClose: () => void;
}

const parseAccessKeys = (accessKeys: any): AccessKeys | null => {
  if (!accessKeys) return null;
  
  if (typeof accessKeys === 'string') {
    try {
      return JSON.parse(accessKeys);
    } catch {
      return null;
    }
  }
  
  return accessKeys;
};

const hasAccessKeys = (accessKeys: AccessKeys | null): boolean => {
  if (!accessKeys) return false;
  return !!(
    (accessKeys.arca?.usuario || accessKeys.arca?.contraseña) ||
    (accessKeys.agip?.usuario || accessKeys.agip?.contraseña) ||
    (accessKeys.armba?.usuario || accessKeys.armba?.contraseña)
  );
};

import { useState } from 'react';

export function ClientInfoModal({ subforum, onClose }: ClientInfoModalProps) {
  const parsedAccessKeys = parseAccessKeys(subforum.access_keys);
  const hasAccessKeysData = hasAccessKeys(parsedAccessKeys);
  const [showPasswords, setShowPasswords] = useState(false);
  
  const hasExtraInfo =
    subforum.cuit ||
    subforum.email ||
    subforum.phone ||
    hasAccessKeysData ||
    subforum.economic_link ||
    subforum.contact_full_name ||
    subforum.client_type;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Ficha del Cliente
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Espacio de trabajo</p>
            <p className="text-sm font-medium text-gray-900">{subforum.name}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Cliente</p>
            <p className="text-sm font-medium text-gray-900">{subforum.client_name}</p>
          </div>

          {!hasExtraInfo && (
            <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
              No hay información adicional cargada para este cliente. Puedes completarla desde
              el botón de edición.
            </div>
          )}

          {subforum.cuit && (
            <div className="flex items-center gap-3 mt-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">CUIT</p>
                <p className="text-sm text-gray-900">{subforum.cuit}</p>
              </div>
            </div>
          )}

          {subforum.email && (
            <div className="flex items-center gap-3 mt-2">
              <Mail className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Email</p>
                <p className="text-sm text-gray-900 break-all">{subforum.email}</p>
              </div>
            </div>
          )}

          {subforum.contact_full_name && (
            <div className="flex items-center gap-3 mt-2">
              <User className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Contacto</p>
                <p className="text-sm text-gray-900">{subforum.contact_full_name}</p>
              </div>
            </div>
          )}

          {subforum.phone && (
            <div className="flex items-center gap-3 mt-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Teléfono</p>
                <p className="text-sm text-gray-900">{subforum.phone}</p>
              </div>
            </div>
          )}

          {subforum.client_type && (
            <div className="flex items-center gap-3 mt-2">
              <Briefcase className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Tipo de cliente</p>
                <p className="text-sm text-gray-900">{subforum.client_type}</p>
              </div>
            </div>
          )}

          {hasAccessKeysData && parsedAccessKeys && (
            <div className="flex items-start gap-3 mt-2">
              <KeyRound className="w-4 h-4 text-gray-500 mt-1" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Claves de acceso / Portales
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showPasswords ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        Ocultar
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        Ver claves
                      </>
                    )}
                  </button>
                </div>
                <div className="space-y-3">
                  {parsedAccessKeys.arca && (parsedAccessKeys.arca.usuario || parsedAccessKeys.arca.contraseña) && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                      <p className="text-xs font-semibold text-gray-700 mb-1">ARCA</p>
                      {parsedAccessKeys.arca.usuario && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Usuario:</span> {parsedAccessKeys.arca.usuario}
                        </p>
                      )}
                      {parsedAccessKeys.arca.contraseña && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Contraseña:</span>{' '}
                          {showPasswords ? parsedAccessKeys.arca.contraseña : '••••••••'}
                        </p>
                      )}
                    </div>
                  )}
                  {parsedAccessKeys.agip && (parsedAccessKeys.agip.usuario || parsedAccessKeys.agip.contraseña) && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                      <p className="text-xs font-semibold text-gray-700 mb-1">AGIP</p>
                      {parsedAccessKeys.agip.usuario && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Usuario:</span> {parsedAccessKeys.agip.usuario}
                        </p>
                      )}
                      {parsedAccessKeys.agip.contraseña && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Contraseña:</span>{' '}
                          {showPasswords ? parsedAccessKeys.agip.contraseña : '••••••••'}
                        </p>
                      )}
                    </div>
                  )}
                  {parsedAccessKeys.armba && (parsedAccessKeys.armba.usuario || parsedAccessKeys.armba.contraseña) && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                      <p className="text-xs font-semibold text-gray-700 mb-1">ARBA</p>
                      {parsedAccessKeys.armba.usuario && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Usuario:</span> {parsedAccessKeys.armba.usuario}
                        </p>
                      )}
                      {parsedAccessKeys.armba.contraseña && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Contraseña:</span>{' '}
                          {showPasswords ? parsedAccessKeys.armba.contraseña : '••••••••'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {subforum.economic_link && (
            <div className="flex items-start gap-3 mt-2">
              <FileText className="w-4 h-4 text-gray-500 mt-1" />
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">
                  Vinculación económica
                </p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                  {subforum.economic_link}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


