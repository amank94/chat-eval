let currentQuestion = '';
let currentResponse = '';
let currentEvaluation = '';
let pdfUploaded = false;
let isDarkMode = false;
let isResizing = false;
let currentPrompt = '';
let promptHistory = [];
let evaluationHistory = [];
let evaluationCounter = 0;

// Prompt Templates
const promptTemplates = {
    groundedness: `You are an evaluation assistant tasked with assessing the groundedness of AI responses to questions about a document.

Given the following:
- Document content: {document_content}
- Question: {question}  
- AI Response: {response}

Evaluate whether the response is well-grounded in the provided document. Consider:
1. Does the response accurately reflect information from the document?
2. Are there any claims made that cannot be verified from the document?
3. Is the response complete with respect to the available information?

Provide your evaluation in the following format:
Label: [Grounded/Partially Grounded/Not Grounded]
Explanation: [Detailed explanation of your evaluation]`,

    factual: `You are an evaluation assistant focused on factual accuracy.

Given the following:
- Document content: {document_content}
- Question: {question}
- AI Response: {response}

Assess the factual accuracy of the response. Consider:
1. Are all facts stated correctly according to the document?
2. Are there any misrepresentations or errors?
3. Is the information presented without distortion?

Provide your evaluation in the following format:
Label: [Accurate/Mostly Accurate/Inaccurate]
Explanation: [Detailed analysis of factual accuracy]`,

    completeness: `You are an evaluation assistant assessing response completeness.

Given the following:
- Document content: {document_content}
- Question: {question}
- AI Response: {response}

Evaluate the completeness of the response. Consider:
1. Does the response address all aspects of the question?
2. Is any relevant information from the document omitted?
3. Would additional context improve the response?

Provide your evaluation in the following format:
Label: [Complete/Partially Complete/Incomplete]
Explanation: [Analysis of what is covered and what is missing]`,

    relevance: `You are an evaluation assistant measuring response relevance.

Given the following:
- Document content: {document_content}
- Question: {question}
- AI Response: {response}

Assess how relevant the response is to the question. Consider:
1. Does the response directly address the question asked?
2. Is there unnecessary or off-topic information?
3. How well does the response focus on the user's needs?

Provide your evaluation in the following format:
Label: [Highly Relevant/Relevant/Not Relevant]
Explanation: [Assessment of relevance and focus]`
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
    const fileName = document.getElementById('file-name');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const typingIndicator = document.getElementById('typing-indicator');
    const panelDivider = document.getElementById('panel-divider');
    const chatPanel = document.getElementById('chat-panel');
    const evalPanel = document.getElementById('eval-panel');
    const collapseEval = document.getElementById('collapse-eval');
    const fullscreenChat = document.getElementById('fullscreen-chat');
    const fullscreenEval = document.getElementById('fullscreen-eval');
    
    // Prompt Editor Elements
    const evalTab = document.getElementById('eval-tab');
    const promptTab = document.getElementById('prompt-tab');
    const promptEditor = document.getElementById('prompt-editor');
    const promptTextarea = document.getElementById('prompt-textarea');
    const charCount = document.getElementById('char-count');
    const savePromptBtn = document.getElementById('save-prompt');
    const resetPromptBtn = document.getElementById('reset-prompt');
    const templatesBtn = document.getElementById('templates-btn');
    const templatesDropdown = document.getElementById('templates-dropdown');
    const versionHistory = document.getElementById('version-history');
    
    // Initialize prompt
    currentPrompt = localStorage.getItem('evaluationPrompt') || promptTemplates.groundedness;
    promptTextarea.value = currentPrompt;
    charCount.textContent = currentPrompt.length;
    
    // Load prompt history
    const savedHistory = localStorage.getItem('promptHistory');
    if (savedHistory) {
        promptHistory = JSON.parse(savedHistory);
        updateVersionHistory();
    }
    
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
    
    // Tab switching
    evalTab.addEventListener('click', () => {
        evalTab.classList.add('text-blue-600', 'dark:text-blue-400', 'border-b-2', 'border-blue-600', 'dark:border-blue-400');
        evalTab.classList.remove('text-gray-600', 'dark:text-gray-400');
        promptTab.classList.remove('text-blue-600', 'dark:text-blue-400', 'border-b-2', 'border-blue-600', 'dark:border-blue-400');
        promptTab.classList.add('text-gray-600', 'dark:text-gray-400');
        evaluationDisplay.classList.remove('hidden');
        promptEditor.classList.add('hidden');
    });
    
    promptTab.addEventListener('click', () => {
        promptTab.classList.add('text-blue-600', 'dark:text-blue-400', 'border-b-2', 'border-blue-600', 'dark:border-blue-400');
        promptTab.classList.remove('text-gray-600', 'dark:text-gray-400');
        evalTab.classList.remove('text-blue-600', 'dark:text-blue-400', 'border-b-2', 'border-blue-600', 'dark:border-blue-400');
        evalTab.classList.add('text-gray-600', 'dark:text-gray-400');
        promptEditor.classList.remove('hidden');
        evaluationDisplay.classList.add('hidden');
    });
    
    // Templates dropdown
    templatesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        templatesDropdown.classList.toggle('hidden');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        templatesDropdown.classList.add('hidden');
    });
    
    // Template selection
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const template = e.currentTarget.dataset.template;
            promptTextarea.value = promptTemplates[template];
            charCount.textContent = promptTemplates[template].length;
            templatesDropdown.classList.add('hidden');
        });
    });
    
    // Character count
    promptTextarea.addEventListener('input', () => {
        charCount.textContent = promptTextarea.value.length;
    });
    
    // Save prompt
    savePromptBtn.addEventListener('click', () => {
        currentPrompt = promptTextarea.value;
        localStorage.setItem('evaluationPrompt', currentPrompt);
        
        // Add to history
        const timestamp = new Date().toLocaleString();
        promptHistory.unshift({ prompt: currentPrompt, timestamp });
        if (promptHistory.length > 10) promptHistory.pop(); // Keep only last 10
        localStorage.setItem('promptHistory', JSON.stringify(promptHistory));
        updateVersionHistory();
        
        // Show success message
        savePromptBtn.innerHTML = '<i class="fas fa-check mr-1"></i> Saved!';
        savePromptBtn.classList.add('bg-green-700');
        setTimeout(() => {
            savePromptBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Save';
            savePromptBtn.classList.remove('bg-green-700');
        }, 2000);
    });
    
    // Reset prompt
    resetPromptBtn.addEventListener('click', () => {
        promptTextarea.value = promptTemplates.groundedness;
        charCount.textContent = promptTemplates.groundedness.length;
    });
    
    // Update version history display
    function updateVersionHistory() {
        if (promptHistory.length === 0) {
            versionHistory.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-400">No history yet</p>';
            return;
        }
        
        versionHistory.innerHTML = promptHistory.map((item, index) => `
            <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" onclick="loadHistoryItem(${index})">
                <span class="text-xs text-gray-600 dark:text-gray-400">${item.timestamp}</span>
                <button class="text-xs text-blue-600 dark:text-blue-400 hover:underline">Load</button>
            </div>
        `).join('');
    }
    
    // Load history item
    window.loadHistoryItem = function(index) {
        const item = promptHistory[index];
        promptTextarea.value = item.prompt;
        charCount.textContent = item.prompt.length;
    };
    
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
    
    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        
        currentQuestion = message;
        
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
                    evaluation_prompt: currentPrompt 
                })
            });
            
            const data = await response.json();
            
            hideTypingIndicator();
            
            if (data.error) {
                addMessage('Error: ' + data.error, 'assistant');
            } else {
                currentResponse = data.response;
                addMessage(data.response, 'assistant');
                
                if (data.evaluation) {
                    currentEvaluation = data.evaluation;
                    displayEvaluation(data.evaluation);
                    improveBtn.classList.remove('hidden');
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
        if (!currentQuestion || !currentResponse || !currentEvaluation) return;
        
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
                    evaluation_prompt: currentPrompt
                })
            });
            
            const data = await response.json();
            
            hideTypingIndicator();
            
            if (data.error) {
                addMessage('Error: ' + data.error, 'assistant');
            } else {
                currentResponse = data.response;
                addMessage('Improved Response:\n\n' + data.response, 'assistant', true);
                
                if (data.evaluation) {
                    currentEvaluation = data.evaluation;
                    displayEvaluation(data.evaluation);
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
        
        let evalClass = 'eval-card';
        let iconClass = '';
        let labelColor = '';
        
        if (label.toLowerCase().includes('grounded') && !label.toLowerCase().includes('not')) {
            if (label.toLowerCase().includes('partially')) {
                evalClass += ' partially';
                iconClass = 'fa-exclamation-triangle text-amber-500';
                labelColor = 'text-amber-600 dark:text-amber-400';
            } else {
                evalClass += ' grounded';
                iconClass = 'fa-check-circle text-green-500';
                labelColor = 'text-green-600 dark:text-green-400';
            }
        } else if (label.toLowerCase().includes('not')) {
            evalClass += ' not-grounded';
            iconClass = 'fa-times-circle text-red-500';
            labelColor = 'text-red-600 dark:text-red-400';
        }
        
        evaluationDisplay.innerHTML = `
            <div class="${evalClass}">
                <div class="flex items-center mb-3">
                    <i class="fas ${iconClass} text-2xl mr-3"></i>
                    <h3 class="text-lg font-semibold ${labelColor}">${label}</h3>
                </div>
                <div class="text-gray-600 dark:text-gray-300 leading-relaxed">
                    ${explanation}
                </div>
                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <i class="fas fa-info-circle mr-2"></i>
                        <span>Evaluation complete. Click "Improve Response" to enhance the answer.</span>
                    </div>
                </div>
            </div>
        `;
    }
});