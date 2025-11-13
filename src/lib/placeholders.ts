export interface PlaceholderDefinition {
  key: string;
  label: string;
  description: string;
}

export const PLACEHOLDERS: PlaceholderDefinition[] = [
  { key: 'club_name', label: 'Nom du club', description: 'Nom complet du club' },
  { key: 'campaign_title', label: 'Titre de la campagne', description: 'Titre de la campagne de sponsoring' },
  { key: 'invite_link', label: "Lien d'invitation", description: 'URL unique pour répondre' },
  { key: 'deadline', label: 'Date limite', description: 'Date limite (AAAA-MM-JJ)' },
  { key: 'sponsor_name', label: 'Nom du contact sponsor', description: 'Nom complet du contact' },
  { key: 'sponsor_company', label: 'Raison sociale sponsor', description: 'Nom de l\'entreprise' },
  { key: 'amount_hint', label: 'Prix indicatif/an', description: 'Montant annuel suggéré (€)' },
  { key: 'footfall', label: 'Passages estimés/jour', description: 'Nombre de passages quotidiens' },
  { key: 'screen_type', label: "Type d'écran", description: 'Type d\'affichage (LED, borne, etc.)' },
  { key: 'campaign_objective', label: 'Objectif (€)', description: 'Objectif financier de la campagne' },
  { key: 'pledge_amount', label: 'Montant promis (€)', description: 'Montant engagé par le sponsor' },
  { key: 'club_contact_name', label: 'Nom contact club', description: 'Nom du contact du club' },
  { key: 'club_contact_email', label: 'Email contact club', description: 'Email de contact du club' },
  { key: 'club_contact_phone', label: 'Téléphone contact club', description: 'Téléphone du club' },
];

export const DEFAULT_EXAMPLE_VALUES: Record<string, string | number> = {
  club_name: 'FC Exemple',
  campaign_title: 'Campagne Écrans LED 2024',
  invite_link: 'https://app.example.com/invite/abc123',
  deadline: '2024-12-31',
  sponsor_name: 'Jean Dupont',
  sponsor_company: 'Entreprise ABC',
  amount_hint: '2500',
  footfall: '5000',
  screen_type: 'LED Extérieur',
  campaign_objective: '50000',
  pledge_amount: '3000',
  club_contact_name: 'Marie Martin',
  club_contact_email: 'contact@fcexemple.fr',
  club_contact_phone: '+33 6 12 34 56 78',
};

export function applyPlaceholders(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : ''));
}
