-- Patch idempotent pour ajouter des valeurs manquantes aux enums
-- Généré le 31/10/2025

-- Ce script vérifie l'existence des valeurs enum avant de les ajouter
-- pour éviter les erreurs "enum label already exists"

-- ============================================================
-- ENUM: sponsor_segment
-- Valeurs attendues: individual, company, foundation, association
-- ============================================================

-- Valeur: individual
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'sponsor_segment' 
      AND e.enumlabel = 'individual'
  ) THEN
    EXECUTE 'ALTER TYPE sponsor_segment ADD VALUE IF NOT EXISTS ''individual''';
    RAISE NOTICE 'Valeur ''individual'' ajoutée à sponsor_segment';
  ELSE
    RAISE NOTICE 'Valeur ''individual'' existe déjà dans sponsor_segment';
  END IF;
END $$;

-- Valeur: company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'sponsor_segment' 
      AND e.enumlabel = 'company'
  ) THEN
    EXECUTE 'ALTER TYPE sponsor_segment ADD VALUE IF NOT EXISTS ''company''';
    RAISE NOTICE 'Valeur ''company'' ajoutée à sponsor_segment';
  ELSE
    RAISE NOTICE 'Valeur ''company'' existe déjà dans sponsor_segment';
  END IF;
END $$;

-- Valeur: foundation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'sponsor_segment' 
      AND e.enumlabel = 'foundation'
  ) THEN
    EXECUTE 'ALTER TYPE sponsor_segment ADD VALUE IF NOT EXISTS ''foundation''';
    RAISE NOTICE 'Valeur ''foundation'' ajoutée à sponsor_segment';
  ELSE
    RAISE NOTICE 'Valeur ''foundation'' existe déjà dans sponsor_segment';
  END IF;
END $$;

-- Valeur: association
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'sponsor_segment' 
      AND e.enumlabel = 'association'
  ) THEN
    EXECUTE 'ALTER TYPE sponsor_segment ADD VALUE IF NOT EXISTS ''association''';
    RAISE NOTICE 'Valeur ''association'' ajoutée à sponsor_segment';
  ELSE
    RAISE NOTICE 'Valeur ''association'' existe déjà dans sponsor_segment';
  END IF;
END $$;

-- ============================================================
-- ENUM: pledge_status
-- Valeurs attendues: yes, maybe, no
-- ============================================================

-- Valeur: yes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'pledge_status' 
      AND e.enumlabel = 'yes'
  ) THEN
    EXECUTE 'ALTER TYPE pledge_status ADD VALUE IF NOT EXISTS ''yes''';
    RAISE NOTICE 'Valeur ''yes'' ajoutée à pledge_status';
  ELSE
    RAISE NOTICE 'Valeur ''yes'' existe déjà dans pledge_status';
  END IF;
END $$;

-- Valeur: maybe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'pledge_status' 
      AND e.enumlabel = 'maybe'
  ) THEN
    EXECUTE 'ALTER TYPE pledge_status ADD VALUE IF NOT EXISTS ''maybe''';
    RAISE NOTICE 'Valeur ''maybe'' ajoutée à pledge_status';
  ELSE
    RAISE NOTICE 'Valeur ''maybe'' existe déjà dans pledge_status';
  END IF;
END $$;

-- Valeur: no
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'pledge_status' 
      AND e.enumlabel = 'no'
  ) THEN
    EXECUTE 'ALTER TYPE pledge_status ADD VALUE IF NOT EXISTS ''no''';
    RAISE NOTICE 'Valeur ''no'' ajoutée à pledge_status';
  ELSE
    RAISE NOTICE 'Valeur ''no'' existe déjà dans pledge_status';
  END IF;
END $$;

-- ============================================================
-- ENUM: invitation_status
-- Valeurs attendues: pending, sent, opened, responded, failed
-- ============================================================

-- Valeur: pending
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'invitation_status' 
      AND e.enumlabel = 'pending'
  ) THEN
    EXECUTE 'ALTER TYPE invitation_status ADD VALUE IF NOT EXISTS ''pending''';
    RAISE NOTICE 'Valeur ''pending'' ajoutée à invitation_status';
  ELSE
    RAISE NOTICE 'Valeur ''pending'' existe déjà dans invitation_status';
  END IF;
END $$;

-- Valeur: sent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'invitation_status' 
      AND e.enumlabel = 'sent'
  ) THEN
    EXECUTE 'ALTER TYPE invitation_status ADD VALUE IF NOT EXISTS ''sent''';
    RAISE NOTICE 'Valeur ''sent'' ajoutée à invitation_status';
  ELSE
    RAISE NOTICE 'Valeur ''sent'' existe déjà dans invitation_status';
  END IF;
END $$;

-- Valeur: opened
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'invitation_status' 
      AND e.enumlabel = 'opened'
  ) THEN
    EXECUTE 'ALTER TYPE invitation_status ADD VALUE IF NOT EXISTS ''opened''';
    RAISE NOTICE 'Valeur ''opened'' ajoutée à invitation_status';
  ELSE
    RAISE NOTICE 'Valeur ''opened'' existe déjà dans invitation_status';
  END IF;
END $$;

-- Valeur: responded
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'invitation_status' 
      AND e.enumlabel = 'responded'
  ) THEN
    EXECUTE 'ALTER TYPE invitation_status ADD VALUE IF NOT EXISTS ''responded''';
    RAISE NOTICE 'Valeur ''responded'' ajoutée à invitation_status';
  ELSE
    RAISE NOTICE 'Valeur ''responded'' existe déjà dans invitation_status';
  END IF;
END $$;

-- Valeur: failed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'invitation_status' 
      AND e.enumlabel = 'failed'
  ) THEN
    EXECUTE 'ALTER TYPE invitation_status ADD VALUE IF NOT EXISTS ''failed''';
    RAISE NOTICE 'Valeur ''failed'' ajoutée à invitation_status';
  ELSE
    RAISE NOTICE 'Valeur ''failed'' existe déjà dans invitation_status';
  END IF;
END $$;

-- ============================================================
-- ENUM: email_event_type
-- Valeurs attendues: sent, delivered, opened, clicked, bounced, complained
-- ============================================================

-- Valeur: sent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'email_event_type' 
      AND e.enumlabel = 'sent'
  ) THEN
    EXECUTE 'ALTER TYPE email_event_type ADD VALUE IF NOT EXISTS ''sent''';
    RAISE NOTICE 'Valeur ''sent'' ajoutée à email_event_type';
  ELSE
    RAISE NOTICE 'Valeur ''sent'' existe déjà dans email_event_type';
  END IF;
END $$;

-- Valeur: delivered
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'email_event_type' 
      AND e.enumlabel = 'delivered'
  ) THEN
    EXECUTE 'ALTER TYPE email_event_type ADD VALUE IF NOT EXISTS ''delivered''';
    RAISE NOTICE 'Valeur ''delivered'' ajoutée à email_event_type';
  ELSE
    RAISE NOTICE 'Valeur ''delivered'' existe déjà dans email_event_type';
  END IF;
END $$;

-- Valeur: opened
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'email_event_type' 
      AND e.enumlabel = 'opened'
  ) THEN
    EXECUTE 'ALTER TYPE email_event_type ADD VALUE IF NOT EXISTS ''opened''';
    RAISE NOTICE 'Valeur ''opened'' ajoutée à email_event_type';
  ELSE
    RAISE NOTICE 'Valeur ''opened'' existe déjà dans email_event_type';
  END IF;
END $$;

-- Valeur: clicked
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'email_event_type' 
      AND e.enumlabel = 'clicked'
  ) THEN
    EXECUTE 'ALTER TYPE email_event_type ADD VALUE IF NOT EXISTS ''clicked''';
    RAISE NOTICE 'Valeur ''clicked'' ajoutée à email_event_type';
  ELSE
    RAISE NOTICE 'Valeur ''clicked'' existe déjà dans email_event_type';
  END IF;
END $$;

-- Valeur: bounced
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'email_event_type' 
      AND e.enumlabel = 'bounced'
  ) THEN
    EXECUTE 'ALTER TYPE email_event_type ADD VALUE IF NOT EXISTS ''bounced''';
    RAISE NOTICE 'Valeur ''bounced'' ajoutée à email_event_type';
  ELSE
    RAISE NOTICE 'Valeur ''bounced'' existe déjà dans email_event_type';
  END IF;
END $$;

-- Valeur: complained
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON e.enumtypid = t.oid 
    WHERE t.typname = 'email_event_type' 
      AND e.enumlabel = 'complained'
  ) THEN
    EXECUTE 'ALTER TYPE email_event_type ADD VALUE IF NOT EXISTS ''complained''';
    RAISE NOTICE 'Valeur ''complained'' ajoutée à email_event_type';
  ELSE
    RAISE NOTICE 'Valeur ''complained'' existe déjà dans email_event_type';
  END IF;
END $$;

-- ============================================================
-- Vérification finale
-- ============================================================

DO $$
DECLARE
  sponsor_segment_count INTEGER;
  pledge_status_count INTEGER;
  invitation_status_count INTEGER;
  email_event_type_count INTEGER;
BEGIN
  -- Compte valeurs sponsor_segment
  SELECT COUNT(*) INTO sponsor_segment_count
  FROM pg_type t 
  JOIN pg_enum e ON e.enumtypid = t.oid 
  WHERE t.typname = 'sponsor_segment';
  
  -- Compte valeurs pledge_status
  SELECT COUNT(*) INTO pledge_status_count
  FROM pg_type t 
  JOIN pg_enum e ON e.enumtypid = t.oid 
  WHERE t.typname = 'pledge_status';
  
  -- Compte valeurs invitation_status
  SELECT COUNT(*) INTO invitation_status_count
  FROM pg_type t 
  JOIN pg_enum e ON e.enumtypid = t.oid 
  WHERE t.typname = 'invitation_status';
  
  -- Compte valeurs email_event_type
  SELECT COUNT(*) INTO email_event_type_count
  FROM pg_type t 
  JOIN pg_enum e ON e.enumtypid = t.oid 
  WHERE t.typname = 'email_event_type';
  
  RAISE NOTICE '=== Résumé des enums ===';
  RAISE NOTICE 'sponsor_segment: % valeurs', sponsor_segment_count;
  RAISE NOTICE 'pledge_status: % valeurs', pledge_status_count;
  RAISE NOTICE 'invitation_status: % valeurs', invitation_status_count;
  RAISE NOTICE 'email_event_type: % valeurs', email_event_type_count;
END $$;
