# Multi-Domain Knowledge Assistant - System Documentation

## Abstract

The Multi-Domain Knowledge Assistant (MDKA) is an advanced Retrieval-Augmented Generation (RAG) system designed to provide intelligent, domain-specific document retrieval and question-answering capabilities. The system enables users to upload documents across multiple domains (Healthcare, Legal, Finance, Technical, and General) and query them using either direct similarity-based retrieval or LLM-assisted retrieval with query expansion. The application leverages Google's Gemini 2.5 Pro API for natural language processing, implements session-based conversation tracking for better user experience, and automatically detects the optimal retrieval strategy based on question complexity. Built with Flask backend and modern frontend technologies, the system ensures scalability, security through user authentication, and independent operation of direct retrieval even when LLM services are unavailable.

---

## Introduction

### 1.1 Purpose
The Multi-Domain Knowledge Assistant addresses the challenge of efficiently searching and extracting relevant information from large document collections across diverse domains. Traditional search methods often fail to capture semantic meaning and context, leading to irrelevant results. This system bridges that gap by implementing:

- **Semantic Search Capability**: Uses embeddings-based retrieval to find semantically similar content
- **Domain Awareness**: Tailored retrieval strategies and prompts for different knowledge domains
- **Intelligent Query Expansion**: LLM-assisted retrieval for complex queries requiring synthesis and reasoning
- **Auto-Detection Logic**: Automatically selects optimal retrieval strategy based on question complexity
- **Session-Based Conversation Tracking**: Groups related questions into coherent sessions for better context management

### 1.2 Problem Statement
Organizations and individuals face challenges in:
1. Searching unstructured document repositories efficiently
2. Retrieving semantically relevant information beyond keyword matching
3. Managing complex queries requiring synthesis across multiple documents
4. Handling domain-specific context and terminology
5. Tracking conversation history in a meaningful way

### 1.3 System Scope
The MDKA system provides:
- Multi-domain document management (Healthcare, Legal, Finance, Technical, General)
- Dual retrieval strategies (Direct and LLM-Assisted)
- User authentication and session management
- Document versioning and deletion
- Chat session persistence
- Automatic retrieval mode detection based on query analysis

---

## Existing System

### 2.1 Current Document Management Approaches
Traditional document management systems rely on:
- **Keyword-based search**: Limited to exact term matching
- **Boolean search**: Complex query syntax, poor user experience
- **Basic full-text indexing**: Doesn't capture semantic meaning
- **Manual categorization**: Labor-intensive and error-prone

### 2.2 Limitations of Existing Solutions
1. **No semantic understanding**: Cannot find conceptually related content
2. **Domain-agnostic responses**: Generic answers without domain context
3. **Manual retrieval strategy selection**: Users must choose between approaches
4. **No conversation context**: Each query treated independently
5. **Single point of failure**: LLM dependency prevents any retrieval if API fails
6. **Poor history management**: Saves individual Q&A pairs instead of coherent sessions

### 2.3 State-of-the-Art in RAG
Current systems like OpenAI's ChatGPT with plugins, Anthropic's Claude with tool use, and commercial solutions offer:
- Semantic search capabilities
- LLM integration
- But typically:
  - Generic (non-domain-aware)
  - Proprietary (not customizable)
  - Single retrieval strategy
  - No auto-detection of query complexity
  - Dependent on LLM for all operations

---

## Proposed System

### 3.1 System Overview
The Multi-Domain Knowledge Assistant implements a hybrid RAG architecture with:

```
User Interface (React)
    ↓
Flask Backend API
    ↓
┌─────────────────────────────────────┐
│  Retrieval Orchestrator              │
├─────────────────────────────────────┤
│  • Auto-detect retrieval mode       │
│  • Route to appropriate retriever   │
│  • Manage context/chunks            │
└─────────────────────────────────────┘
    ↓                        ↓
Direct Retrieval      LLM-Assisted Retrieval
(Cosine Similarity)   (Query Expansion + Retrieval)
    ↓                        ↓
Vector Store           Gemini API
(In-Memory/File)       (Query Expansion)
    ↓                        ↓
Database               Vector Store
(MySQL)                    ↓
    ↓                   Gemini API
User/Document          (Response Generation)
Sessions/History
```

### 3.2 Key Components

#### 3.2.1 Authentication Module
- User registration and login
- Password hashing with bcrypt
- Session management with HTTP-only cookies
- Role-based access control

#### 3.2.2 Document Management Module
- File upload (PDF, TXT)
- Automatic chunking (512-token chunks with 50-token overlap)
- Embedding generation using Gemini API
- Document versioning and deletion
- Domain classification (5 domains)

#### 3.2.3 Retrieval Engine
**Direct Retrieval**:
- Embeds query using Gemini API
- Performs cosine similarity search
- Returns top-K chunks (K=5)
- Fastest, most reliable method
- Works independently of LLM

**LLM-Assisted Retrieval**:
- Calls Gemini API for query expansion
- Generates 3 expanded queries
- Searches for each expanded query
- Deduplicates and ranks results
- Enriches context for LLM

#### 3.2.4 Auto-Detection Logic
Analyzes query characteristics:
- **Direct retrieval** for: Short queries, single facts, direct definitions
  - Query length < 8 words
  - Patterns: "What is X?", "Who is X?", "List X", "Definition of X"
- **LLM-assisted** for: Complex questions, synthesis, reasoning
  - Query length > 8 words with LLM indicators
  - Patterns: "How to X?", "Compare X and Y", "Why?", "Explain X"

#### 3.2.5 Response Generation Module
- Combines retrieved chunks with user query
- Generates domain-aware prompts
- Calls Gemini 2.5 Pro API
- Retry logic with timeout handling
- Fallback to raw chunks if LLM fails (direct retrieval only)

#### 3.2.6 Session Management
- Tracks all messages in a session
- Groups Q&A pairs into coherent conversations
- Saves complete session when user leaves chat
- Allows resuming previous conversations
- Stores session metadata (domain, first query, message count)

#### 3.2.7 Chat History Module
- Saves complete sessions (not individual messages)
- Groups by date (Today, Yesterday, older)
- Previews with first question
- Delete individual sessions
- Load and resume previous conversations

### 3.3 Workflows

#### 3.3.1 Document Upload Workflow
```
1. User selects domain
2. User uploads PDF/TXT file
3. System extracts text
4. Text chunked (512 tokens, 50-token overlap)
5. Each chunk embedded using Gemini API
6. Embeddings stored in vector store
7. Metadata stored in MySQL
8. Success confirmation shown
```

#### 3.3.2 Chat Workflow
```
1. User enters query
2. System auto-detects retrieval mode
3. If direct:
   - Embed query
   - Search vector store
   - Return top-5 chunks
4. If LLM-assisted:
   - Call Gemini for query expansion
   - Search for each expanded query
   - Deduplicate and rank results
5. Generate response using Gemini
6. Track message in session memory
7. Display response with chunks
8. On session end (page leave):
   - Save entire session to database
```

#### 3.3.3 Session Save Workflow
```
1. User leaves chat page or closes browser
2. beforeunload event triggered
3. If session has messages:
   - Create session record
   - Store all messages as JSON
   - Store first query as preview
   - Store message count
   - Save to chat_sessions table
4. Clear session memory
5. Reload history on page return
```

### 3.4 Domain-Specific Features

#### Healthcare Domain
- Medical terminology recognition
- Disease/symptom/treatment context
- HIPAA-compliance ready architecture
- Specialized prompt templates

#### Legal Domain
- Contract clause analysis
- Case law precedent context
- Compliance document handling
- Legal terminology support

#### Finance Domain
- Financial instrument analysis
- Regulatory compliance context
- Annual report/filing support
- Accounting terminology

#### Technical Domain
- Code snippet support
- API documentation handling
- Technical specification context
- Version compatibility tracking

#### General Domain
- Fallback for any domain
- General knowledge support
- Flexible query handling

### 3.5 Data Flow

#### Query Processing Pipeline
```
User Query
    ↓
[Validation & Sanitization]
    ↓
[Auto-Detect Retrieval Mode]
    ├─→ Direct Path
    │   ├─→ Embed Query
    │   ├─→ Cosine Similarity Search
    │   └─→ Return Top-5 Chunks
    │
    └─→ LLM-Assisted Path
        ├─→ Query Expansion (Gemini)
        ├─→ Multi-Query Search
        ├─→ Rank & Deduplicate
        └─→ Return Enriched Chunks
    ↓
[Generate Response]
    ├─→ Prepare Prompt
    ├─→ Call Gemini API
    ├─→ Handle Errors/Fallback
    └─→ Return Response
    ↓
[Track in Session]
    └─→ Store in Memory
```

---

## Software Requirements

### 4.1 Backend Requirements

#### Programming Language & Framework
- **Python 3.9+**: Server-side logic
- **Flask 2.3+**: REST API framework
- **Flask-CORS**: Cross-origin resource sharing

#### Database & Storage
- **MySQL 5.7+**: User data, document metadata, session storage
- **MySQL Connector**: Python-MySQL bridge
- **JSON Storage**: Vector embeddings (in-memory or file-based)

#### Machine Learning & NLP
- **Google Gemini 2.5 Pro API**: 
  - Text embedding generation
  - Query expansion
  - Response generation
- **NumPy**: Vector operations and similarity calculations

#### Security & Authentication
- **bcrypt**: Password hashing
- **JWT/Session Cookies**: Authentication tokens
- **python-dotenv**: Environment variable management

#### Utilities
- **Requests**: HTTP calls to external APIs
- **PyPDF2**: PDF text extraction
- **Regular Expressions**: Text chunking and cleaning

### 4.2 Frontend Requirements

#### Framework & Libraries
- **HTML5**: Semantic markup
- **CSS3**: Styling and animations
- **JavaScript (ES6+)**: Interactive functionality
- **No framework**: Vanilla JS for lightweight delivery

#### APIs & Services
- **REST API**: Backend communication
- **Fetch API**: HTTP requests
- **LocalStorage**: Client-side caching (minimal use)

#### UI/UX Components
- **SVG Icons**: Lightweight icon rendering
- **Responsive Design**: Mobile, tablet, desktop
- **Accessibility**: ARIA labels, keyboard navigation

### 4.3 Infrastructure & Deployment

#### Hosting
- **Vercel**: Frontend and API deployment (serverless)
- **Cloud SQL (Google Cloud)**: Managed MySQL database
- **Environment Variables**: API keys, secrets management

#### External Services
- **Google Gemini API**: LLM and embeddings
- **CORS-enabled endpoints**: Cross-origin requests

### 4.4 Development Tools
- **Git**: Version control
- **GitHub**: Repository hosting
- **VS Code**: IDE
- **Postman**: API testing
- **Chrome DevTools**: Frontend debugging

---

## Hardware Requirements

### 5.1 Server Requirements

#### Minimum Specifications
- **CPU**: 2 vCPUs (shared)
- **Memory**: 2 GB RAM
- **Storage**: 20 GB SSD
- **Network**: 10 Mbps connection

#### Recommended Specifications
- **CPU**: 4 vCPUs
- **Memory**: 8 GB RAM
- **Storage**: 100 GB SSD
- **Network**: 100 Mbps connection

#### Scalability Considerations
- Horizontal scaling: Load balancer + multiple instances
- Database replication: Master-slave MySQL setup
- Vector store partitioning: Distributed embeddings
- Caching layer: Redis for frequently accessed chunks

### 5.2 Client Requirements

#### Minimum Specifications
- **Browser**: Chrome/Firefox/Safari (ES6+ support)
- **Memory**: 512 MB RAM
- **Storage**: 100 MB free space
- **Network**: 1 Mbps connection
- **Device**: Desktop, tablet, or smartphone

#### Recommended Specifications
- **Browser**: Latest version
- **Memory**: 2 GB RAM
- **Storage**: 500 MB free space
- **Network**: 10 Mbps connection
- **Device**: Modern laptop/desktop or recent smartphone

### 5.3 Database Server

#### Minimum Setup
- **CPU**: 1 vCPU
- **Memory**: 2 GB RAM
- **Storage**: 50 GB SSD
- **IOPS**: 100 operations/sec

#### Recommended Setup
- **CPU**: 4 vCPUs
- **Memory**: 16 GB RAM
- **Storage**: 500 GB SSD
- **IOPS**: 1000 operations/sec
- **Backup**: Daily automated backups

### 5.4 API Service Requirements

#### Google Gemini API
- **Rate Limits**: 60 requests/minute (free tier)
- **Latency**: ~2-5 seconds per request
- **Uptime**: 99.95% SLA

#### Network Considerations
- **Upload Speed**: 1-50 Mbps (for document uploads)
- **Download Speed**: 1-10 Mbps (for results)
- **Bandwidth**: ~100 GB/month for typical usage

---

## Implementation Architecture

### 6.1 Technology Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Python, Flask |
| Database | MySQL |
| ML/NLP | Google Gemini 2.5 Pro API |
| Vector Store | In-memory/File-based JSON |
| Deployment | Vercel, Google Cloud |
| Authentication | bcrypt, JWT/Sessions |
| APIs | REST, HTTP/HTTPS |

### 6.2 System Interactions

1. **User ↔ Frontend**: Browser-based UI with real-time updates
2. **Frontend ↔ Backend**: RESTful API calls (JSON)
3. **Backend ↔ Database**: SQL queries via MySQL connector
4. **Backend ↔ Gemini API**: HTTP requests for embeddings and generation
5. **Backend ↔ Vector Store**: In-memory operations for similarity search

---

## Conclusion

The Multi-Domain Knowledge Assistant represents a significant advancement in document retrieval and question-answering systems. By implementing a hybrid RAG architecture with automatic retrieval mode detection, the system provides:

### Key Achievements

1. **Flexibility**: Direct retrieval works independently; LLM-assisted offers enhanced capabilities
2. **Reliability**: Auto-fallback ensures service availability even when LLM fails
3. **Intelligence**: Query complexity analysis optimizes retrieval strategy
4. **Usability**: Session-based history and auto-detection reduce user burden
5. **Scalability**: Modular design enables horizontal scaling
6. **Security**: User authentication and session management built-in
7. **Domain Awareness**: Specialized context for different knowledge domains

### Benefits

- **For Enterprises**: Secure document management with domain-specific handling
- **For Users**: Intuitive interface with intelligent query handling
- **For Developers**: Modular architecture for easy customization
- **For Operations**: Reduced dependencies through intelligent fallbacks

### Future Enhancements

1. **Advanced Chunking**: Semantic chunking based on content structure
2. **Reranking**: Integration with cross-encoder models for result ranking
3. **Multi-Model Support**: Support for Claude, GPT-4, Llama alongside Gemini
4. **Caching Layer**: Redis integration for faster retrieval
5. **Analytics Dashboard**: Query analytics and usage insights
6. **Advanced Filtering**: Metadata-based filtering and faceted search
7. **Export Capabilities**: Save conversations as PDF/markdown
8. **Collaboration Features**: Share documents and sessions with team members

### Conclusion Summary

The Multi-Domain Knowledge Assistant successfully addresses the limitations of traditional document search systems by combining semantic retrieval, intelligent LLM integration, and user-centric session management. Its architecture ensures reliability through intelligent fallback mechanisms, efficiency through auto-detection logic, and usability through session-based conversation tracking. The system is production-ready and scalable for enterprise deployment.

---

## Appendix: API Endpoints Reference

### Authentication Endpoints
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout

### Document Management
- `POST /api/upload` - Upload document
- `GET /api/documents` - List user documents
- `DELETE /api/documents/<id>` - Delete document

### Chat Operations
- `POST /api/chat` - Send query and get response
- `GET /api/chat/history` - Get chat history
- `POST /api/chat/session` - Save complete session
- `GET /api/chat/session/<id>` - Get session details
- `DELETE /api/chat/history/<id>` - Delete session

### Domain Management
- `GET /api/domains` - List available domains
- `POST /api/domains` - Add custom domain

### Status
- `GET /api/status` - System health check

---

**Document Version**: 1.0  
**Last Updated**: March 2026  
**Author**: System Architecture Team  
**Classification**: Technical Documentation
