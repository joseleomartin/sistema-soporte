import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { 
  CreditCard, 
  Users, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  DollarSign,
  TrendingUp,
  Zap,
  Shield,
  Building2,
  RefreshCw
} from 'lucide-react';

interface SubscriptionStatus {
  has_subscription: boolean;
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  plan_type: 'trial' | 'basic' | 'premium' | 'enterprise';
  is_trial: boolean;
  trial_expired: boolean;
  trial_start_date: string | null;
  trial_end_date: string | null;
  trial_days_remaining: number;
  max_users: number;
  current_users: number;
  users_remaining: number;
  price_per_month: number;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  payment_status: string;
}

export function SubscriptionManagement() {
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (profile?.role === 'admin' && tenant?.id) {
      loadSubscriptionStatus();
    }
  }, [profile?.role, tenant?.id]);

  const loadSubscriptionStatus = async () => {
    if (!tenant?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_subscription_status', {
        p_tenant_id: tenant.id
      });

      if (error) throw error;

      setSubscriptionStatus(data as SubscriptionStatus);
    } catch (error: any) {
      console.error('Error loading subscription status:', error);
      setMessage({ type: 'error', text: 'Error al cargar el estado de la suscripción' });
    } finally {
      setLoading(false);
    }
  };

  const handleActivateSubscription = async () => {
    if (!tenant?.id || !subscriptionStatus) return;

    setActivating(true);
    setMessage(null);

    try {
      // En una implementación real, aquí iría la integración con el sistema de pagos
      // Por ahora, simulamos la activación con la cantidad actual de usuarios
      const { error } = await supabase.rpc('activate_paid_subscription', {
        p_tenant_id: tenant.id,
        p_user_count: subscriptionStatus.current_users
      });

      if (error) throw error;

      setMessage({ 
        type: 'success', 
        text: 'Suscripción activada exitosamente. En producción, aquí se procesaría el pago.' 
      });
      
      // Recargar estado
      await loadSubscriptionStatus();
    } catch (error: any) {
      console.error('Error activating subscription:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Error al activar la suscripción' 
      });
    } finally {
      setActivating(false);
    }
  };

  const handleFixSubscription = async () => {
    if (!tenant?.id) return;

    setFixing(true);
    setMessage(null);

    try {
      const { error } = await supabase.rpc('fix_subscription_max_users_for_tenant', {
        p_tenant_id: tenant.id
      });

      if (error) throw error;

      setMessage({ 
        type: 'success', 
        text: 'Límite de usuarios corregido exitosamente. Ahora puedes agregar más usuarios según tu plan.' 
      });
      
      // Recargar estado
      await loadSubscriptionStatus();
    } catch (error: any) {
      console.error('Error fixing subscription:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Error al corregir la suscripción' 
      });
    } finally {
      setFixing(false);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            Solo los administradores pueden ver y gestionar la suscripción.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!subscriptionStatus || !subscriptionStatus.has_subscription) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Gestión de Suscripción
          </h2>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              No se encontró información de suscripción para esta empresa.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { 
    status, 
    plan_type, 
    is_trial, 
    trial_expired, 
    trial_days_remaining,
    trial_end_date,
    max_users,
    current_users,
    users_remaining,
    price_per_month,
    subscription_end_date,
    payment_status
  } = subscriptionStatus;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = () => {
    if (is_trial && !trial_expired) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Clock className="w-4 h-4 mr-1" />
          Prueba Gratuita
        </span>
      );
    }
    if (status === 'active') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle className="w-4 h-4 mr-1" />
          Activa
        </span>
      );
    }
    if (status === 'expired') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <AlertCircle className="w-4 h-4 mr-1" />
          Expirada
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
        {status}
      </span>
    );
  };

  const getPlanIcon = () => {
    switch (plan_type) {
      case 'trial':
        return <Zap className="w-6 h-6" />;
      case 'basic':
        return <Users className="w-6 h-6" />;
      case 'premium':
        return <TrendingUp className="w-6 h-6" />;
      case 'enterprise':
        return <Shield className="w-6 h-6" />;
      default:
        return <Building2 className="w-6 h-6" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Gestión de Suscripción
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Administra la suscripción de tu empresa
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Estado Actual */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Estado Actual
          </h2>
          {getStatusBadge()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Plan Actual */}
          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
            <div className="flex items-center mb-2">
              {getPlanIcon()}
              <h3 className="ml-2 font-medium text-gray-900 dark:text-white">
                Plan Actual
              </h3>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
              {plan_type === 'trial' ? 'Prueba Gratuita' : plan_type}
            </p>
          </div>

          {/* Usuarios */}
          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="ml-2 font-medium text-gray-900 dark:text-white">
                Usuarios
              </h3>
            </div>
            <div className="flex items-baseline">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {current_users}
              </p>
              <p className="ml-2 text-gray-600 dark:text-gray-400">
                / {max_users} máximo
              </p>
            </div>
            {users_remaining <= 3 && users_remaining > 0 && (
              <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ Quedan {users_remaining} espacios disponibles
              </p>
            )}
            {users_remaining === 0 && status === 'active' && current_users <= 10 && (
              <div className="mt-2">
                <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                  ❌ Has alcanzado el límite de usuarios
                </p>
                {max_users === current_users && current_users <= 10 && (
                  <button
                    onClick={handleFixSubscription}
                    disabled={fixing}
                    className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {fixing ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Corrigiendo...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Corregir límite (debe ser 10 para plan básico)
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
            {users_remaining === 0 && status !== 'active' && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                ❌ Has alcanzado el límite de usuarios
              </p>
            )}
          </div>
        </div>

        {/* Barra de progreso de usuarios */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Uso de usuarios</span>
            <span>{Math.round((current_users / max_users) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                (current_users / max_users) >= 0.9
                  ? 'bg-red-500'
                  : (current_users / max_users) >= 0.7
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min((current_users / max_users) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Información de Prueba Gratuita */}
      {is_trial && !trial_expired && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1 mr-3" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Período de Prueba Gratuita
              </h3>
              <p className="text-blue-800 dark:text-blue-300 mb-4">
                Estás en tu período de prueba gratuita de 7 días. 
                {trial_days_remaining > 0 ? (
                  <> Te quedan <strong>{trial_days_remaining} día{trial_days_remaining !== 1 ? 's' : ''}</strong>.</>
                ) : (
                  <> Tu prueba expira hoy.</>
                )}
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-blue-700 dark:text-blue-400">Inicio:</p>
                  <p className="font-medium text-blue-900 dark:text-blue-200">
                    {formatDate(trial_end_date ? new Date(new Date(trial_end_date).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() : null)}
                  </p>
                </div>
                <div>
                  <p className="text-blue-700 dark:text-blue-400">Fin:</p>
                  <p className="font-medium text-blue-900 dark:text-blue-200">
                    {formatDate(trial_end_date)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Prueba Expirada */}
      {trial_expired && status !== 'active' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mt-1 mr-3" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
                Prueba Gratuita Expirada
              </h3>
              <p className="text-red-800 dark:text-red-300 mb-4">
                Tu período de prueba gratuita ha finalizado. Para continuar usando el sistema, 
                necesitas activar una suscripción pagada.
              </p>
              <button
                onClick={handleActivateSubscription}
                disabled={activating}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {activating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Activando...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Activar Suscripción
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Información de Suscripción Pagada */}
      {status === 'active' && !is_trial && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Información de Suscripción
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center mb-2">
                <DollarSign className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Precio Mensual</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${price_per_month.toFixed(2)}
              </p>
            </div>
            <div>
              <div className="flex items-center mb-2">
                <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Próximo Pago</span>
              </div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {formatDate(subscription_end_date)}
              </p>
            </div>
            <div>
              <div className="flex items-center mb-2">
                <CheckCircle className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Estado de Pago</span>
              </div>
              <p className="text-lg font-medium text-gray-900 dark:text-white capitalize">
                {payment_status}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Botón para Activar Suscripción (si está en prueba) */}
      {is_trial && !trial_expired && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Activar Suscripción
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Puedes activar tu suscripción en cualquier momento. El precio se calculará según 
            la cantidad de usuarios que tengas actualmente.
          </p>
          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Precio estimado para {current_users} usuario{current_users !== 1 ? 's' : ''}:
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${subscriptionStatus.price_per_month > 0 
                ? subscriptionStatus.price_per_month.toFixed(2)
                : 'Calculando...'}
            </p>
          </div>
          <button
            onClick={handleActivateSubscription}
            disabled={activating}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {activating ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Activando...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Activar Suscripción Ahora
              </>
            )}
          </button>
        </div>
      )}

      {/* Información Adicional */}
      <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Información Importante
        </h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>• Durante la prueba gratuita, puedes tener hasta 10 usuarios.</li>
          <li>• El precio de la suscripción se calcula según la cantidad de usuarios.</li>
          <li>• La suscripción se renueva automáticamente cada mes.</li>
          <li>• Puedes agregar más usuarios en cualquier momento, el precio se ajustará automáticamente.</li>
        </ul>
      </div>
    </div>
  );
}

