// State
let selectedDomain = 'General';
let retrievalMethod = 'direct';
let documentUploaded = false;

// DOM Elements
const domainSelect = document.getElementById('domain');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const documentInfo = document.getElementById('documentInfo');
const chunksCount = document.getElementById('chunksCount');
const currentDomain = document.getElementById('currentDomain');
const retrievalMethodSection = document.getElementById('retrievalMethod');
const directBtn = document.getElementById('directBtn');
const llmBtn = document.getElementById('llmBtn');
const messagesContainer = document.getElementById('messagesContainer');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// Event Listeners
domainSelect.addEventListener('change', (e) => {
    selectedDomain = e.target.value;
    console.log('[v0] Domain changed to:', selectedDomain);
});

dropzone.addEventListener('click', () => {
    fileInput.click();
});

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        handleFileUpload(file);
    } else {
        alert('Please upload a PDF file');
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
});

directBtn.addEventListener('click', () => {
    setRetrievalMethod('direct');
});

llmBtn.addEventListener('click', () => {
    setRetrievalMethod('llm');
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) {
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

// Functions
function setRetrievalMethod(method) {
    retrievalMethod = method;
    directBtn.classList.toggle('active', method === 'direct');
    llmBtn.classList.toggle('active', method === 'llm');
    console.log('[v0] Retrieval method changed to:', method);
}

async function handleFileUpload(file) {
    console.log('[v0] Uploading file:', file.name);
    
    // Show progress
    uploadProgress.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Uploading...';
    
    // Prepare form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('domain', selectedDomain);
    
    try {
        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            if (progress <= 90) {
                progressFill.style.width = progress + '%';
                progressText.textContent = `Processing... ${progress}%`;
            }
        }, 200);
        
        // Upload file
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        const data = await response.json();
        
        // Complete progress
        progressFill.style.width = '100%';
        progressText.textContent = 'Complete!';
        
        // Update UI
        setTimeout(() => {
            uploadProgress.style.display = 'none';
            documentInfo.style.display = 'block';
            retrievalMethodSection.style.display = 'block';
            chunksCount.textContent = data.chunks_count;
            currentDomain.textContent = data.domain;
            documentUploaded = true;
            
            // Enable chat
            chatInput.disabled = false;
            sendBtn.disabled = false;
            statusDot.classList.add('ready');
            statusText.textContent = 'Ready';
            
            // Clear welcome message
            const welcomeMsg = messagesContainer.querySelector('.welcome-message');
            if (welcomeMsg) {
                welcomeMsg.remove();
            }
            
            console.log('[v0] Upload successful:', data);
        }, 500);
        
    } catch (error) {
        console.error('[v0] Upload error:', error);
        progressText.textContent = 'Upload failed. Please try again.';
        progressFill.style.width = '0%';
    }
}

async function sendMessage() {
    const question = chatInput.value.trim();
    if (!question || !documentUploaded) return;
    
    console.log('[v0] Sending message:', question);
    
    // Add user message
    addMessage(question, 'user');
    chatInput.value = '';
    
    // Add loading message
    const loadingMsgId = addLoadingMessage();
    
    // Update status
    statusDot.classList.remove('ready');
    statusDot.classList.add('processing');
    statusText.textContent = 'Processing...';
    
    try {
        const response = await fetch('/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: question,
                domain: selectedDomain,
                method: retrievalMethod
            })
        });
        
        if (!response.ok) {
            throw new Error('Query failed');
        }
        
        const data = await response.json();
        
        // Remove loading message
        removeLoadingMessage(loadingMsgId);
        
        // Add assistant message
        addMessage(data.answer, 'assistant', {
            method: data.method,
            domain: data.domain,
            chunks: data.chunks
        });
        
        console.log('[v0] Response received:', data);
        
    } catch (error) {
        console.error('[v0] Query error:', error);
        removeLoadingMessage(loadingMsgId);
        addMessage('Sorry, there was an error processing your question. Please try again.', 'assistant');
    } finally {
        statusDot.classList.remove('processing');
        statusDot.classList.add('ready');
        statusText.textContent = 'Ready';
    }
}

function addMessage(text, sender, meta = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = text;
    
    messageDiv.appendChild(bubbleDiv);
    
    // Add metadata for assistant messages
    if (sender === 'assistant' && meta) {
        const metaDiv = document.createElement('div');
        metaDiv.className = 'message-meta';
        
        // Method badge
        if (meta.method) {
            const methodBadge = document.createElement('span');
            methodBadge.className = `badge ${meta.method.includes('Direct') ? 'direct' : 'llm'}`;
            methodBadge.textContent = meta.method.includes('Direct') ? 'Direct' : 'LLM-Assisted';
            metaDiv.appendChild(methodBadge);
        }
        
        // Domain badge
        if (meta.domain) {
            const domainBadge = document.createElement('span');
            domainBadge.className = 'badge domain';
            domainBadge.textContent = meta.domain;
            metaDiv.appendChild(domainBadge);
        }
        
        messageDiv.appendChild(metaDiv);
        
        // Add chunks section
        if (meta.chunks && meta.chunks.length > 0) {
            const chunksSection = createChunksSection(meta.chunks);
            messageDiv.appendChild(chunksSection);
        }
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createChunksSection(chunks) {
    const section = document.createElement('div');
    section.className = 'chunks-section';
    
    const header = document.createElement('div');
    header.className = 'chunks-header';
    
    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('class', 'chevron');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', 'currentColor');
    chevron.setAttribute('stroke-width', '2');
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '9 18 15 12 9 6');
    chevron.appendChild(polyline);
    
    const title = document.createElement('h4');
    title.textContent = `${chunks.length} Retrieved Chunks`;
    
    header.appendChild(chevron);
    header.appendChild(title);
    
    const chunksList = document.createElement('div');
    chunksList.className = 'chunks-list';
    
    chunks.forEach((chunk, index) => {
        const chunkItem = document.createElement('div');
        chunkItem.className = 'chunk-item';
        
        const score = document.createElement('span');
        score.className = 'chunk-score';
        score.textContent = `Score: ${(chunk.score * 100).toFixed(1)}%`;
        
        const text = document.createElement('div');
        text.textContent = chunk.chunk;
        
        chunkItem.appendChild(score);
        chunkItem.appendChild(text);
        chunksList.appendChild(chunkItem);
    });
    
    header.addEventListener('click', () => {
        chunksList.classList.toggle('expanded');
        chevron.classList.toggle('expanded');
    });
    
    section.appendChild(header);
    section.appendChild(chunksList);
    
    return section;
}

function addLoadingMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant loading';
    messageDiv.id = 'loading-' + Date.now();
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'loading-dot';
        bubbleDiv.appendChild(dot);
    }
    
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    return messageDiv.id;
}

function removeLoadingMessage(id) {
    const loadingMsg = document.getElementById(id);
    if (loadingMsg) {
        loadingMsg.remove();
    }
}

// Initialize
console.log('[v0] Multi-Domain RAG System initialized');
