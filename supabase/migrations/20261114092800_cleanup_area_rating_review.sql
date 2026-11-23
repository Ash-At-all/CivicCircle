-- Cleanup: area ratings and reviews are no longer used by the product.
-- The area chat, shop ratings/reviews and post interactions replaced them.
-- Dead schema, so drop the tables and the two helper RPCs that only served them.

drop table if exists public.area_ratings cascade;
drop table if exists public.area_reviews cascade;

drop function if exists public.set_area_rating(uuid, integer);
drop function if exists public.set_area_review(uuid, text);

notify pgrst, 'reload schema';
