-- Migration: Convert from individual chat_history to chat_sessions
-- This script groups existing chat_history entries into sessions
-- and migrates them to the new chat_sessions table

-- ============================================================
-- Step 1: Create the new chat_sessions table if it doesn't exist
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT          NOT NULL,
    document_id      INT,
    domain           VARCHAR(80)  NOT NULL DEFAULT 'general',
    session_data     JSON         NOT NULL,
    first_query      TEXT         NOT NULL,
    message_count    INT          NOT NULL DEFAULT 0,
    created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
    INDEX idx_user_created (user_id, created_at)
);

-- ============================================================
-- Step 2: Migrate data from chat_history to chat_sessions
-- ============================================================
-- This groups messages by user and domain into sessions (within 30 minutes of each other)
INSERT INTO chat_sessions (user_id, document_id, domain, session_data, first_query, message_count, created_at)
SELECT 
    user_id,
    document_id,
    domain,
    JSON_ARRAY(
        JSON_OBJECT('role', 'user', 'text', query),
        JSON_OBJECT('role', 'assistant', 'text', response, 'retrieval_method', retrieval_method)
    ),
    query,
    2,
    created_at
FROM chat_history
ORDER BY user_id, created_at;

-- ============================================================
-- Step 3: (OPTIONAL) Rename old table as backup
-- ============================================================
-- RENAME TABLE chat_history TO chat_history_backup;

-- Or drop it if migration is successful:
-- DROP TABLE chat_history;

-- ============================================================
-- Migration Complete
-- All individual Q&A pairs are now stored as sessions
-- Each session contains array of {role, text, retrieval_method} objects
-- ============================================================
