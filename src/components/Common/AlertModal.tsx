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
      iconColor: 'text-white',
      iconBg: 'bg-gradient-to-br from-green-500 to-emerald-600',
      borderColor: 'border-green-300 dark:border-green-600',
      buttonBg: 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700',
      glowColor: 'shadow-green-500/20',
    },
    error: {
      icon: XCircle,
      iconColor: 'text-white',
      iconBg: 'bg-gradient-to-br from-red-500 to-rose-600',
      borderColor: 'border-red-300 dark:border-red-600',
      buttonBg: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700',
      glowColor: 'shadow-red-500/20',
    },
    warning: {
      icon: AlertCircle,
      iconColor: 'text-white',
      iconBg: 'bg-gradient-to-br from-yellow-500 to-amber-600',
      borderColor: 'border-yellow-300 dark:border-yellow-600',
      buttonBg: 'bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700',
      glowColor: 'shadow-yellow-500/20',
    },
    info: {
      icon: Info,
      iconColor: 'text-white',
      iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      borderColor: 'border-blue-300 dark:border-blue-600',
      buttonBg: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700',
      glowColor: 'shadow-blue-500/20',
    },
  };

  const style = typeStyles[type];
  const Icon = style.icon;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
      <div 
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 border-2 ${style.borderColor} relative overflow-hidden ${style.glowColor} shadow-2xl`}
        style={{
          animation: 'modalEnter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Efecto de brillo sutil */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none"></div>
        
        <div className="p-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-16 h-16 rounded-2xl ${style.iconBg} flex items-center justify-center shadow-lg transform transition-transform hover:scale-110 animate-pulse`}>
              <Icon className={`w-8 h-8 ${style.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                {title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                {message}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg hover:scale-110"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className={`px-6 py-3 text-sm font-semibold text-white ${style.buttonBg} rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95`}
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}







