import { X, Shield } from 'lucide-react';

interface RGPDModalProps {
  isOpen: boolean;
  onClose: () => void;
  rgpdContent: string;
  tenantName?: string;
}

export function RGPDModal({ isOpen, onClose, rgpdContent, tenantName }: RGPDModalProps) {
  if (!isOpen) return null;

  const renderMarkdown = (markdown: string): string => {
    if (!markdown) return '<p class="text-slate-400">Aucun contenu RGPD disponible</p>';

    return markdown
      .split('\n')
      .map((line) => {
        if (line.startsWith('# ')) {
          return `<h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-4">${line.slice(2)}</h1>`;
        } else if (line.startsWith('## ')) {
          return `<h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-3 mt-6">${line.slice(3)}</h2>`;
        } else if (line.startsWith('### ')) {
          return `<h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-2 mt-4">${line.slice(4)}</h3>`;
        } else if (line.startsWith('- ')) {
          return `<li class="ml-4 text-slate-700 dark:text-slate-300 mb-1">${line.slice(2)}</li>`;
        } else if (line.startsWith('**') && line.endsWith('**')) {
          return `<p class="font-bold text-slate-900 dark:text-white mb-2">${line.slice(2, -2)}</p>`;
        } else if (line.trim() === '') {
          return '<br>';
        } else {
          const processed = line
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
          return `<p class="text-slate-700 dark:text-slate-300 mb-2">${processed}</p>`;
        }
      })
      .join('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        data-testid="rgpd-modal"
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Protection des données (RGPD)
              </h2>
              {tenantName && (
                <p className="text-sm text-slate-600 dark:text-slate-400">{tenantName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 dark:hover:bg-slate-700 rounded-lg transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div
            className="prose prose-slate dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(rgpdContent) }}
          />
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end bg-slate-50 dark:bg-slate-900">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
