/* ============================================================
   MULTI-DOMAIN KNOWLEDGE ASSISTANT — app.js
   ============================================================ */

const API_BASE = '/api';

// Domain metadata (icons + descriptions)
const DOMAIN_META = {
    healthcare: { icon: '🏥', desc: 'Medical analysis, patient data, clinical guidelines, treatment protocols and diagnostics.' },
    legal:      { icon: '⚖️', desc: 'Contract analysis, legal clauses, liability assessment, jurisdiction and case law.' },
    finance:    { icon: '📊', desc: 'Financial reports, revenue analysis, asset management, investment strategy and forecasting.' },
    technical:  { icon: '💻', desc: 'Software architecture, API documentation, system design, implementation details and code.' },
    general:    { icon: '📚', desc: 'General-purpose document retrieval with no domain-specific constraints.' }
};

const PROCESSING_STEPS = [
    'Detecting query intent...',
    'Loading domain framework...',
    'Checking uploaded resources...',
    'Understanding resource context...',
    'Validating information with domain rules...',
    'Selecting optimal retrieval path...',
    'Generating domain-aware response...'
];

// State
let state = {
    currentDomain: 'general',
    documentLoaded: false,
    uploadedFiles: [],
    isProcessing: false,
    currentUser: null,
    currentDocumentId: null,
    sessionMessages: [],  // Track all messages in current chat session
    sessionActive: false
};

/* ============================================================
   PAGE NAVIGATION
   ============================================================ */
function goToPage(page) {
    // Save session if leaving chat page
    const currentPage = document.querySelector('.page.active');
    if (currentPage && currentPage.id === 'page-chat' && page !== 'chat' && state.sessionMessages.length > 0) {
        saveSession();
    }
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
    }
    if (page === 'chat') {
        updateSidebarDomain();
        loadChatHistory();
        state.sessionActive = true;
        state.sessionMessages = [];  // Start fresh session
    }
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async function () {
    // Verify user is logged in before doing anything
    await checkAuth();
    loadDomainsPage1();
    loadPage1History(); // Load previous conversations on page 1
    setupUploadPage();
    setupChatPage();
    checkStatus();
    document.getElementById('btnAddDomainPage1').addEventListener('click', openModal);
    
    // Save session before page unload (browser close, tab close, etc.)
    window.addEventListener('beforeunload', function() {
        if (state.sessionActive && state.sessionMessages.length > 0) {
            saveSession();
        }
    });
});

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
            window.location.href = '/';
            return;
        }
        const data = await res.json();
        state.currentUser = data.user;
        updateUserUI(data.user);
    } catch (e) {
        window.location.href = '/';
    }
}

function updateUserUI(user) {
    ['userDisplayName', 'userDisplayNameP1', 'userDisplayNameP2'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.textContent = user.username;
    });
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
}

/* ============================================================
   PAGE 1 — DOMAIN SELECTION
   ============================================================ */
async function loadDomainsPage1() {
    try {
        const res = await fetch(`${API_BASE}/domains`);
        const data = await res.json();
        renderDomainGrid(data.domains);
    } catch (e) {
        renderDomainGrid(getDefaultDomains());
    }
}

function getDefaultDomains() {
    return Object.entries(DOMAIN_META).map(([id, meta]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        keywords: []
    }));
}

function renderDomainGrid(domains) {
    const grid = document.getElementById('domainGrid');
    grid.innerHTML = '';
    domains.forEach(domain => {
        const meta = DOMAIN_META[domain.id] || { icon: '🔷', desc: 'Custom domain for specialized document retrieval.' };
        const card = document.createElement('div');
        card.className = 'domain-card' + (domain.id === state.currentDomain ? ' selected' : '');
        card.dataset.id = domain.id;
        card.innerHTML = `
            <div class="domain-card-icon">${meta.icon}</div>
            <div class="domain-card-name">${domain.name}</div>
            <div class="domain-card-kw">${domain.keywords.slice(0,3).join(', ') || 'General purpose'}</div>
        `;
        card.addEventListener('click', () => selectDomainCard(domain.id, domain.name, meta, card));
        grid.appendChild(card);
    });
}

function selectDomainCard(id, name, meta, cardEl) {
    // Visually select
    document.querySelectorAll('.domain-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');

    // Update state
    state.currentDomain = id;

    // Description box
    document.getElementById('descIcon').textContent = meta.icon;
    document.getElementById('descText').textContent = meta.desc;

    // Enable proceed
    document.getElementById('btnProceed').disabled = false;

    // Tell backend
    fetch(`${API_BASE}/set-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: id })
    }).catch(() => {});
}

/* ============================================================
   PAGE 2 — UPLOAD
   ============================================================ */
function setupUploadPage() {
    // Ensure success message and button are hidden on page load
    const successMsg = document.getElementById('uploadSuccessMsg');
    const progressWrap = document.getElementById('uploadProgressWrap');
    const goToChatBtn = document.getElementById('btnGoToChat');
    
    if (successMsg) successMsg.style.display = 'none';
    if (progressWrap) progressWrap.style.display = 'none';
    if (goToChatBtn) goToChatBtn.disabled = true;
    
    const dropArea = document.getElementById('uploadDropArea');
    const fileInput = document.getElementById('fileInputUpload');

    dropArea.addEventListener('dragover', e => {
        e.preventDefault();
        document.getElementById('uploadZone').classList.add('dragover');
    });
    dropArea.addEventListener('dragleave', () => {
        document.getElementById('uploadZone').classList.remove('dragover');
    });
    dropArea.addEventListener('drop', e => {
        e.preventDefault();
        document.getElementById('uploadZone').classList.remove('dragover');
        processFiles(Array.from(e.dataTransfer.files));
    });
    fileInput.addEventListener('change', e => {
        processFiles(Array.from(e.target.files));
        fileInput.value = '';
    });
    
    // Load upload page history and documents
    loadUploadPageHistory();
    loadUploadedDocuments();
}

async function loadUploadPageHistory() {
    try {
        const res = await fetch(`${API_BASE}/chat/history?limit=6`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        renderUploadPageHistory(data.history || []);
    } catch (e) {
        // silently fail
    }
}

function renderUploadPageHistory(items) {
    const list = document.getElementById('uploadHistoryList');
    if (!list) return;
    
    if (!items || items.length === 0) {
        list.innerHTML = '<div class="upload-history-empty">No previous conversations. Start fresh by uploading a document.</div>';
        return;
    }
    
    list.innerHTML = '';
    items.forEach(function(item) {
        const itemEl = document.createElement('div');
        itemEl.className = 'upload-history-item';
        itemEl.dataset.id = item.id;
        
        const time = new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        itemEl.innerHTML = `
            <div class="upload-history-item-query">${escapeHtml(item.query)}</div>
            <div class="upload-history-item-meta">
                <span class="upload-history-item-domain">${item.domain}</span>
                <span class="upload-history-item-time">${time}</span>
            </div>
        `;
        
        itemEl.addEventListener('click', function() {
            resumeHistoryConversation(item);
        });
        
        list.appendChild(itemEl);
    });
}

/* ============================================================
   DOCUMENT MANAGEMENT
   ============================================================ */
async function loadUploadedDocuments() {
    try {
        const res = await fetch(`${API_BASE}/documents`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        renderUploadedDocuments(data.documents || []);
    } catch (e) {
        console.error('[v0] Error loading documents:', e);
    }
}

function renderUploadedDocuments(documents) {
    const section = document.getElementById('uploadedDocsSection');
    const list = document.getElementById('uploadedDocsList');
    if (!section || !list) return;
    
    if (!documents || documents.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    list.innerHTML = '';
    
    documents.forEach(function(doc) {
        const itemEl = document.createElement('div');
        itemEl.className = 'uploaded-doc-item';
        itemEl.dataset.id = doc.id;
        
        const date = new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        itemEl.innerHTML = `
            <div class="uploaded-doc-info">
                <div class="uploaded-doc-name">${escapeHtml(doc.filename)}</div>
                <div class="uploaded-doc-meta">
                    <span class="uploaded-doc-chunks">${doc.chunks_count} chunks</span>
                    <span>${date}</span>
                </div>
            </div>
        `;
        
        const delBtn = document.createElement('button');
        delBtn.className = 'uploaded-doc-delete';
        delBtn.title = 'Delete this document';
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3H4v2h16V7h-3z"/></svg>';
        delBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteDocument(doc.id, itemEl);
        });
        
        itemEl.appendChild(delBtn);
        list.appendChild(itemEl);
    });
}

async function deleteDocument(docId, itemEl) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    
    try {
        const res = await fetch(`${API_BASE}/documents/${docId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (res.ok) {
            itemEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(function() {
                itemEl.remove();
                // Reload to update list
                loadUploadedDocuments();
            }, 300);
        } else {
            alert('Error deleting document');
        }
    } catch (e) {
        console.error('[v0] Error deleting document:', e);
        alert('Error deleting document');
    }
}

function processFiles(files) {
    files.forEach(file => {
        if (!file.name.match(/\.(pdf|txt)$/i)) return;
        uploadFile(file);
    });
}

async function uploadFile(file) {
    const fileId = 'file-' + Date.now() + Math.random().toString(36).slice(2);
    addFileItem(fileId, file.name, file.size);

    // Show progress
    showProgress(true, 'Extracting and embedding...');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        const data = await res.json();

        if (res.ok) {
            setFileStatus(fileId, 'done', `${data.chunks_count} chunks`);
            state.documentLoaded    = true;
            state.currentDocumentId = data.document_id || null;
            state.uploadedFiles.push(file.name);

            document.getElementById('uploadSuccessMsg').style.display = 'flex';
            document.getElementById('btnGoToChat').disabled = false;

            // Animate progress to 100%
            animateProgress(100);
            setTimeout(() => showProgress(false), 800);
        } else {
            setFileStatus(fileId, 'error', data.error || 'Failed');
            showProgress(false);
        }
    } catch (e) {
        setFileStatus(fileId, 'error', 'Upload failed');
        showProgress(false);
    }
}

function addFileItem(id, name, size) {
    const list = document.getElementById('uploadedFiles');
    const ext = name.split('.').pop().toUpperCase();
    const sizeStr = size < 1024 * 1024
        ? (size / 1024).toFixed(1) + ' KB'
        : (size / 1024 / 1024).toFixed(1) + ' MB';
    const el = document.createElement('div');
    el.className = 'file-item';
    el.id = id;
    el.innerHTML = `
        <div class="file-icon">${ext === 'PDF' ? '📄' : '📝'}</div>
        <div class="file-info">
            <div class="file-name">${name}</div>
            <div class="file-meta">${sizeStr} · ${ext}</div>
        </div>
        <div class="file-status processing" id="${id}-status">Processing...</div>
    `;
    list.appendChild(el);
}

function setFileStatus(id, type, label) {
    const statusEl = document.getElementById(id + '-status');
    if (!statusEl) return;
    statusEl.className = 'file-status ' + type;
    statusEl.textContent = type === 'done' ? '✓ ' + label : '✗ ' + label;
    const fileItem = document.getElementById(id);
    if (fileItem && type === 'done') fileItem.classList.add('processed');
}

function showProgress(visible, label) {
    const wrap = document.getElementById('uploadProgressWrap');
    wrap.style.display = visible ? 'block' : 'none';
    if (label) document.getElementById('uploadProgressLabel').textContent = label;
    if (visible) animateProgress(60);
}

function animateProgress(target) {
    const fill = document.getElementById('uploadProgressFill');
    fill.style.width = target + '%';
}

/* ============================================================
   PAGE 3 — CHAT
   ============================================================ */
function setupChatPage() {
    const textarea = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');

    sendBtn.addEventListener('click', sendMessage);
    textarea.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
}

function updateSidebarDomain() {
    const nameEl = document.getElementById('sidebarDomainName');
    const domainMeta = DOMAIN_META[state.currentDomain];
    const displayName = state.currentDomain.charAt(0).toUpperCase() + state.currentDomain.slice(1);
    nameEl.textContent = (domainMeta ? domainMeta.icon + ' ' : '') + displayName;

    // Update framework cards
    updateFrameworkCards(state.currentDomain);
}

function updateFrameworkCards(domain) {
    const frameworks = {
        healthcare: {
            definitions: 'Clinical terminology, ICD-10 codes, patient identifiers, treatment pathways.',
            terminology: 'Diagnosis, prognosis, contraindication, etiology, pathology, pharmacology.',
            rules: 'HIPAA compliance, clinical evidence hierarchy, dosage validation.',
            constraints: 'No absolute diagnosis from text alone; recommend physician verification.'
        },
        legal: {
            definitions: 'Contractual obligations, statutory provisions, case precedents, liabilities.',
            terminology: 'Indemnification, subrogation, estoppel, tort, mens rea, injunction.',
            rules: 'Jurisdiction-specific interpretation, statute of limitations, burden of proof.',
            constraints: 'Not legal advice; consult a qualified attorney for binding decisions.'
        },
        finance: {
            definitions: 'Revenue, EBITDA, P/E ratio, liquidity ratios, balance sheet metrics.',
            terminology: 'Amortization, derivatives, hedge, arbitrage, yield, ROI, CAGR.',
            rules: 'GAAP/IFRS accounting standards, SEC reporting requirements.',
            constraints: 'Past performance does not guarantee future results. Not investment advice.'
        },
        technical: {
            definitions: 'APIs, microservices, data structures, design patterns, system architecture.',
            terminology: 'Latency, throughput, idempotency, serialization, abstraction, polymorphism.',
            rules: 'Follow SOLID principles; validate against official documentation.',
            constraints: 'Version-specific behaviors may vary. Test in target environment.'
        },
        general: {
            definitions: 'Domain-agnostic concepts derived directly from uploaded document content.',
            terminology: 'Terms extracted and inferred from the uploaded knowledge base.',
            rules: 'Respond based on document context; flag when information is absent.',
            constraints: 'Accuracy depends on document quality and completeness.'
        }
    };
    const f = frameworks[domain] || frameworks.general;
    document.getElementById('frameworkDefinitions').textContent = f.definitions;
    document.getElementById('frameworkTerminology').textContent = f.terminology;
    document.getElementById('frameworkRules').textContent = f.rules;
    document.getElementById('frameworkConstraints').textContent = f.constraints;
}

function useChip(chipEl) {
    const textarea = document.getElementById('chatInput');
    textarea.value = chipEl.textContent;
    textarea.focus();
}

async function sendMessage() {
    if (state.isProcessing) return;
    const textarea = document.getElementById('chatInput');
    const query = textarea.value.trim();
    if (!query) return;

    textarea.value = '';
    textarea.style.height = 'auto';

    // Remove welcome message
    const welcome = document.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    // Add user bubble
    appendUserMessage(query);

    // Show animated processing steps
    const processingId = appendProcessingSteps();
    state.isProcessing = true;
    document.getElementById('topbarStatus').textContent = 'Processing...';

    try {
        if (!state.documentLoaded) {
            await simulateStepsOnly(processingId);
            removeProcessing(processingId);
            appendAssistantMessage(
                'No document has been uploaded yet. Please go back to the Upload page and add a PDF or TXT file.',
                null, null
            );
            return;
        }

        // Animate steps while waiting for real API
        const stepPromise = animateSteps(processingId);
        // Don't specify use_llm_retrieval — let backend auto-detect based on query
        const apiPromise = fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ query, document_id: state.currentDocumentId })
        }).then(r => r.json());

        const [, data] = await Promise.all([stepPromise, apiPromise]);

        removeProcessing(processingId);

        if (data.error) {
            appendAssistantMessage('Error: ' + data.error, null, null);
        } else if (data.off_domain) {
            appendOffDomainMessage(data.response);
            // Still track in session so users can see the refusal in history
            state.sessionMessages.push({ role: 'user', text: query });
            state.sessionMessages.push({ role: 'assistant', text: data.response, retrieval_method: 'blocked' });
        } else {
            appendAssistantMessage(data.response, data.retrieved_chunks, data.retrieval_method);
            // Track in session instead of saving individually
            state.sessionMessages.push({
                role: 'user',
                text: query
            });
            state.sessionMessages.push({
                role: 'assistant',
                text: data.response,
                retrieval_method: data.retrieval_method
            });
        }

    } catch (e) {
        await simulateStepsOnly(processingId);
        removeProcessing(processingId);
        appendAssistantMessage('Connection error: ' + e.message, null, null);
    } finally {
        state.isProcessing = false;
        document.getElementById('topbarStatus').textContent = 'Ready';
    }
}

function appendUserMessage(text) {
    const area = document.getElementById('messagesArea');
    const row = document.createElement('div');
    row.className = 'msg-row user';
    row.innerHTML = `
        <div class="msg-body">
            <div class="msg-bubble">${escapeHtml(text)}</div>
        </div>
        <div class="msg-avatar user">You</div>
    `;
    area.appendChild(row);
    scrollMessages();
}

function appendProcessingSteps() {
    const id = 'proc-' + Date.now();
    const area = document.getElementById('messagesArea');
    const row = document.createElement('div');
    row.className = 'msg-row assistant';
    row.id = id;
    row.innerHTML = `
        <div class="msg-avatar assistant">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
            </svg>
        </div>
        <div class="msg-body">
            <div class="processing-steps" id="${id}-steps">
                ${PROCESSING_STEPS.map((s, i) => `
                    <div class="processing-step waiting" id="${id}-step-${i}">
                        <div class="step-icon"></div>
                        <span>${s}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    area.appendChild(row);
    scrollMessages();
    return id;
}

function animateSteps(id) {
    return new Promise(resolve => {
        let i = 0;
        function next() {
            if (i > 0) {
                const prev = document.getElementById(`${id}-step-${i - 1}`);
                if (prev) {
                    prev.classList.remove('active', 'visible');
                    prev.classList.add('done', 'visible');
                    prev.querySelector('.step-icon').innerHTML = '✓';
                }
            }
            if (i >= PROCESSING_STEPS.length) { resolve(); return; }

            const step = document.getElementById(`${id}-step-${i}`);
            if (step) {
                step.classList.remove('waiting');
                step.classList.add('active', 'visible');
                step.querySelector('.step-icon').innerHTML = '<div class="step-spinner"></div>';
            }
            scrollMessages();
            i++;
            setTimeout(next, 900);
        }
        next();
    });
}

function simulateStepsOnly(id) {
    return animateSteps(id);
}

function removeProcessing(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function appendOffDomainMessage(text) {
    const area = document.getElementById('messagesArea');
    const row = document.createElement('div');
    row.className = 'msg-row assistant';

    const domainDisplay = state.currentDomain.charAt(0).toUpperCase() + state.currentDomain.slice(1);

    row.innerHTML = `
        <div class="msg-avatar assistant" style="opacity:0.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
            </svg>
        </div>
        <div class="msg-body">
            <div class="msg-meta">
                <span class="meta-badge" style="background:rgba(239,68,68,0.15);color:#f87171;border-color:rgba(239,68,68,0.3)">Off-Domain</span>
                <span class="meta-badge domain">${domainDisplay}</span>
            </div>
            <div class="msg-bubble off-domain-bubble">${escapeHtml(text)}</div>
        </div>
    `;
    area.appendChild(row);
    scrollMessages();
}

function appendAssistantMessage(text, chunks, method) {
    const area = document.getElementById('messagesArea');
    const row = document.createElement('div');
    row.className = 'msg-row assistant';

    const domainDisplay = state.currentDomain.charAt(0).toUpperCase() + state.currentDomain.slice(1);
    const methodLabel = method === 'llm_assisted' ? 'LLM-Assisted' : 'Direct';

    let metaHtml = '';
    if (method) {
        metaHtml = `
            <div class="msg-meta">
                <span class="meta-badge retrieval">${methodLabel} Retrieval</span>
                <span class="meta-badge domain">${domainDisplay}</span>
            </div>
        `;
    }

    let chunksHtml = '';
    if (chunks && chunks.length > 0) {
        const chunkId = 'chunks-' + Date.now();
        const chunkCards = chunks.map(c => `
            <div class="chunk-card">
                <div class="chunk-score">${(c.similarity * 100).toFixed(1)}% match</div>
                <div class="chunk-preview">${escapeHtml(c.text.substring(0, 120))}...</div>
            </div>
        `).join('');
        chunksHtml = `
            <button class="chunks-toggle" onclick="toggleChunks('${chunkId}', this)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M19 9l-7 7-7-7"/></svg>
                Show ${chunks.length} retrieved chunks
            </button>
            <div class="chunks-panel" id="${chunkId}">${chunkCards}</div>
        `;
    }

    row.innerHTML = `
        <div class="msg-avatar assistant">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
            </svg>
        </div>
        <div class="msg-body">
            ${metaHtml}
            <div class="msg-bubble">${escapeHtml(text)}</div>
            ${chunksHtml}
        </div>
    `;
    area.appendChild(row);
    scrollMessages();
}

function toggleChunks(id, btn) {
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.classList.toggle('open');
    btn.innerHTML = panel.classList.contains('open')
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M5 15l7-7 7 7"/></svg> Hide chunks'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M19 9l-7 7-7-7"/></svg> Show ' + panel.children.length + ' retrieved chunks';
}

function scrollMessages() {
    const area = document.getElementById('messagesArea');
    area.scrollTop = area.scrollHeight;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ============================================================
   STATUS CHECK
   ============================================================ */
async function checkStatus() {
    try {
        const res = await fetch(`${API_BASE}/status`);
        const data = await res.json();
        if (data.documents_loaded > 0) {
            state.documentLoaded = true;
            document.getElementById('btnGoToChat').disabled = false;
            document.getElementById('uploadSuccessMsg').style.display = 'flex';
            document.getElementById('topbarStatus').textContent = `${data.documents_loaded} chunks loaded`;
        }
        if (data.current_domain) {
            state.currentDomain = data.current_domain;
        }
    } catch (e) {}
}

/* ============================================================
   MODAL — ADD DOMAIN
   ============================================================ */
function openModal() {
    document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.getElementById('modalDomainName').value = '';
    document.getElementById('modalKeywords').value = '';
    document.getElementById('modalPromptPrefix').value = '';
}

async function submitAddDomain() {
    const name = document.getElementById('modalDomainName').value.trim();
    const keywords = document.getElementById('modalKeywords').value.split(',').map(k => k.trim()).filter(Boolean);
    const prefix = document.getElementById('modalPromptPrefix').value.trim();

    if (!name) { alert('Domain name is required.'); return; }

    const domainId = name.toLowerCase().replace(/\s+/g, '_');

    try {
        const res = await fetch(`${API_BASE}/domains`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                domain_id: domainId,
                name,
                keywords,
                structure: ['overview', 'details', 'summary'],
                prompt_prefix: prefix || `As a ${name} expert, `
            })
        });
        const data = await res.json();
        if (res.ok) {
            DOMAIN_META[domainId] = { icon: '🔷', desc: `Custom domain: ${name}.` };
            closeModal();
            loadDomainsPage1();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

/* ============================================================
   AUTO-DETECT RETRIEVAL MODE
   ============================================================ */
function detectRetrievalMode(query) {
    // Short queries or single-fact questions use direct retrieval
    // Long queries or synthesis questions use LLM-assisted retrieval
    
    const lowerQuery = query.toLowerCase();
    const words = query.trim().split(/\s+/).length;
    
    // Direct retrieval indicators: short, direct definition questions
    const directIndicators = [
        /^what\s+(is|are)\s+/i,           // What is X?
        /^who\s+is\s+/i,                  // Who is X?
        /^when\s+/i,                      // When...?
        /^where\s+/i,                     // Where...?
        /^definition\s+/i,                // Definition of...
        /^list\s+(all\s+)?/i,            // List X
        /^name\s+(the\s+)?/i              // Name the X
    ];
    
    // LLM-assisted indicators: complex questions needing synthesis
    const llmIndicators = [
        /\bhow\s+to\b/i,                  // How to X (needs steps/reasoning)
        /\bcompare\b/i,                   // Compare X and Y
        /\bwhy\b/i,                       // Why questions (need reasoning)
        /\brelationship\b/i,              // Relationships
        /\bexplain\b/i,                   // Explain (needs context)
        /\bdifference\b/i,                // Difference between
        /\badvantage|disadvantage\b/i,    // Pros/cons
        /\bimpact|effect\b/i,             // Cause-effect
        /\banalysis|analyze\b/i           // Analysis
    ];
    
    // Check indicators
    const hasDirectIndicator = directIndicators.some(regex => regex.test(query));
    const hasLLMIndicator = llmIndicators.some(regex => regex.test(query));
    
    // If LLM indicators present, use LLM-assisted
    if (hasLLMIndicator) return 'llm';
    
    // If short query (< 8 words) without LLM indicators, use direct
    if (words < 8) return 'direct';
    
    // If has direct indicator, use direct
    if (hasDirectIndicator) return 'direct';
    
    // Long queries (>= 8 words) without clear indicators use LLM-assisted
    return words > 15 ? 'llm' : 'direct';
}

/* ============================================================
   PAGE 1 HISTORY LOADING
   ============================================================ */
async function loadPage1History() {
    try {
        const res = await fetch(`${API_BASE}/chat/history?limit=10`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        renderPage1History(data.history || []);
    } catch (e) {
        // silently fail
    }
}

function renderPage1History(items) {
    const section = document.getElementById('page1HistorySection');
    const list = document.getElementById('page1HistoryList');
    if (!section || !list) return;
    
    if (!items || items.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    list.innerHTML = '';
    
    items.slice(0, 6).forEach(function(item) {
        const itemEl = document.createElement('div');
        itemEl.className = 'page1-history-item';
        itemEl.dataset.id = item.id;
        
        const time = new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        itemEl.innerHTML = `
            <div class="page1-history-item-query">${escapeHtml(item.query)}</div>
            <div class="page1-history-item-meta">
                <span class="page1-history-item-domain">${item.domain}</span>
                <span class="page1-history-item-time">${time}</span>
            </div>
        `;
        
        itemEl.addEventListener('click', function(e) {
            if (e.target.closest('.page1-history-item-delete')) return;
            resumeHistoryConversation(item);
        });
        
        const delBtn = document.createElement('button');
        delBtn.className = 'page1-history-item-delete';
        delBtn.title = 'Delete this conversation';
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3H4v2h16V7h-3z"/></svg>';
        delBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteHistoryItem(item.id, itemEl);
        });
        
        itemEl.appendChild(delBtn);
        list.appendChild(itemEl);
    });
}

function resumeHistoryConversation(item) {
    // Set domain to the history item's domain
    state.currentDomain = item.domain;
    
    // Go to chat page with the history item pre-loaded
    goToPage('chat');
    
    // After page loads, restore the complete session
    setTimeout(async function() {
        try {
            // Fetch full session data
            const res = await fetch(`${API_BASE}/chat/session/${item.id}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Could not load session');
            const data = await res.json();
            const messages = data.session_data || [];
            
            const area = document.getElementById('messagesArea');
            const welcome = document.querySelector('.chat-welcome');
            if (welcome) welcome.remove();
            
            const banner = document.createElement('div');
            banner.className = 'history-restore-banner';
            banner.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Restored session: <strong>${messages.length} messages</strong> from ${new Date(item.created_at).toLocaleString()}
            `;
            area.appendChild(banner);
            
            // Render all messages in the session
            messages.forEach(msg => {
                if (msg.role === 'user') {
                    appendUserMessage(msg.text);
                } else {
                    appendAssistantMessage(msg.text, null, msg.retrieval_method);
                }
            });
            
            scrollMessages();
        } catch (e) {
            console.error('[v0] Error loading session:', e);
            const area = document.getElementById('messagesArea');
            appendAssistantMessage('Error: Could not load session data', null, null);
        }
    }, 100);
}

/* ============================================================
   CHAT HISTORY
   ============================================================ */
async function loadChatHistory() {
    try {
        const res = await fetch(`${API_BASE}/chat/history?limit=50`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        renderHistoryList(data.history || []);
    } catch (e) {
        // silently fail — history is a non-critical enhancement
    }
}

function renderHistoryList(items) {
    const list = document.getElementById('historyList');
    const empty = document.getElementById('historyEmpty');
    if (!list) return;

    if (!items || items.length === 0) {
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    // Group by date
    const groups = {};
    items.forEach(function(item) {
        const d = new Date(item.created_at);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        let label;
        if (d.toDateString() === today.toDateString()) {
            label = 'Today';
        } else if (d.toDateString() === yesterday.toDateString()) {
            label = 'Yesterday';
        } else {
            label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        if (!groups[label]) groups[label] = [];
        groups[label].push(item);
    });

    list.innerHTML = '';
    Object.entries(groups).forEach(function([date, groupItems]) {
        const dateEl = document.createElement('div');
        dateEl.className = 'history-date-group';
        dateEl.textContent = date;
        list.appendChild(dateEl);

        groupItems.forEach(function(item) {
            const container = document.createElement('div');
            container.className = 'history-item-container';

            const btn = document.createElement('button');
            btn.className = 'history-item';
            btn.dataset.id = item.id;

            const time = new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            btn.innerHTML = `
                <div class="history-item-query">${escapeHtml(item.query)}</div>
                <div class="history-item-meta">
                    <span class="history-item-domain">${item.domain}</span>
                    <span class="history-item-time">${time}</span>
                </div>
            `;
            btn.addEventListener('click', function() { restoreHistoryItem(item, btn); });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'history-item-delete';
            deleteBtn.title = 'Delete this conversation';
            deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3H4v2h16V7h-3z"/></svg>';
            deleteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                deleteHistoryItem(item.id, container);
            });

            container.appendChild(btn);
            container.appendChild(deleteBtn);
            list.appendChild(container);
        });
    });
}

function restoreHistoryItem(item, btnEl) {
    // Mark active in sidebar
    document.querySelectorAll('.history-item').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');

    const area = document.getElementById('messagesArea');

    // Remove welcome screen
    const welcome = document.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    // Add a restore banner
    const banner = document.createElement('div');
    banner.className = 'history-restore-banner';
    banner.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Restored from history &mdash; <strong>${new Date(item.created_at).toLocaleString()}</strong>
    `;
    area.appendChild(banner);

    // Render the user query
    appendUserMessage(item.query);

    // Render the assistant response (no chunks — history only stores text)
    appendAssistantMessage(item.response, null, item.retrieval_method);

    scrollMessages();

    // Update domain display to match the history item's domain
    const domainMeta = DOMAIN_META[item.domain] || { icon: '', desc: '' };
    const nameEl = document.getElementById('sidebarDomainName');
    if (nameEl) nameEl.textContent = (domainMeta.icon ? domainMeta.icon + ' ' : '') + item.domain.charAt(0).toUpperCase() + item.domain.slice(1);
}

async function deleteHistoryItem(historyId, containerEl) {
    if (!confirm('Delete this conversation?')) return;
    try {
        const res = await fetch(`${API_BASE}/chat/history/${historyId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (res.ok) {
            containerEl.style.opacity = '0';
            containerEl.style.transform = 'translateX(100%)';
            containerEl.style.transition = 'all 0.2s ease';
            setTimeout(() => containerEl.remove(), 200);
        } else {
            alert('Failed to delete conversation');
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function clearHistory() {
    if (!confirm('Delete all chat history? This cannot be undone.')) return;
    try {
        await fetch(`${API_BASE}/chat/history`, { method: 'DELETE', credentials: 'include' });
        const list = document.getElementById('historyList');
        const empty = document.getElementById('historyEmpty');
        if (list) list.innerHTML = '';
        if (empty) { empty.style.display = 'block'; list.appendChild(empty); }
    } catch (e) {
        alert('Could not clear history: ' + e.message);
    }
}

/* ============================================================
   DATA MANAGEMENT
   ============================================================ */
async function loadSavedData() {
    try {
        const res = await fetch(`${API_BASE}/data/load`, { method: 'POST', credentials: 'include' });
        if (!res.ok) { alert('Load failed: server returned ' + res.status); return; }
        const data = await res.json();
        if (data.success) {
            alert('Loaded ' + data.documents_count + ' document chunks and ' + data.domains_count + ' domains.');
            loadDomainsPage1();
            checkStatus();
        }
    } catch (e) { alert('Load error: ' + e.message); }
}

function exportChatPDF() {
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) { alert('No chat messages to export.'); return; }

    // Collect all rendered message bubbles
    const bubbles = messagesArea.querySelectorAll('.msg-bubble');
    if (bubbles.length === 0) { alert('No messages in the conversation yet.'); return; }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const domainName = document.getElementById('sidebarDomainName') ? document.getElementById('sidebarDomainName').textContent : 'General';
    const userName = state.currentUser ? state.currentUser.username : 'User';

    let rows = '';
    bubbles.forEach(function (bubble) {
        const isUser = bubble.closest('.msg-row') && bubble.closest('.msg-row').classList.contains('msg-row-user');
        const role = isUser ? 'user' : 'assistant';
        const roleLabel = isUser ? userName : 'Assistant (RAG)';
        // Get text content, stripping the chunks accordion if present
        const clone = bubble.cloneNode(true);
        const chunksEl = clone.querySelector('.retrieved-chunks-wrap');
        if (chunksEl) chunksEl.remove();
        const text = (clone.textContent || '').trim();
        rows += '<div class="print-msg">'
            + '<div class="print-msg-role ' + role + '">' + roleLabel + '</div>'
            + '<div class="print-msg-text">' + escapeHtml(text) + '</div>'
            + '</div>';
    });

    const printArea = document.getElementById('printArea');
    printArea.style.display = 'block';
    printArea.innerHTML = '<div class="print-header">'
        + '<h1>Multi-Domain Knowledge Assistant — Chat Export</h1>'
        + '<p>Domain: ' + escapeHtml(domainName) + '&nbsp;&nbsp;|&nbsp;&nbsp;Exported: ' + dateStr + '&nbsp;&nbsp;|&nbsp;&nbsp;User: ' + escapeHtml(userName) + '</p>'
        + '</div>'
        + rows
        + '<div class="print-footer">Generated by Multi-Domain RAG System &mdash; Powered by Gemini 2.5 Pro</div>';

    window.print();

    // Restore after print dialog closes
    setTimeout(function () {
        printArea.style.display = 'none';
        printArea.innerHTML = '';
    }, 1000);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ============================================================
   SESSION SAVING
   ============================================================ */
async function saveSession() {
    if (!state.sessionActive || state.sessionMessages.length < 2) return;
    
    try {
        const res = await fetch(`${API_BASE}/chat/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                messages: state.sessionMessages,
                document_id: state.currentDocumentId,
                domain: state.currentDomain
            })
        });
        
        if (res.ok) {
            console.log('[v0] Session saved with ' + state.sessionMessages.length + ' messages');
            state.sessionMessages = [];
            state.sessionActive = false;
        }
    } catch (e) {
        console.error('[v0] Error saving session:', e);
    }
}

function addCustomDomain() { openModal(); }

// Expose globals
window.goToPage = goToPage;
window.useChip = useChip;
window.toggleChunks = toggleChunks;
window.openModal = openModal;
window.closeModal = closeModal;
window.submitAddDomain = submitAddDomain;
window.loadSavedData = loadSavedData;
window.exportChatPDF = exportChatPDF;
window.clearHistory = clearHistory;
window.deleteHistoryItem = deleteHistoryItem;
window.addCustomDomain = addCustomDomain;
window.logout = logout;
