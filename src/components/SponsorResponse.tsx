import { useState, useEffect } from 'react';
import { useParams } from './Router';
import { Target, CheckCircle, MapPin, TrendingUp, Users, Calendar, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validatePledgeResponse, hasError, getErrorMessage } from '../lib/validation';
import { RGPDModal } from './RGPDModal';
import type { Database } from '../lib/database.types';

type Invitation = Database['public']['Tables']['invitations']['Row'];
type Sponsor = Database['public']['Tables']['sponsors']['Row'];
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

export function SponsorResponse() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [status, setStatus] = useState<'yes' | 'maybe' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [consent, setConsent] = useState(false);
  const [sendCopy, setSendCopy] = useState(false);
  const [sendingCopy, setSendingCopy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showRGPDModal, setShowRGPDModal] = useState(false);

  useEffect(() => {
    if (token) {
      fetchInvitationData();
    }
  }, [token]);

  const fetchInvitationData = async () => {
    setLoading(true);

    const { data: invitationData, error: invitationError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (invitationError || !invitationData) {
      setLoading(false);
      return;
    }

    if (new Date(invitationData.expires_at) < new Date()) {
      setLoading(false);
      return;
    }

    setInvitation(invitationData);

    const { data: sponsorData } = await supabase
      .from('sponsors')
      .select('*')
      .eq('id', invitationData.sponsor_id)
      .maybeSingle();

    if (sponsorData) {
      setSponsor(sponsorData);
    }

    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('*, tenants(*)')
      .eq('id', invitationData.campaign_id)
      .maybeSingle();

    if (campaignData) {
      const tenant = Array.isArray(campaignData.tenants)
        ? campaignData.tenants[0]
        : campaignData.tenants;
      setCampaign({ ...campaignData, tenant });
    }

    const { data: existingPledge } = await supabase
      .from('pledges')
      .select('*')
      .eq('invitation_id', invitationData.id)
      .maybeSingle();

    if (existingPledge) {
      setSubmitted(true);
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation || !sponsor || !campaign) return;

    const { data: existingPledge } = await supabase
      .from('pledges')
      .select('*')
      .eq('invitation_id', invitation.id)
      .maybeSingle();

    if (existingPledge) {
      setErrors({
        submit: 'Vous avez déjà répondu à cette invitation. Une seule réponse est autorisée par invitation.',
      });
      return;
    }

    const validation = validatePledgeResponse({
      email: sponsor.email || '',
      name: sponsor.contact_name || '',
      company: sponsor.company || undefined,
      phone: sponsor.phone || undefined,
      amount: status === 'yes' ? parseFloat(amount) : undefined,
      comment: comment || undefined,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    if (!consent) {
      setErrors({ consent: 'Vous devez accepter les conditions pour continuer' });
      return;
    }

    setErrors({});

    try {
      const pledgeAmount = status === 'yes' ? parseFloat(amount) || 0 : 0;

      const { error: pledgeError } = await supabase.from('pledges').insert({
        campaign_id: campaign.id,
        sponsor_id: sponsor.id,
        sponsor_name: sponsor.contact_name,
        sponsor_email: sponsor.email,
        sponsor_company: sponsor.company,
        sponsor_phone: sponsor.phone,
        status,
        amount: pledgeAmount,
        comment: comment || null,
        consent: consent,
        source: 'invite',
        invitation_id: invitation.id,
      });

      if (pledgeError) throw pledgeError;

      await supabase
        .from('invitations')
        .update({
          status: 'responded',
          responded_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      setSubmitted(true);
    } catch (error: any) {
      setErrors({ submit: error.message || 'Une erreur est survenue' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Chargement...</div>
      </div>
    );
  }

  if (!invitation || !sponsor || !campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="bg-red-100 p-4 rounded-full inline-block mb-4">
            <Target className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invitation non valide</h1>
          <p className="text-slate-600">
            Ce lien d'invitation n'est pas valide ou a expiré.
          </p>
        </div>
      </div>
    );
  }

  const handleSendCopy = async () => {
    if (!sponsor || !campaign) return;

    setSendingCopy(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-confirmation`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sponsor_email: sponsor.email,
          sponsor_name: sponsor.contact_name,
          campaign_title: campaign.title,
          status: status,
          amount: status === 'yes' ? parseFloat(amount) : null,
          comment: comment || null,
        }),
      });

      if (response.ok) {
        alert('Une copie de confirmation a été envoyée à votre email');
        setSendCopy(true);
      } else {
        alert('Erreur lors de l\'envoi de la confirmation');
      }
    } catch (error) {
      alert('Erreur lors de l\'envoi de la confirmation');
    } finally {
      setSendingCopy(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="bg-green-100 p-4 rounded-full inline-block mb-6">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Merci!</h1>
          <p className="text-slate-600 mb-2 text-lg">
            Votre réponse a été enregistrée avec succès.
          </p>
          <p className="text-slate-600 mb-6">
            {campaign.tenant?.name} vous remercie pour votre intérêt et prendra contact avec vous
            prochainement.
          </p>

          {status === 'yes' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <p className="text-sm font-semibold text-green-800 mb-1">Votre engagement</p>
              <p className="text-2xl font-bold text-green-700">
                {parseFloat(amount).toLocaleString('fr-FR')}€
              </p>
            </div>
          )}

          {!sendCopy && (
            <button
              onClick={handleSendCopy}
              disabled={sendingCopy}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold rounded-xl transition disabled:opacity-50"
            >
              {sendingCopy ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                'Recevoir une copie par email'
              )}
            </button>
          )}

          {sendCopy && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-2 justify-center text-sm text-blue-700">
              <CheckCircle className="w-4 h-4" />
              Email de confirmation envoyé
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-blue-600 p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
                <Target className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Invitation Sponsoring</h1>
                <p className="text-green-100 mt-1">
                  {campaign.tenant?.name} vous invite à participer
                </p>
              </div>
            </div>
          </div>

          {campaign.cover_image_url && (
            <div className="h-64 overflow-hidden">
              <img
                src={campaign.cover_image_url}
                alt={campaign.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">{campaign.title}</h2>

              {campaign.description_md && (
                <div className="prose max-w-none mb-6">
                  <p className="text-slate-600">{campaign.description_md}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

                {campaign.annual_price_hint > 0 && (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <div className="flex items-start gap-3">
                      <div className="bg-amber-600 p-2 rounded-lg">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-amber-700 font-medium mb-1">Prix indicatif annuel</p>
                        <p className="font-bold text-amber-900">
                          {campaign.annual_price_hint.toLocaleString('fr-FR')}€
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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

                {campaign.lighting_start_time && campaign.lighting_end_time && (
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 md:col-span-2">
                    <div className="flex items-start gap-3">
                      <div className="bg-indigo-600 p-2 rounded-lg">
                        <Clock className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-indigo-700 font-medium mb-1">Périodes d'allumage</p>
                        <p className="font-bold text-indigo-900">
                          {campaign.lighting_start_time} - {campaign.lighting_end_time}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {campaign.deadline && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-600" />
                    <div>
                      <p className="text-sm text-slate-600">Date limite de la campagne</p>
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

              <div className="border-l-4 border-blue-500 bg-blue-50 pl-4 py-3 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-900 font-semibold">Entreprise invitée</p>
                    <p className="text-blue-800 font-medium">{sponsor.company}</p>
                    {sponsor.contact_name && (
                      <p className="text-sm text-blue-700">Contact: {sponsor.contact_name}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Votre réponse
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setStatus('yes')}
                    className={`py-4 px-4 rounded-xl border-2 transition font-semibold ${
                      status === 'yes'
                        ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Oui
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('maybe')}
                    className={`py-4 px-4 rounded-xl border-2 transition font-semibold ${
                      status === 'maybe'
                        ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Peut-être
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('no')}
                    className={`py-4 px-4 rounded-xl border-2 transition font-semibold ${
                      status === 'no'
                        ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Non
                  </button>
                </div>
              </div>

              {status === 'yes' && (
                <div>
                  <label htmlFor="amount" className="block text-sm font-semibold text-slate-700 mb-2">
                    Montant envisagé (€) <span className="text-red-500" aria-label="requis">*</span>
                  </label>

                  {campaign.annual_price_hint > 0 && (
                    <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
                      <Target className="w-4 h-4 text-slate-400" />
                      <span>
                        Prix indicatif : <span className="font-semibold text-slate-900">{campaign.annual_price_hint.toLocaleString('fr-FR')}€</span>
                      </span>
                    </div>
                  )}

                  <div className="mb-3">
                    <p className="text-xs text-slate-600 mb-2 font-medium">Montants rapides :</p>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAmount('250');
                          if (touched.amount) {
                            setErrors({ ...errors, amount: '' });
                          }
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-green-100 hover:border-green-300 border-2 border-slate-200 text-slate-700 hover:text-green-700 font-semibold rounded-lg transition"
                      >
                        250€
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAmount('500');
                          if (touched.amount) {
                            setErrors({ ...errors, amount: '' });
                          }
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-green-100 hover:border-green-300 border-2 border-slate-200 text-slate-700 hover:text-green-700 font-semibold rounded-lg transition"
                      >
                        500€
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAmount('1000');
                          if (touched.amount) {
                            setErrors({ ...errors, amount: '' });
                          }
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-green-100 hover:border-green-300 border-2 border-slate-200 text-slate-700 hover:text-green-700 font-semibold rounded-lg transition"
                      >
                        1000€
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAmount('2000');
                          if (touched.amount) {
                            setErrors({ ...errors, amount: '' });
                          }
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-green-100 hover:border-green-300 border-2 border-slate-200 text-slate-700 hover:text-green-700 font-semibold rounded-lg transition"
                      >
                        2000€
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      id="amount"
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        if (touched.amount) {
                          setErrors({ ...errors, amount: '' });
                        }
                      }}
                      onBlur={() => setTouched({ ...touched, amount: true })}
                      aria-required="true"
                      aria-invalid={hasError('amount', errors)}
                      aria-describedby={hasError('amount', errors) ? 'amount-error' : 'amount-hint'}
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 outline-none transition ${
                        hasError('amount', errors)
                          ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                          : 'border-slate-300 focus:ring-green-500 focus:border-green-500'
                      }`}
                      placeholder="Ex: 5000"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                      €
                    </span>
                  </div>
                  {hasError('amount', errors) ? (
                    <div id="amount-error" className="flex items-center gap-1 mt-1 text-sm text-red-600" role="alert">
                      <AlertCircle className="w-4 h-4" />
                      {getErrorMessage('amount', errors)}
                    </div>
                  ) : (
                    <p id="amount-hint" className="text-xs text-slate-500 mt-1">
                      Ou saisissez un montant personnalisé
                    </p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="comment" className="block text-sm font-semibold text-slate-700 mb-2">
                  Commentaires (optionnel)
                </label>
                <textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (touched.comment) {
                      setErrors({ ...errors, comment: '' });
                    }
                  }}
                  onBlur={() => setTouched({ ...touched, comment: true })}
                  rows={4}
                  maxLength={500}
                  aria-describedby={hasError('comment', errors) ? 'comment-error' : 'comment-hint'}
                  aria-invalid={hasError('comment', errors)}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 outline-none resize-none transition ${
                    hasError('comment', errors)
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                      : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="Ajoutez des détails, conditions ou questions..."
                />
                {hasError('comment', errors) ? (
                  <div id="comment-error" className="flex items-center gap-1 mt-1 text-sm text-red-600" role="alert">
                    <AlertCircle className="w-4 h-4" />
                    {getErrorMessage('comment', errors)}
                  </div>
                ) : (
                  <p id="comment-hint" className="text-xs text-slate-500 mt-1">
                    Maximum 500 caractères • {500 - comment.length} restants
                  </p>
                )}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked);
                      if (e.target.checked) {
                        setErrors({ ...errors, consent: '' });
                      }
                    }}
                    aria-required="true"
                    aria-invalid={hasError('consent', errors)}
                    aria-describedby="consent-text"
                    className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-2"
                    required
                  />
                  <span id="consent-text" className="text-sm text-slate-700">
                    J'accepte que mes données soient utilisées dans le cadre de cette demande de
                    sponsoring et je consens à être recontacté par {campaign.tenant?.name} concernant
                    ce projet. <span className="text-red-500" aria-label="requis">*</span>
                  </span>
                </label>
                {hasError('consent', errors) && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-red-600" role="alert">
                    <AlertCircle className="w-4 h-4" />
                    {getErrorMessage('consent', errors)}
                  </div>
                )}
              </div>

              {hasError('submit', errors) && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4" role="alert">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-semibold">{getErrorMessage('submit', errors)}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!consent || (status === 'yes' && !amount)}
                aria-label="Envoyer ma réponse au questionnaire de sponsoring"
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-offset-2"
              >
                Envoyer ma réponse
              </button>
            </form>
          </div>
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
