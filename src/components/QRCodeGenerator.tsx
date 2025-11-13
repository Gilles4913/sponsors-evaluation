import { useState, useEffect, useRef } from 'react';
import { X, Download, QrCode, Printer, FileImage, FileDown } from 'lucide-react';
import QRCodeLib from 'qrcode';
import html2pdf from 'html2pdf.js';
import type { Database } from '../lib/database.types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Tenant = Database['public']['Tables']['tenants']['Row'];

interface QRCodeGeneratorProps {
  campaign: Campaign & { tenant?: Tenant };
  onClose: () => void;
}

export function QRCodeGenerator({ campaign, onClose }: QRCodeGeneratorProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flyerRef = useRef<HTMLDivElement>(null);

  const publicUrl = campaign.public_slug
    ? `${window.location.origin}/p/${campaign.public_slug}`
    : '';

  useEffect(() => {
    if (publicUrl) {
      generateQRCode();
    }
  }, [publicUrl, format]);

  const generateQRCode = async () => {
    try {
      if (format === 'png') {
        const dataUrl = await QRCodeLib.toDataURL(publicUrl, {
          width: 512,
          margin: 2,
          color: {
            dark: '#1e293b',
            light: '#ffffff',
          },
        });
        setQrDataUrl(dataUrl);
      } else {
        const svgString = await QRCodeLib.toString(publicUrl, {
          type: 'svg',
          width: 512,
          margin: 2,
          color: {
            dark: '#1e293b',
            light: '#ffffff',
          },
        });
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        setQrDataUrl(url);
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `qr-${campaign.public_slug}.${format}`;
    link.href = qrDataUrl;
    link.click();
  };

  const handlePrintFlyer = () => {
    if (!flyerRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const flyerHtml = flyerRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Flyer - ${campaign.title}</title>
          <style>
            @page {
              size: A6;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              width: 105mm;
              height: 148mm;
              margin: 0;
              padding: 0;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          ${flyerHtml}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleDownloadFlyerPDF = async () => {
    if (!flyerRef.current) return;

    const element = flyerRef.current.cloneNode(true) as HTMLElement;

    const opt = {
      margin: 0,
      filename: `flyer-${campaign.public_slug || campaign.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      },
      jsPDF: {
        unit: 'mm',
        format: 'a6',
        orientation: 'portrait'
      }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const shortUrl = publicUrl.replace(/^https?:\/\//, '').replace(/^www\./, '');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl my-8">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-6 h-6" />
              Générateur QR Code & Flyer
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {campaign.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!publicUrl ? (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <p className="text-sm text-amber-900 dark:text-amber-300">
                Cette campagne n'a pas de slug public configuré. Veuillez d'abord activer le partage
                public dans les paramètres de la campagne.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    QR Code
                  </h3>

                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-6 mb-4 flex items-center justify-center">
                    {qrDataUrl && (
                      <img
                        src={qrDataUrl}
                        alt="QR Code"
                        className="w-64 h-64 rounded-lg shadow-lg"
                      />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Format
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFormat('png')}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                            format === 'png'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          PNG
                        </button>
                        <button
                          onClick={() => setFormat('svg')}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                            format === 'svg'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          SVG
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleDownloadQR}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl font-semibold transition shadow-lg"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger QR Code ({format.toUpperCase()})
                    </button>

                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                        URL publique :
                      </p>
                      <p className="text-sm font-mono text-slate-900 dark:text-white break-all">
                        {publicUrl}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Aperçu Flyer A6
                  </h3>

                  <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4 mb-4 flex items-center justify-center">
                    <div
                      ref={flyerRef}
                      className="bg-white shadow-2xl"
                      style={{
                        width: '105mm',
                        height: '148mm',
                        position: 'relative',
                      }}
                    >
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-between p-8"
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
                        }}
                      >
                        <div className="text-center">
                          <div className="bg-white rounded-2xl p-4 mb-4 inline-block shadow-xl">
                            <QrCode className="w-12 h-12 text-blue-600" />
                          </div>
                          <h1 className="text-white font-bold text-2xl mb-2">
                            {campaign.tenant?.name || 'Club'}
                          </h1>
                          <p className="text-blue-100 text-sm font-medium">
                            Opportunité de sponsoring
                          </p>
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-2xl">
                          {qrDataUrl && (
                            <img
                              src={qrDataUrl}
                              alt="QR Code"
                              className="w-48 h-48 mx-auto"
                            />
                          )}
                        </div>

                        <div className="text-center">
                          <p className="text-white font-bold text-lg mb-2">
                            {campaign.title}
                          </p>
                          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                            <p className="text-white text-xs font-mono break-all">
                              {shortUrl}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={handleDownloadFlyerPDF}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white rounded-xl font-semibold transition shadow-lg"
                    >
                      <FileDown className="w-4 h-4" />
                      Télécharger Flyer PDF
                    </button>

                    <button
                      onClick={handlePrintFlyer}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium transition"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimer
                    </button>

                    <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
                      Format A6 (105 x 148 mm)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex gap-3">
                  <FileImage className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900 dark:text-blue-300">
                    <p className="font-semibold mb-2">Conseils d'utilisation</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Le QR code peut être scanné avec n'importe quel smartphone</li>
                      <li>Format PNG pour intégration dans documents (Word, PowerPoint, etc.)</li>
                      <li>Format SVG pour impression haute qualité et redimensionnement sans perte</li>
                      <li>Le flyer A6 est optimisé pour impression recto simple</li>
                      <li>
                        Pour créer un PDF : Imprimer → Destination : Enregistrer au format PDF
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-6 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
