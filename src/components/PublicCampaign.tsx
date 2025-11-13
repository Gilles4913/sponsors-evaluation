import { useState, useEffect, useRef } from 'react';
import { useParams } from './Router';
import { Target, CheckCircle, MapPin, TrendingUp, Calendar, Users, Shield, Clock, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RGPDModal } from './RGPDModal';
import type { Database } from '../lib/database.types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Tenant = Database['public']['Tables']['tenants']['Row'];

interface CampaignDetails extends Campaign {
  tenant?: Tenant;
}

const SCREEN_TYPE_LABELS: Record<string, string> = {
  led_ext: 'LED Extérieur',
  led_int: 'LED Intérieur',
  borne_ext: 'Borne Extérieur',
  borne_int_mobile: 'Borne Intérieur Mobile',
  ecran_int_fixe: 'Écran Intérieur Fixe',
};

export function PublicCampaign() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    company: '',
    contact_name: '',
    email: '',
    phone: '',
    status: 'yes' as 'yes' | 'maybe' | 'no',
    amount: '',
    comment: '',
    consent: false,
    honeypot: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [showRGPDModal, setShowRGPDModal] = useState(false);
  const lastSubmitTime = useRef<number>(0);

  useEffect(() => {
    if (slug) {
      fetchCampaign();
    }
  }, [slug]);

  const fetchCampaign = async () => {
    setLoading(true);

    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .select('*, tenants(*)')
      .eq('public_slug', slug)
      .eq('is_public_share_enabled', true)
      .maybeSingle();

    if (campaignError || !campaignData) {
      setLoading(false);
      return;
    }

    const tenant = Array.isArray(campaignData.tenants)
      ? campaignData.tenants[0]
      : campaignData.tenants;
    setCampaign({ ...campaignData, tenant });
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!campaign || !formData.consent) {
      alert('Veuillez accepter le consentement pour continuer');
      return;
    }

    if (formData.honeypot) {
      console.warn('Honeypot triggered');
      setSubmitted(true);
      return;
    }

    const now = Date.now();
    const timeSinceLastSubmit = now - lastSubmitTime.current;
    if (timeSinceLastSubmit < 3000) {
      alert('Veuillez patienter quelques secondes avant de soumettre à nouveau');
      return;
    }

    setSubmitting(true);

    try {
      const { data: existingSponsor } = await supabase
        .from('sponsors')
        .select('id')
        .eq('tenant_id', campaign.tenant_id)
        .eq('email', formData.email.trim().toLowerCase())
        .maybeSingle();

      let sponsorId: string;

      if (existingSponsor) {
        sponsorId = existingSponsor.id;
      } else {
        const { data: sponsorData, error: sponsorError } = await supabase
          .from('sponsors')
          .insert({
            tenant_id: campaign.tenant_id,
            company: formData.company.trim(),
            contact_name: formData.contact_name.trim(),
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.trim() || null,
            segment: 'autre',
            notes: `Source: Page publique - ${slug}`,
          })
          .select()
          .single();

        if (sponsorError) throw sponsorError;
        sponsorId = sponsorData.id;
      }

      const pledgeAmount = formData.status === 'yes' ? parseFloat(formData.amount) || 0 : 0;

      const { error: pledgeError } = await supabase.from('pledges').insert({
        campaign_id: campaign.id,
        sponsor_id: sponsorId,
        sponsor_name: formData.contact_name.trim(),
        sponsor_email: formData.email.trim().toLowerCase(),
        sponsor_company: formData.company.trim(),
        sponsor_phone: formData.phone.trim() || null,
        status: formData.status,
        amount: pledgeAmount,
        comment: formData.comment.trim() || null,
        consent: formData.consent,
        source: 'public',
      });

      if (pledgeError) throw pledgeError;

      lastSubmitTime.current = now;
      setSubmitted(true);
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Chargement...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="bg-red-100 p-4 rounded-full inline-block mb-4">
            <Target className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Campagne introuvable</h1>
          <p className="text-slate-600">
            Cette campagne n'existe pas ou n'est plus accessible publiquement.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="bg-green-100 p-4 rounded-full inline-block mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Merci!</h1>
          <p className="text-slate-600 mb-2">
            Votre participation a été enregistrée avec succès.
          </p>
          <p className="text-slate-600">
            {campaign.tenant?.name} vous remercie pour votre intérêt et prendra contact avec vous
            prochainement.
          </p>
        </div>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-slate-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {campaign.cover_image_url && (
              <div className="h-96 overflow-hidden">
                <img
                  src={campaign.cover_image_url}
                  alt={campaign.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold mb-4">
                  <Target className="w-4 h-4" />
                  <span>Campagne de sponsoring</span>
                </div>
                <h1 className="text-4xl font-bold text-slate-900 mb-3">{campaign.title}</h1>
                <p className="text-lg text-slate-600">
                  Proposé par <span className="font-semibold">{campaign.tenant?.name}</span>
                </p>
              </div>

              {campaign.description_md && (
                <div className="prose max-w-none mb-8">
                  <p className="text-slate-700 text-lg leading-relaxed">{campaign.description_md}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-blue-700 font-medium mb-1">Type d'équipement</p>
                      <p className="font-bold text-blue-900">
                        {SCREEN_TYPE_LABELS[campaign.screen_type] || campaign.screen_type}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                  <div className="flex items-start gap-3">
                    <div className="bg-green-600 p-2 rounded-lg">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-green-700 font-medium mb-1">Localisation</p>
                      <p className="font-bold text-green-900">{campaign.location}</p>
                    </div>
                  </div>
                </div>

                {campaign.daily_footfall_estimate > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-start gap-3">
                      <div className="bg-slate-600 p-2 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-700 font-medium mb-1">Passages estimés</p>
                        <p className="font-bold text-slate-900">
                          {campaign.daily_footfall_estimate.toLocaleString('fr-FR')} /jour
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {campaign.annual_price_hint > 0 && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-8">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-amber-700" />
                    <div>
                      <p className="text-sm text-amber-700 font-medium">Prix indicatif annuel</p>
                      <p className="text-2xl font-bold text-amber-900">
                        {campaign.annual_price_hint.toLocaleString('fr-FR')}€
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {campaign.deadline && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-8">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-600" />
                    <div>
                      <p className="text-sm text-slate-600">Date limite de participation</p>
                      <p className="font-semibold text-slate-900">
                        {new Date(campaign.deadline).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl transition shadow-lg hover:shadow-xl text-lg"
              >
                Je participe à ce projet
              </button>

              <div className="mt-8 pt-8 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  Protection des données personnelles (RGPD)
                </h3>
                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    Les informations recueillies sur ce formulaire sont enregistrées dans un fichier informatisé par {campaign.tenant?.name} pour la gestion des opportunités de sponsoring.
                  </p>
                  <p>
                    La base légale du traitement est votre consentement. Les données collectées seront communiquées aux seuls destinataires suivants : l'équipe commerciale de {campaign.tenant?.name}.
                  </p>
                  <p>
                    Les données sont conservées pendant 3 ans. Vous pouvez accéder aux données vous concernant, les rectifier, demander leur effacement ou exercer votre droit à la limitation du traitement de vos données.
                  </p>
                  <p>
                    Pour exercer ces droits ou pour toute question sur le traitement de vos données, vous pouvez contacter {campaign.tenant?.name}.
                  </p>
                  <p>
                    Si vous estimez, après nous avoir contactés, que vos droits « Informatique et Libertés » ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-6 text-sm text-slate-600">
            <p>
              Propulsé par <span className="font-semibold">{campaign.tenant?.name}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Formulaire de participation</h2>
            <p className="text-slate-600">{campaign.title}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="company" className="block text-sm font-semibold text-slate-700 mb-2">
                Nom de l'entreprise <span className="text-red-500">*</span>
              </label>
              <input
                id="company"
                type="text"
                required
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Ex: ACME Corp"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contact_name" className="block text-sm font-semibold text-slate-700 mb-2">
                  Nom du contact <span className="text-red-500">*</span>
                </label>
                <input
                  id="contact_name"
                  type="text"
                  required
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="Jean Dupont"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-2">
                  Téléphone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="06 12 34 56 78"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="contact@entreprise.fr"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Votre réponse
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'yes' })}
                  className={`py-4 px-4 rounded-xl border-2 transition font-semibold ${
                    formData.status === 'yes'
                      ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Oui
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'maybe' })}
                  className={`py-4 px-4 rounded-xl border-2 transition font-semibold ${
                    formData.status === 'maybe'
                      ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Peut-être
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'no' })}
                  className={`py-4 px-4 rounded-xl border-2 transition font-semibold ${
                    formData.status === 'no'
                      ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Non
                </button>
              </div>
            </div>

            {formData.status === 'yes' && (
              <div>
                <label htmlFor="amount" className="block text-sm font-semibold text-slate-700 mb-2">
                  Montant envisagé (€) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="amount"
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                    placeholder="Ex: 5000"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                    €
                  </span>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="comment" className="block text-sm font-semibold text-slate-700 mb-2">
                Commentaires (optionnel)
              </label>
              <textarea
                id="comment"
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition"
                placeholder="Ajoutez des détails, conditions ou questions..."
              />
            </div>

            <input
              type="text"
              name="website"
              value={formData.honeypot}
              onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })}
              style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Vos données sont protégées</p>
                  <p className="text-blue-800">
                    Conformément au RGPD, vos informations sont sécurisées et ne seront utilisées que dans le cadre de cette opportunité de sponsoring.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.consent}
                  onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                  className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  required
                />
                <span className="text-sm text-slate-700">
                  J'ai lu et j'accepte la politique de protection des données. Je consens à ce que mes informations personnelles soient utilisées par {campaign.tenant?.name} dans le cadre de cette demande de sponsoring et j'accepte d'être recontacté concernant ce projet. <span className="text-red-500">*</span>
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 px-6 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-semibold"
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={submitting || !formData.consent || (formData.status === 'yes' && !formData.amount)}
                className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  'Envoyer ma participation'
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="text-center mt-6 text-sm text-slate-600">
          <p>
            Propulsé par <span className="font-semibold">{campaign.tenant?.name}</span>
          </p>
          {campaign.tenant?.rgpd_content_md && (
            <button
              onClick={() => setShowRGPDModal(true)}
              className="mt-2 text-blue-600 hover:text-blue-800 underline font-medium"
            >
              RGPD - Protection des données
            </button>
          )}
        </div>
      </div>

      <RGPDModal
        isOpen={showRGPDModal}
        onClose={() => setShowRGPDModal(false)}
        rgpdContent={campaign.tenant?.rgpd_content_md || ''}
        tenantName={campaign.tenant?.name}
      />
    </div>
  );
}
