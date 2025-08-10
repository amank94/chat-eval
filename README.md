# AI Chat with Groundedness Evaluator

MVP implementation of a chat interface with automatic groundedness evaluation for PDF-based Q&A.

## Features
- Upload PDF documents
- Chat with AI about the PDF content
- Automatic groundedness evaluation of responses
- Improve responses based on evaluation feedback

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your Anthropic API key to `.env`:
```
ANTHROPIC_API_KEY=your_actual_api_key_here
```

4. Run the application:
```bash
python app.py
```

5. Open browser to `http://localhost:5000`

## Usage

1. Upload a PDF using the upload button
2. Ask questions about the PDF content
3. View automatic groundedness evaluation in the right panel
4. Click "Improve Response" to get a better grounded answer

## Tech Stack
- Backend: Flask (Python)
- Frontend: Vanilla JavaScript, HTML, CSS
- AI: Anthropic Claude API
- PDF Processing: pypdf