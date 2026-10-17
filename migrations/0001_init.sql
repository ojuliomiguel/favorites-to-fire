-- Minimal on purpose: events.favorite_id needs the FK now; Import adds columns later.
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Source of truth for XP, streak and stats. Other event payloads arrive via ALTER TABLE ADD COLUMN.
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  favorite_id INTEGER NOT NULL REFERENCES favorites(id),
  type TEXT NOT NULL CHECK (type IN ('triage', 'flip', 'rescue', 'skip', 'open', 'outcome')),
  open_id INTEGER UNIQUE REFERENCES events(id),
  outcome TEXT CHECK (outcome IN ('learned', 'consumed', 'junk')),
  lesson TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- NULL passes a CHECK, hence the boolean equalities and coalesce.
  CHECK ((type = 'outcome') = (open_id IS NOT NULL)),
  CHECK ((type = 'outcome') = (outcome IS NOT NULL)),
  CHECK ((coalesce(outcome, '') = 'learned') = (length(trim(coalesce(lesson, ''), ' ' || char(9, 10, 13))) > 0)),
  CHECK (lesson IS NULL OR coalesce(outcome, '') = 'learned')
);

-- An outcome closes an open of the same favorite.
CREATE TRIGGER events_outcome_closes_open
BEFORE INSERT ON events
WHEN NEW.type = 'outcome'
BEGIN
  SELECT RAISE(ABORT, 'outcome.open_id must reference an open event of the same favorite')
  WHERE NOT EXISTS (
    SELECT 1 FROM events
    WHERE id = NEW.open_id AND type = 'open' AND favorite_id = NEW.favorite_id
  );
END;

-- An outcome is terminal: one per favorite.
CREATE UNIQUE INDEX events_one_outcome_per_favorite ON events(favorite_id) WHERE type = 'outcome';
