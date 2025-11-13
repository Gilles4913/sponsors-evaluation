import { ReactNode, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Building2,
  Target,
  Users,
  Share2,
  Mail,
  Settings,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Clock,
  AlertCircle,
  FileText,
  Database,
  Shield,
  HardDrive,
  CheckCircle,
  FileSearch,
  Inbox
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  roles: ('super_admin' | 'club_admin')[];
}

const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    roles: ['super_admin'],
  },
  {
    label: 'Clubs',
    icon: Building2,
    path: '/clubs',
    roles: ['super_admin'],
  },
  {
    label: 'Templates e-mails',
    icon: Mail,
    path: '/emails/templates',
    roles: ['super_admin', 'club_admin'],
  },
  {
    label: 'Vérificateur de Schéma',
    icon: Database,
    path: '/schema-checker',
    roles: ['super_admin'],
  },
  {
    label: 'Vérificateur RLS',
    icon: Shield,
    path: '/rls-checker',
    roles: ['super_admin'],
  },
  {
    label: 'Vérificateur Stockage',
    icon: HardDrive,
    path: '/storage-checker',
    roles: ['super_admin'],
  },
  {
    label: 'Vérificateur Env',
    icon: CheckCircle,
    path: '/env-checker',
    roles: ['super_admin'],
  },
  {
    label: 'Audit Schema vs Code',
    icon: FileSearch,
    path: '/schema-audit',
    roles: ['super_admin'],
  },
  {
    label: 'Historique e-mails',
    icon: Inbox,
    path: '/admin/email-logs',
    roles: ['super_admin'],
  },
  {
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    path: '/club',
    roles: ['club_admin'],
  },
  {
    label: 'Campagnes',
    icon: Target,
    path: '/campaigns',
    roles: ['club_admin'],
  },
  {
    label: 'Sponsors',
    icon: Users,
    path: '/sponsors',
    roles: ['club_admin'],
  },
  {
    label: 'Partage',
    icon: Share2,
    path: '/share',
    roles: ['club_admin'],
  },
  {
    label: 'Emails',
    icon: Mail,
    path: '/emails',
    roles: ['club_admin'],
  },
  {
    label: 'Envois planifiés',
    icon: Clock,
    path: '/scheduled',
    roles: ['club_admin'],
  },
  {
    label: 'Paramètres',
    icon: Settings,
    path: '/settings',
    roles: ['club_admin'],
  },
  {
    label: 'Légal & E-mails',
    icon: FileText,
    path: '/settings/legal',
    roles: ['club_admin'],
  },
  {
    label: 'Contenus Légaux',
    icon: FileText,
    path: '/club/legal',
    roles: ['club_admin'],
  },
];

export function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { asTenantId, isMasquerading, clearAsTenant } = useAsTenant();
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [asTenantName, setAsTenantName] = useState<string | null>(null);
  const [tenantStatus, setTenantStatus] = useState<'active' | 'inactive' | null>(null);

  const userNavigation = navigation.filter((item) =>
    profile?.role ? item.roles.includes(profile.role as 'super_admin' | 'club_admin') : false
  );

  const currentPath = window.location.pathname;

  useEffect(() => {
    if (asTenantId) {
      fetchTenantData(asTenantId);
    } else {
      setTenantStatus(null);
      setAsTenantName(null);
    }
  }, [asTenantId]);

  const fetchTenantData = async (tenantId: string) => {
    const { data } = await supabase
      .from('tenants')
      .select('name, status')
      .eq('id', tenantId)
      .maybeSingle();
    if (data) {
      setAsTenantName(data.name);
      setTenantStatus(data.status as 'active' | 'inactive');
    }
  };

  const handleQuitMasquerade = () => {
    clearAsTenant();
    toast.success('Mode masquerade désactivé');
    window.location.href = '/admin/clubs';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 dark:text-white">SponsoZone</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {profile?.role === 'super_admin' ? 'Super Admin' : 'Club Admin'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            <div className="space-y-1">
              {userNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;

                return (
                  <a
                    key={item.path}
                    href={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-lg shadow-blue-500/30'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </a>
                );
              })}
            </div>
          </nav>

          <div className="p-3 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-5 h-5" />
                  <span className="font-medium">Mode sombre</span>
                </>
              ) : (
                <>
                  <Sun className="w-5 h-5" />
                  <span className="font-medium">Mode clair</span>
                </>
              )}
            </button>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition mt-1"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 backdrop-blur-sm bg-white/90 dark:bg-slate-800/90">
          <div className="flex items-center justify-between px-4 lg:px-8 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-4 ml-auto">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {profile?.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{profile?.email}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white font-bold shadow-lg">
                {profile?.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {isMasquerading && (
          <div
            data-testid="banner-masquerade"
            className="sticky top-[57px] z-20 bg-gradient-to-r from-orange-600 to-orange-700 text-white px-4 py-3 shadow-lg"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm font-medium">
                  Mode super_admin — Vous voyez l'environnement du club : <span className="font-bold">{asTenantName || 'Chargement...'}</span>
                </p>
              </div>
              <button
                onClick={handleQuitMasquerade}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition text-sm font-medium flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Quitter
              </button>
            </div>
          </div>
        )}

        {asTenantId && tenantStatus === 'inactive' && (
          <div
            data-testid="banner-tenant-inactive"
            className="sticky top-[57px] z-20 bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 shadow-lg"
          >
            <div className="max-w-7xl mx-auto flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-medium">
                Ce club est désactivé — accès en lecture seule
              </p>
            </div>
          </div>
        )}

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
