-- ============================================================
-- Multi-Domain RAG System — MySQL Schema
-- Run this file once to set up your database:
--   mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS rag_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rag_system;

-- -------------------------------------------------------
-- USERS — stores registered accounts
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(80)  NOT NULL UNIQUE,
    email       VARCHAR(120) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,         -- bcrypt hash
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------
-- SESSIONS — server-side session tokens
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL,
    token       VARCHAR(255) NOT NULL UNIQUE,
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    expires_at  DATETIME     NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- DOCUMENTS — uploaded PDF metadata per user
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT          NOT NULL,
    filename     VARCHAR(255) NOT NULL,
    domain       VARCHAR(80)  NOT NULL DEFAULT 'general',
    chunks_count INT          NOT NULL DEFAULT 0,
    uploaded_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- CHAT_SESSIONS — complete user sessions with multiple Q&As
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT          NOT NULL,
    document_id      INT,
    domain           VARCHAR(80)  NOT NULL DEFAULT 'general',
    session_data     JSON         NOT NULL,          -- Array of {query, response, retrieval_method}
    first_query      TEXT         NOT NULL,          -- First query for preview
    message_count    INT          NOT NULL DEFAULT 0,
    created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
    INDEX idx_user_created (user_id, created_at)
);

-- -------------------------------------------------------
-- CUSTOM DOMAINS — user-created domain frameworks
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_domains (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT          NOT NULL,
    domain_id     VARCHAR(80)  NOT NULL,
    domain_name   VARCHAR(80)  NOT NULL,
    keywords      TEXT,                        -- JSON array string
    structure     TEXT,                        -- JSON array string
    prompt_prefix TEXT,
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_domain (user_id, domain_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
