/**
 * Componente de Checkout de Mercado Pago
 * Maneja el proceso de pago con Mercado Pago Checkout Pro
 */

import { useEffect, useState } from 'react';
import { X, CreditCard, AlertCircle } from 'lucide-react';
import { createPaymentPreference, getMercadoPagoPublicKey, CreatePaymentPreferenceParams } from '../../lib/mercadoPago';

interface MercadoPagoCheckoutProps {
  onClose: () => void;
  onSuccess: () => void;
  params: CreatePaymentPreferenceParams;
}

export function MercadoPagoCheckout({ onClose, onSuccess, params }: MercadoPagoCheckoutProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    const initializeCheckout = async () => {
      try {
        setLoading(true);
        setError(null);

        // Crear preferencia de pago
        const preference = await createPaymentPreference(params);
        
        // Usar sandbox_init_point para testing (o init_point como fallback)
        const url = preference.sandbox_init_point || preference.init_point;
        setCheckoutUrl(url);
        setLoading(false);

        // Redirigir automáticamente al checkout de Mercado Pago
        if (url) {
          window.location.href = url;
        }
      } catch (err: any) {
        console.error('Error initializing checkout:', err);
        setError(err.message || 'Error al inicializar el checkout');
        setLoading(false);
      }
    };

    initializeCheckout();
  }, [params]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Procesando Pago
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Redirigiendo a Mercado Pago...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Error en el Pago
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Error</p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null; // El componente redirige automáticamente
}

