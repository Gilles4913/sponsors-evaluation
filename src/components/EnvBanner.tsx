import { useBackendEnv } from '../hooks/useBackendEnv';

export function EnvBanner() {
  const { projectId, backendName, supabaseUrl } = useBackendEnv();

  const truncatedUrl = supabaseUrl.length > 50
    ? supabaseUrl.substring(0, 47) + '...'
    : supabaseUrl;

  return (
    <div className="sticky top-0 z-50 bg-slate-800 text-white px-4 py-2 text-sm shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <span>
          <strong>Backend:</strong> {projectId}
          {backendName && <span> ({backendName})</span>} – {truncatedUrl}
        </span>
      </div>
    </div>
  );
}
