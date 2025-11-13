import { useState } from 'react';
import { HardDrive, CheckCircle, XCircle, AlertTriangle, Play, FolderOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Layout } from './Layout';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  error?: string;
  url?: string;
}

interface BucketCheck {
  name: string;
  exists: boolean;
  tests: TestResult[];
}

interface StorageReport {
  buckets: BucketCheck[];
  timestamp: string;
}

export function StorageChecker() {
  const toast = useToast();
  const [testing, setTesting] = useState(false);
  const [report, setReport] = useState<StorageReport | null>(null);

  const generateTestImage = (): Blob => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, 0, 100, 100);
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText('TEST', 25, 55);
    }

    return new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob || new Blob());
      }, 'image/png');
    }) as unknown as Blob;
  };

  const generateTestPdf = (): Blob => {
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000317 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
410
%%EOF`;

    return new Blob([pdfContent], { type: 'application/pdf' });
  };

  const testClubPublicBucket = async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    const testFileName = `test-${Date.now()}.png`;
    const testPath = `test/${testFileName}`;

    try {
      const imageBlob = generateTestImage();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('club_public')
        .upload(testPath, imageBlob, {
          contentType: 'image/png',
          upsert: true,
        });

      results.push({
        name: 'Upload image dans club_public',
        success: !uploadError && !!uploadData,
        message: uploadError
          ? `Échec: ${uploadError.message}`
          : `Succès: Image uploadée (${testPath})`,
        error: uploadError?.message,
      });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from('club_public')
          .getPublicUrl(testPath);

        const isValidUrl = urlData.publicUrl && urlData.publicUrl.startsWith('http');

        results.push({
          name: 'Récupération URL publique',
          success: isValidUrl,
          message: isValidUrl
            ? `Succès: URL publique générée`
            : 'Échec: URL publique invalide',
          url: urlData.publicUrl,
        });

        await supabase.storage
          .from('club_public')
          .remove([testPath]);
      } else {
        results.push({
          name: 'Récupération URL publique',
          success: false,
          message: 'Non testé: Upload a échoué',
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      results.push({
        name: 'Upload image dans club_public',
        success: false,
        message: `Exception: ${error.message}`,
        error: error.message,
      });
      results.push({
        name: 'Récupération URL publique',
        success: false,
        message: 'Non testé: Exception lors de l\'upload',
      });
    }

    return results;
  };

  const testClubExportsBucket = async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    const testFileName = `test-${Date.now()}.pdf`;
    const testPath = `exports/${testFileName}`;

    try {
      const pdfBlob = generateTestPdf();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('club_exports')
        .upload(testPath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      results.push({
        name: 'Upload PDF dans club_exports',
        success: !uploadError && !!uploadData,
        message: uploadError
          ? `Échec: ${uploadError.message}`
          : `Succès: PDF uploadé (${testPath})`,
        error: uploadError?.message,
      });

      if (!uploadError && uploadData) {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('club_exports')
          .createSignedUrl(testPath, 60);

        const isValidUrl = signedUrlData?.signedUrl && signedUrlData.signedUrl.startsWith('http');

        results.push({
          name: 'Génération URL signée (60s)',
          success: !signedUrlError && isValidUrl,
          message: signedUrlError
            ? `Échec: ${signedUrlError.message}`
            : isValidUrl
              ? 'Succès: URL signée générée (expire dans 60s)'
              : 'Échec: URL signée invalide',
          error: signedUrlError?.message,
          url: signedUrlData?.signedUrl,
        });

        await supabase.storage
          .from('club_exports')
          .remove([testPath]);
      } else {
        results.push({
          name: 'Génération URL signée (60s)',
          success: false,
          message: 'Non testé: Upload a échoué',
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      results.push({
        name: 'Upload PDF dans club_exports',
        success: false,
        message: `Exception: ${error.message}`,
        error: error.message,
      });
      results.push({
        name: 'Génération URL signée (60s)',
        success: false,
        message: 'Non testé: Exception lors de l\'upload',
      });
    }

    return results;
  };

  const runStorageTests = async () => {
    setTesting(true);
    try {
      const { data: bucketsData, error: bucketsError } = await supabase.storage.listBuckets();

      if (bucketsError) {
        toast.error(`Erreur lors de la récupération des buckets: ${bucketsError.message}`);
        setTesting(false);
        return;
      }

      const bucketsList = bucketsData || [];
      const publicBucketExists = bucketsList.some(b => b.name === 'club_public');
      const exportsBucketExists = bucketsList.some(b => b.name === 'club_exports');

      const buckets: BucketCheck[] = [];

      if (publicBucketExists) {
        const tests = await testClubPublicBucket();
        buckets.push({
          name: 'club_public',
          exists: true,
          tests,
        });
      } else {
        buckets.push({
          name: 'club_public',
          exists: false,
          tests: [{
            name: 'Existence bucket',
            success: false,
            message: 'Bucket club_public introuvable',
          }],
        });
      }

      if (exportsBucketExists) {
        const tests = await testClubExportsBucket();
        buckets.push({
          name: 'club_exports',
          exists: true,
          tests,
        });
      } else {
        buckets.push({
          name: 'club_exports',
          exists: false,
          tests: [{
            name: 'Existence bucket',
            success: false,
            message: 'Bucket club_exports introuvable',
          }],
        });
      }

      const newReport: StorageReport = {
        buckets,
        timestamp: new Date().toISOString(),
      };

      setReport(newReport);
      toast.success('Tests de stockage terminés');
    } catch (error) {
      toast.error('Erreur lors des tests de stockage');
      console.error(error);
    } finally {
      setTesting(false);
    }
  };

  const getTestIcon = (success: boolean) => {
    return success ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />;
  };

  const allTestsOk = report?.buckets.every(b => b.exists && b.tests.every(t => t.success)) ?? false;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <HardDrive className="w-8 h-8 text-blue-600" />
                Vérificateur de Stockage
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Vérifie l'existence et le bon fonctionnement des buckets Supabase Storage
              </p>
            </div>
            <button
              onClick={runStorageTests}
              disabled={testing}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className={`w-5 h-5 ${testing ? 'animate-pulse' : ''}`} />
              {testing ? 'Test en cours...' : 'Exécuter les tests'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <FolderOpen className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  club_public
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Bucket public pour logos et images
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <p className="font-medium">Tests effectués:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Vérification existence bucket</li>
                <li>Upload image de test (PNG)</li>
                <li>Récupération URL publique</li>
                <li>Nettoyage fichier test</li>
              </ul>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <FolderOpen className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  club_exports
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Bucket privé pour exports PDF
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <p className="font-medium">Tests effectués:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Vérification existence bucket</li>
                <li>Upload PDF de test</li>
                <li>Génération URL signée (60s)</li>
                <li>Nettoyage fichier test</li>
              </ul>
            </div>
          </div>
        </div>

        {report && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {allTestsOk ? (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      Tous les tests réussis
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-6 h-6 text-yellow-600" />
                      Problèmes détectés
                    </>
                  )}
                </h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {new Date(report.timestamp).toLocaleString('fr-FR')}
                </span>
              </div>

              <div className="space-y-6">
                {report.buckets.map((bucket) => {
                  const allBucketTestsOk = bucket.exists && bucket.tests.every(t => t.success);

                  return (
                    <div
                      key={bucket.name}
                      data-testid={bucket.name === 'club_public' ? 'bucket-public-ok' : 'bucket-exports-ok'}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {bucket.exists ? (
                            <FolderOpen className="w-6 h-6 text-blue-600" />
                          ) : (
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                          )}
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-white font-mono">
                              {bucket.name}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {bucket.exists ? 'Bucket trouvé' : 'Bucket manquant'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded text-sm font-medium ${
                          allBucketTestsOk
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {allBucketTestsOk ? 'OK' : 'Erreur'}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {bucket.tests.map((test, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getTestIcon(test.success)}
                                <span className="font-medium text-slate-900 dark:text-white text-sm">
                                  {test.name}
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                test.success
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {test.success ? 'Succès' : 'Échec'}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">
                              {test.message}
                            </p>
                            {test.url && (
                              <div className="mt-2 ml-7">
                                <a
                                  href={test.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all font-mono"
                                >
                                  {test.url}
                                </a>
                              </div>
                            )}
                            {test.error && (
                              <div className="mt-2 ml-7 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs font-mono text-red-700 dark:text-red-300">
                                {test.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {!allTestsOk && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-2">
                      Actions recommandées
                    </h3>
                    <ul className="space-y-1 text-sm text-orange-800 dark:text-orange-300">
                      {report.buckets.some(b => !b.exists) && (
                        <li>• Créer les buckets manquants dans Supabase Dashboard → Storage</li>
                      )}
                      {report.buckets.some(b => b.tests.some(t => t.error?.includes('permission'))) && (
                        <li>• Vérifier les politiques RLS sur les buckets (policies)</li>
                      )}
                      {report.buckets.some(b => b.tests.some(t => t.error?.includes('unauthorized'))) && (
                        <li>• Vérifier que l'utilisateur a les permissions nécessaires</li>
                      )}
                      <li>• Consulter les logs Supabase pour plus de détails</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!report && !testing && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-12 text-center">
            <HardDrive className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Aucun test effectué
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Cliquez sur "Exécuter les tests" pour vérifier le stockage
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
