import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ ok: false, message: 'Missing token' });

    const sbUser = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: me } = await sbUser.auth.getUser();
    if (!me?.user?.id) return res.status(401).json({ ok: false, message: 'Invalid session' });

    const { data: roleRow } = await sbUser
      .from('app_users')
      .select('role')
      .eq('id', me.user.id)
      .single();
    if (roleRow?.role !== 'super_admin')
      return res.status(403).json({ ok: false, message: 'Forbidden' });

    const out: any = { ok: true, service_key_present: !!SERVICE };

    if (!SERVICE) return res.status(200).json(out);

    const sbAdmin = createClient(URL, SERVICE);

    try {
      const listed = await sbAdmin.auth.admin.listUsers({ page: 1, perPage: 1 } as any);
      out.can_list_users = !listed.error;
    } catch {
      out.can_list_users = false;
    }

    try {
      const { count, error } = await sbAdmin
        .from('tenants')
        .select('*', { count: 'exact', head: true });
      out.tenants_count = error ? null : count ?? 0;
    } catch {
      out.tenants_count = null;
    }

    return res.status(200).json(out);
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || 'Server error' });
  }
}
