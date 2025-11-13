# SponsoZone - Plateforme de Gestion de Sponsoring

Application SaaS multi-tenant pour la gestion de campagnes de sponsoring pour clubs sportifs et associations.

## Fonctionnalités

### Gestion Multi-Tenant
- **Super Admin** : Création et gestion des clubs (tenants)
- **Club Admin** : Gestion complète des campagnes de leur club
- Isolation totale des données par tenant via RLS

### Campagnes de Sponsoring
- Création de campagnes avec objectifs financiers
- Types d'équipements : LED extérieur/intérieur, bornes, écrans fixes
- Suivi en temps réel : montants promis, taux d'atteinte, statistiques
- Images de couverture et descriptions personnalisées
- Dates limites et paramètres de visibilité

### Gestion des Sponsors
- Base de données centralisée des sponsors
- Segments : Or, Argent, Bronze, Autre
- Historique des participations et promesses

### Invitations & Réponses
- Système d'invitation par email avec tokens sécurisés
- Formulaire de réponse personnalisé : Oui / Peut-être / Non
- Montants et commentaires
- Traçabilité complète (source : invite, public, qr)

### Partage Public & QR Code
- Pages publiques pour chaque campagne (/p/[slug])
- Génération automatique de QR codes
- Téléchargement des QR codes en PNG
- Partage via URL publique

### Templates d'Emails
- 6 templates personnalisables par le Super Admin
- Types : invitation, relance J+5, relance J-10, confirmation, accusé, résumé
- Éditeur visuel avec prévisualisation
- Variables dynamiques (placeholders)

### Relances Automatiques
- Edge Function Supabase pour relances automatiques
- Relance J+5 après invitation sans réponse
- Relance J-10 avant deadline
- Configuration cron pour exécution quotidienne

### Simulation & Forecast
- Panel de simulation financière
- Scénarios avec sponsors et montants
- Calcul du ROI, coût d'acquisition, VPM
- Sauvegarde et gestion de multiples scénarios

### Export de Données
- **Export CSV** : Données tabulaires pour Excel/Google Sheets
- **Export PDF** : Rapports formatés avec statistiques et graphiques
- Design professionnel prêt à l'impression

### Sécurité & RGPD
- Row Level Security (RLS) sur toutes les tables
- Consentement RGPD obligatoire (contrainte database)
- Chiffrement TLS sur toutes les connexions
- Accès token-based pour les sponsors
- Validation côté client et serveur

## Stack Technique

### Frontend
- **React 18** avec TypeScript
- **Vite** pour le build ultra-rapide
- **Tailwind CSS** pour le styling
- **Lucide React** pour les icônes
- **QRCode** pour la génération de QR codes

### Backend
- **Supabase** (PostgreSQL + Auth + Edge Functions)
- **Row Level Security (RLS)** pour l'isolation des données
- **Edge Functions** pour les relances automatiques
- Architecture multi-tenant complète

### Déploiement
- **Vercel** pour le frontend
- **Supabase Cloud** pour le backend
- CI/CD automatique via Git

## Installation Locale

### Prérequis
- Node.js 18+
- npm ou yarn
- Compte Supabase

### Configuration

1. Cloner le repository
```bash
git clone [votre-repo]
cd project
```

2. Installer les dépendances
```bash
npm install
```

3. Configurer les variables d'environnement
```bash
cp .env.example .env
```

Éditez `.env` avec vos credentials Supabase :
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon
```

4. Lancer le serveur de développement
```bash
npm run dev
```

L'application sera disponible sur http://localhost:5173

## Déploiement

Consultez le fichier [DEPLOYMENT.md](./DEPLOYMENT.md) pour les instructions détaillées de déploiement sur Vercel + Supabase.

### Résumé rapide

1. **Vercel**
   - Connectez votre repo Git
   - Configurez les variables d'environnement
   - Déployez automatiquement

2. **Supabase**
   - Les migrations sont déjà appliquées
   - Configurez un cron job pour `send-reminders`
   - Créez votre premier super admin

## Structure du Projet

```
project/
├── src/
│   ├── components/          # Composants React
│   │   ├── ClubDashboard.tsx
│   │   ├── SuperAdminDashboard.tsx
│   │   ├── EmailTemplateEditor.tsx
│   │   ├── ForecastPanel.tsx
│   │   ├── PublicCampaign.tsx
│   │   ├── SponsorResponse.tsx
│   │   └── ...
│   ├── contexts/            # Contexts React (Auth)
│   ├── lib/                 # Utilitaires
│   │   ├── supabase.ts
│   │   ├── emailService.ts
│   │   ├── exportUtils.ts
│   │   └── database.types.ts
│   ├── App.tsx              # Routeur principal
│   └── main.tsx             # Point d'entrée
├── supabase/
│   ├── migrations/          # Migrations SQL
│   └── functions/           # Edge Functions
│       └── send-reminders/
├── vercel.json              # Config Vercel
├── DEPLOYMENT.md            # Guide de déploiement
└── package.json
```

## Parcours Utilisateur

### 1. Super Admin
1. Connexion avec email/password
2. Vue d'ensemble : statistiques globales
3. Gestion des clubs (tenants)
4. Création de comptes Club Admin
5. Édition des templates d'emails

### 2. Club Admin
1. Connexion avec email/password
2. Dashboard : liste des campagnes
3. Création de campagnes
4. Ajout de sponsors
5. Envoi d'invitations
6. Génération de QR codes
7. Suivi en temps réel des réponses
8. Export CSV/PDF des résultats
9. Simulation de scénarios

### 3. Sponsor (Invitation)
1. Réception d'un email d'invitation
2. Clic sur le lien (/invite/[token])
3. Visualisation de la campagne
4. Réponse Oui/Peut-être/Non + montant
5. Consentement RGPD obligatoire
6. Confirmation de participation

### 4. Public (Page Publique)
1. Scan du QR code ou accès direct (/p/[slug])
2. Découverte de la campagne
3. Formulaire de participation
4. Création automatique dans la base sponsors
5. Enregistrement de la promesse

## Sécurité

### Row Level Security (RLS)

Toutes les tables sont protégées :
- `tenants` : Super admins full access, Club admins own tenant
- `users` : Super admins full access, users own profile
- `campaigns` : Tenant-scoped + public read si enabled
- `sponsors` : Tenant-scoped
- `invitations` : Tenant-scoped + token-based access
- `pledges` : Tenant-scoped + consent required
- `scenarios` : Tenant-scoped
- `email_events` : Tenant-scoped
- `email_templates` : Super admins manage, all read

### RGPD

- Consentement obligatoire (contrainte database)
- Validation côté client ET serveur
- Mention explicite dans tous les formulaires
- Possibilité d'export et suppression des données

## Scripts NPM

```bash
npm run dev        # Serveur de développement
npm run build      # Build production
npm run preview    # Preview du build
npm run lint       # Linter ESLint
npm run typecheck  # Vérification TypeScript
```

## Fonctionnalités Avancées

### Simulation de Scénarios
- Ajout de sponsors fictifs ou réels
- Calcul automatique des métriques
- Projection du ROI
- Sauvegarde de multiples scénarios
- Comparaison côte à côte

### Relances Automatiques
- Configuration via Supabase Cron
- J+5 : relance douce si pas de réponse
- J-10 : relance urgente avant deadline
- Templates personnalisables
- Logs d'exécution dans Edge Functions

### Export Professionnel
- CSV encodé UTF-8 avec BOM
- PDF avec design soigné et statistiques
- Prêt pour Excel, Google Sheets, impression
- Graphiques et visualisations

## Roadmap

- [ ] Intégration Resend pour envoi d'emails réels
- [ ] Dashboard analytics avec graphiques
- [ ] Notifications push
- [ ] Export Excel natif
- [ ] API publique pour intégrations
- [ ] Application mobile (React Native)
- [ ] Multi-langue (i18n)

## Support & Contribution

Pour toute question ou contribution, ouvrez une issue sur GitHub.

## Licence

Propriétaire - Tous droits réservés

---

Développé avec ❤️ pour les clubs et associations
