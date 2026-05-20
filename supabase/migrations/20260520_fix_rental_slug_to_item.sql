-- Rename column to match application code
ALTER TABLE public.bookings
RENAME COLUMN rental_slug TO rental_item;

-- Rename index to match new column name
ALTER INDEX bookings_rental_slug_event_date_idx
RENAME TO bookings_rental_item_event_date_idx;

-- Recreate index using new column name (safe if needed)
DROP INDEX IF EXISTS bookings_rental_item_event_date_idx;
CREATE INDEX bookings_rental_item_event_date_idx
ON public.bookings (rental_item, event_date);
