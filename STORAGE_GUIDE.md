# Data Storage Guide

## Overview

The Multi-Domain RAG system now includes **persistent storage** using JSON files. All your documents, embeddings, and custom domains are saved automatically and reloaded when you restart the server.

## Storage Architecture

### 1. Vector Store (`data/vector_store.json`)

Stores all document chunks and their embeddings:

```json
{
  "documents": [
    {
      "text": "This is the content of chunk 1...",
      "chunk_id": 0,
      "metadata": {
        "source": "document.pdf"
      }
    },
    {
      "text": "This is the content of chunk 2...",
      "chunk_id": 1,
      "metadata": {
        "source": "document.pdf"
      }
    }
  ],
  "embeddings": [
    [0.123, 0.456, 0.789, ...],  // 768-dimensional vector for chunk 0
    [0.321, 0.654, 0.987, ...]   // 768-dimensional vector for chunk 1
  ],
  "last_updated": "1234567890.0"
}
```

### 2. Domains (`data/domains.json`)

Stores all domain frameworks (built-in + custom):

```json
{
  "healthcare": {
    "name": "Healthcare",
    "keywords": ["patient", "diagnosis", "treatment"],
    "structure": ["patient_info", "diagnosis", "treatment_plan"],
    "prompt_prefix": "As a medical professional assistant, "
  },
  "education": {
    "name": "Education",
    "keywords": ["student", "teacher", "learning"],
    "structure": ["overview", "curriculum", "assessment"],
    "prompt_prefix": "As an education specialist, "
  }
}
```

## How Data is Stored

### On PDF Upload
1. PDF text is extracted and chunked
2. Each chunk is embedded using Gemini API
3. Documents and embeddings are stored in memory
4. **Automatically saved** to `data/vector_store.json`

### On Domain Creation/Update
1. New domain is added to `DOMAIN_FRAMEWORKS` dictionary
2. **Automatically saved** to `data/domains.json`

### On Server Restart
1. Server starts and checks for `data/` directory
2. Loads `domains.json` if exists (or creates with defaults)
3. Loads `vector_store.json` if exists
4. All data restored to memory
5. Ready to use immediately

## Data Operations

### Save Data (Manual)
```javascript
// Frontend button click
saveData()

// API call
POST /api/data/save
```

### Load Data (Manual)
```javascript
// Frontend button click
loadSavedData()

// API call
POST /api/data/load
```

### Export Data
```javascript
// Frontend button click
exportData()

// API call
GET /api/data/export
// Downloads: rag_data_export_[timestamp].json
```

### Clear Data
```bash
# API call
curl -X POST http://localhost:5000/api/data/clear
```

## Storage Benefits

1. **Persistence**: Data survives server restarts
2. **No Re-embedding**: Uploaded documents don't need re-processing
3. **Custom Domains**: Your domains are saved permanently
4. **Export/Backup**: Easy data export for backups
5. **Fast Startup**: Instant data loading on restart

## Example Workflow

### First Time Setup
```bash
# 1. Start server
python app.py

# 2. Upload PDF via UI
# 3. Add custom domain via UI
# 4. Data auto-saved to data/vector_store.json and data/domains.json
```

### After Restart
```bash
# 1. Start server
python app.py
# [v0] Loaded 150 documents from storage
# [v0] Loaded 6 domains from file

# 2. All data ready immediately - no re-upload needed!
```

## File Size Considerations

### Vector Store Size
- Each chunk: ~100-500 words
- Each embedding: 768 floats × 4 bytes = ~3KB
- 100 chunks = ~300KB storage
- 1000 chunks = ~3MB storage

### Domains Size
- Typically < 10KB total
- Can store unlimited custom domains

## Advanced Usage

### Backup Your Data
```bash
# Copy data directory
cp -r data/ data_backup/

# Or use Export button in UI
```

### Transfer to Another System
```bash
# Copy data/ folder to new system
scp -r data/ user@newserver:/path/to/rag-system/

# Start server on new system - data loads automatically
```

### Programmatic Access
```python
import json

# Read vector store
with open('data/vector_store.json', 'r') as f:
    data = json.load(f)
    print(f"Loaded {len(data['documents'])} documents")

# Read domains
with open('data/domains.json', 'r') as f:
    domains = json.load(f)
    print(f"Loaded {len(domains)} domains")
```

## Troubleshooting

### Data Not Loading
- Check if `data/` directory exists
- Verify JSON files are valid
- Check console logs for errors

### Storage Full
- Use "Clear Data" to remove old documents
- Export and archive old data
- Delete specific entries manually from JSON files

### Corrupted Files
- Delete corrupted JSON file
- Restart server (creates new defaults)
- Re-upload documents

## Summary

The storage system provides seamless persistence without requiring a database. Your data is stored in simple JSON files that are human-readable and easy to backup or transfer. The system handles all saving/loading automatically, making it effortless to maintain your document library and custom domains across sessions.
