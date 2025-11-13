# Guide de déploiement

## Architecture

- **Frontend**: React + Vite déployé sur Vercel
- **Backend**: Supabase (base de données PostgreSQL + Edge Functions)
- **Auth**: Supabase Auth avec email/password
- **Emails**: Templates Supabase + Edge Functions pour relances automatiques

## Prérequis

1. Compte Vercel (https://vercel.com)
2. Projet Supabase configuré (https://supabase.com)
3. Node.js 18+ installé localement

## Configuration Supabase

### 1. Base de données

Toutes les migrations ont été appliquées via le projet. Vérifiez que les tables suivantes existent :

- `tenants`
- `users`
- `campaigns`
- `sponsors`
- `invitations`
- `pledges`
- `scenarios`
- `email_events`
- `email_templates`

### 2. Row Level Security (RLS)

Toutes les tables ont RLS activé avec politiques complètes :
- Super admins : accès total via `is_super_admin()`
- Club admins : accès limité à leur tenant via `has_tenant_access()`
- Public : accès limité aux campagnes publiques et invitations via token

### 3. Edge Functions

La fonction `send-reminders` est déployée pour les relances automatiques :
- Relance J+5 après invitation initiale
- Relance J-10 avant deadline

**Configuration Cron (optionnel)** :
Dans le dashboard Supabase, configurez un cron job pour appeler la fonction périodiquement (ex: quotidien à 9h).

### 4. Récupérer les credentials

Dans votre projet Supabase :
1. Allez dans Settings → API
2. Copiez l'URL du projet (Project URL)
3. Copiez la clé `anon/public` (Project API keys)

## Déploiement sur Vercel

### Méthode 1 : Via l'interface Vercel

1. **Connectez votre repository Git**
   - Allez sur https://vercel.com/new
   - Importez votre repository GitHub/GitLab/Bitbucket

2. **Configurez les variables d'environnement**

   Dans Vercel → Project Settings → Environment Variables, ajoutez :

   ```
   VITE_SUPABASE_URL=https://votre-projet.supabase.co
   VITE_SUPABASE_ANON_KEY=votre-cle-anon
   ```

3. **Déployez**
   - Vercel détecte automatiquement Vite
   - Le build se lance automatiquement
   - Votre app sera disponible sur `https://votre-app.vercel.app`

### Méthode 2 : Via Vercel CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Déployer (depuis la racine du projet)
vercel

# Suivez les instructions pour :
# - Lier à un projet existant ou en créer un nouveau
# - Configurer les variables d'environnement
```

### Ajouter les variables d'environnement via CLI

```bash
vercel env add VITE_SUPABASE_URL
# Collez votre URL Supabase

vercel env add VITE_SUPABASE_ANON_KEY
# Collez votre clé anon
```

## Configuration post-déploiement

### 1. Créer le super admin initial

Connectez-vous à votre projet Supabase et exécutez ce SQL :

```sql
-- Créer un utilisateur auth
-- (Remplacez email/password par vos valeurs)

-- Puis insérez dans la table users
INSERT INTO users (id, email, name, role, tenant_id)
VALUES (
  'auth-user-id-from-auth-users-table',
  'admin@example.com',
  'Super Admin',
  'super_admin',
  NULL
);
```

Ou utilisez l'interface Supabase Auth pour créer un utilisateur, puis ajoutez-le manuellement dans la table `users`.

### 2. Vérifier les URLs

1. Mettez à jour `PUBLIC_BASE_URL` si nécessaire pour les liens d'emails
2. Testez le QR code pour vérifier que les URLs sont correctes

### 3. Tester le parcours complet

1. **Super Admin** : Connectez-vous et créez un tenant/club
2. **Club Admin** : Connectez-vous avec le compte club créé
3. **Campagne** : Créez une campagne avec objectif
4. **Sponsors** : Ajoutez des sponsors
5. **Invitations** : Envoyez des invitations (vérifiez les tokens)
6. **Réponse sponsor** : Testez `/invite/[token]`
7. **Page publique** : Activez le partage public et testez `/p/[slug]`
8. **QR Code** : Générez et téléchargez le QR code
9. **Exports** : Testez CSV et PDF
10. **Simulation** : Ouvrez le panneau forecast

## Variables d'environnement

### Obligatoires

- `VITE_SUPABASE_URL` : URL de votre projet Supabase
- `VITE_SUPABASE_ANON_KEY` : Clé publique anon de Supabase

### Optionnelles (pour future intégration)

- `RESEND_API_KEY` : Pour l'envoi d'emails réels via Resend
- `PUBLIC_BASE_URL` : URL publique de l'app (auto-détectée si non définie)

## Sécurité

### Checklist de sécurité

- ✅ RLS activé sur toutes les tables
- ✅ Politiques restrictives par défaut
- ✅ Validation RGPD avec consentement obligatoire
- ✅ Accès token-based pour les sponsors
- ✅ Super admin isolé via fonction `is_super_admin()`
- ✅ Tenant isolation via fonction `has_tenant_access()`
- ✅ TLS/HTTPS activé (Supabase + Vercel)
- ✅ Pas de secrets exposés côté client

### Bonnes pratiques

1. **Ne jamais** commit le fichier `.env` avec des vraies valeurs
2. Utilisez des tokens d'invitation avec expiration si besoin
3. Auditez régulièrement les logs Supabase
4. Activez 2FA pour les comptes super admin
5. Configurez des alertes Supabase pour activités suspectes

## Monitoring

### Supabase Dashboard

- Surveillez les logs dans Database → Logs
- Vérifiez les edge functions dans Functions
- Consultez les métriques dans Reports

### Vercel Dashboard

- Surveillez les déploiements dans Deployments
- Consultez les analytics dans Analytics
- Vérifiez les logs dans Functions (si utilisé)

## Maintenance

### Mises à jour

```bash
# Mettre à jour les dépendances
npm update

# Tester localement
npm run dev
npm run build

# Déployer
git push  # Vercel déploie automatiquement
```

### Backup base de données

Configurez des backups automatiques dans Supabase :
- Settings → Database → Backups
- Activez les backups quotidiens
- Conservez au moins 7 jours d'historique

## Troubleshooting

### Erreur : "Failed to fetch"
- Vérifiez que `VITE_SUPABASE_URL` est correcte
- Vérifiez que RLS est bien configuré
- Consultez les logs Supabase pour les erreurs de politique

### Erreur : "JWT expired"
- L'utilisateur doit se reconnecter
- Vérifiez la configuration Auth dans Supabase

### Erreur : "Row level security policy violation"
- Vérifiez que les politiques RLS sont bien déployées
- Vérifiez que l'utilisateur a le bon rôle (super_admin ou club_admin)
- Consultez la documentation des politiques RLS dans les migrations

### QR Code ne fonctionne pas
- Vérifiez que `is_public_share_enabled = true` sur la campagne
- Vérifiez que le `public_slug` est généré
- Testez l'URL directement dans le navigateur

### Export CSV/PDF vide
- Vérifiez qu'il y a des pledges dans la campagne
- Vérifiez les permissions RLS sur la table pledges
- Consultez la console du navigateur pour les erreurs

## Support

- Documentation Supabase : https://supabase.com/docs
- Documentation Vercel : https://vercel.com/docs
- Documentation Vite : https://vitejs.dev/

## Fonctionnalités principales

✅ Authentification multi-tenant (super_admin + club_admin)
✅ Gestion des campagnes de sponsoring
✅ Invitations personnalisées avec tokens
✅ Page publique + QR code
✅ Formulaires de réponse sponsors
✅ Calcul automatique des totaux et progression
✅ Panel de simulation/forecast
✅ Templates d'emails personnalisables
✅ Edge Functions pour relances automatiques (J+5, J-10)
✅ Export CSV et PDF
✅ Sécurité RLS complète
✅ Conformité RGPD avec consentement obligatoire
