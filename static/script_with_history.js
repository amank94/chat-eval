let currentQuestion = '';
let currentResponse = '';
let currentEvaluation = '';
let currentHistoryId = null;
let pdfUploaded = false;
let currentPage = 1;
let itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', () => {
    // Main elements
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const evaluationDisplay = document.getElementById('evaluation-display');
    const improveBtn = document.getElementById('improve-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const pdfUpload = document.getElementById('pdf-upload');
    const uploadStatus = document.getElementById('upload-status');
    
    // Tab elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // History elements
    const historyList = document.getElementById('history-list');
    const searchInput = document.getElementById('search-input');
    const groundednessFilter = document.getElementById('groundedness-filter');
    const applyFilters = document.getElementById('apply-filters');
    const prevPage = document.getElementById('prev-page');
    const nextPage = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    // Export elements
    const exportBtn = document.getElementById('export-btn');
    const exportModal = document.getElementById('export-modal');
    const confirmExport = document.getElementById('confirm-export');
    const cancelExport = document.getElementById('cancel-export');
    
    // Initialize
    loadStats();
    
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
    
    // Tab switching
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            switchTab(targetTab);
            
            if (targetTab === 'history') {
                loadHistory();
            } else if (targetTab === 'stats') {
                loadStats();
            }
        });
    });
    
    // History filters
    applyFilters.addEventListener('click', () => {
        currentPage = 1;
        loadHistory();
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentPage = 1;
            loadHistory();
        }
    });
    
    // Pagination
    prevPage.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadHistory();
        }
    });
    
    nextPage.addEventListener('click', () => {
        currentPage++;
        loadHistory();
    });
    
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
    function switchTab(tabName) {
        tabButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        tabContents.forEach(content => {
            if (content.id === `${tabName}-tab`) {
                content.style.display = 'flex';
            } else {
                content.style.display = 'none';
            }
        });
    }
    
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
                    displayEvaluation(data.evaluation);
                    improveBtn.style.display = 'block';
                }
                
                // Refresh stats after new evaluation
                loadStats();
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
                    displayEvaluation(data.evaluation);
                }
                
                // Refresh stats after improvement
                loadStats();
            }
        } catch (error) {
            removeLoadingMessage();
            addMessage('Error: ' + error.message, 'assistant');
        } finally {
            improveBtn.disabled = false;
            improveBtn.textContent = 'Improve Response';
        }
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
    
    function displayEvaluation(evaluation) {
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
        
        let labelClass = 'eval-label';
        if (label.toLowerCase().includes('grounded') && !label.toLowerCase().includes('not')) {
            if (label.toLowerCase().includes('partially')) {
                labelClass += ' partially';
            } else {
                labelClass += ' grounded';
            }
        } else if (label.toLowerCase().includes('not')) {
            labelClass += ' not-grounded';
        }
        
        evaluationDisplay.innerHTML = `
            <div class="evaluation-result">
                <div class="${labelClass}">${label}</div>
                <div class="eval-explanation">${explanation}</div>
            </div>
        `;
    }
    
    async function loadHistory() {
        const search = searchInput.value;
        const groundedness = groundednessFilter.value;
        const offset = (currentPage - 1) * itemsPerPage;
        
        try {
            const params = new URLSearchParams({
                limit: itemsPerPage,
                offset: offset
            });
            
            if (search) params.append('search', search);
            if (groundedness) params.append('groundedness', groundedness);
            
            const response = await fetch(`/history?${params}`);
            const data = await response.json();
            
            displayHistory(data.evaluations);
            updatePagination(data.total);
        } catch (error) {
            historyList.innerHTML = '<p>Error loading history</p>';
        }
    }
    
    function displayHistory(evaluations) {
        if (evaluations.length === 0) {
            historyList.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No evaluations found</p>';
            return;
        }
        
        historyList.innerHTML = evaluations.map(eval => {
            const timestamp = new Date(eval.timestamp).toLocaleString();
            const groundednessClass = eval.groundedness_level ? 
                eval.groundedness_level.toLowerCase().replace(' ', '-') : '';
            
            return `
                <div class="history-item" onclick="viewHistoryItem(${eval.id})">
                    <div class="history-item-header">
                        <span class="history-timestamp">${timestamp}</span>
                        <span class="history-groundedness ${groundednessClass}">
                            ${eval.groundedness_level || 'N/A'}
                        </span>
                    </div>
                    <div class="history-question">${eval.question}</div>
                    <div class="history-response">${eval.response}</div>
                </div>
            `;
        }).join('');
    }
    
    function updatePagination(total) {
        const totalPages = Math.ceil(total / itemsPerPage);
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        
        prevPage.disabled = currentPage === 1;
        nextPage.disabled = currentPage === totalPages || totalPages === 0;
    }
    
    async function loadStats() {
        try {
            const response = await fetch('/history/stats');
            const stats = await response.json();
            
            document.getElementById('total-evaluations').textContent = stats.total_evaluations;
            document.getElementById('grounded-count').textContent = stats.grounded;
            document.getElementById('partially-count').textContent = stats.partially_grounded;
            document.getElementById('not-grounded-count').textContent = stats.not_grounded;
            document.getElementById('improvement-rate').textContent = stats.improvement_rate + '%';
            
            // Update chart if it exists
            updateChart(stats);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    function updateChart(stats) {
        const ctx = document.getElementById('groundedness-chart');
        if (!ctx) return;
        
        // Destroy existing chart if it exists
        if (window.groundednessChart) {
            window.groundednessChart.destroy();
        }
        
        window.groundednessChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Grounded', 'Partially Grounded', 'Not Grounded'],
                datasets: [{
                    data: [stats.grounded, stats.partially_grounded, stats.not_grounded],
                    backgroundColor: ['#27ae60', '#f39c12', '#e74c3c'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: 'Groundedness Distribution'
                    }
                }
            }
        });
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
    
    window.viewHistoryItem = function(id) {
        // Implement view history item functionality
        console.log('View history item:', id);
    };
});