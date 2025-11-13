import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const success = useCallback((message: string) => showToast('success', message), [showToast]);
  const error = useCallback((message: string) => showToast('error', message), [showToast]);
  const info = useCallback((message: string) => showToast('info', message), [showToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border-2 backdrop-blur-sm transition-all animate-slide-in ${
              toast.type === 'success'
                ? 'bg-green-50/95 dark:bg-green-900/95 border-green-200 dark:border-green-700'
                : toast.type === 'error'
                ? 'bg-red-50/95 dark:bg-red-900/95 border-red-200 dark:border-red-700'
                : 'bg-blue-50/95 dark:bg-blue-900/95 border-blue-200 dark:border-blue-700'
            }`}
          >
            {toast.type === 'success' && (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            )}
            {toast.type === 'error' && (
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            )}
            {toast.type === 'info' && (
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            )}
            <p
              className={`text-sm font-medium flex-1 ${
                toast.type === 'success'
                  ? 'text-green-900 dark:text-green-100'
                  : toast.type === 'error'
                  ? 'text-red-900 dark:text-red-100'
                  : 'text-blue-900 dark:text-blue-100'
              }`}
            >
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
              className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition ${
                toast.type === 'success'
                  ? 'text-green-700 dark:text-green-300'
                  : toast.type === 'error'
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-blue-700 dark:text-blue-300'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
