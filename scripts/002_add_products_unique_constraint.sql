-- Add unique constraint on shopify_id and user_id for upsert to work
ALTER TABLE public.products 
ADD CONSTRAINT products_shopify_id_user_id_key UNIQUE (shopify_id, user_id);
