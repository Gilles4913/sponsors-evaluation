import { useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { Layout } from './Layout';

const SCREEN_TYPE_OPTIONS = [
  { value: 'led_ext', label: 'LED Extérieur' },
  { value: 'led_int', label: 'LED Intérieur' },
  { value: 'borne_ext', label: 'Borne Extérieur' },
  { value: 'borne_int_mobile', label: 'Borne Intérieur Mobile' },
  { value: 'ecran_int_fixe', label: 'Écran Intérieur Fixe' },
];

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Lundi' },
  { value: 'tuesday', label: 'Mardi' },
  { value: 'wednesday', label: 'Mercredi' },
  { value: 'thursday', label: 'Jeudi' },
  { value: 'friday', label: 'Vendredi' },
  { value: 'saturday', label: 'Samedi' },
  { value: 'sunday', label: 'Dimanche' },
];

interface LightingHours {
  [key: string]: { start: string; end: string } | null;
}

interface CampaignFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function CampaignForm({ onSuccess, onCancel }: CampaignFormProps) {
  const { profile } = useAuth();
  const { effectiveTenantId } = useAsTenant();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    screen_type: 'led_ext',
    location: '',
    annual_price_hint: '',
    objective_amount: '',
    daily_footfall_estimate: '',
    cover_image_url: '',
    deadline: '',
    description_md: '',
    is_public_share_enabled: false,
  });

  const [lightingHours, setLightingHours] = useState<LightingHours>({
    monday: { start: '08:00', end: '20:00' },
    tuesday: { start: '08:00', end: '20:00' },
    wednesday: { start: '08:00', end: '20:00' },
    thursday: { start: '08:00', end: '20:00' },
    friday: { start: '08:00', end: '20:00' },
    saturday: { start: '08:00', end: '20:00' },
    sunday: { start: '08:00', end: '20:00' },
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLightingHourChange = (day: string, field: 'start' | 'end', value: string) => {
    setLightingHours((prev) => ({
      ...prev,
      [day]: prev[day] ? { ...prev[day]!, [field]: value } : { start: '08:00', end: '20:00' },
    }));
  };

  const toggleDay = (day: string) => {
    setLightingHours((prev) => ({
      ...prev,
      [day]: prev[day] === null ? { start: '08:00', end: '20:00' } : null,
    }));
  };

  const formatNumber = (value: string): number => {
    const cleaned = value.replace(/[^\d]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      toast.error('Le titre est requis');
      return false;
    }

    if (!formData.location.trim()) {
      toast.error('La localisation est requise');
      return false;
    }

    if (!formData.objective_amount || formatNumber(formData.objective_amount) <= 0) {
      toast.error('Le montant objectif doit être supérieur à 0');
      return false;
    }

    if (formData.deadline) {
      const deadlineDate = new Date(formData.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (deadlineDate < today) {
        toast.error('La date limite doit être dans le futur');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!effectiveTenantId) {
      toast.error('Impossible de créer une campagne : tenant_id manquant');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from('campaigns').insert({
        tenant_id: effectiveTenantId,
        title: formData.title.trim(),
        screen_type: formData.screen_type,
        location: formData.location.trim(),
        annual_price_hint: formatNumber(formData.annual_price_hint),
        objective_amount: formatNumber(formData.objective_amount),
        daily_footfall_estimate: formatNumber(formData.daily_footfall_estimate),
        lighting_hours: lightingHours,
        cover_image_url: formData.cover_image_url.trim() || null,
        deadline: formData.deadline || null,
        description_md: formData.description_md.trim() || null,
        is_public_share_enabled: formData.is_public_share_enabled,
      });

      if (error) throw error;

      onSuccess();
    } catch (error: any) {
      toast.error('Erreur lors de la création: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const applyToAll = () => {
    const reference = lightingHours.monday;
    if (reference) {
      const newHours: LightingHours = {};
      DAYS_OF_WEEK.forEach((day) => {
        newHours[day.value] = { ...reference };
      });
      setLightingHours(newHours);
      toast.success('Horaires appliqués à tous les jours');
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Créer une nouvelle campagne
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Remplissez les informations ci-dessous pour créer votre campagne
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Informations générales
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Titre de la campagne *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="Ex: Écran LED Stade Principal"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Type d'écran *
                  </label>
                  <select
                    required
                    value={formData.screen_type}
                    onChange={(e) => handleInputChange('screen_type', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {SCREEN_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Localisation *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    placeholder="Ex: Stade Jean Bouin"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  URL de l'image de couverture
                </label>
                <input
                  type="url"
                  value={formData.cover_image_url}
                  onChange={(e) => handleInputChange('cover_image_url', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description (Markdown)
                </label>
                <textarea
                  value={formData.description_md}
                  onChange={(e) => handleInputChange('description_md', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="Décrivez votre campagne..."
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Objectifs et estimations
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Montant objectif * (€)
                </label>
                <input
                  type="text"
                  required
                  value={formData.objective_amount}
                  onChange={(e) => handleInputChange('objective_amount', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="50000"
                />
                {formData.objective_amount && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatNumber(formData.objective_amount).toLocaleString('fr-FR')}€
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Prix annuel indicatif (€)
                </label>
                <input
                  type="text"
                  value={formData.annual_price_hint}
                  onChange={(e) => handleInputChange('annual_price_hint', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="5000"
                />
                {formData.annual_price_hint && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatNumber(formData.annual_price_hint).toLocaleString('fr-FR')}€
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fréquentation journalière estimée
                </label>
                <input
                  type="text"
                  value={formData.daily_footfall_estimate}
                  onChange={(e) => handleInputChange('daily_footfall_estimate', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="1000"
                />
                {formData.daily_footfall_estimate && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatNumber(formData.daily_footfall_estimate).toLocaleString('fr-FR')}{' '}
                    personnes
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Horaires d'allumage
              </h2>
              <button
                type="button"
                onClick={applyToAll}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition"
              >
                Appliquer le lundi à tous
              </button>
            </div>

            <div className="space-y-3">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day.value}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3 sm:w-40">
                    <input
                      type="checkbox"
                      checked={lightingHours[day.value] !== null}
                      onChange={() => toggleDay(day.value)}
                      className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium text-slate-900 dark:text-white">
                      {day.label}
                    </label>
                  </div>

                  {lightingHours[day.value] !== null && (
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-1">
                        <input
                          type="time"
                          value={lightingHours[day.value]?.start || '08:00'}
                          onChange={(e) =>
                            handleLightingHourChange(day.value, 'start', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <span className="text-slate-500 dark:text-slate-400">à</span>
                      <div className="flex-1">
                        <input
                          type="time"
                          value={lightingHours[day.value]?.end || '20:00'}
                          onChange={(e) =>
                            handleLightingHourChange(day.value, 'end', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Options et date limite
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Date limite
                </label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => handleInputChange('deadline', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={formData.is_public_share_enabled}
                  onChange={(e) => handleInputChange('is_public_share_enabled', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="is_public"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Activer le partage public de la campagne
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition font-medium"
              disabled={saving}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {saving ? 'Création...' : 'Créer la campagne'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
