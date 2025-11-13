import { useState } from 'react';
import { Calculator, Save, X, TrendingUp, Users, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ForecastPanelProps {
  campaignId: string;
  objectiveAmount: number;
  currentPledged: number;
  onClose: () => void;
}

export function ForecastPanel({
  campaignId,
  objectiveAmount,
  currentPledged,
  onClose,
}: ForecastPanelProps) {
  const { user } = useAuth();
  const [pricePerSponsor, setPricePerSponsor] = useState(5000);
  const [expectedSponsors, setExpectedSponsors] = useState(5);
  const [scenarioName, setScenarioName] = useState('');
  const [saving, setSaving] = useState(false);

  const estimatedRevenue = pricePerSponsor * expectedSponsors;
  const achievementRate = objectiveAmount > 0 ? (estimatedRevenue / objectiveAmount) * 100 : 0;
  const totalWithCurrent = currentPledged + estimatedRevenue;
  const totalAchievementRate = objectiveAmount > 0 ? (totalWithCurrent / objectiveAmount) * 100 : 0;

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) {
      alert('Veuillez donner un nom au scénario');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('scenarios').insert({
        campaign_id: campaignId,
        params_json: {
          price_per_sponsor: pricePerSponsor,
          expected_sponsors_count: expectedSponsors,
        },
        results_json: {
          name: scenarioName,
          estimated_revenue: estimatedRevenue,
          achievement_rate: achievementRate,
          total_with_current: totalWithCurrent,
          total_achievement_rate: totalAchievementRate,
        },
      });

      if (error) throw error;

      alert('Scénario enregistré avec succès');
      setScenarioName('');
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Mode Prévisionnel</h2>
            <p className="text-xs text-blue-100">Simulez vos revenus futurs</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">État actuel</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Promesses actuelles</span>
              <span className="font-bold text-slate-900">
                {currentPledged.toLocaleString('fr-FR')}€
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Objectif</span>
              <span className="font-bold text-slate-900">
                {objectiveAmount.toLocaleString('fr-FR')}€
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
              <span className="text-slate-600">Reste à atteindre</span>
              <span className="font-bold text-blue-600">
                {Math.max(0, objectiveAmount - currentPledged).toLocaleString('fr-FR')}€
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              Prix par sponsor (€)
            </label>
            <input
              type="range"
              min="100"
              max="20000"
              step="100"
              value={pricePerSponsor}
              onChange={(e) => setPricePerSponsor(Number(e.target.value))}
              className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between items-center mt-2">
              <input
                type="number"
                value={pricePerSponsor}
                onChange={(e) => setPricePerSponsor(Number(e.target.value))}
                className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-center font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <span className="text-xs text-slate-500">100€ - 20 000€</span>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Users className="w-4 h-4 text-green-600" />
              Nombre de sponsors attendus
            </label>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={expectedSponsors}
              onChange={(e) => setExpectedSponsors(Number(e.target.value))}
              className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
            />
            <div className="flex justify-between items-center mt-2">
              <input
                type="number"
                value={expectedSponsors}
                onChange={(e) => setExpectedSponsors(Number(e.target.value))}
                className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-center font-bold text-slate-900 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
              <span className="text-xs text-slate-500">1 - 50 sponsors</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-5 border-2 border-green-200 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-green-700" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Résultats de la simulation
            </h3>
          </div>

          <div className="space-y-3">
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-slate-600 mb-1">Revenu estimé</p>
              <p className="text-2xl font-bold text-green-700">
                {estimatedRevenue.toLocaleString('fr-FR')}€
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {pricePerSponsor.toLocaleString('fr-FR')}€ × {expectedSponsors} sponsors
              </p>
            </div>

            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-slate-600 mb-1">Taux d'atteinte prévisionnel</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-blue-700">{achievementRate.toFixed(1)}%</p>
                <p className="text-xs text-slate-500">de l'objectif</p>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    achievementRate >= 100
                      ? 'bg-gradient-to-r from-green-500 to-green-600'
                      : 'bg-gradient-to-r from-blue-600 to-green-600'
                  }`}
                  style={{ width: `${Math.min(achievementRate, 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-lg p-3 border border-green-200">
              <p className="text-xs font-semibold text-slate-700 mb-1">Total avec promesses actuelles</p>
              <p className="text-xl font-bold text-slate-900">
                {totalWithCurrent.toLocaleString('fr-FR')}€
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1">
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        totalAchievementRate >= 100
                          ? 'bg-green-600'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(totalAchievementRate, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-700">
                  {totalAchievementRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Enregistrer ce scénario
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Ex: Scénario optimiste, Plan B..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              onClick={handleSaveScenario}
              disabled={saving || !scenarioName.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer le scénario'}
            </button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-xs text-amber-900">
            <strong>Note:</strong> Ces simulations sont des estimations basées sur vos paramètres.
            Les résultats réels peuvent varier en fonction de nombreux facteurs.
          </p>
        </div>
      </div>
    </div>
  );
}
