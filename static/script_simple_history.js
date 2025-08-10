let currentQuestion = '';
let currentResponse = '';
let currentEvaluation = '';
let currentHistoryId = null;
let pdfUploaded = false;
let sessionEvaluations = [];
let evaluationCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Main elements
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const currentEvaluationDiv = document.getElementById('current-evaluation');
    const improveBtn = document.getElementById('improve-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const pdfUpload = document.getElementById('pdf-upload');
    const uploadStatus = document.getElementById('upload-status');
    const evalCount = document.getElementById('eval-count');
    const evaluationHistoryList = document.getElementById('evaluation-history-list');
    
    // Export elements
    const exportBtn = document.getElementById('export-btn');
    const exportModal = document.getElementById('export-modal');
    const confirmExport = document.getElementById('confirm-export');
    const cancelExport = document.getElementById('cancel-export');
    
    // Event listeners
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    uploadBtn.addEventListener('click', uploadPDF);
    improveBtn.addEventListener('click', improveResponse);
    
    // Export
    exportBtn.addEventListener('click', () => {
        exportModal.style.display = 'flex';
    });
    
    confirmExport.addEventListener('click', () => {
        const format = document.querySelector('input[name="export-format"]:checked').value;
        exportHistory(format);
    });
    
    cancelExport.addEventListener('click', () => {
        exportModal.style.display = 'none';
    });
    
    // Functions
    async function uploadPDF() {
        const file = pdfUpload.files[0];
        if (!file) {
            uploadStatus.textContent = 'Please select a PDF file';
            uploadStatus.style.color = '#e74c3c';
            return;
        }
        
        uploadStatus.innerHTML = 'Uploading...<span class="loading"></span>';
        uploadStatus.style.color = '#3498db';
        uploadBtn.disabled = true;
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const response = await fetch('/upload_pdf', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        pdf_data: e.target.result,
                        filename: file.name
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    uploadStatus.textContent = data.message;
                    uploadStatus.style.color = '#27ae60';
                    pdfUploaded = true;
                    userInput.placeholder = 'Ask a question about the uploaded PDF...';
                } else {
                    uploadStatus.textContent = 'Upload failed: ' + (data.error || 'Unknown error');
                    uploadStatus.style.color = '#e74c3c';
                }
            } catch (error) {
                uploadStatus.textContent = 'Upload failed: ' + error.message;
                uploadStatus.style.color = '#e74c3c';
            } finally {
                uploadBtn.disabled = false;
            }
        };
        
        reader.readAsDataURL(file);
    }
    
    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        
        currentQuestion = message;
        
        addMessage(message, 'user');
        userInput.value = '';
        sendBtn.disabled = true;
        
        addMessage('Thinking...', 'assistant', true);
        
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            
            removeLoadingMessage();
            
            if (data.error) {
                addMessage('Error: ' + data.error, 'assistant');
            } else {
                currentResponse = data.response;
                currentHistoryId = data.history_id;
                addMessage(data.response, 'assistant');
                
                if (data.evaluation) {
                    currentEvaluation = data.evaluation;
                    evaluationCounter++;
                    
                    // Parse evaluation
                    const { label, explanation } = parseEvaluation(data.evaluation);
                    
                    // Add to session history
                    const evalData = {
                        id: data.history_id,
                        number: evaluationCounter,
                        timestamp: new Date().toLocaleTimeString(),
                        question: currentQuestion,
                        response: currentResponse,
                        evaluation: data.evaluation,
                        label: label,
                        explanation: explanation,
                        improved: false
                    };
                    
                    sessionEvaluations.unshift(evalData); // Add to beginning
                    
                    // Display current evaluation
                    displayCurrentEvaluation(evalData);
                    
                    // Update history list
                    updateEvaluationHistory();
                    
                    // Show improve button
                    improveBtn.style.display = 'block';
                }
            }
        } catch (error) {
            removeLoadingMessage();
            addMessage('Error: ' + error.message, 'assistant');
        } finally {
            sendBtn.disabled = false;
        }
    }
    
    async function improveResponse() {
        if (!currentQuestion || !currentResponse || !currentEvaluation) return;
        
        improveBtn.disabled = true;
        improveBtn.innerHTML = '<span class="icon">⏳</span> Improving...';
        
        addMessage('Improving response based on evaluation...', 'assistant', true);
        
        try {
            const response = await fetch('/improve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: currentQuestion,
                    response: currentResponse,
                    evaluation: currentEvaluation,
                    history_id: currentHistoryId
                })
            });
            
            const data = await response.json();
            
            removeLoadingMessage();
            
            if (data.error) {
                addMessage('Error: ' + data.error, 'assistant');
            } else {
                currentResponse = data.response;
                addMessage('Improved Response:\n\n' + data.response, 'assistant');
                
                if (data.evaluation) {
                    currentEvaluation = data.evaluation;
                    evaluationCounter++;
                    
                    // Parse evaluation
                    const { label, explanation } = parseEvaluation(data.evaluation);
                    
                    // Add improved evaluation to history
                    const evalData = {
                        id: currentHistoryId + '_improved',
                        number: evaluationCounter,
                        timestamp: new Date().toLocaleTimeString(),
                        question: currentQuestion + ' (Improved)',
                        response: data.response,
                        evaluation: data.evaluation,
                        label: label,
                        explanation: explanation,
                        improved: true
                    };
                    
                    sessionEvaluations.unshift(evalData);
                    
                    // Display improved evaluation
                    displayCurrentEvaluation(evalData);
                    
                    // Update history list
                    updateEvaluationHistory();
                }
            }
        } catch (error) {
            removeLoadingMessage();
            addMessage('Error: ' + error.message, 'assistant');
        } finally {
            improveBtn.disabled = false;
            improveBtn.innerHTML = '<span class="icon">✨</span> Improve Response';
        }
    }
    
    function parseEvaluation(evaluation) {
        const lines = evaluation.split('\n');
        let label = '';
        let explanation = '';
        
        for (const line of lines) {
            if (line.startsWith('Label:')) {
                label = line.replace('Label:', '').trim();
            } else if (line.startsWith('Explanation:')) {
                explanation = line.replace('Explanation:', '').trim();
            } else if (explanation && line.trim()) {
                explanation += ' ' + line.trim();
            }
        }
        
        return { label, explanation };
    }
    
    function displayCurrentEvaluation(evalData) {
        let labelClass = 'eval-label';
        if (evalData.label.toLowerCase().includes('grounded') && !evalData.label.toLowerCase().includes('not')) {
            if (evalData.label.toLowerCase().includes('partially')) {
                labelClass += ' partially';
            } else {
                labelClass += ' grounded';
            }
        } else if (evalData.label.toLowerCase().includes('not')) {
            labelClass += ' not-grounded';
        }
        
        let improvedBadge = evalData.improved ? 
            '<span class="improved-indicator"><span class="icon">✨</span>Improved</span>' : '';
        
        currentEvaluationDiv.innerHTML = `
            <div class="evaluation-result">
                <div class="${labelClass}">
                    ${evalData.label}
                    ${improvedBadge}
                </div>
                <div class="eval-explanation">${evalData.explanation}</div>
                <div style="margin-top: 10px; font-size: 11px; color: #95a5a6;">
                    Evaluation #${evalData.number} • ${evalData.timestamp}
                </div>
            </div>
        `;
    }
    
    function updateEvaluationHistory() {
        // Update count
        evalCount.textContent = `${sessionEvaluations.length} evaluation${sessionEvaluations.length !== 1 ? 's' : ''}`;
        
        // Update history list
        if (sessionEvaluations.length === 0) {
            evaluationHistoryList.innerHTML = `
                <div class="history-placeholder">
                    No previous evaluations in this session
                </div>
            `;
            return;
        }
        
        evaluationHistoryList.innerHTML = sessionEvaluations.map((eval, index) => {
            const groundednessClass = eval.label ? 
                eval.label.toLowerCase().replace(' ', '-') : '';
            
            const improvedBadge = eval.improved ? 
                '<span class="improved-indicator"><span class="icon">✨</span>Improved</span>' : '';
            
            return `
                <div class="eval-history-item ${index === 0 ? 'active' : ''}" 
                     onclick="viewEvaluation(${index})"
                     data-index="${index}">
                    <div class="eval-history-header">
                        <span class="eval-history-number">
                            #${eval.number}
                            ${improvedBadge}
                        </span>
                        <span class="eval-history-timestamp">${eval.timestamp}</span>
                    </div>
                    <div class="eval-history-badge ${groundednessClass}">
                        ${eval.label || 'N/A'}
                    </div>
                    <div class="eval-history-question">${eval.question}</div>
                    <div class="eval-history-preview">${eval.explanation}</div>
                </div>
            `;
        }).join('');
    }
    
    window.viewEvaluation = function(index) {
        const eval = sessionEvaluations[index];
        if (!eval) return;
        
        // Update active state
        document.querySelectorAll('.eval-history-item').forEach((item, i) => {
            if (i === index) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Display selected evaluation
        displayCurrentEvaluation(eval);
        
        // Update current variables for potential improvement
        currentQuestion = eval.question.replace(' (Improved)', '');
        currentResponse = eval.response;
        currentEvaluation = eval.evaluation;
        currentHistoryId = eval.id;
        
        // Show/hide improve button based on selection
        improveBtn.style.display = eval.improved ? 'none' : 'block';
    };
    
    function addMessage(text, sender, isLoading = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'message-label';
        labelDiv.textContent = sender === 'user' ? 'You' : 'Assistant';
        
        const contentDiv = document.createElement('div');
        contentDiv.textContent = text;
        if (isLoading) {
            contentDiv.innerHTML = text + '<span class="loading"></span>';
        }
        
        messageDiv.appendChild(labelDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function removeLoadingMessage() {
        const messages = chatMessages.querySelectorAll('.message.assistant');
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.querySelector('.loading')) {
            lastMessage.remove();
        }
    }
    
    async function exportHistory(format) {
        try {
            const url = `/history/export?format=${format}`;
            window.location.href = url;
            exportModal.style.display = 'none';
        } catch (error) {
            alert('Error exporting history: ' + error.message);
        }
    }
});