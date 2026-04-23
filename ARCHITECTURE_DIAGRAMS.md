# Multi-Domain RAG System - Architecture Diagrams

## 1. SYSTEM ARCHITECTURE DIAGRAM

```mermaid
graph TB
    subgraph Frontend["Frontend Layer"]
        WP["Welcome Page"]
        LP["Login/Signup Page"]
        DP1["Domain Selection Page"]
        UP["Upload Page"]
        CP["Chat Page"]
    end

    subgraph FrontendLogic["Frontend Logic"]
        Auth["Authentication Manager"]
        DOM["Domain Manager"]
        Upload["Upload Handler"]
        Chat["Chat Interface"]
        History["Session History Manager"]
    end

    subgraph Backend["Backend Layer - Flask API"]
        AuthEP["/auth/register, /auth/login"]
        UploadEP["/api/upload"]
        ChatEP["/api/chat"]
        SessionEP["/api/chat/session"]
        DocsEP["/api/documents"]
        HistoryEP["/api/chat/history"]
    end

    subgraph Processing["Processing Layer"]
        PDFParser["PDF Parser"]
        TextChunker["Text Chunker"]
        EmbeddingGen["Embedding Generator<br/>Gemini API"]
        RetrieverDirect["Direct Retriever<br/>Cosine Similarity"]
        RetrieverLLM["LLM-Assisted Retriever<br/>Query Expansion"]
        LLMGen["LLM Generator<br/>Gemini 2.5 Pro"]
    end

    subgraph Storage["Storage & Memory"]
        MySQL["MySQL Database<br/>Users, Documents,<br/>Sessions, Domains"]
        VectorStore["Vector Store<br/>In-Memory Embeddings<br/>Per User"]
    end

    subgraph External["External Services"]
        GeminiAPI["Google Gemini API<br/>Embeddings & Generation"]
    end

    Frontend -->|User Input| FrontendLogic
    FrontendLogic -->|HTTP/REST| Backend
    Backend -->|Process| Processing
    Processing -->|Query| GeminiAPI
    GeminiAPI -->|Embeddings| Processing
    Processing -->|Store/Retrieve| MySQL
    Processing -->|Store/Retrieve| VectorStore
    Backend -->|Response| FrontendLogic
    FrontendLogic -->|Display| Frontend
```

---

## 2. USE CASE DIAGRAM

```mermaid
graph LR
    Actor["👤 User"] -->|Uses| UC1["Sign Up"]
    Actor -->|Uses| UC2["Login"]
    Actor -->|Uses| UC3["Logout"]
    Actor -->|Uses| UC5["Select Domain"]
    Actor -->|Uses| UC6["Create Domain"]
    Actor -->|Uses| UC7["Upload Document"]
    Actor -->|Uses| UC10["Ask Question"]
    Actor -->|Uses| UC14["View Sessions"]

    System -->|Implements| UC1
    System -->|Implements| UC2
    System -->|Implements| UC3
    System -->|Implements| UC5
    System -->|Implements| UC6
    System -->|Implements| UC7
    System -->|Implements| UC10
    System -->|Implements| UC14
```

---

## 3. SEQUENCE DIAGRAM - Chat Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Frontend<br/>JavaScript
    participant Backend as Backend<br/>Flask API
    participant VectorStore as Vector Store<br/>In-Memory
    participant GeminiAPI as Gemini API
    participant MySQL as MySQL<br/>Database

    User->>Frontend: 1. Type Question
    Frontend->>Frontend: 2. Auto-Detect Retrieval Mode<br/>Direct/LLM-Assisted
    
    alt Direct Retrieval
        Frontend->>Backend: 3. POST /api/chat<br/>{query, domain, direct}
        Backend->>VectorStore: 4. Get Query Embeddings
        Backend->>GeminiAPI: 5. Generate Embeddings
        GeminiAPI-->>Backend: 6. Return Embeddings
        Backend->>VectorStore: 7. Cosine Similarity Search
        VectorStore-->>Backend: 8. Return Top-K Chunks
        Backend->>GeminiAPI: 9. Generate Response<br/>from Chunks
        GeminiAPI-->>Backend: 10. Return Generated Text
    else LLM-Assisted Retrieval
        Frontend->>Backend: 3. POST /api/chat<br/>{query, domain, llm}
        Backend->>GeminiAPI: 4. Expand Query<br/>Multi-Query Generation
        GeminiAPI-->>Backend: 5. Return Expanded Queries
        Backend->>VectorStore: 6. Search All Expanded Queries
        Backend->>GeminiAPI: 7. Generate Embeddings
        GeminiAPI-->>Backend: 8. Return Embeddings
        Backend->>VectorStore: 9. Aggregate Results
        VectorStore-->>Backend: 10. Return Top-K Chunks
        Backend->>GeminiAPI: 11. Generate Response<br/>with Reasoning
        GeminiAPI-->>Backend: 12. Return Generated Text
    end

    Backend-->>Frontend: 13. {response, chunks, method}
    Frontend->>Frontend: 14. Add to Session Messages
    Frontend-->>User: 15. Display Response + Chunks

    User->>Frontend: 16. Leave Chat Page
    Frontend->>Frontend: 17. Save Session
    Frontend->>Backend: 18. POST /api/chat/session<br/>{messages, domain, doc_id}
    Backend->>MySQL: 19. INSERT chat_sessions
    MySQL-->>Backend: 20. Confirm
    Backend-->>Frontend: 21. Session Saved
```

---

## 4. CLASS DIAGRAM

```mermaid
classDiagram
    class User {
        -int id
        -str username
        -str email
        -str password_hash
        -datetime created_at
        +register() boolean
        +login() boolean
        +logout() void
    }

    class Document {
        -int id
        -int user_id
        -str filename
        -str domain
        -int chunks_count
        -datetime uploaded_at
        +upload_file() int
        +delete_document() void
        +get_chunks() list
    }

    class ChatSession {
        -int id
        -int user_id
        -int document_id
        -str domain
        -json session_data
        -str first_query
        -int message_count
        -datetime created_at
        +add_message() void
        +save_session() void
        +get_all_messages() list
    }

    class Message {
        -str role
        -str text
        -str retrieval_method
        -list retrieved_chunks
        +format_message() str
    }

    class Retriever {
        -str method
        -vector_store vector_store
        -embedding_model model
        +retrieve_chunks()* list
    }

    class DirectRetriever {
        -float threshold
        +retrieve_chunks() list
        +cosine_similarity() float
    }

    class LLMRetriever {
        -gemini_client client
        +retrieve_chunks() list
        +expand_query() list
        +aggregate_results() list
    }

    class VectorStore {
        -dict documents
        -ndarray embeddings
        -int user_id
        +add_embedding() void
        +search() list
        +delete_by_source() void
    }

    class DomainFramework {
        -str domain_id
        -str name
        -list keywords
        -list structure
        -str prompt_prefix
        +get_context() str
        +validate_content() boolean
    }

    class EmbeddingService {
        -str api_key
        -str model_name
        +generate_embedding() ndarray
        +batch_generate() list
    }

    class LLMService {
        -str api_key
        -str model_name
        -int retry_count
        +generate_text() str
        +with_retry() str
    }

    User "1" --> "*" Document
    User "1" --> "*" ChatSession
    ChatSession "1" --> "*" Message
    Document "1" --> "*" Message
    Retriever <|-- DirectRetriever
    Retriever <|-- LLMRetriever
    Retriever --> VectorStore
    VectorStore --> EmbeddingService
    LLMRetriever --> LLMService
    DirectRetriever --> EmbeddingService
    ChatSession --> DomainFramework
    Document --> DomainFramework
```

---
## 5. ACTIVITY DIAGRAM
graph TD
    %% Document Upload Flow
    StartUpload(["User Starts Upload"])
    Select["Select File<br/>PDF or TXT"]
    Upload["Submit File"]
    Validate{File Valid?}
    Invalid["Show Error"]
    ValidFile["Parse & Extract Text"]
    Chunk["Split into Chunks"]
    Embed["Generate Embeddings"]
    StoreDB["Store in DB & Vector Store"]
    SuccessUpload["Chunks Added, Enable Chat"]
    EndUpload(["Upload Complete"])

    %% Chat Session Flow
    StartChat(["User Opens Chat"])
    Init["Initialize Session"]
    AskQuestion["User Asks Question"]
    AutoDetect["Auto-Detect Retrieval Mode"]
    ModeSet["Set Mode: Direct/LLM"]
    SendChat["Send to Backend"]
    Generate["Generate Response"]
    Response["Return Response"]
    TrackSession["Track Session"]
    DisplayResult["Display Response"]
    Loop{Continue Chatting?}
    Leave["User Leaves Chat"]
    SaveSession["Save Session"]
    EndChat(["Session Saved"])

    %% Document Upload Connections
    StartUpload --> Select
    Select --> Upload
    Upload --> Validate
    Validate -->|No| Invalid
    Invalid --> StartUpload
    Validate -->|Yes| ValidFile
    ValidFile --> Chunk
    Chunk --> Embed
    Embed --> StoreDB
    StoreDB --> SuccessUpload
    SuccessUpload --> EndUpload

    %% Chat Session Connections
    EndUpload --> StartChat
    StartChat --> Init
    Init --> AskQuestion
    AskQuestion --> AutoDetect
    AutoDetect --> ModeSet
    ModeSet --> SendChat
    SendChat --> Generate
    Generate --> Response
    Response --> TrackSession
    TrackSession --> DisplayResult
    DisplayResult --> Loop
    Loop -->|Yes| AskQuestion
    Loop -->|No| Leave
    Leave --> SaveSession
    SaveSession --> EndChat
```

---

## 7. DATABASE SCHEMA DIAGRAM

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : has
    USERS ||--o{ DOCUMENTS : uploads
    USERS ||--o{ CHAT_SESSIONS : creates
    USERS ||--o{ CUSTOM_DOMAINS : defines
    DOCUMENTS ||--o{ CHAT_SESSIONS : references
    
    USERS {
        int id PK
        string username UK
        string email UK
        string password_hash
        datetime created_at
    }
    
    SESSIONS {
        int id PK
        int user_id FK
        string token UK
        datetime created_at
        datetime expires_at
    }
    
    DOCUMENTS {
        int id PK
        int user_id FK
        string filename
        string domain
        int chunks_count
        datetime uploaded_at
    }
    
    CHAT_SESSIONS {
        int id PK
        int user_id FK
        int document_id FK
        string domain
        json session_data
        string first_query
        int message_count
        datetime created_at
    }
    
    CUSTOM_DOMAINS {
        int id PK
        int user_id FK
        string domain_id UK
        string domain_name
        string keywords
        string structure
        string prompt_prefix
        datetime created_at
    }
```

---

## 8. API ENDPOINT ARCHITECTURE

```mermaid
graph LR
    Client["Frontend Client"]
    
    subgraph Auth["Authentication Endpoints"]
        EP1["/auth/register<br/>POST"]
        EP2["/auth/login<br/>POST"]
        EP3["/auth/logout<br/>POST"]
        EP4["/auth/verify<br/>GET"]
    end
    
    subgraph Docs["Document Endpoints"]
        EP5["/api/upload<br/>POST"]
        EP6["/api/documents<br/>GET"]
        EP7["/api/documents/:id<br/>DELETE"]
    end
    
    subgraph Chat["Chat Endpoints"]
        EP8["/api/chat<br/>POST"]
        EP9["/api/chat/session<br/>POST"]
        EP10["/api/chat/history<br/>GET"]
        EP11["/api/chat/history/:id<br/>DELETE"]
        EP12["/api/chat/session/:id<br/>GET"]
    end
    
    subgraph Domain["Domain Endpoints"]
        EP13["/api/domains<br/>GET"]
        EP14["/api/domains<br/>POST"]
    end
    
    subgraph Status["System Endpoints"]
        EP15["/status<br/>GET"]
        EP16["/health<br/>GET"]
    end
    
    Client -->|Authenticate| Auth
    Client -->|Upload/Delete| Docs
    Client -->|Chat| Chat
    Client -->|Manage| Domain
    Client -->|Check| Status
```

---

## 9. DATA FLOW DIAGRAM - Direct Retrieval Path

```mermaid
---
config:
  layout: fixed
---
flowchart TB
    Query["User Query"] -- "1. Tokenize" --> Normalize["Normalize Query"]
    Normalize -- "2. Generate" --> Embed["Embedding<br>Gemini API"]
    Embed -- "3. ndarray" --> VStore["Vector Store<br>Query Vector"]
    VStore -- "4. Cosine<br>Similarity" --> Score["Score All<br>Documents"]
    Score -- "5. Top-K" --> Chunks["Retrieved Chunks"]
    Chunks -- "6. Format" --> Context["Build Context<br>String"]
    Context -- "7. Prompt" --> Prompt["Create LLM Prompt<br>+ System Message"]
    Prompt -- "8. Request" --> LLM["Gemini 2.5 Pro<br>Generate Text"]
    LLM -- "9. Response" --> Output["Generated Answer"]
    Output -- "10. Generate" --> Response["JSON Response"]
    Response -- "11. Display" --> User["User Interface"]

     Query:::fill:#f9f,stroke:#333,stroke-width:2px
     Normalize:::fill:#f9f,stroke:#333,stroke-width:2px
     Embed:::fill:#f9f,stroke:#333,stroke-width:2px
     VStore:::fill:#bbf,stroke:#333,stroke-width:2px
     Score:::fill:#bbf,stroke:#333,stroke-width:2px
     Chunks:::fill:#bbf,stroke:#333,stroke-width:2px
     Context:::fill:#f9f,stroke:#333,stroke-width:2px
     Prompt:::fill:#f9f,stroke:#333,stroke-width:2px
     LLM:::fill:#f9f,stroke:#333,stroke-width:2px
     Output:::fill:#f9f,stroke:#333,stroke-width:2px
     Response:::fill:#f9f,stroke:#333,stroke-width:2px
     User:::fill:#f9f,stroke:#333,stroke-width:2px
```

---

## 10. Data Flow Diagram - LLM-Assisted Retrieval Path

```mermaid
graph LR
    Query["User Query"]
    
    Query -->|1. Analyze| Detect["Detect Query<br/>Complexity"]
    Detect -->|2. If Complex| Expand["LLM Expands Query<br/>Multi-variant"]
    
    Expand -->|3. Generate| Embeddings["Generate Embeddings<br/>for Each"]
    Embeddings -->|4. ndarray| MultiSearch["Multiple Searches<br/>in Vector Store"]
    
    MultiSearch -->|5. Score| ScoreAll["Score All Results"]
    ScoreAll -->|6. Rank & Dedup| Aggregate["Aggregate<br/>Results"]
    
    Aggregate -->|7. Top-K| ChunksFinal["Final Chunk List"]
    ChunksFinal -->|8. Context| ContextFull["Rich Context<br/>+ Reasoning"]
    
    ContextFull -->|9. Enhanced<br/>Prompt| PromptLLM["LLM Prompt<br/>with Context"]
    PromptLLM -->|10. Request| LLMFULL["Gemini 2.5 Pro<br/>Generate with<br/>Reasoning"]
    
    LLMFULL -->|11. Response| OutputFull["Comprehensive<br/>Answer"]
    OutputFull -->|12. Return| FinalResponse["JSON Response"]
    FinalResponse -->|13. Display| UserFinal["User Interface"]
```

---

## System Features Summary

### Core Capabilities
1. **Multi-Domain Support**: Healthcare, Legal, Finance, Technical, General + Custom Domains
2. **Document Processing**: PDF/TXT extraction with automatic chunking
3. **Vector Embeddings**: Gemini Embedding API for semantic search
4. **Dual Retrieval Modes**:
   - Direct: Fast cosine similarity search
   - LLM-Assisted: Query expansion + multi-variant search
5. **Auto-Detection**: Intelligently selects retrieval mode based on query complexity
6. **Session Management**: Complete chat sessions saved with all Q&A pairs
7. **User Authentication**: Bcrypt password hashing + session tokens
8. **Document Management**: Upload, view, delete uploaded documents
9. **Chat History**: Resume previous conversations, view all sessions

### Error Handling
- LLM fallback: Direct retrieval works even if Gemini API fails
- Retry logic: Automatic retries for network failures
- Graceful degradation: Raw chunks returned if generation fails

### Performance Features
- In-memory vector store per user
- Cosine similarity with configurable threshold
- Efficient chunking strategy
- Multi-query expansion for complex questions
- Deduplication of retrieved results
