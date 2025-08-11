let currentQuestion = '';
let currentResponse = '';
let currentEvaluation = '';
let currentCombinedEvaluation = null;
let pdfUploaded = false;
let isDarkMode = false;
let isResizing = false;
let apiKey = '';

// Modal related variables - declare globally
let apiKeyModal = null;
let apiKeyInput = null;
let saveApiKeyBtn = null;
let cancelApiKeyBtn = null;

// Functions that need to be accessible globally
function showAPIKeyModal() {
    if (apiKeyModal) {
        apiKeyModal.classList.remove('hidden');
        if (apiKeyInput) {
            apiKeyInput.value = apiKey || '';
            apiKeyInput.focus();
        }
    }
}

function hideAPIKeyModal() {
    if (apiKeyModal) {
        apiKeyModal.classList.add('hidden');
    }
}

function updateAPIKeyStatus() {
    const indicator = document.getElementById('api-key-indicator');
    const btnText = document.getElementById('api-key-btn-text');
    
    if (indicator && btnText) {
        if (apiKey) {
            const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4);
            indicator.textContent = maskedKey;
            indicator.className = 'text-sm font-medium text-green-600 dark:text-green-400';
            btnText.textContent = 'Change API Key';
        } else {
            indicator.textContent = 'Not Set';
            indicator.className = 'text-sm font-medium text-red-600 dark:text-red-400';
            btnText.textContent = 'Add API Key';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Load API key from localStorage
    apiKey = localStorage.getItem('anthropic_api_key') || '';
    updateAPIKeyStatus();
    
    // Initialize modal elements
    apiKeyModal = document.getElementById('api-key-modal');
    apiKeyInput = document.getElementById('api-key-input');
    saveApiKeyBtn = document.getElementById('save-api-key');
    cancelApiKeyBtn = document.getElementById('cancel-api-key');
    
    // If no API key, show modal
    if (!apiKey) {
        showAPIKeyModal();
    }
    
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const evaluationDisplay = document.getElementById('evaluation-display');
    const improveBtn = document.getElementById('improve-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const pdfUpload = document.getElementById('pdf-upload');
    const uploadStatus = document.getElementById('upload-status');
    const fileName = document.getElementById('file-name');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const typingIndicator = document.getElementById('typing-indicator');
    const panelDivider = document.getElementById('panel-divider');
    const chatPanel = document.getElementById('chat-panel');
    const evalPanel = document.getElementById('eval-panel');
    const collapseEval = document.getElementById('collapse-eval');
    const fullscreenChat = document.getElementById('fullscreen-chat');
    const fullscreenEval = document.getElementById('fullscreen-eval');
    const apiKeyBtn = document.getElementById('api-key-btn');
    
    // API Key Management
    apiKeyBtn.addEventListener('click', showAPIKeyModal);
    
    saveApiKeyBtn.addEventListener('click', async () => {
        const newApiKey = apiKeyInput.value.trim();
        if (!newApiKey) {
            alert('Please enter an API key');
            return;
        }
        
        // Validate API key
        saveApiKeyBtn.disabled = true;
        saveApiKeyBtn.textContent = 'Validating...';
        
        try {
            const response = await fetch('/validate_api_key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ api_key: newApiKey })
            });
            
            const data = await response.json();
            
            if (response.ok && data.valid) {
                // Save to localStorage
                apiKey = newApiKey;
                localStorage.setItem('anthropic_api_key', apiKey);
                updateAPIKeyStatus();
                hideAPIKeyModal();
                
                // Remove welcome notice if present
                const welcomeNotice = document.getElementById('welcome-api-notice');
                if (welcomeNotice) {
                    welcomeNotice.style.display = 'none';
                }
            } else {
                alert('Invalid API key: ' + (data.error || 'Please check your API key'));
            }
        } catch (error) {
            alert('Error validating API key: ' + error.message);
        } finally {
            saveApiKeyBtn.disabled = false;
            saveApiKeyBtn.textContent = 'Save API Key';
        }
    });
    
    cancelApiKeyBtn.addEventListener('click', hideAPIKeyModal);
    
    // Close modal when clicking outside
    apiKeyModal.addEventListener('click', (e) => {
        if (e.target === apiKeyModal && apiKey) {
            hideAPIKeyModal();
        }
    });
    
    // Initialize dark mode
    if (localStorage.getItem('darkMode') === 'true') {
        document.documentElement.classList.add('dark');
        isDarkMode = true;
        darkModeToggle.innerHTML = '<i class="fas fa-sun text-yellow-400"></i>';
    }
    
    // Dark mode toggle
    darkModeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('darkMode', isDarkMode);
        darkModeToggle.innerHTML = isDarkMode 
            ? '<i class="fas fa-sun text-yellow-400"></i>'
            : '<i class="fas fa-moon text-gray-600 dark:text-gray-400"></i>';
    });
    
    // Panel resizing
    let startX = 0;
    let startWidthChat = 0;
    let startWidthEval = 0;
    
    panelDivider.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidthChat = chatPanel.offsetWidth;
        startWidthEval = evalPanel.offsetWidth;
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const dx = e.clientX - startX;
        const newChatWidth = startWidthChat + dx;
        const newEvalWidth = startWidthEval - dx;
        
        if (newChatWidth > 300 && newEvalWidth > 300) {
            chatPanel.style.flex = `0 0 ${newChatWidth}px`;
            evalPanel.style.flex = `0 0 ${newEvalWidth}px`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = 'default';
    });
    
    // Collapse evaluation panel
    let isEvalCollapsed = false;
    collapseEval.addEventListener('click', () => {
        isEvalCollapsed = !isEvalCollapsed;
        if (isEvalCollapsed) {
            evalPanel.classList.add('panel-collapsed');
            collapseEval.innerHTML = '<i class="fas fa-chevron-left text-gray-600 dark:text-gray-400"></i>';
            chatPanel.style.flex = '1';
            panelDivider.style.display = 'none';
        } else {
            evalPanel.classList.remove('panel-collapsed');
            collapseEval.innerHTML = '<i class="fas fa-chevron-right text-gray-600 dark:text-gray-400"></i>';
            chatPanel.style.flex = '0 0 50%';
            evalPanel.style.flex = '0 0 50%';
            panelDivider.style.display = 'block';
        }
    });
    
    // Fullscreen toggles
    fullscreenChat.addEventListener('click', () => {
        chatPanel.classList.toggle('panel-fullscreen');
        const icon = fullscreenChat.querySelector('i');
        if (chatPanel.classList.contains('panel-fullscreen')) {
            icon.classList.remove('fa-expand');
            icon.classList.add('fa-compress');
            evalPanel.style.display = 'none';
            panelDivider.style.display = 'none';
        } else {
            icon.classList.remove('fa-compress');
            icon.classList.add('fa-expand');
            evalPanel.style.display = 'flex';
            panelDivider.style.display = 'block';
        }
    });
    
    fullscreenEval.addEventListener('click', () => {
        evalPanel.classList.toggle('panel-fullscreen');
        const icon = fullscreenEval.querySelector('i');
        if (evalPanel.classList.contains('panel-fullscreen')) {
            icon.classList.remove('fa-expand');
            icon.classList.add('fa-compress');
            chatPanel.style.display = 'none';
            panelDivider.style.display = 'none';
        } else {
            icon.classList.remove('fa-compress');
            icon.classList.add('fa-expand');
            chatPanel.style.display = 'flex';
            panelDivider.style.display = 'block';
        }
    });
    
    // Send message functionality
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Upload PDF functionality
    uploadBtn.addEventListener('click', uploadPDF);
    
    // Show filename when PDF is selected
    pdfUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileName.textContent = file.name;
            fileName.classList.remove('hidden');
            uploadBtn.disabled = false;
        } else {
            fileName.classList.add('hidden');
            uploadBtn.disabled = true;
        }
    });
    
    // Show typing indicator
    function showTypingIndicator() {
        typingIndicator.classList.remove('hidden');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function hideTypingIndicator() {
        typingIndicator.classList.add('hidden');
    }
    
    async function uploadPDF() {
        const file = pdfUpload.files[0];
        if (!file) {
            uploadStatus.innerHTML = '<i class="fas fa-exclamation-circle text-red-500 mr-1"></i> Please select a PDF file';
            return;
        }
        
        if (file.type !== 'application/pdf') {
            uploadStatus.innerHTML = '<i class="fas fa-exclamation-circle text-red-500 mr-1"></i> Please select a valid PDF file';
            return;
        }
        
        uploadStatus.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Uploading...';
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
                    uploadStatus.innerHTML = `<i class="fas fa-check-circle text-green-500 mr-1"></i> ${data.message}`;
                    pdfUploaded = true;
                    userInput.placeholder = 'Ask a question about the uploaded PDF...';
                    fileName.classList.add('hidden');
                    pdfUpload.value = '';
                    
                    // Remove welcome message
                    const welcomeMsg = chatMessages.querySelector('.text-center');
                    if (welcomeMsg) welcomeMsg.remove();
                } else {
                    uploadStatus.innerHTML = `<i class="fas fa-exclamation-circle text-red-500 mr-1"></i> ${data.error || 'Upload failed'}`;
                }
            } catch (error) {
                uploadStatus.innerHTML = `<i class="fas fa-exclamation-circle text-red-500 mr-1"></i> ${error.message}`;
            } finally {
                uploadBtn.disabled = false;
            }
        };
        
        reader.readAsDataURL(file);
    }
    
    // Function to get selected evaluation criteria
    window.getSelectedEvaluationCriteria = function getSelectedEvaluationCriteria() {
        const criteria = [];
        const checkboxes = document.querySelectorAll('.eval-criterion:checked');
        
        checkboxes.forEach(checkbox => {
            let criterionType = '';
            let prompt = '';
            
            switch (checkbox.id) {
                case 'eval-groundedness':
                    criterionType = 'groundedness';
                    prompt = `You are evaluating whether an AI response is grounded in the provided document context.

Document Context:
{document_content}

User Question:
{question}

AI Response:
{response}

Evaluate the response and provide:
1. A label: "Grounded", "Partially Grounded", or "Not Grounded"  
2. A brief explanation (2-3 sentences) of your evaluation

Format your response as:
Label: [your label]
Explanation: [your explanation]`;
                    break;
                case 'eval-factual':
                    criterionType = 'factual_accuracy';
                    prompt = `Evaluate the factual accuracy of this AI response against the document.

Document Context:
{document_content}

User Question:
{question}

AI Response:
{response}

Evaluate and provide:
1. A label: "Factually Accurate", "Mostly Accurate", or "Inaccurate"
2. A brief explanation noting any factual errors or confirming accuracy

Format your response as:
Label: [your label]
Explanation: [your explanation]`;
                    break;
                case 'eval-completeness':
                    criterionType = 'completeness';
                    prompt = `Evaluate how completely this AI response addresses the user's question based on available information in the document.

Document Context:
{document_content}

User Question:
{question}

AI Response:
{response}

Evaluate and provide:
1. A label: "Complete", "Partially Complete", or "Incomplete"
2. A brief explanation of what was covered well and what may be missing

Format your response as:
Label: [your label]
Explanation: [your explanation]`;
                    break;
                case 'eval-relevance':
                    criterionType = 'relevance';
                    prompt = `Evaluate how relevant this AI response is to the user's specific question.

Document Context:
{document_content}

User Question:
{question}

AI Response:
{response}

Evaluate and provide:
1. A label: "Highly Relevant", "Somewhat Relevant", or "Not Relevant"
2. A brief explanation of how well the response addresses the question

Format your response as:
Label: [your label]
Explanation: [your explanation]`;
                    break;
            }
            
            if (criterionType && prompt) {
                criteria.push({
                    type: criterionType,
                    prompt: prompt
                });
            }
        });
        
        return criteria;
    }

    async function sendMessage() {
        if (!apiKey) {
            alert('Please add your Anthropic API key first');
            showAPIKeyModal();
            return;
        }
        
        const message = userInput.value.trim();
        if (!message) return;
        
        currentQuestion = message;
        
        // Get selected evaluation criteria
        const evaluationCriteria = getSelectedEvaluationCriteria();
        
        // Remove welcome message if it exists
        const welcomeMsg = chatMessages.querySelector('.text-center');
        if (welcomeMsg) welcomeMsg.remove();
        
        addMessage(message, 'user');
        userInput.value = '';
        sendBtn.disabled = true;
        
        showTypingIndicator();
        
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message,
                    api_key: apiKey,
                    evaluation_criteria: evaluationCriteria
                })
            });
            
            const data = await response.json();
            
            hideTypingIndicator();
            
            if (data.error) {
                if (response.status === 401) {
                    addMessage('API Key Error: ' + data.error, 'assistant');
                    showAPIKeyModal();
                } else {
                    addMessage('Error: ' + data.error, 'assistant');
                }
            } else {
                currentResponse = data.response;
                addMessage(data.response, 'assistant');
                
                if (data.evaluation || data.combined_evaluation) {
                    currentEvaluation = data.evaluation;
                    currentCombinedEvaluation = data.combined_evaluation;
                    if (data.combined_evaluation && data.combined_evaluation.length > 0) {
                        displayMultipleEvaluations(data.combined_evaluation);
                    } else if (data.evaluation) {
                        displaySingleEvaluation(data.evaluation);
                    }
                    
                    // Show improve button immediately when evaluation is received
                    if (improveBtn) {
                        improveBtn.classList.remove('hidden');
                    }
                    
                    // Add to evaluation history
                    addToEvaluationHistory(
                        currentQuestion, 
                        currentResponse, 
                        data.evaluation,
                        data.combined_evaluation
                    );
                }
            }
        } catch (error) {
            hideTypingIndicator();
            addMessage('Error: ' + error.message, 'assistant');
        } finally {
            sendBtn.disabled = false;
        }
    }
    
    improveBtn.addEventListener('click', improveResponse);
    
    async function improveResponse() {
        if (!currentQuestion || !currentResponse || !currentEvaluation || !apiKey) return;
        
        // Get current evaluation criteria
        const evaluationCriteria = getSelectedEvaluationCriteria();
        
        improveBtn.disabled = true;
        improveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Improving...';
        
        showTypingIndicator();
        
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
                    combined_evaluation: currentCombinedEvaluation,
                    api_key: apiKey,
                    evaluation_criteria: evaluationCriteria
                })
            });
            
            const data = await response.json();
            
            hideTypingIndicator();
            
            if (data.error) {
                addMessage('Error: ' + data.error, 'assistant');
            } else {
                currentResponse = data.response;
                addMessage('Improved Response:\n\n' + data.response, 'assistant', true);
                
                if (data.evaluation || data.combined_evaluation) {
                    currentEvaluation = data.evaluation;
                    currentCombinedEvaluation = data.combined_evaluation;
                    if (data.combined_evaluation && data.combined_evaluation.length > 0) {
                        displayMultipleEvaluations(data.combined_evaluation);
                    } else if (data.evaluation) {
                        displaySingleEvaluation(data.evaluation);
                    }
                    
                    // Add improved response to evaluation history
                    addToEvaluationHistory(
                        currentQuestion, 
                        currentResponse, 
                        data.evaluation,
                        data.combined_evaluation
                    );
                    
                    // Mark as improved
                    if (evaluationHistory.length > 0) {
                        evaluationHistory[0].isImproved = true;
                        localStorage.setItem('evaluationHistory', JSON.stringify(evaluationHistory));
                        renderEvaluationHistory();
                    }
                }
            }
        } catch (error) {
            hideTypingIndicator();
            addMessage('Error: ' + error.message, 'assistant');
        } finally {
            improveBtn.disabled = false;
            improveBtn.innerHTML = '<i class="fas fa-magic mr-2"></i> Improve Response';
        }
    }
    
    function addMessage(text, sender, isImproved = false) {
        const messageContainer = document.createElement('div');
        messageContainer.className = `flex items-start space-x-3 ${sender === 'user' ? 'justify-end' : ''}`;
        
        if (sender === 'assistant') {
            // Assistant avatar
            const avatar = document.createElement('div');
            avatar.className = 'avatar assistant flex items-center justify-center';
            avatar.innerHTML = '<i class="fas fa-robot text-white text-sm"></i>';
            messageContainer.appendChild(avatar);
        }
        
        // Message bubble
        const messageBubble = document.createElement('div');
        messageBubble.className = `message-bubble ${sender} px-4 py-3 rounded-lg`;
        
        if (sender === 'user') {
            messageBubble.classList.add('bg-blue-600', 'text-white');
        } else {
            messageBubble.classList.add('bg-white', 'dark:bg-gray-700', 'text-gray-800', 'dark:text-gray-200', 'border', 'border-gray-200', 'dark:border-gray-600');
        }
        
        // Add improved badge if needed
        if (isImproved) {
            const badge = document.createElement('div');
            badge.className = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 mb-2';
            badge.innerHTML = '<i class="fas fa-check-circle mr-1"></i> Improved';
            messageBubble.appendChild(badge);
        }
        
        const messageText = document.createElement('div');
        messageText.className = 'chat-message prose prose-sm dark:prose-invert max-w-none';
        
        // Parse markdown for assistant messages
        if (sender === 'assistant') {
            // Configure marked options for better formatting
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false
            });
            
            // Parse the markdown
            let formattedText = marked.parse(text);
            
            // Apply custom styles to parsed HTML
            messageText.innerHTML = formattedText;
            
            // Style code blocks
            messageText.querySelectorAll('pre code').forEach(block => {
                block.className = 'block bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm overflow-x-auto';
            });
            
            // Style inline code
            messageText.querySelectorAll('code:not(pre code)').forEach(code => {
                code.className = 'bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm';
            });
            
            // Style lists
            messageText.querySelectorAll('ul').forEach(ul => {
                ul.className = 'list-disc list-inside space-y-1 my-2';
            });
            
            messageText.querySelectorAll('ol').forEach(ol => {
                ol.className = 'list-decimal list-inside space-y-1 my-2';
            });
            
            // Style paragraphs
            messageText.querySelectorAll('p').forEach(p => {
                p.className = 'my-2 leading-relaxed';
            });
            
            // Style headings
            messageText.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
                heading.className = 'font-semibold my-2';
            });
            
            // Style blockquotes
            messageText.querySelectorAll('blockquote').forEach(quote => {
                quote.className = 'border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-2 italic';
            });
        } else {
            // For user messages, just display as text
            messageText.textContent = text;
        }
        
        messageBubble.appendChild(messageText);
        
        messageContainer.appendChild(messageBubble);
        
        if (sender === 'user') {
            // User avatar
            const avatar = document.createElement('div');
            avatar.className = 'avatar user flex items-center justify-center';
            avatar.innerHTML = '<i class="fas fa-user text-white text-sm"></i>';
            messageContainer.appendChild(avatar);
        }
        
        chatMessages.appendChild(messageContainer);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function parseEvaluationText(evaluation) {
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
    
    function getEvaluationStyling(label, criterionType) {
        let iconClass = '';
        let labelColor = '';
        let bgColor = 'bg-gray-50 dark:bg-gray-800';
        
        const lowerLabel = label.toLowerCase();
        
        // Determine styling based on criterion type and label with improved colors
        if (criterionType === 'groundedness') {
            if (lowerLabel.includes('grounded') && !lowerLabel.includes('not')) {
                if (lowerLabel.includes('partially')) {
                    // Partially Grounded - Amber/Orange
                    iconClass = 'fa-exclamation-triangle text-amber-500';
                    labelColor = 'text-amber-700 dark:text-amber-300';
                    bgColor = 'bg-amber-50 dark:bg-amber-900/20';
                } else {
                    // Fully Grounded - Emerald Green
                    iconClass = 'fa-check-circle text-emerald-600';
                    labelColor = 'text-emerald-700 dark:text-emerald-300';
                    bgColor = 'bg-emerald-50 dark:bg-emerald-900/20';
                }
            } else {
                // Not Grounded - Red
                iconClass = 'fa-times-circle text-red-500';
                labelColor = 'text-red-700 dark:text-red-300';
                bgColor = 'bg-red-50 dark:bg-red-900/20';
            }
        } else if (criterionType === 'factual_accuracy') {
            if (lowerLabel.includes('accurate') && !lowerLabel.includes('inaccurate')) {
                iconClass = 'fa-check-circle text-green-500';
                labelColor = 'text-green-600 dark:text-green-400';
                bgColor = 'bg-green-50 dark:bg-green-900/20';
            } else if (lowerLabel.includes('mostly')) {
                iconClass = 'fa-exclamation-triangle text-amber-500';
                labelColor = 'text-amber-600 dark:text-amber-400';
                bgColor = 'bg-amber-50 dark:bg-amber-900/20';
            } else {
                iconClass = 'fa-times-circle text-red-500';
                labelColor = 'text-red-600 dark:text-red-400';
                bgColor = 'bg-red-50 dark:bg-red-900/20';
            }
        } else if (criterionType === 'completeness') {
            if (lowerLabel.includes('complete') && !lowerLabel.includes('incomplete')) {
                if (lowerLabel.includes('partially')) {
                    iconClass = 'fa-exclamation-triangle text-amber-500';
                    labelColor = 'text-amber-600 dark:text-amber-400';
                    bgColor = 'bg-amber-50 dark:bg-amber-900/20';
                } else {
                    iconClass = 'fa-check-circle text-green-500';
                    labelColor = 'text-green-600 dark:text-green-400';
                    bgColor = 'bg-green-50 dark:bg-green-900/20';
                }
            } else {
                iconClass = 'fa-times-circle text-red-500';
                labelColor = 'text-red-600 dark:text-red-400';
                bgColor = 'bg-red-50 dark:bg-red-900/20';
            }
        } else if (criterionType === 'relevance') {
            if (lowerLabel.includes('highly relevant')) {
                iconClass = 'fa-check-circle text-green-500';
                labelColor = 'text-green-600 dark:text-green-400';
                bgColor = 'bg-green-50 dark:bg-green-900/20';
            } else if (lowerLabel.includes('somewhat')) {
                iconClass = 'fa-exclamation-triangle text-amber-500';
                labelColor = 'text-amber-600 dark:text-amber-400';
                bgColor = 'bg-amber-50 dark:bg-amber-900/20';
            } else {
                iconClass = 'fa-times-circle text-red-500';
                labelColor = 'text-red-600 dark:text-red-400';
                bgColor = 'bg-red-50 dark:bg-red-900/20';
            }
        } else {
            // Default styling
            iconClass = 'fa-info-circle text-blue-500';
            labelColor = 'text-blue-600 dark:text-blue-400';
            bgColor = 'bg-blue-50 dark:bg-blue-900/20';
        }
        
        return { iconClass, labelColor, bgColor };
    }
    
    function displayMultipleEvaluations(evaluations) {
        // With the new history-based system, we don't need to display evaluations inline anymore
        // The evaluation results are handled by addToEvaluationHistory function
        // This function is kept for compatibility but doesn't modify the display
        console.log('Multiple evaluations processed:', evaluations.length);
    }
    
    function displaySingleEvaluation(evaluation) {
        // With the new history-based system, we don't need to display evaluations inline anymore
        // The evaluation results are handled by addToEvaluationHistory function
        // This function is kept for compatibility but doesn't modify the display
        console.log('Single evaluation processed:', evaluation.substring(0, 50) + '...');
    }
    
    // Evaluation History Management
    let evaluationHistory = JSON.parse(localStorage.getItem('evaluationHistory')) || [];
    let expandedHistoryItem = null;
    
    window.addToEvaluationHistory = function addToEvaluationHistory(question, response, evaluation, combinedEvaluation = null) {
        const historyItem = {
            id: Date.now(),
            question: question,
            response: response,
            evaluation: evaluation,
            combinedEvaluation: combinedEvaluation,
            timestamp: new Date().toISOString(),
            isImproved: false
        };
        
        evaluationHistory.unshift(historyItem);
        localStorage.setItem('evaluationHistory', JSON.stringify(evaluationHistory));
        renderEvaluationHistory();
    }
    
    function renderEvaluationHistory() {
        const historyContainer = document.getElementById('evaluation-history');
        const placeholder = document.getElementById('eval-placeholder');
        
        if (evaluationHistory.length === 0) {
            if (placeholder) placeholder.style.display = 'block';
            historyContainer.innerHTML = `
                <div id="eval-placeholder" class="flex items-center justify-center py-8">
                    <div class="text-center">
                        <div class="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-chart-bar text-gray-400 dark:text-gray-500 text-2xl"></i>
                        </div>
                        <p class="text-gray-500 dark:text-gray-400">Send a message to see evaluations</p>
                    </div>
                </div>
            `;
            return;
        }
        
        if (placeholder) placeholder.style.display = 'none';
        
        let historyHTML = '';
        evaluationHistory.forEach((item, index) => {
            const { label } = parseEvaluationText(item.evaluation);
            const timeAgo = getTimeAgo(new Date(item.timestamp));
            
            // Determine label styling with improved colors
            let labelClass = '';
            if (label.toLowerCase().includes('grounded') && !label.toLowerCase().includes('not') && !label.toLowerCase().includes('partial')) {
                // Fully Grounded - Emerald Green
                labelClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
            } else if (label.toLowerCase().includes('partial') || label.toLowerCase().includes('somewhat')) {
                // Partially Grounded - Amber/Orange  
                labelClass = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
            } else if (label.toLowerCase().includes('not grounded') || label.toLowerCase().includes('not_grounded')) {
                // Not Grounded - Red
                labelClass = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            } else if (label.toLowerCase().includes('accurate') || label.toLowerCase().includes('good') || label.toLowerCase().includes('relevant')) {
                // Other positive labels - Green
                labelClass = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
            } else {
                // Default negative - Red
                labelClass = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            }
            
            historyHTML += `
                <div class="evaluation-history-item bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow" onclick="toggleEvaluationDetails(${index})">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-medium text-gray-900 dark:text-white truncate flex-1 mr-2">${item.question.substring(0, 60)}${item.question.length > 60 ? '...' : ''}</span>
                        <div class="flex items-center space-x-2">
                            ${item.isImproved ? '<span class="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 rounded-full">Improved</span>' : ''}
                            <span class="px-2 py-1 text-xs font-medium ${labelClass} rounded-full">${label}</span>
                        </div>
                    </div>
                    <p class="text-xs text-gray-600 dark:text-gray-400 truncate">${item.response.substring(0, 100)}${item.response.length > 100 ? '...' : ''}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">${timeAgo}</p>
                </div>
                <div id="eval-details-${index}" class="hidden mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded border-l-4 border-blue-500">
                    ${item.combinedEvaluation ? renderCombinedEvaluation(item.combinedEvaluation) : renderSingleEvaluation(item.evaluation)}
                    <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <button onclick="improveFromHistory(${index})" class="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors">
                            <i class="fas fa-magic mr-1"></i>
                            Improve This Response
                        </button>
                    </div>
                </div>
            `;
        });
        
        historyContainer.innerHTML = historyHTML;
    }
    
    // Global function for inline evaluation details
    window.toggleEvaluationDetails = function(index) {
        const detailsDiv = document.getElementById(`eval-details-${index}`);
        
        // Close previously expanded item
        if (expandedHistoryItem !== null && expandedHistoryItem !== index) {
            const prevDetails = document.getElementById(`eval-details-${expandedHistoryItem}`);
            if (prevDetails) prevDetails.classList.add('hidden');
        }
        
        // Toggle current item
        if (detailsDiv) {
            detailsDiv.classList.toggle('hidden');
            expandedHistoryItem = detailsDiv.classList.contains('hidden') ? null : index;
        }
    };
    
    function renderCombinedEvaluation(evaluations) {
        let content = '';
        evaluations.forEach(evalItem => {
            const { label, explanation } = parseEvaluationText(evalItem.evaluation);
            const criterionTitle = evalItem.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            content += `
                <div class="mb-3 p-2 bg-white dark:bg-gray-800 rounded border">
                    <div class="flex items-center mb-1">
                        <span class="text-xs font-medium text-gray-600 dark:text-gray-400">${criterionTitle}:</span>
                        <span class="ml-2 text-xs font-semibold text-gray-900 dark:text-white">${label}</span>
                    </div>
                    <p class="text-xs text-gray-700 dark:text-gray-300">${explanation}</p>
                </div>
            `;
        });
        return content;
    }
    
    function renderSingleEvaluation(evaluation) {
        const { label, explanation } = parseEvaluationText(evaluation);
        return `
            <div class="p-2 bg-white dark:bg-gray-800 rounded border">
                <div class="flex items-center mb-1">
                    <span class="text-xs font-medium text-gray-600 dark:text-gray-400">Groundedness:</span>
                    <span class="ml-2 text-xs font-semibold text-gray-900 dark:text-white">${label}</span>
                </div>
                <p class="text-xs text-gray-700 dark:text-gray-300">${explanation}</p>
            </div>
        `;
    }
    
    window.improveFromHistory = async function(index) {
        const item = evaluationHistory[index];
        if (!item || !apiKey) return;
        
        // Set current values
        currentQuestion = item.question;
        currentResponse = item.response;
        currentEvaluation = item.evaluation;
        currentCombinedEvaluation = item.combinedEvaluation;
        
        // Get current evaluation criteria
        const evaluationCriteria = getSelectedEvaluationCriteria();
        
        try {
            const response = await fetch('/improve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: item.question,
                    response: item.response,
                    evaluation: item.evaluation,
                    combined_evaluation: item.combinedEvaluation,
                    api_key: apiKey,
                    evaluation_criteria: evaluationCriteria
                })
            });
            
            const data = await response.json();
            
            if (!data.error) {
                // Add improved response to history
                addToEvaluationHistory(
                    item.question, 
                    data.response, 
                    data.evaluation,
                    data.combined_evaluation
                );
                
                // Mark as improved
                const newIndex = 0; // New item is at index 0
                evaluationHistory[newIndex].isImproved = true;
                localStorage.setItem('evaluationHistory', JSON.stringify(evaluationHistory));
                renderEvaluationHistory();
                
                // Add to chat
                addMessage('Improved Response:\n\n' + data.response, 'assistant', true);
            }
        } catch (error) {
            console.error('Error improving response:', error);
        }
    };
    
    function getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }
    
    function clearEvaluationHistory() {
        if (confirm('Are you sure you want to clear all evaluation history?')) {
            evaluationHistory = [];
            localStorage.removeItem('evaluationHistory');
            renderEvaluationHistory();
        }
    }
    
    // Clear history button event listener
    const clearHistoryBtn = document.getElementById('clear-history');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearEvaluationHistory);
    }
    
    // Tab functionality - avoid variable name conflicts
    const evalTabBtn = document.getElementById('eval-tab');
    const promptTabBtn = document.getElementById('prompt-tab');
    const templatesBtnEl = document.getElementById('templates-btn');
    const evaluationDisplayEl = document.getElementById('evaluation-display');
    const promptEditorEl = document.getElementById('prompt-editor');
    const templatesDropdownEl = document.getElementById('templates-dropdown');
    
    if (evalTabBtn && promptTabBtn && templatesBtnEl) {
        evalTabBtn.addEventListener('click', () => {
            // Switch to evaluation tab
            evalTabBtn.classList.add('text-blue-600', 'dark:text-blue-400', 'border-b-2', 'border-blue-600', 'dark:border-blue-400');
            evalTabBtn.classList.remove('text-gray-600', 'dark:text-gray-400');
            
            promptTabBtn.classList.add('text-gray-600', 'dark:text-gray-400');
            promptTabBtn.classList.remove('text-blue-600', 'dark:text-blue-400', 'border-b-2', 'border-blue-600', 'dark:border-blue-400');
            
            if (evaluationDisplayEl) evaluationDisplayEl.classList.remove('hidden');
            if (promptEditorEl) promptEditorEl.classList.add('hidden');
            if (templatesDropdownEl) templatesDropdownEl.classList.add('hidden');
        });
        
        promptTabBtn.addEventListener('click', () => {
            // Switch to prompt editor tab
            promptTabBtn.classList.add('text-blue-600', 'dark:text-blue-400', 'border-b-2', 'border-blue-600', 'dark:border-blue-400');
            promptTabBtn.classList.remove('text-gray-600', 'dark:text-gray-400');
            
            evalTabBtn.classList.add('text-gray-600', 'dark:text-gray-400');
            evalTabBtn.classList.remove('text-blue-600', 'dark:text-blue-400', 'border-b-2', 'border-blue-600', 'dark:border-blue-400');
            
            if (evaluationDisplayEl) evaluationDisplayEl.classList.add('hidden');
            if (promptEditorEl) promptEditorEl.classList.remove('hidden');
            if (templatesDropdownEl) templatesDropdownEl.classList.add('hidden');
        });
        
        templatesBtnEl.addEventListener('click', () => {
            if (templatesDropdownEl) {
                templatesDropdownEl.classList.toggle('hidden');
            }
        });
    }
    
    // Load history on page load
    renderEvaluationHistory();
});