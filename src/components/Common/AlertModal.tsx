import { AlertCircle, CheckCircle, XCircle, Info, X } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
}: AlertModalProps) {
  if (!isOpen) return null;

  const typeStyles = {
    success: {
      icon: CheckCircle,
      iconColor: 'text-green-600 dark:text-green-400',
      iconBg: 'bg-green-100 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
    },
    error: {
      icon: XCircle,
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
    },
    warning: {
      icon: AlertCircle,
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
  };

  const style = typeStyles[type];
  const Icon = style.icon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 border ${style.borderColor} animate-in zoom-in-95 duration-200`}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full ${style.iconBg} flex items-center justify-center shadow-sm`}>
              <Icon className={`w-7 h-7 ${style.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                {message}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors shadow-sm hover:shadow-md"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}







