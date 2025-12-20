-- Add theme column to games
ALTER TABLE public.games
  ADD COLUMN theme text NOT NULL DEFAULT 'default';

-- Optional: enforce allowed values
ALTER TABLE public.games
  ADD CONSTRAINT games_theme_check CHECK (theme IN ('default', 'baby-autumn'));

-- Backfill existing rows if needed (already defaulted to 'default')
UPDATE public.games SET theme = 'default' WHERE theme IS NULL;
