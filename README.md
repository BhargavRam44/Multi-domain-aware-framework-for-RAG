# Multi-Domain RAG System

A Retrieval-Augmented Generation (RAG) system with persistent storage, custom domains, dual retrieval modes, and Gemini AI integration.

## Features

- **PDF Processing**: Upload and process PDF documents with automatic text extraction and chunking
- **Persistent Storage**: All data saved to JSON files and automatically loaded on restart
- **Multi-Domain Support**: Healthcare, Legal, Finance, Technical, and General domains (built-in)
- **Custom Domains**: Add, update, and delete your own domain frameworks
- **Dual Retrieval Modes**:
  - Direct: Fast similarity-based retrieval
  - LLM-Assisted: Query expansion for better results
- **Real-time Chat**: Interactive chat interface with retrieved chunk visualization
- **Gemini AI Integration**: Uses Google's Gemini API for embeddings and text generation
- **Data Management**: Save, load, export, and clear stored data

## Tech Stack

- **Backend**: Python + Flask
- **Frontend**: HTML + CSS + JavaScript (No TypeScript, No React)
- **AI**: Google Gemini API (text-embedding-004, gemini-1.5-flash)
- **Vector Search**: In-memory cosine similarity with JSON persistence
- **Storage**: Local JSON files (data/vector_store.json, data/domains.json)

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Set your Gemini API key:
```bash
export GEMINI_API_KEY='your-api-key-here'
```

Or edit `app.py` line 17 to hardcode your key (already set in the file).

## Usage

1. Start the Flask server:
```bash
python app.py
```

2. Open your browser to:
```
http://localhost:5000
```

3. Upload a PDF document

4. Select a domain (Healthcare, Legal, Finance, etc.)

5. Choose retrieval mode (Direct or LLM-Assisted)

6. Ask questions about your document!

## File Structure

```
├── app.py                 # Flask backend with RAG logic
├── data/                  # Persistent storage (auto-created)
│   ├── vector_store.json # Document embeddings and chunks
│   └── domains.json      # Custom domain frameworks
├── static/
│   ├── index.html        # Frontend UI
│   ├── styles.css        # Styling
│   └── app.js            # Frontend JavaScript
├── requirements.txt      # Python dependencies
└── README.md            # This file
```

## API Endpoints

### Core Endpoints
- `GET /` - Serve frontend
- `POST /api/upload` - Upload PDF
- `POST /api/set-domain` - Set active domain
- `POST /api/chat` - Send query and get response
- `GET /api/status` - Get system status

### Domain Management
- `GET /api/domains` - Get available domains
- `POST /api/domains` - Add custom domain
- `PUT /api/domains/<domain_id>` - Update domain
- `DELETE /api/domains/<domain_id>` - Delete custom domain

### Data Management
- `POST /api/data/save` - Manually save data
- `POST /api/data/load` - Load saved data
- `POST /api/data/clear` - Clear all data
- `GET /api/data/export` - Export data as JSON

## Domain Frameworks

Each domain has:
- Domain-specific keywords for better retrieval
- Structured output templates
- Custom prompt prefixes for specialized responses

Available domains:
- Healthcare
- Legal
- Finance
- Technical
- General

## How It Works

1. **PDF Upload**: Text is extracted and split into overlapping chunks
2. **Embedding**: Each chunk is embedded using Gemini's text-embedding-004 model
3. **Storage**: Embeddings stored in-memory for fast retrieval
4. **Query**: User question is embedded and matched against document chunks
5. **Retrieval**: Top-k most similar chunks retrieved (with optional LLM expansion)
6. **Generation**: Gemini generates answer using retrieved context

## Using Custom Domains

### Add a Custom Domain (UI)
1. Click "Add Custom Domain" button in the sidebar
2. Enter domain name (e.g., "Education")
3. Enter keywords separated by commas
4. Domain is automatically saved to `data/domains.json`

### Add a Custom Domain (API)
```bash
curl -X POST http://localhost:5000/api/domains \
  -H "Content-Type: application/json" \
  -d '{
    "domain_id": "education",
    "name": "Education",
    "keywords": ["student", "teacher", "learning", "curriculum"],
    "structure": ["overview", "curriculum", "assessment"],
    "prompt_prefix": "As an education specialist, "
  }'
```

## Data Persistence

### Automatic Saving
- Data is automatically saved after each PDF upload
- Domains are saved immediately when added/updated/deleted

### Manual Operations
- **Save**: Click "Save Data" button to manually save current state
- **Load**: Click "Load Data" to reload from storage files
- **Export**: Click "Export JSON" to download complete data backup

### Storage Location
All data stored in `data/` directory:
- `vector_store.json` - Document chunks and embeddings
- `domains.json` - Domain frameworks (built-in + custom)

### Data Reloading
When you restart the server, all data is automatically loaded from storage files. Your uploaded documents and custom domains persist across sessions.

## Notes

- Data persists across restarts in JSON files
- Gemini API key is required for embeddings and generation
- PDF processing may take time for large documents
- LLM-Assisted retrieval is slower but more accurate
- Built-in domains (healthcare, legal, finance, technical, general) cannot be deleted

## License

MIT
