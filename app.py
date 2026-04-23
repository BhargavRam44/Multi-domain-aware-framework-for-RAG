from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import requests
import PyPDF2
import io
import re
import hashlib
import numpy as np
import bcrypt
import secrets
import mysql.connector
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__, static_folder='static')
CORS(app, supports_credentials=True)

# -------------------------------------------------------
# Configuration
# -------------------------------------------------------
GROQ_API_KEY     = os.environ.get('GROQ_API_KEY', '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')
GENERATION_MODEL = 'llama-3.3-70b-versatile'
SESSION_DAYS     = 7

# MySQL config — edit these values to match your local MySQL
MYSQL_CONFIG = {
    'host':     os.environ.get('MYSQL_HOST',     'localhost'),
    'port':     int(os.environ.get('MYSQL_PORT', 3306)),
    'user':     os.environ.get('MYSQL_USER',     'root'),
    'password': os.environ.get('MYSQL_PASSWORD', 'root'),
    'database': os.environ.get('MYSQL_DATABASE', 'rag_system'),
    'charset':  'utf8mb4'
}

# -------------------------------------------------------
# Domain frameworks (built-in)
# -------------------------------------------------------
BUILTIN_DOMAINS = {
    'healthcare': {
        'name': 'Healthcare',
        'keywords': ['patient', 'diagnosis', 'treatment', 'medical', 'symptom', 'disease', 'medication', 'clinical'],
        'structure': ['patient_info', 'diagnosis', 'treatment_plan', 'medications', 'follow_up'],
        'prompt_prefix': 'As a medical professional assistant, '
    },
    'legal': {
        'name': 'Legal',
        'keywords': ['contract', 'law', 'agreement', 'clause', 'liability', 'jurisdiction', 'defendant', 'plaintiff'],
        'structure': ['parties', 'terms', 'obligations', 'liability', 'jurisdiction'],
        'prompt_prefix': 'As a legal document analyst, '
    },
    'finance': {
        'name': 'Finance',
        'keywords': ['revenue', 'profit', 'balance', 'assets', 'liabilities', 'investment', 'financial', 'fiscal'],
        'structure': ['financial_summary', 'revenue', 'expenses', 'assets', 'liabilities', 'cash_flow'],
        'prompt_prefix': 'As a financial analyst, '
    },
    'technical': {
        'name': 'Technical',
        'keywords': ['api', 'function', 'class', 'method', 'architecture', 'implementation', 'system', 'module'],
        'structure': ['overview', 'architecture', 'components', 'api', 'implementation'],
        'prompt_prefix': 'As a technical documentation expert, '
    },
    'general': {
        'name': 'General',
        'keywords': [],
        'structure': ['introduction', 'main_content', 'conclusion'],
        'prompt_prefix': ''
    }
}

# -------------------------------------------------------
# In-memory vector store (per session, keyed by user_id)
# -------------------------------------------------------
user_vector_stores = {}   # { user_id: { 'documents': [], 'embeddings': [] } }
user_domains       = {}   # { user_id: 'general' }

DATA_DIR = 'data'
os.makedirs(DATA_DIR, exist_ok=True)

# -------------------------------------------------------
# MySQL helpers
# -------------------------------------------------------
def get_db():
    return mysql.connector.connect(**MYSQL_CONFIG)

def db_execute(query, params=(), fetch=False, lastrowid=False):
    conn = get_db()
    cur  = conn.cursor(dictionary=True)
    cur.execute(query, params)
    result = None
    if fetch:
        result = cur.fetchall()
    elif lastrowid:
        conn.commit()
        result = cur.lastrowid
    else:
        conn.commit()
    cur.close()
    conn.close()
    return result

# -------------------------------------------------------
# Auth helpers
# -------------------------------------------------------
def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_session_token(user_id):
    token      = secrets.token_hex(32)
    expires_at = datetime.now() + timedelta(days=SESSION_DAYS)
    db_execute(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES (%s, %s, %s)',
        (user_id, token, expires_at)
    )
    return token

def get_user_from_token(token):
    if not token:
        return None
    rows = db_execute(
        '''SELECT u.id, u.username, u.email
           FROM sessions s
           JOIN users u ON u.id = s.user_id
           WHERE s.token = %s AND s.expires_at > NOW()''',
        (token,), fetch=True
    )
    return rows[0] if rows else None

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get('session_token') or request.headers.get('X-Session-Token')
        user  = get_user_from_token(token)
        if not user:
            return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        return f(user, *args, **kwargs)
    return decorated

# -------------------------------------------------------
# Vector store helpers (per user, persisted to JSON)
# -------------------------------------------------------
def get_user_store(user_id):
    if user_id not in user_vector_stores:
        path = os.path.join(DATA_DIR, f'vector_store_{user_id}.json')
        if os.path.exists(path):
            with open(path, 'r') as f:
                data = json.load(f)
                user_vector_stores[user_id] = {
                    'documents':  data.get('documents',  []),
                    'embeddings': data.get('embeddings', [])
                }
        else:
            user_vector_stores[user_id] = {'documents': [], 'embeddings': []}
    return user_vector_stores[user_id]

def save_user_store(user_id):
    store = user_vector_stores.get(user_id, {'documents': [], 'embeddings': []})
    path  = os.path.join(DATA_DIR, f'vector_store_{user_id}.json')
    with open(path, 'w') as f:
        json.dump(store, f)

def get_domain_for_user(user_id):
    return user_domains.get(user_id, 'general')

def get_domain_frameworks(user_id):
    """Merge built-in domains with user-created custom domains from MySQL."""
    frameworks = dict(BUILTIN_DOMAINS)
    rows = db_execute(
        'SELECT * FROM custom_domains WHERE user_id = %s', (user_id,), fetch=True
    )
    for row in rows:
        frameworks[row['domain_id']] = {
            'name':          row['domain_name'],
            'keywords':      json.loads(row['keywords'] or '[]'),
            'structure':     json.loads(row['structure'] or '[]'),
            'prompt_prefix': row['prompt_prefix'] or ''
        }
    return frameworks

# -------------------------------------------------------
# PDF / text helpers
# -------------------------------------------------------
def extract_text_from_pdf(pdf_file):
    try:
        reader = PyPDF2.PdfReader(pdf_file)
        text   = ''
        for page in reader.pages:
            text += page.extract_text() + '\n'
        return text
    except Exception as e:
        print(f'[v0] PDF extract error: {e}')
        return None

def chunk_text(text, chunk_size=500, overlap=50):
    words  = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = ' '.join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks

# -------------------------------------------------------
# Groq API helpers
# -------------------------------------------------------
def get_embedding(text):
    """
    Keyword-frequency embedding using unigrams + bigrams.
    Far more semantically meaningful than a hash, and requires no external API.
    Returns a fixed-length vector whose dimensions correspond to hashed n-gram buckets.
    """
    DIM = 1536
    vec = [0.0] * DIM

    words = re.findall(r'[a-z0-9]+', text.lower())
    # Stop-words to ignore
    stop = {'the','a','an','is','in','of','to','and','or','for','on','at','by',
            'with','this','that','are','was','were','be','it','as','from','has',
            'have','had','its','be','been','not','but','what','which','who','how'}
    words = [w for w in words if w not in stop and len(w) > 1]

    ngrams = words + [words[i] + '_' + words[i+1] for i in range(len(words)-1)]

    for ng in ngrams:
        idx = int(hashlib.md5(ng.encode()).hexdigest(), 16) % DIM
        vec[idx] += 1.0

    # L2-normalise
    norm = sum(v*v for v in vec) ** 0.5
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec

def _groq_call(messages, temperature=0.3, max_tokens=2048, retry_count=2):
    """Raw Groq API call with a messages list."""
    url = 'https://api.groq.com/openai/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {GROQ_API_KEY}',
        'Content-Type': 'application/json'
    }
    data = {
        'model': GENERATION_MODEL,
        'messages': messages,
        'temperature': temperature,
        'max_tokens': max_tokens
    }
    for attempt in range(retry_count):
        try:
            res = requests.post(url, headers=headers, json=data, timeout=30)
            res.raise_for_status()
            result = res.json()
            if 'choices' in result and len(result['choices']) > 0:
                return result['choices'][0]['message']['content']
            else:
                raise Exception('Invalid response format from Groq API')
        except requests.exceptions.Timeout:
            print(f'[v0] Groq timeout (attempt {attempt+1}/{retry_count})')
            if attempt == retry_count - 1:
                raise Exception('Groq API timeout - request took too long')
        except requests.exceptions.ConnectionError as e:
            print(f'[v0] Groq connection error (attempt {attempt+1}/{retry_count}): {e}')
            if attempt == retry_count - 1:
                raise Exception('Unable to connect to Groq API')
        except Exception as e:
            print(f'[v0] Groq generation error (attempt {attempt+1}/{retry_count}): {e}')
            if attempt == retry_count - 1:
                raise e


def generate_text(prompt, retry_count=2):
    """Generate text using Groq API with retry logic (no system message)."""
    return _groq_call(
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.7,
        max_tokens=2048,
        retry_count=retry_count
    )


def generate_text_domain_aware(query, context, domain_id, domain_info, retry_count=2):
    """
    Two-step generation:
    Step 1 — Domain gate: a tiny deterministic call to check if the question is
             off-domain. Returns None if off-domain (sentinel detected).
    Step 2 — Answer generation: a separate call that answers the question using
             the retrieved context, with enough flexibility to reason over it.
    """
    REFUSAL_SENTINEL = '__OFF_DOMAIN__'

    # ----------------------------------------------------------------
    # Step 1: domain gate (only for non-general domains)
    # ----------------------------------------------------------------
    if domain_id != 'general':
        domain_name = domain_info.get('name', domain_id)
        gate_system = (
            f'You are a domain classifier for a {domain_name} document assistant. '
            f'Determine whether the user\'s question is related to the {domain_name} domain. '
            f'If it is NOT related, output EXACTLY: {REFUSAL_SENTINEL} '
            f'If it IS related, output EXACTLY: __RELEVANT__ '
            f'Output nothing else.'
        )
        gate_response = _groq_call(
            messages=[
                {'role': 'system', 'content': gate_system},
                {'role': 'user',   'content': f'Question: {query}'}
            ],
            temperature=0.0,
            max_tokens=10,
            retry_count=retry_count
        )
        if REFUSAL_SENTINEL in gate_response:
            return None  # off-domain

    # ----------------------------------------------------------------
    # Step 2: answer generation using context
    # ----------------------------------------------------------------
    if domain_id == 'general':
        system_msg = (
            'You are a document assistant. '
            'Answer the question using the provided context. '
            'Extract and present ALL relevant details, facts, figures, and explanations '
            'that exist in the context related to the question. '
            'Structure your answer clearly using headings, bullet points, or numbered lists. '
            'You may reason over and explain the context, but do NOT invent facts not present in it. '
            'If the context genuinely has no relevant information, say: '
            '"The provided documents do not contain information about this topic."'
        )
    else:
        domain_name = domain_info.get('name', domain_id)
        system_msg = (
            f'You are a {domain_name} domain document assistant. '
            f'Answer the question using the provided context from the user\'s uploaded documents. '
            f'Extract and present ALL relevant details, facts, figures, and explanations '
            f'that exist in the context related to the question. '
            f'Structure your answer clearly using headings, bullet points, or numbered lists. '
            f'You may reason over and explain what the context says, but do NOT invent facts not present in it. '
            f'If the context genuinely has no relevant information at all, say: '
            f'"The provided documents do not contain information about this topic."'
        )

    user_msg = (
        f'Context (extracted from uploaded documents):\n\n{context}\n\n'
        f'---\n'
        f'Question: {query}\n\n'
        f'Answer thoroughly using the context above. Cover every relevant detail present in the context.'
    )

    return _groq_call(
        messages=[
            {'role': 'system', 'content': system_msg},
            {'role': 'user',   'content': user_msg}
        ],
        temperature=0.2,
        max_tokens=4096,
        retry_count=retry_count
    )

# -------------------------------------------------------
# Retrieval helpers
# -------------------------------------------------------
def cosine_similarity(a, b):
    a, b = np.array(a), np.array(b)
    n_a, n_b = np.linalg.norm(a), np.linalg.norm(b)
    if n_a == 0 or n_b == 0:
        return 0.0
    return float(np.dot(a, b) / (n_a * n_b))

def direct_retrieval(query_embedding, user_id, top_k=5):
    store = get_user_store(user_id)
    if not store['embeddings']:
        return []
    sims = [(i, cosine_similarity(query_embedding, emb)) for i, emb in enumerate(store['embeddings'])]
    sims.sort(key=lambda x: x[1], reverse=True)
    return [{'text': store['documents'][i]['text'], 'chunk_id': i,
              'similarity': sim, 'metadata': store['documents'][i].get('metadata', {})}
            for i, sim in sims[:top_k]]

def llm_assisted_retrieval(query, user_id, top_k=3):
    domain_id   = get_domain_for_user(user_id)
    frameworks  = get_domain_frameworks(user_id)
    domain_info = frameworks.get(domain_id, BUILTIN_DOMAINS['general'])

    expansion_prompt = f"""Given this user query: "{query}"
Domain: {domain_info['name']}
Keywords: {', '.join(domain_info['keywords'][:5])}

Generate 3 alternative phrasings that would help find relevant information.
Return only the alternative queries, one per line."""

    expanded    = generate_text(expansion_prompt)
    q_emb       = get_embedding(query)
    all_results = direct_retrieval(q_emb, user_id, top_k)

    for eq in expanded.split('\n')[:2]:
        if eq.strip():
            all_results.extend(direct_retrieval(get_embedding(eq.strip()), user_id, 2))

    seen, unique = set(), []
    for r in all_results:
        if r['chunk_id'] not in seen:
            seen.add(r['chunk_id'])
            unique.append(r)
    unique.sort(key=lambda x: x['similarity'], reverse=True)
    return unique[:top_k], expanded

# ============================================================
# STATIC ROUTES
# ============================================================
@app.route('/')
def root():
    return send_from_directory('static', 'welcome.html')

@app.route('/auth')
def auth_page():
    return send_from_directory('static', 'login.html')

@app.route('/app')
def main_app():
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

# ============================================================
# AUTH ROUTES
# ============================================================
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data     = request.json or {}
    username = data.get('username', '').strip()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    try:
        rows = db_execute('SELECT id FROM users WHERE email = %s OR username = %s',
                          (email, username), fetch=True)
        if rows:
            return jsonify({'error': 'Username or email already exists'}), 409

        hashed  = hash_password(password)
        user_id = db_execute(
            'INSERT INTO users (username, email, password) VALUES (%s, %s, %s)',
            (username, email, hashed), lastrowid=True
        )
        token = create_session_token(user_id)

        resp = jsonify({'success': True, 'user': {'id': user_id, 'username': username, 'email': email}})
        resp.set_cookie('session_token', token, httponly=True,
                        max_age=SESSION_DAYS * 86400, samesite='Lax')
        return resp

    except Exception as e:
        print(f'[v0] Signup error: {e}')
        return jsonify({'error': 'Database error. Check MySQL connection.'}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    data     = request.json or {}
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    try:
        rows = db_execute('SELECT * FROM users WHERE email = %s', (email,), fetch=True)
        if not rows or not check_password(password, rows[0]['password']):
            return jsonify({'error': 'Invalid email or password'}), 401

        user  = rows[0]
        token = create_session_token(user['id'])

        resp = jsonify({'success': True, 'user': {'id': user['id'], 'username': user['username'], 'email': user['email']}})
        resp.set_cookie('session_token', token, httponly=True,
                        max_age=SESSION_DAYS * 86400, samesite='Lax')
        return resp

    except Exception as e:
        print(f'[v0] Login error: {e}')
        return jsonify({'error': 'Database error. Check MySQL connection.'}), 500


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    token = request.cookies.get('session_token') or request.headers.get('X-Session-Token')
    if token:
        db_execute('DELETE FROM sessions WHERE token = %s', (token,))
    resp = jsonify({'success': True})
    resp.delete_cookie('session_token')
    return resp


@app.route('/api/auth/me', methods=['GET'])
@require_auth
def me(user):
    return jsonify({'user': user})

# ============================================================
# DOMAIN ROUTES
# ============================================================
@app.route('/api/domains', methods=['GET'])
@require_auth
def get_domains(user):
    frameworks = get_domain_frameworks(user['id'])
    domains = [{'id': did, 'name': info['name'], 'keywords': info['keywords'][:5]}
               for did, info in frameworks.items()]
    return jsonify({'domains': domains})


@app.route('/api/domains', methods=['POST'])
@require_auth
def add_domain(user):
    data          = request.json or {}
    domain_id     = data.get('domain_id', '').lower().replace(' ', '_')
    domain_name   = data.get('name', '')
    keywords      = data.get('keywords', [])
    structure     = data.get('structure', ['overview', 'details', 'summary'])
    prompt_prefix = data.get('prompt_prefix', f'As a {domain_name} expert, ')

    if not domain_id or not domain_name:
        return jsonify({'error': 'domain_id and name are required'}), 400

    try:
        db_execute(
            '''INSERT INTO custom_domains (user_id, domain_id, domain_name, keywords, structure, prompt_prefix)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE
                   domain_name=VALUES(domain_name), keywords=VALUES(keywords),
                   structure=VALUES(structure), prompt_prefix=VALUES(prompt_prefix)''',
            (user['id'], domain_id, domain_name,
             json.dumps(keywords), json.dumps(structure), prompt_prefix)
        )
        return jsonify({'success': True, 'domain_id': domain_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/domains/<domain_id>', methods=['DELETE'])
@require_auth
def delete_domain(user, domain_id):
    if domain_id in BUILTIN_DOMAINS:
        return jsonify({'error': 'Cannot delete built-in domains'}), 403
    db_execute('DELETE FROM custom_domains WHERE user_id = %s AND domain_id = %s',
               (user['id'], domain_id))
    return jsonify({'success': True})


@app.route('/api/set-domain', methods=['POST'])
@require_auth
def set_domain(user):
    domain = (request.json or {}).get('domain', 'general')
    frameworks = get_domain_frameworks(user['id'])
    if domain in frameworks:
        user_domains[user['id']] = domain
        return jsonify({'success': True, 'domain': domain})
    return jsonify({'error': 'Invalid domain'}), 400

# ============================================================
# UPLOAD ROUTE
# ============================================================
@app.route('/api/upload', methods=['POST'])
@require_auth
def upload_pdf(user):
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400
    if not file.filename.lower().endswith(('.pdf', '.txt')):
        return jsonify({'error': 'Only PDF and TXT files are supported'}), 400

    try:
        if file.filename.lower().endswith('.pdf'):
            text = extract_text_from_pdf(io.BytesIO(file.read()))
        else:
            text = file.read().decode('utf-8', errors='ignore')

        if not text or not text.strip():
            return jsonify({'error': 'No text found in file'}), 400

        chunks = chunk_text(text)
        store  = get_user_store(user['id'])
        store['documents']  = []
        store['embeddings'] = []

        print(f'[v0] User {user["id"]} — processing {len(chunks)} chunks...')
        for i, chunk in enumerate(chunks):
            emb = get_embedding(chunk)
            store['documents'].append({'text': chunk, 'chunk_id': i,
                                       'metadata': {'source': file.filename}})
            store['embeddings'].append(emb)
            if (i + 1) % 10 == 0:
                print(f'[v0] Embedded {i+1}/{len(chunks)} chunks')

        save_user_store(user['id'])

        domain = get_domain_for_user(user['id'])
        doc_id = db_execute(
            'INSERT INTO documents (user_id, filename, domain, chunks_count) VALUES (%s, %s, %s, %s)',
            (user['id'], file.filename, domain, len(chunks)), lastrowid=True
        )

        return jsonify({'success': True, 'chunks_count': len(chunks),
                        'filename': file.filename, 'document_id': doc_id})

    except Exception as e:
        print(f'[v0] Upload error: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/documents', methods=['GET'])
@require_auth
def get_documents(user):
    """List all uploaded documents for the user"""
    docs = db_execute(
        '''SELECT id, filename, domain, chunks_count, uploaded_at
           FROM documents
           WHERE user_id = %s
           ORDER BY uploaded_at DESC''',
        (user['id'],), fetch=True
    )
    for doc in docs:
        doc['uploaded_at'] = str(doc['uploaded_at'])
    return jsonify({'documents': docs})


@app.route('/api/documents/<int:doc_id>', methods=['DELETE'])
@require_auth
def delete_document(user, doc_id):
    """Delete a document and its chunks from user's store"""
    # Get document to find filename
    doc = db_execute(
        'SELECT filename FROM documents WHERE id = %s AND user_id = %s',
        (doc_id, user['id']), fetch=True
    )
    if not doc:
        return jsonify({'error': 'Document not found'}), 404
    
    try:
        # Remove from documents table
        db_execute('DELETE FROM documents WHERE id = %s AND user_id = %s',
                   (doc_id, user['id']))
        
        # Remove from vector store
        store = get_user_store(user['id'])
        if 'documents' in store and 'embeddings' in store:
            # Remove chunks with matching source filename
            filename = doc[0]['filename']
            indices_to_remove = []
            for i, d in enumerate(store['documents']):
                if d.get('metadata', {}).get('source') == filename:
                    indices_to_remove.append(i)
            
            # Remove in reverse order to preserve indices
            for i in sorted(indices_to_remove, reverse=True):
                store['documents'].pop(i)
                store['embeddings'].pop(i)
            
            save_user_store(user['id'])
        
        return jsonify({'success': True, 'deleted_id': doc_id})
    except Exception as e:
        print(f'[v0] Error deleting document: {e}')
        return jsonify({'error': str(e)}), 500

# ============================================================
# AUTO RETRIEVAL MODE DETECTION
# ============================================================
def detect_retrieval_mode(query):
    """Automatically detect retrieval mode based on question complexity"""
    query_lower = query.lower().strip()
    
    # Direct retrieval indicators (short, single fact, direct definition)
    direct_keywords = [
        'what is', 'define', 'who is', 'when is', 'where is', 
        'how many', 'list', 'name', 'what does', 'explain briefly',
        'short', 'quick', 'simple'
    ]
    
    # LLM-assisted retrieval indicators (synthesis, multiple chunks, reasoning)
    llm_keywords = [
        'compare', 'contrast', 'analyze', 'discuss', 'pros and cons',
        'advantages', 'disadvantages', 'relationship', 'connection',
        'how does', 'why', 'explain', 'summarize', 'combine', 'integrate',
        'implications', 'consequences', 'synthesis', 'complex'
    ]
    
    query_length = len(query.split())
    llm_score = 0
    direct_score = 0
    
    # Check keywords
    for kw in direct_keywords:
        if kw in query_lower:
            direct_score += 1
    for kw in llm_keywords:
        if kw in query_lower:
            llm_score += 2
    
    # Longer questions typically need LLM-assisted
    if query_length > 15:
        llm_score += 1
    if query_length < 8:
        direct_score += 1
    
    # Decision: if LLM score is significantly higher, use LLM-assisted, else direct
    if llm_score > direct_score:
        return 'llm_assisted'
    else:
        return 'direct'

# ============================================================
# CHAT ROUTE
# ============================================================
@app.route('/api/chat', methods=['POST'])
@require_auth
def chat(user):
    data             = request.json or {}
    query            = data.get('query', '')
    use_llm          = data.get('use_llm_retrieval', False)
    document_id      = data.get('document_id')

    if not query:
        return jsonify({'error': 'No query provided'}), 400

    store = get_user_store(user['id'])
    if not store['documents']:
        return jsonify({'error': 'No documents loaded. Please upload a file first.'}), 400

    try:
        domain_id   = get_domain_for_user(user['id'])
        frameworks  = get_domain_frameworks(user['id'])
        domain_info = frameworks.get(domain_id, BUILTIN_DOMAINS['general'])

        # Auto-detect retrieval mode if not explicitly specified
        if 'use_llm_retrieval' not in data or data.get('use_llm_retrieval') is None:
            detected_mode = detect_retrieval_mode(query)
            use_llm = (detected_mode == 'llm_assisted')
            print(f'[v0] Auto-detected retrieval mode: {detected_mode} for query: "{query[:60]}"')

        if use_llm:
            retrieved_chunks, expanded = llm_assisted_retrieval(query, user['id'])
            retrieval_method = 'llm_assisted'
        else:
            q_emb            = get_embedding(query)
            retrieved_chunks = direct_retrieval(q_emb, user['id'])
            expanded         = ''
            retrieval_method = 'direct'

        context = '\n\n'.join([c['text'] for c in retrieved_chunks])

        # generate_text_domain_aware returns None when the model identifies the
        # question as off-domain (it outputs the sentinel string).
        try:
            response_text = generate_text_domain_aware(
                query=query,
                context=context,
                domain_id=domain_id,
                domain_info=domain_info
            )
        except Exception as llm_error:
            print(f'[v0] LLM generation failed: {llm_error}')
            if retrieval_method == 'direct':
                response_text = (
                    f'Based on the retrieved documents, here is the relevant information:\n\n'
                    f'{context}\n\n'
                    f'Note: The AI summary generation is temporarily unavailable, so we\'re returning the raw relevant content from your documents.'
                )
            else:
                return jsonify({'error': 'LLM service temporarily unavailable. Please try direct retrieval or try again later.'}), 503

        # None means the model judged the question as off-domain
        if response_text is None:
            domain_name = domain_info.get('name', domain_id)
            print(f'[v0] Off-domain question blocked for domain "{domain_id}": "{query[:60]}"')
            return jsonify({
                'response':         f'This question is not related to the {domain_name} domain. I can\'t answer it.',
                'retrieved_chunks': [],
                'retrieval_method': 'blocked',
                'expanded_queries': '',
                'domain':           domain_id,
                'off_domain':       True
            })

        # Do NOT save to history here — session saved when user navigates away
        return jsonify({
            'response':         response_text,
            'retrieved_chunks': retrieved_chunks,
            'retrieval_method': retrieval_method,
            'expanded_queries': expanded,
            'domain':           domain_id
        })

    except Exception as e:
        print(f'[v0] Chat error: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/chat/session', methods=['POST'])
@require_auth
def save_session(user):
    """Save a complete user session (all Q&As in one entry)"""
    data = request.json or {}
    messages = data.get('messages', [])  # Array of {role, text, retrieval_method}
    document_id = data.get('document_id')
    domain = data.get('domain', 'general')
    
    if not messages or len(messages) < 2:  # At least one Q&A pair
        return jsonify({'error': 'No messages to save'}), 400
    
    try:
        # Extract first query for preview
        first_query = next((m['text'] for m in messages if m['role'] == 'user'), 'Untitled')[:100]
        
        # Save session as JSON
        db_execute(
            '''INSERT INTO chat_sessions
               (user_id, document_id, domain, session_data, first_query, message_count)
               VALUES (%s, %s, %s, %s, %s, %s)''',
            (user['id'], document_id, domain, json.dumps(messages),
             first_query, len(messages))
        )
        
        return jsonify({'success': True, 'message': 'Session saved'})
    except Exception as e:
        print(f'[v0] Error saving session: {e}')
        return jsonify({'error': str(e)}), 500

# ============================================================
# CHAT HISTORY ROUTE
# ============================================================
@app.route('/api/chat/history', methods=['GET'])
@require_auth
def get_chat_history(user):
    limit = int(request.args.get('limit', 20))
    rows  = db_execute(
        '''SELECT id, domain, first_query, message_count, created_at
           FROM chat_sessions
           WHERE user_id = %s
           ORDER BY created_at DESC
           LIMIT %s''',
        (user['id'], limit), fetch=True
    )
    # Parse session data and extract first message for preview
    for row in rows:
        row['created_at'] = str(row['created_at'])
        row['query'] = row.pop('first_query')  # Use first_query as query for display
    return jsonify({'history': rows})


@app.route('/api/chat/history', methods=['DELETE'])
@require_auth
def clear_chat_history(user):
    db_execute('DELETE FROM chat_sessions WHERE user_id = %s', (user['id'],))
    return jsonify({'success': True})


@app.route('/api/chat/session/<int:session_id>', methods=['GET'])
@require_auth
def get_session(user, session_id):
    """Fetch a complete chat session with all messages"""
    row = db_execute(
        '''SELECT id, session_data, first_query, created_at
           FROM chat_sessions
           WHERE id = %s AND user_id = %s''',
        (session_id, user['id']), fetch=True
    )
    if not row:
        return jsonify({'error': 'Session not found'}), 404
    
    session = row[0]
    session['session_data'] = json.loads(session['session_data'])
    session['created_at'] = str(session['created_at'])
    return jsonify(session)


@app.route('/api/chat/history/<int:session_id>', methods=['DELETE'])
@require_auth
def delete_chat_history_item(user, session_id):
    """Delete a single chat session"""
    db_execute(
        'DELETE FROM chat_sessions WHERE id = %s AND user_id = %s',
        (session_id, user['id'])
    )
    return jsonify({'success': True, 'deleted_id': session_id})

# ============================================================
# STATUS & DATA ROUTES
# ============================================================
@app.route('/api/status', methods=['GET'])
@require_auth
def get_status(user):
    store = get_user_store(user['id'])
    return jsonify({
        'documents_loaded': len(store['documents']),
        'current_domain':   get_domain_for_user(user['id']),
        'domains_count':    len(get_domain_frameworks(user['id'])),
        'user':             user
    })


@app.route('/api/data/clear', methods=['POST'])
@require_auth
def clear_data(user):
    user_vector_stores[user['id']] = {'documents': [], 'embeddings': []}
    save_user_store(user['id'])
    return jsonify({'success': True, 'message': 'Vector store cleared'})


if __name__ == '__main__':
    os.makedirs('static', exist_ok=True)
    print('[v0] Starting Flask server on http://localhost:5000')
    print('[v0] Make sure MySQL is running and schema.sql has been imported.')
    app.run(debug=True, host='0.0.0.0', port=5000)
