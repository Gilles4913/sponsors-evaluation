import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ExportPdfRequest {
  campaign_id: string;
  html_content: string;
  filename?: string;
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { 
      campaign_id, 
      html_content, 
      filename = `campaign-${campaign_id}-${Date.now()}.pdf`,
      format = 'a4',
      orientation = 'portrait'
    }: ExportPdfRequest = await req.json();

    if (!campaign_id || !html_content) {
      throw new Error('campaign_id and html_content are required');
    }

    const { data: userProfile } = await supabaseClient
      .from('app_users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userProfile?.tenant_id) {
      throw new Error('User tenant not found');
    }

    const { data: campaign } = await supabaseClient
      .from('campaigns')
      .select('id, tenant_id, title')
      .eq('id', campaign_id)
      .eq('tenant_id', userProfile.tenant_id)
      .single();

    if (!campaign) {
      throw new Error('Campaign not found or access denied');
    }

    const sanitizedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${campaign.title} - Export PDF</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12pt;
              line-height: 1.6;
              color: #333;
              padding: 20mm;
            }
            h1 { 
              font-size: 24pt; 
              margin-bottom: 10pt; 
              color: #1a1a1a; 
              page-break-after: avoid;
            }
            h2 { 
              font-size: 18pt; 
              margin-top: 15pt; 
              margin-bottom: 8pt; 
              color: #333; 
              page-break-after: avoid;
            }
            h3 { 
              font-size: 14pt; 
              margin-top: 10pt; 
              margin-bottom: 6pt; 
              color: #555; 
              page-break-after: avoid;
            }
            p { 
              margin-bottom: 8pt; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 10pt 0; 
              page-break-inside: avoid;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 8pt; 
              text-align: left; 
            }
            th { 
              background-color: #f5f5f5; 
              font-weight: bold; 
            }
            .header { 
              text-align: center; 
              margin-bottom: 20pt; 
            }
            .footer { 
              margin-top: 20pt; 
              padding-top: 10pt; 
              border-top: 1px solid #ddd; 
              font-size: 10pt; 
              color: #666; 
            }
            .page-break { 
              page-break-before: always; 
            }
            @page {
              size: ${format} ${orientation};
              margin: 10mm;
            }
            @media print {
              body { 
                padding: 0; 
              }
              .no-print { 
                display: none; 
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${campaign.title}</h1>
            <p>Export généré le ${new Date().toLocaleString('fr-FR')}</p>
          </div>
          
          ${html_content}
          
          <div class="footer">
            <p><strong>Document généré automatiquement</strong></p>
            <p>Campagne: ${campaign.title} | ID: ${campaign.id}</p>
            <p>Date: ${new Date().toLocaleString('fr-FR')}</p>
          </div>
        </body>
      </html>
    `;

    console.log('HTML content prepared for PDF generation');

    const htmlBuffer = new TextEncoder().encode(sanitizedHtml);
    const htmlFilename = filename.replace('.pdf', '.html');
    const storagePath = `${userProfile.tenant_id}/exports/${htmlFilename}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('club_exports')
      .upload(storagePath, htmlBuffer, {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) {
      throw new Error('Failed to upload HTML: ' + uploadError.message);
    }

    const { data: { publicUrl } } = supabaseClient.storage
      .from('club_exports')
      .getPublicUrl(storagePath);

    const response = {
      success: true,
      message: 'HTML prepared for PDF generation',
      html_url: publicUrl,
      storage_path: storagePath,
      campaign_id: campaign.id,
      campaign_title: campaign.title,
      note: 'HTML file generated and stored. Use browser Print to PDF or external PDF service.',
      usage: {
        browser: 'Open html_url in browser, press Ctrl+P (or Cmd+P), and select "Save as PDF"',
        api: 'POST html_url to a PDF generation service (e.g., Puppeteer, WeasyPrint, PDFShift)',
        client: 'Use html2pdf.js or similar library on the frontend to convert',
      },
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      }
    );
  }
});
