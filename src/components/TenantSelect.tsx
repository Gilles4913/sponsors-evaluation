import { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Tenant {
  id: string;
  name: string;
}

interface TenantSelectProps {
  value: string;
  onChange: (tenantId: string) => void;
  placeholder?: string;
}

export function TenantSelect({ value, onChange, placeholder = 'Tous les tenants' }: TenantSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (value && value !== 'all') {
      fetchSelectedTenant(value);
    } else {
      setSelectedTenant(null);
    }
  }, [value]);

  useEffect(() => {
    if (isOpen) {
      fetchTenants('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (isOpen) {
        fetchTenants(searchTerm);
      }
    }, 250);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchTerm, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSelectedTenant = async (tenantId: string) => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('id', tenantId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSelectedTenant(data);
      }
    } catch (err) {
      console.error('Error fetching selected tenant:', err);
    }
  };

  const fetchTenants = async (term: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('tenants')
        .select('id, name')
        .order('name')
        .limit(20);

      if (term.trim()) {
        query = query.ilike('name', `%${term.trim()}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) {
        setTenants(data);
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (tenant: Tenant | null) => {
    if (tenant) {
      setSelectedTenant(tenant);
      onChange(tenant.id);
    } else {
      setSelectedTenant(null);
      onChange('all');
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSelect(null);
  };

  return (
    <div ref={containerRef} className="relative" data-testid="filter-tenant">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white cursor-pointer flex items-center justify-between focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500"
      >
        <span className={selectedTenant ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>
          {selectedTenant ? selectedTenant.name : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selectedTenant && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition"
            >
              <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-200 dark:border-slate-700">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un tenant..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto flex-1">
            {value !== 'all' && (
              <button
                onClick={() => handleSelect(null)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700"
              >
                Tous les tenants
              </button>
            )}

            {loading ? (
              <div className="p-4 text-center text-sm text-slate-600 dark:text-slate-400">
                Chargement...
              </div>
            ) : tenants.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-600 dark:text-slate-400">
                Aucun tenant trouvé
              </div>
            ) : (
              tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleSelect(tenant)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition ${
                    tenant.id === value
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {tenant.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
