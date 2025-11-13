import html2pdf from 'html2pdf.js';
import { supabase } from './supabase';
import type { Database } from './database.types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Pledge = Database['public']['Tables']['pledges']['Row'];
type Sponsor = Database['public']['Tables']['sponsors']['Row'];

interface PledgeWithSponsor extends Pledge {
  sponsors?: Sponsor;
}

interface ExportStats {
  total_pledged: number;
  yes_count: number;
  maybe_count: number;
  no_count: number;
  progress_percentage: number;
}

export function exportToCsv(
  campaign: Campaign,
  pledges: PledgeWithSponsor[]
): void {
  const headers = [
    'Entreprise',
    'Contact',
    'Email',
    'Téléphone',
    'Réponse',
    'Montant (€)',
    'Commentaire',
    'Source',
    'Date',
  ];

  const rows = pledges.map((pledge) => {
    const sponsor = pledge.sponsors;
    return [
      sponsor?.company || '',
      sponsor?.contact_name || '',
      sponsor?.email || '',
      sponsor?.phone || '',
      pledge.status === 'yes' ? 'Oui' : pledge.status === 'maybe' ? 'Peut-être' : pledge.status === 'no' ? 'Non' : 'En attente',
      pledge.amount?.toString() || '0',
      pledge.comment || '',
      pledge.source || 'invite',
      new Date(pledge.created_at || '').toLocaleDateString('fr-FR'),
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${sanitizeFilename(campaign.title)}_pledges_${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportToPdfWithStorage(
  campaign: Campaign,
  pledges: PledgeWithSponsor[],
  stats: ExportStats,
  tenantId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const element = createPdfElement(campaign, pledges, stats);
    document.body.appendChild(element);

    const opt = {
      margin: 10,
      filename: `${sanitizeFilename(campaign.title)}_report_${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    const pdfBlob = await html2pdf().set(opt).from(element).output('blob');

    document.body.removeChild(element);

    const filename = `${tenantId}/${campaign.id}/report_${Date.now()}.pdf`;

    const { data, error } = await supabase.storage
      .from('club_exports')
      .upload(filename, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      console.error('Storage error:', error);
      downloadBlob(pdfBlob, opt.filename);
      return {
        success: false,
        error: 'Erreur de stockage, fichier téléchargé localement',
      };
    }

    const { data: urlData } = supabase.storage.from('club_exports').getPublicUrl(filename);

    return {
      success: true,
      url: urlData.publicUrl,
    };
  } catch (error: any) {
    console.error('Export error:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la génération du PDF',
    };
  }
}

export async function exportToPdfLocal(
  campaign: Campaign,
  pledges: PledgeWithSponsor[],
  stats: ExportStats
): Promise<void> {
  const element = createPdfElement(campaign, pledges, stats);
  document.body.appendChild(element);

  const opt = {
    margin: 10,
    filename: `${sanitizeFilename(campaign.title)}_report_${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  await html2pdf().set(opt).from(element).save();

  document.body.removeChild(element);
}

function createPdfElement(
  campaign: Campaign,
  pledges: PledgeWithSponsor[],
  stats: ExportStats
): HTMLElement {
  const container = document.createElement('div');
  container.style.width = '210mm';
  container.style.padding = '20mm';
  container.style.backgroundColor = '#ffffff';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.color = '#1e293b';
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';

  container.innerHTML = `
    <div style="border-bottom: 4px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px;">
      <h1 style="color: #1e40af; font-size: 32px; margin: 0 0 10px 0; font-weight: bold;">
        ${escapeHtml(campaign.title)}
      </h1>
      <div style="color: #64748b; font-size: 14px; line-height: 1.8;">
        <p style="margin: 5px 0;"><strong>Rapport généré le:</strong> ${new Date().toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}</p>
        ${campaign.location ? `<p style="margin: 5px 0;"><strong>Localisation:</strong> ${escapeHtml(campaign.location)}</p>` : ''}
        ${campaign.deadline ? `<p style="margin: 5px 0;"><strong>Date limite:</strong> ${new Date(campaign.deadline).toLocaleDateString('fr-FR')}</p>` : ''}
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 25px 0;">
      <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="font-size: 12px; color: rgba(255,255,255,0.9); text-transform: uppercase; font-weight: 600; margin-bottom: 8px;">Total promis</div>
        <div style="font-size: 36px; font-weight: bold; color: white; margin-bottom: 5px;">
          ${stats.total_pledged.toLocaleString('fr-FR')}€
        </div>
        <div style="font-size: 11px; color: rgba(255,255,255,0.8);">
          sur ${campaign.objective_amount.toLocaleString('fr-FR')}€
        </div>
      </div>

      <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="font-size: 12px; color: rgba(255,255,255,0.9); text-transform: uppercase; font-weight: 600; margin-bottom: 8px;">Taux d'atteinte</div>
        <div style="font-size: 36px; font-weight: bold; color: white;">
          ${stats.progress_percentage.toFixed(1)}%
        </div>
      </div>

      <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="font-size: 12px; color: rgba(255,255,255,0.9); text-transform: uppercase; font-weight: 600; margin-bottom: 8px;">Total réponses</div>
        <div style="font-size: 36px; font-weight: bold; color: white;">
          ${pledges.length}
        </div>
      </div>
    </div>

    <div style="display: flex; justify-content: space-around; margin: 20px 0; padding: 20px; background: #f8fafc; border-radius: 12px;">
      <div style="text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #10b981;">${stats.yes_count}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 5px;">Oui</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #f59e0b;">${stats.maybe_count}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 5px;">Peut-être</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #ef4444;">${stats.no_count}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 5px;">Non</div>
      </div>
    </div>

    <div style="margin-top: 30px;">
      <h2 style="color: #1e40af; font-size: 20px; margin-bottom: 15px; font-weight: bold;">
        Détail des promesses
      </h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background: #1e40af; color: white;">
            <th style="padding: 10px 8px; text-align: left; font-weight: 600;">Entreprise</th>
            <th style="padding: 10px 8px; text-align: left; font-weight: 600;">Contact</th>
            <th style="padding: 10px 8px; text-align: center; font-weight: 600;">Réponse</th>
            <th style="padding: 10px 8px; text-align: right; font-weight: 600;">Montant</th>
            <th style="padding: 10px 8px; text-align: center; font-weight: 600;">Date</th>
          </tr>
        </thead>
        <tbody>
          ${pledges
            .map((pledge, idx) => {
              const sponsor = pledge.sponsors;
              const statusBg =
                pledge.status === 'yes'
                  ? '#d1fae5'
                  : pledge.status === 'maybe'
                  ? '#fef3c7'
                  : '#fee2e2';
              const statusColor =
                pledge.status === 'yes'
                  ? '#065f46'
                  : pledge.status === 'maybe'
                  ? '#92400e'
                  : '#991b1b';
              const statusLabel =
                pledge.status === 'yes' ? 'Oui' : pledge.status === 'maybe' ? 'Peut-être' : 'Non';

              return `
                <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 8px;">
                    <strong style="color: #1e293b;">${escapeHtml(sponsor?.company || 'N/A')}</strong>
                  </td>
                  <td style="padding: 10px 8px;">
                    <div style="color: #1e293b;">${escapeHtml(sponsor?.contact_name || 'N/A')}</div>
                    <div style="color: #64748b; font-size: 10px;">${escapeHtml(sponsor?.email || '')}</div>
                  </td>
                  <td style="padding: 10px 8px; text-align: center;">
                    <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 10px; background: ${statusBg}; color: ${statusColor};">
                      ${statusLabel}
                    </span>
                  </td>
                  <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #059669;">
                    ${(pledge.amount || 0).toLocaleString('fr-FR')}€
                  </td>
                  <td style="padding: 10px 8px; text-align: center; color: #64748b;">
                    ${new Date(pledge.created_at || '').toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>

    ${
      pledges.some((p) => p.comment)
        ? `
      <div style="margin-top: 30px; page-break-before: auto;">
        <h2 style="color: #1e40af; font-size: 20px; margin-bottom: 15px; font-weight: bold;">
          Commentaires
        </h2>
        ${pledges
          .filter((p) => p.comment)
          .map(
            (pledge) => `
            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #3b82f6;">
              <div style="font-weight: 600; color: #1e293b; margin-bottom: 5px; font-size: 12px;">
                ${escapeHtml(pledge.sponsors?.company || 'N/A')}
              </div>
              <div style="color: #475569; font-size: 11px; line-height: 1.6;">
                ${escapeHtml(pledge.comment || '')}
              </div>
            </div>
          `
          )
          .join('')}
      </div>
    `
        : ''
    }

    <div style="margin-top: 40px; padding-top: 15px; border-top: 2px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 10px;">
      <p>Document généré automatiquement - ${new Date().toLocaleString('fr-FR')}</p>
    </div>
  `;

  return container;
}

function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()
    .substring(0, 50);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
