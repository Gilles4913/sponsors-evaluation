-- Patch idempotent pour créer les policies RLS manquantes
-- Généré le 31/10/2025

-- Ce script vérifie l'existence des policies avant de les créer
-- pour éviter les erreurs "policy already exists"

-- ============================================================
-- INVITATIONS - Policy tenant_rw (read/write pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy invitations_tenant_rw existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'invitations' 
      AND policyname = 'invitations_tenant_rw'
  ) THEN
    -- Crée la policy pour SELECT/UPDATE/DELETE
    EXECUTE 'CREATE POLICY invitations_tenant_rw ON public.invitations
      FOR ALL
      TO authenticated
      USING (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))
      WITH CHECK (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))';
    
    RAISE NOTICE 'Policy invitations_tenant_rw créée avec succès';
  ELSE
    RAISE NOTICE 'Policy invitations_tenant_rw existe déjà';
  END IF;
END $$;

-- ============================================================
-- PLEDGES - Policy tenant_i (insert pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy pledges_tenant_i existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'pledges' 
      AND policyname = 'pledges_tenant_i'
  ) THEN
    -- Crée la policy pour INSERT
    EXECUTE 'CREATE POLICY pledges_tenant_i ON public.pledges
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM campaigns c
          WHERE c.id = campaign_id
            AND c.tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid())
        )
      )';
    
    RAISE NOTICE 'Policy pledges_tenant_i créée avec succès';
  ELSE
    RAISE NOTICE 'Policy pledges_tenant_i existe déjà';
  END IF;
END $$;

-- ============================================================
-- CAMPAIGNS - Policy tenant_select (read pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy campaigns_tenant_select existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'campaigns' 
      AND policyname = 'campaigns_tenant_select'
  ) THEN
    -- Crée la policy pour SELECT
    EXECUTE 'CREATE POLICY campaigns_tenant_select ON public.campaigns
      FOR SELECT
      TO authenticated
      USING (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))';
    
    RAISE NOTICE 'Policy campaigns_tenant_select créée avec succès';
  ELSE
    RAISE NOTICE 'Policy campaigns_tenant_select existe déjà';
  END IF;
END $$;

-- ============================================================
-- CAMPAIGNS - Policy tenant_insert (insert pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy campaigns_tenant_insert existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'campaigns' 
      AND policyname = 'campaigns_tenant_insert'
  ) THEN
    -- Crée la policy pour INSERT
    EXECUTE 'CREATE POLICY campaigns_tenant_insert ON public.campaigns
      FOR INSERT
      TO authenticated
      WITH CHECK (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))';
    
    RAISE NOTICE 'Policy campaigns_tenant_insert créée avec succès';
  ELSE
    RAISE NOTICE 'Policy campaigns_tenant_insert existe déjà';
  END IF;
END $$;

-- ============================================================
-- CAMPAIGNS - Policy tenant_update (update pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy campaigns_tenant_update existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'campaigns' 
      AND policyname = 'campaigns_tenant_update'
  ) THEN
    -- Crée la policy pour UPDATE
    EXECUTE 'CREATE POLICY campaigns_tenant_update ON public.campaigns
      FOR UPDATE
      TO authenticated
      USING (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))
      WITH CHECK (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))';
    
    RAISE NOTICE 'Policy campaigns_tenant_update créée avec succès';
  ELSE
    RAISE NOTICE 'Policy campaigns_tenant_update existe déjà';
  END IF;
END $$;

-- ============================================================
-- CAMPAIGNS - Policy tenant_delete (delete pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy campaigns_tenant_delete existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'campaigns' 
      AND policyname = 'campaigns_tenant_delete'
  ) THEN
    -- Crée la policy pour DELETE
    EXECUTE 'CREATE POLICY campaigns_tenant_delete ON public.campaigns
      FOR DELETE
      TO authenticated
      USING (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))';
    
    RAISE NOTICE 'Policy campaigns_tenant_delete créée avec succès';
  ELSE
    RAISE NOTICE 'Policy campaigns_tenant_delete existe déjà';
  END IF;
END $$;

-- ============================================================
-- SPONSORS - Policy tenant_select (read pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy sponsors_tenant_select existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'sponsors' 
      AND policyname = 'sponsors_tenant_select'
  ) THEN
    -- Crée la policy pour SELECT
    EXECUTE 'CREATE POLICY sponsors_tenant_select ON public.sponsors
      FOR SELECT
      TO authenticated
      USING (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))';
    
    RAISE NOTICE 'Policy sponsors_tenant_select créée avec succès';
  ELSE
    RAISE NOTICE 'Policy sponsors_tenant_select existe déjà';
  END IF;
END $$;

-- ============================================================
-- SPONSORS - Policy tenant_insert (insert pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy sponsors_tenant_insert existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'sponsors' 
      AND policyname = 'sponsors_tenant_insert'
  ) THEN
    -- Crée la policy pour INSERT
    EXECUTE 'CREATE POLICY sponsors_tenant_insert ON public.sponsors
      FOR INSERT
      TO authenticated
      WITH CHECK (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))';
    
    RAISE NOTICE 'Policy sponsors_tenant_insert créée avec succès';
  ELSE
    RAISE NOTICE 'Policy sponsors_tenant_insert existe déjà';
  END IF;
END $$;

-- ============================================================
-- SPONSORS - Policy tenant_update (update pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy sponsors_tenant_update existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'sponsors' 
      AND policyname = 'sponsors_tenant_update'
  ) THEN
    -- Crée la policy pour UPDATE
    EXECUTE 'CREATE POLICY sponsors_tenant_update ON public.sponsors
      FOR UPDATE
      TO authenticated
      USING (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))
      WITH CHECK (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))';
    
    RAISE NOTICE 'Policy sponsors_tenant_update créée avec succès';
  ELSE
    RAISE NOTICE 'Policy sponsors_tenant_update existe déjà';
  END IF;
END $$;

-- ============================================================
-- SPONSORS - Policy tenant_delete (delete pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy sponsors_tenant_delete existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'sponsors' 
      AND policyname = 'sponsors_tenant_delete'
  ) THEN
    -- Crée la policy pour DELETE
    EXECUTE 'CREATE POLICY sponsors_tenant_delete ON public.sponsors
      FOR DELETE
      TO authenticated
      USING (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))';
    
    RAISE NOTICE 'Policy sponsors_tenant_delete créée avec succès';
  ELSE
    RAISE NOTICE 'Policy sponsors_tenant_delete existe déjà';
  END IF;
END $$;

-- ============================================================
-- PLEDGES - Policy tenant_select (read pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy pledges_tenant_select existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'pledges' 
      AND policyname = 'pledges_tenant_select'
  ) THEN
    -- Crée la policy pour SELECT
    EXECUTE 'CREATE POLICY pledges_tenant_select ON public.pledges
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM campaigns c
          WHERE c.id = campaign_id
            AND c.tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid())
        )
      )';
    
    RAISE NOTICE 'Policy pledges_tenant_select créée avec succès';
  ELSE
    RAISE NOTICE 'Policy pledges_tenant_select existe déjà';
  END IF;
END $$;

-- ============================================================
-- PLEDGES - Policy tenant_update (update pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy pledges_tenant_update existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'pledges' 
      AND policyname = 'pledges_tenant_update'
  ) THEN
    -- Crée la policy pour UPDATE
    EXECUTE 'CREATE POLICY pledges_tenant_update ON public.pledges
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM campaigns c
          WHERE c.id = campaign_id
            AND c.tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM campaigns c
          WHERE c.id = campaign_id
            AND c.tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid())
        )
      )';
    
    RAISE NOTICE 'Policy pledges_tenant_update créée avec succès';
  ELSE
    RAISE NOTICE 'Policy pledges_tenant_update existe déjà';
  END IF;
END $$;

-- ============================================================
-- PLEDGES - Policy tenant_delete (delete pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy pledges_tenant_delete existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'pledges' 
      AND policyname = 'pledges_tenant_delete'
  ) THEN
    -- Crée la policy pour DELETE
    EXECUTE 'CREATE POLICY pledges_tenant_delete ON public.pledges
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM campaigns c
          WHERE c.id = campaign_id
            AND c.tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid())
        )
      )';
    
    RAISE NOTICE 'Policy pledges_tenant_delete créée avec succès';
  ELSE
    RAISE NOTICE 'Policy pledges_tenant_delete existe déjà';
  END IF;
END $$;

-- ============================================================
-- EMAIL_TEMPLATES - Policy tenant_select (read pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy email_templates_tenant_select existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'email_templates' 
      AND policyname = 'email_templates_tenant_select'
  ) THEN
    -- Crée la policy pour SELECT
    EXECUTE 'CREATE POLICY email_templates_tenant_select ON public.email_templates
      FOR SELECT
      TO authenticated
      USING (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()) OR tenant_id IS NULL)';
    
    RAISE NOTICE 'Policy email_templates_tenant_select créée avec succès';
  ELSE
    RAISE NOTICE 'Policy email_templates_tenant_select existe déjà';
  END IF;
END $$;

-- ============================================================
-- EMAIL_TEMPLATES - Policy tenant_insert (insert pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy email_templates_tenant_insert existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'email_templates' 
      AND policyname = 'email_templates_tenant_insert'
  ) THEN
    -- Crée la policy pour INSERT
    EXECUTE 'CREATE POLICY email_templates_tenant_insert ON public.email_templates
      FOR INSERT
      TO authenticated
      WITH CHECK (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))';
    
    RAISE NOTICE 'Policy email_templates_tenant_insert créée avec succès';
  ELSE
    RAISE NOTICE 'Policy email_templates_tenant_insert existe déjà';
  END IF;
END $$;

-- ============================================================
-- EMAIL_TEMPLATES - Policy tenant_update (update pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy email_templates_tenant_update existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'email_templates' 
      AND policyname = 'email_templates_tenant_update'
  ) THEN
    -- Crée la policy pour UPDATE
    EXECUTE 'CREATE POLICY email_templates_tenant_update ON public.email_templates
      FOR UPDATE
      TO authenticated
      USING (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))
      WITH CHECK (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))';
    
    RAISE NOTICE 'Policy email_templates_tenant_update créée avec succès';
  ELSE
    RAISE NOTICE 'Policy email_templates_tenant_update existe déjà';
  END IF;
END $$;

-- ============================================================
-- EMAIL_TEMPLATES - Policy tenant_delete (delete pour tenant)
-- ============================================================

DO $$
BEGIN
  -- Vérifie si la policy email_templates_tenant_delete existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'email_templates' 
      AND policyname = 'email_templates_tenant_delete'
  ) THEN
    -- Crée la policy pour DELETE
    EXECUTE 'CREATE POLICY email_templates_tenant_delete ON public.email_templates
      FOR DELETE
      TO authenticated
      USING (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()))';
    
    RAISE NOTICE 'Policy email_templates_tenant_delete créée avec succès';
  ELSE
    RAISE NOTICE 'Policy email_templates_tenant_delete existe déjà';
  END IF;
END $$;

-- ============================================================
-- Vérification finale
-- ============================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('invitations', 'pledges', 'campaigns', 'sponsors', 'email_templates');
  
  RAISE NOTICE 'Nombre total de policies RLS: %', policy_count;
END $$;
