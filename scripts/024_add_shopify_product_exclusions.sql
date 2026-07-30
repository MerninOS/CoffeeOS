-- Shopify products the operator has explicitly declined to import.
--
-- Written when a product classified NEW is left unchecked in the sync review
-- dialog, so it stops reappearing in every subsequent preview. Deleted when the
-- operator moves it back into the import set.
--
-- Scoped to NEW products only. Declining an UPDATE to a product already in the
-- catalogue is a different gesture ("skip this change") and writes nothing here
-- — otherwise an in-use product would vanish from every future sync.

CREATE TABLE IF NOT EXISTS public.shopify_product_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shopify_id TEXT NOT NULL,
  excluded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The sync action upserts on this constraint, so re-declining an already
  -- excluded product is idempotent rather than a duplicate-key error.
  UNIQUE(user_id, shopify_id)
);

ALTER TABLE public.shopify_product_exclusions ENABLE ROW LEVEL SECURITY;

-- Team-aware, mirroring public.products and public.product_variants: an
-- exclusion belongs to the owner, and teammates resolve to that same owner via
-- get_user_owner_id. One operator's "don't import this" therefore applies to
-- the whole team, which matches how the products it gates are scoped.

DROP POLICY IF EXISTS "shopify_product_exclusions_select_team" ON public.shopify_product_exclusions;
CREATE POLICY "shopify_product_exclusions_select_team" ON public.shopify_product_exclusions FOR SELECT
USING (
  auth.uid() = user_id
  OR user_id = public.get_user_owner_id(auth.uid())
);

DROP POLICY IF EXISTS "shopify_product_exclusions_insert_team" ON public.shopify_product_exclusions;
CREATE POLICY "shopify_product_exclusions_insert_team" ON public.shopify_product_exclusions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR user_id = public.get_user_owner_id(auth.uid())
);

DROP POLICY IF EXISTS "shopify_product_exclusions_update_team" ON public.shopify_product_exclusions;
CREATE POLICY "shopify_product_exclusions_update_team" ON public.shopify_product_exclusions FOR UPDATE
USING (
  auth.uid() = user_id
  OR user_id = public.get_user_owner_id(auth.uid())
);

DROP POLICY IF EXISTS "shopify_product_exclusions_delete_team" ON public.shopify_product_exclusions;
CREATE POLICY "shopify_product_exclusions_delete_team" ON public.shopify_product_exclusions FOR DELETE
USING (
  auth.uid() = user_id
  OR user_id = public.get_user_owner_id(auth.uid())
);

-- The preview loads every exclusion for one owner on each run.
CREATE INDEX IF NOT EXISTS idx_shopify_product_exclusions_user_id
  ON public.shopify_product_exclusions(user_id);
