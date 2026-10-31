-- Daily non-identifying GET counts for public forum discovery. No IPs, URLs,
-- user agents, tokens, member IDs, topic IDs, referrers, or message contents.
CREATE TABLE IF NOT EXISTS forum_discovery_counters (
  day TEXT NOT NULL,
  surface TEXT NOT NULL CHECK (surface IN ('questions_list','help_category','question_detail')),
  hits INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
  PRIMARY KEY(day,surface)
);
