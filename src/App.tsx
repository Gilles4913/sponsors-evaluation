import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ReadOnlyProvider } from './contexts/ReadOnlyContext';
import { Router } from './components/Router';
import { Login } from './components/Login';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SuperAdminClubs } from './components/SuperAdminClubs';
import { SuperAdminEmailTemplates } from './components/SuperAdminEmailTemplates';
import { SuperAdminGlobalEmailTemplates } from './components/SuperAdminGlobalEmailTemplates';
import { EmailTemplatesHub } from './components/EmailTemplatesHub';
import { SchemaChecker } from './components/SchemaChecker';
import { RlsChecker } from './components/RlsChecker';
import { StorageChecker } from './components/StorageChecker';
import EnvChecker from './components/EnvChecker';
import { AuthEnvDiag } from './components/AuthEnvDiag';
import { SchemaVsCodeAudit } from './components/SchemaVsCodeAudit';
import { ClubDashboard } from './components/ClubDashboard';
import { CampaignsList } from './components/CampaignsList';
import { SponsorsList } from './components/SponsorsList';
import { SponsorResponse } from './components/SponsorResponse';
import { PublicCampaign } from './components/PublicCampaign';
import { EmailTemplates } from './components/EmailTemplates';
import { TemplateDetail } from './components/TemplateDetail';
import { Reminders } from './components/Reminders';
import { SettingsClub } from './components/SettingsClub';
import { SettingsLegal } from './components/SettingsLegal';
import { ClubLegalSettings } from './components/ClubLegalSettings';
import { ScheduledSends } from './components/ScheduledSends';
import EmailTestLab from './components/EmailTestLab';
import EnvDiagnosticsPanel from './components/EnvDiagnosticsPanel';
import DbDiagnostics from './components/DbDiagnostics';
import { AuthTest } from './components/AuthTest';
import { TemplateUpdateTest } from './components/TemplateUpdateTest';
import AuthGuard from './components/AuthGuard';
import { BackendGuard } from './components/BackendGuard';
import { EnvBanner } from './components/EnvBanner';
import { useParams } from './components/Router';
import { AdminClubs } from './components/AdminClubs';
import { AdminClubsNew } from './components/AdminClubsNew';
import { AdminEmailsTest } from './components/AdminEmailsTest';
import { ResendDiagnostic } from './components/ResendDiagnostic';
import { EmailLogsPage } from './components/EmailLogsPage';
import { TenantEdit } from './components/TenantEdit';
import { SupabaseDiagnostic } from './components/SupabaseDiagnostic';

function TemplateDetailWrapper() {
  const { idOrKey } = useParams();
  if (!idOrKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600">Template ID ou key manquant</p>
        </div>
      </div>
    );
  }
  return <TemplateDetail idOrKey={idOrKey} />;
}

function TemplateDetailByIdWrapper() {
  const { id } = useParams();
  if (!id) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600">Template ID manquant</p>
        </div>
      </div>
    );
  }
  return <TemplateDetail idOrKey={id} />;
}

function TenantEditWrapper() {
  const { tenantId } = useParams();
  if (!tenantId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600">Tenant ID manquant</p>
        </div>
      </div>
    );
  }
  return <TenantEdit />;
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const path = window.location.pathname;

  if (path.startsWith('/sponsor/') || path.startsWith('/respond/') || path.startsWith('/invite/')) {
    return (
      <>
        <EnvBanner />
        <Router>
          <SponsorResponse />
        </Router>
      </>
    );
  }

  if (path.startsWith('/p/')) {
    return (
      <>
        <EnvBanner />
        <Router>
          <PublicCampaign />
        </Router>
      </>
    );
  }

  if (path.startsWith('/template/')) {
    return (
      <>
        <EnvBanner />
        <Router>
          <TemplateDetailWrapper />
        </Router>
      </>
    );
  }

  if (path.startsWith('/templates/')) {
    return (
      <>
        <EnvBanner />
        <Router>
          <TemplateDetailByIdWrapper />
        </Router>
      </>
    );
  }

  if (path === '/env-checker') {
    return <EnvChecker />;
  }

  if (path === '/auth-diag') {
    return <AuthEnvDiag />;
  }

  if (path === '/env-diagnostics') {
    return <EnvDiagnosticsPanel />;
  }

  if (path === '/db-diagnostics') {
    return <DbDiagnostics />;
  }

  if (path === '/auth-test') {
    return <AuthTest />;
  }

  if (path === '/template-update-test') {
    return <TemplateUpdateTest />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Chargement...</div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <>
        <EnvBanner />
        <Login />
      </>
    );
  }

  return (
    <>
      <EnvBanner />
      {renderAuthenticatedContent(profile, path)}
    </>
  );
}

function renderAuthenticatedContent(profile: any, path: string) {
  if (profile.role === 'super_admin') {
    if (path === '/super' || path === '/clubs') {
      return (
        <AuthGuard allow={['super_admin']}>
          <SuperAdminClubs />
        </AuthGuard>
      );
    }
    if (path === '/admin/clubs') {
      return (
        <AuthGuard allow={['super_admin']}>
          <AdminClubs />
        </AuthGuard>
      );
    }
    if (path === '/admin/clubs/new') {
      return (
        <AuthGuard allow={['super_admin']}>
          <AdminClubsNew />
        </AuthGuard>
      );
    }
    if (path.startsWith('/admin/clubs/') && path.endsWith('/edit')) {
      return (
        <AuthGuard allow={['super_admin']}>
          <Router>
            <TenantEditWrapper />
          </Router>
        </AuthGuard>
      );
    }
    if (path === '/admin/email-logs') {
      return (
        <AuthGuard allow={['super_admin']}>
          <EmailLogsPage />
        </AuthGuard>
      );
    }
    if (path === '/email-templates') {
      return (
        <AuthGuard allow={['super_admin']}>
          <EmailTemplates />
        </AuthGuard>
      );
    }
    if (path === '/emails/templates') {
      return (
        <AuthGuard allow={['super_admin', 'club_admin']}>
          <EmailTemplatesHub />
        </AuthGuard>
      );
    }
    if (path === '/default-email-templates') {
      return (
        <AuthGuard allow={['super_admin']}>
          <SuperAdminEmailTemplates />
        </AuthGuard>
      );
    }
    if (path === '/global-email-templates') {
      return (
        <AuthGuard allow={['super_admin']}>
          <SuperAdminGlobalEmailTemplates />
        </AuthGuard>
      );
    }
    if (path === '/schema-checker') {
      return (
        <AuthGuard allow={['super_admin']}>
          <SchemaChecker />
        </AuthGuard>
      );
    }
    if (path === '/rls-checker') {
      return (
        <AuthGuard allow={['super_admin']}>
          <RlsChecker />
        </AuthGuard>
      );
    }
    if (path === '/storage-checker') {
      return (
        <AuthGuard allow={['super_admin']}>
          <StorageChecker />
        </AuthGuard>
      );
    }
    if (path === '/schema-audit') {
      return (
        <AuthGuard allow={['super_admin']}>
          <SchemaVsCodeAudit />
        </AuthGuard>
      );
    }
    if (path === '/email-test') {
      return (
        <AuthGuard allow={['super_admin', 'club_admin']}>
          <EmailTestLab />
        </AuthGuard>
      );
    }
    if (path === '/admin/emails-test') {
      return (
        <AuthGuard allow={['super_admin']}>
          <AdminEmailsTest />
        </AuthGuard>
      );
    }
    if (path === '/admin/resend-diagnostic') {
      return (
        <AuthGuard allow={['super_admin']}>
          <ResendDiagnostic />
        </AuthGuard>
      );
    }
    if (path === '/admin/email-logs') {
      return (
        <AuthGuard allow={['super_admin']}>
          <EmailLogsPage />
        </AuthGuard>
      );
    }
    if (path === '/admin/diag/supabase') {
      return (
        <AuthGuard allow={['super_admin']}>
          <SupabaseDiagnostic />
        </AuthGuard>
      );
    }
    return (
      <AuthGuard allow={['super_admin']}>
        <SuperAdminDashboard />
      </AuthGuard>
    );
  }

  if (profile.role === 'club_admin') {
    if (path === '/sponsors') {
      return <SponsorsList />;
    }
    if (path === '/campaigns') {
      return <CampaignsList />;
    }
    if (path === '/reminders') {
      return <Reminders />;
    }
    if (path === '/scheduled') {
      return <ScheduledSends />;
    }
    if (path === '/settings') {
      return <SettingsClub />;
    }
    if (path === '/settings/legal') {
      return <SettingsLegal />;
    }
    if (path === '/club/legal') {
      return <ClubLegalSettings />;
    }
    if (path === '/emails/templates') {
      return (
        <AuthGuard allow={['super_admin', 'club_admin']}>
          <EmailTemplatesHub />
        </AuthGuard>
      );
    }
    if (path === '/email-test') {
      return (
        <AuthGuard allow={['super_admin', 'club_admin']}>
          <EmailTestLab />
        </AuthGuard>
      );
    }
    return <ClubDashboard />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-slate-600">Rôle non reconnu</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BackendGuard>
      <AuthProvider>
        <ReadOnlyProvider>
          <AppContent />
        </ReadOnlyProvider>
      </AuthProvider>
    </BackendGuard>
  );
}

export default App;
