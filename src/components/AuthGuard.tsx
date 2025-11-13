import { ReactNode, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AuthGuardProps {
  children: ReactNode;
  allow?: string[];
  redirect?: string;
  fallback?: ReactNode;
}

export default function AuthGuard({
  children,
  allow,
  redirect = '/login',
  fallback = null
}: AuthGuardProps) {
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = redirect;
    }
  }, [user, loading, redirect]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Vérification des permissions...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (allow && allow.length > 0) {
    const userRole = profile?.role || '';
    const hasPermission = allow.includes(userRole);

    if (!hasPermission) {
      if (fallback) {
        return <>{fallback}</>;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Accès refusé
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Rôle requis : <span className="font-semibold text-gray-900 dark:text-white">{allow.join(', ')}</span>
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Votre rôle : <span className="font-semibold text-gray-900 dark:text-white">{userRole || 'Non défini'}</span>
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
