-- Patch idempotent pour activer pg_trgm et créer les indexes GIN tri-grammes
-- Généré le 31/10/2025

-- Ce script active l'extension pg_trgm et crée des indexes GIN pour la recherche
-- textuelle performante avec opérateurs LIKE/ILIKE et similarité

-- ============================================================
-- EXTENSION: pg_trgm (tri-grammes)
-- ============================================================

-- Activer l'extension pg_trgm si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) THEN
    CREATE EXTENSION pg_trgm;
    RAISE NOTICE 'Extension pg_trgm activée';
  ELSE
    RAISE NOTICE 'Extension pg_trgm déjà activée';
  END IF;
END $$;

-- ============================================================
-- TABLE: sponsors
-- Indexes GIN tri-grammes pour recherche textuelle
-- ============================================================

-- Index GIN sur sponsors.company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'sponsors' 
      AND indexname = 'idx_sponsors_company_trgm'
  ) THEN
    CREATE INDEX idx_sponsors_company_trgm ON public.sponsors 
    USING gin (company gin_trgm_ops);
    RAISE NOTICE 'Index idx_sponsors_company_trgm créé sur sponsors.company';
  ELSE
    RAISE NOTICE 'Index idx_sponsors_company_trgm existe déjà';
  END IF;
END $$;

-- Index GIN sur sponsors.contact_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'sponsors' 
      AND indexname = 'idx_sponsors_contact_name_trgm'
  ) THEN
    CREATE INDEX idx_sponsors_contact_name_trgm ON public.sponsors 
    USING gin (contact_name gin_trgm_ops);
    RAISE NOTICE 'Index idx_sponsors_contact_name_trgm créé sur sponsors.contact_name';
  ELSE
    RAISE NOTICE 'Index idx_sponsors_contact_name_trgm existe déjà';
  END IF;
END $$;

-- Index GIN sur sponsors.email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'sponsors' 
      AND indexname = 'idx_sponsors_email_trgm'
  ) THEN
    CREATE INDEX idx_sponsors_email_trgm ON public.sponsors 
    USING gin (email gin_trgm_ops);
    RAISE NOTICE 'Index idx_sponsors_email_trgm créé sur sponsors.email';
  ELSE
    RAISE NOTICE 'Index idx_sponsors_email_trgm existe déjà';
  END IF;
END $$;

-- ============================================================
-- TABLE: tenants
-- Indexes GIN tri-grammes pour recherche textuelle
-- ============================================================

-- Index GIN sur tenants.name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'tenants' 
      AND indexname = 'idx_tenants_name_trgm'
  ) THEN
    CREATE INDEX idx_tenants_name_trgm ON public.tenants 
    USING gin (name gin_trgm_ops);
    RAISE NOTICE 'Index idx_tenants_name_trgm créé sur tenants.name';
  ELSE
    RAISE NOTICE 'Index idx_tenants_name_trgm existe déjà';
  END IF;
END $$;

-- Index GIN sur tenants.email_contact
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'tenants' 
      AND indexname = 'idx_tenants_email_contact_trgm'
  ) THEN
    CREATE INDEX idx_tenants_email_contact_trgm ON public.tenants 
    USING gin (email_contact gin_trgm_ops);
    RAISE NOTICE 'Index idx_tenants_email_contact_trgm créé sur tenants.email_contact';
  ELSE
    RAISE NOTICE 'Index idx_tenants_email_contact_trgm existe déjà';
  END IF;
END $$;

-- ============================================================
-- Vérification finale
-- ============================================================

DO $$
DECLARE
  extension_active BOOLEAN;
  sponsors_indexes_count INTEGER;
  tenants_indexes_count INTEGER;
BEGIN
  -- Vérifier extension pg_trgm
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) INTO extension_active;
  
  -- Compter indexes GIN tri-grammes sur sponsors
  SELECT COUNT(*) INTO sponsors_indexes_count
  FROM pg_indexes 
  WHERE schemaname = 'public' 
    AND tablename = 'sponsors' 
    AND indexname LIKE '%_trgm';
  
  -- Compter indexes GIN tri-grammes sur tenants
  SELECT COUNT(*) INTO tenants_indexes_count
  FROM pg_indexes 
  WHERE schemaname = 'public' 
    AND tablename = 'tenants' 
    AND indexname LIKE '%_trgm';
  
  RAISE NOTICE '=== Résumé des indexes tri-grammes ===';
  RAISE NOTICE 'Extension pg_trgm active: %', extension_active;
  RAISE NOTICE 'Indexes GIN sur sponsors: % (attendu: 3)', sponsors_indexes_count;
  RAISE NOTICE 'Indexes GIN sur tenants: % (attendu: 2)', tenants_indexes_count;
  RAISE NOTICE 'Total indexes tri-grammes: %', sponsors_indexes_count + tenants_indexes_count;
END $$;

-- ============================================================
-- Exemples de requêtes optimisées par ces indexes
-- ============================================================

/*
-- Recherche ILIKE sur sponsors.company (utilise idx_sponsors_company_trgm)
SELECT * FROM sponsors 
WHERE company ILIKE '%foundation%';

-- Recherche ILIKE sur sponsors.contact_name (utilise idx_sponsors_contact_name_trgm)
SELECT * FROM sponsors 
WHERE contact_name ILIKE '%jean%';

-- Recherche ILIKE sur sponsors.email (utilise idx_sponsors_email_trgm)
SELECT * FROM sponsors 
WHERE email ILIKE '%@gmail.com%';

-- Recherche par similarité (pg_trgm)
SELECT *, similarity(company, 'Fondation') AS sim
FROM sponsors 
WHERE company % 'Fondation'
ORDER BY sim DESC;

-- Recherche multi-colonnes
SELECT * FROM sponsors 
WHERE company ILIKE '%sports%' 
   OR contact_name ILIKE '%sports%'
   OR email ILIKE '%sports%';

-- Recherche sur tenants.name (utilise idx_tenants_name_trgm)
SELECT * FROM tenants 
WHERE name ILIKE '%club%';

-- Recherche sur tenants.email_contact (utilise idx_tenants_email_contact_trgm)
SELECT * FROM tenants 
WHERE email_contact ILIKE '%@club%';
*/
