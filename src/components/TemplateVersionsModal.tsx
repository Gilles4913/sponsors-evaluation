import { useState, useEffect } from 'react';
import { X, History, RotateCcw, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TemplateVersion {
  id: string;
  template_id: string;
  template_type: string;
  subject: string;
  html_body: string;
  text_body: string;
  placeholders: string[];
  is_active: boolean;
  version_number: number;
  changed_by: string | null;
  created_at: string;
}

interface TemplateVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  templateType: string;
  onRollback: (version: TemplateVersion) => Promise<void>;
}

export function TemplateVersionsModal({
  isOpen,
  onClose,
  templateId,
  templateType,
  onRollback,
}: TemplateVersionsModalProps) {
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<TemplateVersion | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen && templateId) {
      fetchVersions();
    }
  }, [isOpen, templateId]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_template_versions')
        .select('*')
        .eq('template_id', templateId)
        .order('version_number', { ascending: false })
        .limit(5);

      if (error) throw error;

      setVersions(
        (data || []).map((v) => ({
          ...v,
          placeholders: Array.isArray(v.placeholders)
            ? v.placeholders
            : JSON.parse(v.placeholders || '[]'),
        }))
      );
    } catch (error) {
      console.error('Error fetching versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (version: TemplateVersion) => {
    const confirmed = confirm(
      `Restaurer la version ${version.version_number} ?\n\nCela remplacera le sujet et le contenu HTML actuels par cette version.`
    );

    if (!confirmed) return;

    try {
      await onRollback(version);
      onClose();
    } catch (error) {
      console.error('Error during rollback:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-2 rounded-lg">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Historique des versions
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Template : {templateType}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-600 dark:text-slate-400">
              Chargement de l'historique...
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                Aucune version disponible
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                Les versions sont créées automatiquement lors des modifications
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className={`bg-slate-50 dark:bg-slate-900 border rounded-lg p-4 transition ${
                    index === 0
                      ? 'border-green-300 dark:border-green-700'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          Version {version.version_number}
                        </h3>
                        {index === 0 && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-medium">
                            Version actuelle
                          </span>
                        )}
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            version.is_active
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {version.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        <strong>Sujet :</strong> {version.subject}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(version.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedVersion(version);
                          setShowPreview(true);
                        }}
                        className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition text-sm"
                      >
                        Prévisualiser
                      </button>
                      {index > 0 && (
                        <button
                          onClick={() => handleRollback(version)}
                          className="flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition text-sm"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Restaurer
                        </button>
                      )}
                    </div>
                  </div>

                  {version.placeholders.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-500 dark:text-slate-500 mb-2">
                        Placeholders ({version.placeholders.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {version.placeholders.slice(0, 8).map((ph, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-mono"
                          >
                            {`{{${ph}}}`}
                          </span>
                        ))}
                        {version.placeholders.length > 8 && (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded text-xs">
                            +{version.placeholders.length - 8}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-white rounded-lg transition"
          >
            Fermer
          </button>
        </div>
      </div>

      {showPreview && selectedVersion && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Prévisualisation - Version {selectedVersion.version_number}
              </h3>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setSelectedVersion(null);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Sujet
                </label>
                <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-slate-900 dark:text-white">
                  {selectedVersion.subject}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Aperçu HTML
                </label>
                <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-4 bg-white dark:bg-slate-900 overflow-auto max-h-96">
                  <div dangerouslySetInnerHTML={{ __html: selectedVersion.html_body }} />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowPreview(false);
                  setSelectedVersion(null);
                }}
                className="px-4 py-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-white rounded-lg transition"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  handleRollback(selectedVersion);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
              >
                <RotateCcw className="w-4 h-4" />
                Restaurer cette version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
