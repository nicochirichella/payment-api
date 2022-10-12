UPDATE items SET details_new = details::jsonb WHERE details_new is null and details is not null;
ALTER TABLE items RENAME COLUMN details TO details_old;
ALTER TABLE items RENAME COLUMN details_new TO details;
