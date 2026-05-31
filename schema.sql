CREATE TABLE IF NOT EXISTS gpt_threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT DEFAULT 'New chat',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gpt_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS research_knowledge (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_url TEXT,
  pdf_link TEXT,
  content TEXT,
  search_text TEXT,
  keywords TEXT,
  status TEXT DEFAULT 'indexed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE research_knowledge ADD COLUMN search_text TEXT;
ALTER TABLE research_knowledge ADD COLUMN keywords TEXT;

CREATE INDEX IF NOT EXISTS idx_gpt_threads_user_id
ON gpt_threads(user_id);

CREATE INDEX IF NOT EXISTS idx_gpt_messages_thread_id
ON gpt_messages(thread_id);

CREATE INDEX IF NOT EXISTS idx_gpt_messages_user_role_created
ON gpt_messages(user_id, role, created_at);

CREATE INDEX IF NOT EXISTS idx_research_knowledge_post_id
ON research_knowledge(post_id);

CREATE INDEX IF NOT EXISTS idx_research_knowledge_title
ON research_knowledge(title);

CREATE INDEX IF NOT EXISTS idx_research_knowledge_status
ON research_knowledge(status);

CREATE INDEX IF NOT EXISTS idx_research_knowledge_updated_at
ON research_knowledge(updated_at);
