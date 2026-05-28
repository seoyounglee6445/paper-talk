CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  linkedin_url TEXT,
  role TEXT DEFAULT 'member',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  author_name TEXT,
  author_email TEXT,
  linkedin_url TEXT,
  status TEXT DEFAULT 'published',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
