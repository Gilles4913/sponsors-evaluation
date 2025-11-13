import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const url = process.env.VITE_SUPABASE_URL!;
const anon = process.env.VITE_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const resendKey = process.env.RESEND_API_KEY!;
const baseUrl = process.env.VITE_PUBLIC_BASE_URL || 'http://localhost:3000';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ ok: false, message: 'Missing token' });

    const sbUser = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: me } = await sbUser.auth.getUser();
    const uid = me?.user?.id;
    if (!uid) return res.status(401).json({ ok: false, message: 'Invalid session' });

    const { data: roleRow, error: roleErr } = await sbUser
      .from('app_users')
      .select('role')
      .eq('id', uid)
      .single();
    if (roleErr || roleRow?.role !== 'super_admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden: super_admin only' });
    }

    const { name, email_contact, admin_email, phone, address } = req.body || {};
    if (!name || !admin_email) return res.status(400).json({ ok: false, message: 'name and admin_email required' });

    const sbAdmin = createClient(url, service);

    const { data: tenant } = await sbAdmin
      .from('tenants')
      .upsert({
        name,
        email_contact: email_contact || null,
        phone: phone || null,
        address: address || null,
        status: 'active',
      }, { onConflict: 'name' })
      .select('id,name,email_contact')
      .single();

    const { data: existing } = await sbAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 } as any);
    const existingUser = existing?.users?.find((u: any) => u.email === admin_email);
    let auth_uid = existingUser?.id;

    if (!auth_uid) {
      const created = await sbAdmin.auth.admin.createUser({
        email: admin_email,
        email_confirm: false,
        app_metadata: { role: 'club_admin' },
      });
      if (created.error) return res.status(400).json({ ok: false, message: created.error.message });
      auth_uid = created.data.user?.id;
    } else {
      await sbAdmin.auth.admin.updateUserById(auth_uid, { app_metadata: { role: 'club_admin' } });
    }

    const { error: upErr } = await sbAdmin
      .from('app_users')
      .upsert({ id: auth_uid, email: admin_email, role: 'club_admin', tenant_id: tenant.id }, { onConflict: 'id' });
    if (upErr) return res.status(400).json({ ok: false, message: upErr.message });

    try {
      if (resendKey) {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: 'noreply@notifications.a2display.fr',
          to: admin_email,
          subject: `Bienvenue — Accès admin pour ${tenant.name}`,
          html: `<p>Bonjour,</p>
                 <p>Un compte administrateur vous a été créé pour <b>${tenant.name}</b>.</p>
                 <p>Activez votre accès depuis l'email d'invitation Supabase puis connectez-vous&nbsp;:
                 <a href="${baseUrl}/login">${baseUrl}/login</a></p>
                 <p>Contact du club : ${tenant.email_contact || '—'}</p>`,
          reply_to: tenant.email_contact || 'contact@a2display.fr',
        });
      }
    } catch (e) {
      console.error('Resend error:', e);
    }

    res.status(200).json({ ok: true, tenant_id: tenant.id, admin_user_id: auth_uid });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, message: e?.message || 'Server error' });
  }
}
