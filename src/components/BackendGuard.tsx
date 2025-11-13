import { useBackendEnv } from '../hooks/useBackendEnv';
import { AlertTriangle } from 'lucide-react';

export function BackendGuard({ children }: { children: React.ReactNode }) {
  const { isProduction, isCorrectBackend, projectId } = useBackendEnv();

  if (isProduction && !isCorrectBackend) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-red-600 p-3 rounded-xl">
              <AlertTriangle className="w-12 h-12 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-red-900 mb-4">
            Mauvais backend détecté
          </h1>

          <p className="text-slate-700 mb-4">
            Le projet est configuré avec le mauvais backend Supabase.
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left mb-6">
            <p className="text-sm text-red-800 mb-2">
              <strong>Backend actuel:</strong> {projectId}
            </p>
            <p className="text-sm text-red-800">
              <strong>Backend attendu:</strong> umjewxduvqehqzepuwby
            </p>
          </div>

          <p className="text-sm text-slate-600">
            Vérifie ton fichier <code className="bg-slate-100 px-2 py-1 rounded">.env.production</code> et redéploie l'application avec les bonnes variables d'environnement.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
