import { supabase } from './supabase';

interface LoadEmailLogsParams {
  q?: string;
  status?: string;
  tenantId?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface EmailLog {
  id: string;
  created_at: string;
  to_email: string;
  status: string;
  response_json: any;
  user_id: string | null;
  tenant_id: string | null;
  user_label?: string;
  tenant_label?: string;
}

interface LoadEmailLogsResult {
  rows: EmailLog[];
  total: number;
}

export async function loadEmailLogs({
  q,
  status,
  tenantId,
  from,
  to,
  page,
  pageSize,
}: LoadEmailLogsParams): Promise<LoadEmailLogsResult> {
  let base = supabase
    .from('email_test_logs')
    .select('id, created_at, to_email, status, response_json, user_id, tenant_id', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    base = base.eq('status', status);
  }

  if (q) {
    base = base.ilike('to_email', `%${q}%`);
  }

  if (tenantId && tenantId !== 'all') {
    base = base.eq('tenant_id', tenantId);
  }

  if (from) {
    base = base.gte('created_at', from);
  }

  if (to) {
    base = base.lte('created_at', to);
  }

  const fromIdx = page * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  const { data, error, count } = await base.range(fromIdx, toIdx);

  if (error) throw error;

  const rows = data ?? [];

  const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean))) as string[];
  const tenantIds = Array.from(new Set(rows.map(r => r.tenant_id).filter(Boolean))) as string[];

  const usersMap = new Map<string, { email: string; name: string | null }>();
  const tenantsMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: usersData } = await supabase
      .from('app_users')
      .select('id, email, name')
      .in('id', userIds);

    if (usersData) {
      usersData.forEach(user => {
        usersMap.set(user.id, { email: user.email, name: user.name });
      });
    }
  }

  if (tenantIds.length > 0) {
    const { data: tenantsData } = await supabase
      .from('tenants')
      .select('id, name')
      .in('id', tenantIds);

    if (tenantsData) {
      tenantsData.forEach(tenant => {
        tenantsMap.set(tenant.id, tenant.name);
      });
    }
  }

  const truncateId = (id: string | null): string => {
    if (!id) return '—';
    return id.substring(0, 8);
  };

  rows.forEach(row => {
    if (row.user_id) {
      const user = usersMap.get(row.user_id);
      row.user_label = user?.email || truncateId(row.user_id);
    } else {
      row.user_label = '—';
    }

    if (row.tenant_id) {
      const tenant = tenantsMap.get(row.tenant_id);
      row.tenant_label = tenant || truncateId(row.tenant_id);
    } else {
      row.tenant_label = '—';
    }
  });

  return { rows, total: count ?? 0 };
}
