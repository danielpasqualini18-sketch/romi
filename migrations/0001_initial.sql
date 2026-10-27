CREATE TABLE events (
 id TEXT PRIMARY KEY,
 at TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('breast','bottle','pump','nappy','weight','note','vomit')),
 value REAL,
 side TEXT NOT NULL DEFAULT '',
 wet INTEGER NOT NULL DEFAULT 0,
 poo INTEGER NOT NULL DEFAULT 0,
 notes TEXT NOT NULL DEFAULT '',
 milk TEXT NOT NULL DEFAULT '',
 wet_size TEXT NOT NULL DEFAULT '',
 poo_size TEXT NOT NULL DEFAULT '',
 vomit_size TEXT NOT NULL DEFAULT '',
 date_only INTEGER NOT NULL DEFAULT 0,
 duration_seconds INTEGER,
 left_seconds INTEGER,
 right_seconds INTEGER,
 revision INTEGER NOT NULL DEFAULT 1,
 deleted INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX events_at ON events(at);
CREATE TABLE feed_timer (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 revision INTEGER NOT NULL DEFAULT 1,
 state TEXT NOT NULL DEFAULT '{"status":"idle"}'
);
INSERT INTO feed_timer(singleton) VALUES(1);
