-- Add unique constraint for orders upsert
ALTER TABLE public.orders 
ADD CONSTRAINT orders_shopify_order_id_user_id_key 
UNIQUE (shopify_order_id, user_id);
