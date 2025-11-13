import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ ok: false, message: 'Missing token' });

    const sbUser = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: me } = await sbUser.auth.getUser();
    if (!me?.user?.id) return res.status(401).json({ ok: false, message: 'Invalid session' });

    const { data: roleRow, error: roleErr } = await sbUser
      .from('app_users').select('role').eq('id', me.user.id).single();
    if (roleErr || roleRow?.role !== 'super_admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden: super_admin only' });
    }

    const { admin_email } = req.body || {};
    if (!admin_email) return res.status(400).json({ ok: false, message: 'admin_email required' });

    const sbAdmin = createClient(URL, SERVICE);

    const existing = await sbAdmin.auth.admin.listUsers({ page: 1, perPage: 1, email: admin_email } as any);
    if (existing.error) return res.status(400).json({ ok: false, message: existing.error.message });

    if (!existing.data.users?.length) {
      const created = await sbAdmin.auth.admin.createUser({
        email: admin_email,
        email_confirm: false,
        app_metadata: { role: 'club_admin' }
      });
      if (created.error) return res.status(400).json({ ok: false, message: created.error.message });
      return res.status(200).json({ ok: true, created: true });
    } else {
      const invited = await sbAdmin.auth.admin.inviteUserByEmail?.(admin_email);
      if (invited && invited.error) {
        const rec = await sbAdmin.auth.admin.generateLink({ type: 'recovery', email: admin_email });
        if (rec.error) return res.status(400).json({ ok: false, message: rec.error.message });
      }
      return res.status(200).json({ ok: true, invited: true });
    }
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || 'Server error' });
  }
}
