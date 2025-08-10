// Initialize variables including evaluation history
let currentQuestion = '';
let currentResponse = '';
let currentEvaluation = '';
let pdfUploaded = false;
let evaluationHistory = [];
let evaluationCounter = 0;

// Clear evaluation history function (global for onclick)
window.clearEvaluationHistory = function() {
    if (confirm('Are you sure you want to clear the evaluation history?')) {
        evaluationHistory = [];
        updateEvaluationDisplay();
        // Clear session history on server
        fetch('/clear_history', { method: 'POST' });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const evaluationDisplay = document.getElementById('evaluation-display');
    const improveBtn = document.getElementById('improve-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const pdfUpload = document.getElementById('pdf-upload');
    const uploadStatus = document.getElementById('upload-status');
    
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    uploadBtn.addEventListener('click', uploadPDF);
    improveBtn.addEventListener('click', improveResponse);
    
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
                        pdf_data: e.target.result
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
                addMessage(data.response, 'assistant');
                
                if (data.evaluation_history) {
                    // Update the entire evaluation history from server
                    evaluationHistory = data.evaluation_history;
                    updateEvaluationDisplay();
                    improveBtn.style.display = 'block';
                    currentEvaluation = data.evaluation;
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
        improveBtn.textContent = 'Improving...';
        
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
                    evaluation: currentEvaluation
                })
            });
            
            const data = await response.json();
            
            removeLoadingMessage();
            
            if (data.error) {
                addMessage('Error: ' + data.error, 'assistant');
            } else {
                currentResponse = data.response;
                addMessage('Improved Response:\n\n' + data.response, 'assistant');
                
                if (data.evaluation_history) {
                    // Update the entire evaluation history from server
                    evaluationHistory = data.evaluation_history;
                    updateEvaluationDisplay();
                    currentEvaluation = data.evaluation;
                }
            }
        } catch (error) {
            removeLoadingMessage();
            addMessage('Error: ' + error.message, 'assistant');
        } finally {
            improveBtn.disabled = false;
            improveBtn.textContent = 'Improve Response';
        }
    }
    
    function addEvaluationToHistory(evaluation, isImproved) {
        evaluationCounter++;
        
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
        
        // Add to evaluation history
        const evalItem = {
            id: evaluationCounter,
            question: currentQuestion,
            response: currentResponse,
            label: label,
            explanation: explanation,
            timestamp: new Date().toLocaleTimeString(),
            isImproved: isImproved
        };
        evaluationHistory.unshift(evalItem);
        
        // Update the evaluation display
        updateEvaluationDisplay();
    }
    
    function updateEvaluationDisplay() {
        const evaluationHistoryDiv = document.getElementById('evaluation-history');
        if (!evaluationHistoryDiv) return;
        
        // Remove placeholder if exists
        const placeholder = document.getElementById('eval-placeholder');
        if (placeholder) placeholder.remove();
        
        // Build history HTML - reverse to show newest first
        let historyHTML = '';
        const reversedHistory = [...evaluationHistory].reverse();
        
        reversedHistory.forEach((eval, index) => {
            // Parse the evaluation text
            let label = '';
            let explanation = '';
            
            if (eval.evaluation) {
                const lines = eval.evaluation.split('\n');
                for (const line of lines) {
                    if (line.startsWith('Label:')) {
                        label = line.replace('Label:', '').trim();
                    } else if (line.startsWith('Explanation:')) {
                        explanation = line.replace('Explanation:', '').trim();
                    } else if (explanation && line.trim()) {
                        explanation += ' ' + line.trim();
                    }
                }
            }
            
            let bgColor = 'bg-white';
            let borderColor = 'border-gray-200';
            let iconClass = 'fa-circle text-gray-400';
            let labelColor = 'text-gray-600';
            
            if (label.toLowerCase().includes('grounded') && !label.toLowerCase().includes('not')) {
                if (label.toLowerCase().includes('partially')) {
                    borderColor = 'border-l-4 border-l-amber-400';
                    iconClass = 'fa-exclamation-triangle text-amber-500';
                    labelColor = 'text-amber-600';
                } else {
                    borderColor = 'border-l-4 border-l-green-400';
                    iconClass = 'fa-check-circle text-green-500';
                    labelColor = 'text-green-600';
                }
            } else if (label.toLowerCase().includes('not')) {
                borderColor = 'border-l-4 border-l-red-400';
                iconClass = 'fa-times-circle text-red-500';
                labelColor = 'text-red-600';
            }
            
            const isLatest = index === 0;
            const timestamp = new Date(eval.timestamp).toLocaleTimeString();
            
            historyHTML += `
                <div class="${bgColor} rounded-lg border ${borderColor} p-4 mb-3 ${isLatest ? 'ring-2 ring-blue-400 ring-opacity-50' : ''} transition-all hover:shadow-md">
                    <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center">
                            <i class="fas ${iconClass} mr-2"></i>
                            <span class="font-semibold ${labelColor}">${label}</span>
                            ${eval.is_improved ? '<span class="ml-2 text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">Improved</span>' : ''}
                        </div>
                        <span class="text-xs text-gray-500">${timestamp}</span>
                    </div>
                    <div class="text-sm text-gray-700 mb-2">
                        <span class="font-medium">Q:</span> ${eval.question.substring(0, 100)}${eval.question.length > 100 ? '...' : ''}
                    </div>
                    <div class="text-sm text-gray-600">
                        ${explanation}
                    </div>
                    ${isLatest ? '<div class="mt-2 text-xs text-blue-600 font-medium">← Latest evaluation</div>' : ''}
                </div>
            `;
        });
        
        evaluationHistoryDiv.innerHTML = historyHTML || '<div class="text-center text-gray-500 py-8">No evaluations yet</div>';
    }
    
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
});