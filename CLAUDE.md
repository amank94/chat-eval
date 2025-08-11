# CLAUDE.md - Project Context for AI Assistant

## Project Overview
**Name**: AI Chat with Groundedness Evaluator  
**Purpose**: A web application that allows users to upload PDFs, ask questions about them, and receive AI-generated responses with automatic groundedness evaluation.  
**Status**: Production-ready, deployed on Render.com  
**Repository**: https://github.com/amank94/chat-eval

## Architecture

### Tech Stack
- **Backend**: Flask (Python 3.11)
- **Database**: PostgreSQL (production) / SQLite (development)
- **Cache**: Redis (optional)
- **AI**: Anthropic Claude API (claude-3-haiku-20240307)
- **Server**: Gunicorn (production)
- **Deployment**: Render.com
- **Frontend**: HTML, Tailwind CSS, Vanilla JavaScript with Marked.js for markdown

### Key Features Implemented
1. **PDF Upload & Processing**: Extract text from PDFs using PyPDF
2. **AI Chat Interface**: Send questions and receive AI responses
3. **Multi-Criteria Evaluation System**: Evaluate responses using multiple criteria (Groundedness, Factual, Completeness, Relevance)
4. **Inline Evaluation Details**: Click evaluation history items to show details inline below the item
5. **Evaluation History**: Persistent tracking of all evaluations with localStorage support
6. **Combined Feedback System**: Use feedback from multiple criteria to improve responses
7. **Prompt Customization**: Editable evaluation prompts with templates
8. **Dark Mode**: Toggle between light and dark themes
9. **Responsive Design**: Mobile-friendly interface
10. **Markdown Rendering**: Proper formatting of AI responses
11. **Panel Management**: Resizable, collapsible, independent scrolling panels

## Project Structure
```
chat-eval/
├── app.py                    # Main Flask application with DB models
├── requirements.txt          # Python dependencies
├── render.yaml              # Render.com infrastructure config
├── gunicorn.conf.py         # Production server configuration
├── Procfile                 # Alternative deployment config
├── build.sh                 # Build script for deployment
├── runtime.txt              # Python version specification
├── templates/
│   ├── index.html           # Main template with Tailwind CSS
│   └── index_*.html         # Alternative templates with different features
├── static/
│   ├── script.js            # Main JavaScript with markdown parsing
│   ├── style.css            # Custom CSS with animations
│   └── *_history.js/css     # Alternative versions with history features
└── instance/                # Local database files (gitignored)
```

## Important Code Patterns

### Database Models (in app.py)
```python
- ChatSession: Stores session information
- Message: Stores chat messages
- Evaluation: Stores evaluation results
```

### Key Routes
- `/` - Main interface
- `/health` - Health check endpoint
- `/chat` - Process chat messages (POST)
- `/upload_pdf` - Handle PDF uploads (POST)
- `/improve` - Improve response based on evaluation (POST)
- `/clear_history` - Clear evaluation history (POST)

### Frontend Features
- **Multi-Criteria Evaluation**: Checkbox selection for Groundedness, Factual, Completeness, Relevance
- **Inline Evaluation Details**: Click history items to expand details inline below
- **Combined Feedback**: Multiple evaluation criteria used together for response improvement
- **Markdown Parsing**: Uses marked.js to render formatted responses
- **Persistent History**: Evaluation history stored in localStorage (survives page refreshes)
- **Session Storage**: Additional session-based tracking in Flask
- **Prompt Templates**: Groundedness, Factual Accuracy, Completeness, Relevance
- **Real-time UI**: Typing indicators, loading states, animations

## Environment Variables
```bash
ANTHROPIC_API_KEY=required      # Anthropic API key
SECRET_KEY=auto-generated        # Flask session secret
DATABASE_URL=auto-configured     # PostgreSQL connection
REDIS_URL=optional              # Redis connection
FLASK_ENV=production/development # Environment mode
PORT=5000                       # Server port
```

## Common Tasks

### Running Locally
```bash
source venv/bin/activate
python app.py
# Visit http://localhost:5002 (or 5001 depending on app.py configuration)
# Note: You need a valid Anthropic API key to see evaluations work
```

### Testing with Playwright
```bash
# Install Playwright (one-time setup)
pip install playwright pytest-playwright
playwright install chromium

# Run comprehensive test suite
python test_app.py

# Test specific features
python test_[feature_name].py
```

### IMPORTANT: Always Test New Features
When implementing ANY new feature:
1. Write Playwright tests FIRST (TDD approach)
2. Implement the feature
3. Run tests to verify functionality
4. Use visual mode (headless=False) during development
5. Test on multiple screen sizes

### Database Operations
```bash
flask db init      # Initialize migrations
flask db migrate   # Create migration
flask db upgrade   # Apply migrations
```

### Deployment
```bash
git add .
git commit -m "Your message"
git push origin main
# Auto-deploys to Render
```

## Testing Guidelines

### Playwright Test Template
```python
import asyncio
from playwright.async_api import async_playwright

async def test_new_feature():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Visual testing
        page = await browser.new_page()
        
        await page.goto("http://localhost:5001")
        
        # Test implementation
        # 1. Check element visibility
        # 2. Test user interactions
        # 3. Verify API responses
        # 4. Check state changes
        
        # Assertions
        assert await page.is_visible("#element-id")
        
        # Screenshots for debugging
        await page.screenshot(path="test_debug.png")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_new_feature())
```

### Test Coverage Areas
1. **UI Components**: Visibility, interactions, state changes
2. **API Calls**: Response handling, error states, timeouts
3. **Data Persistence**: Session storage, localStorage, database
4. **Responsive Design**: Mobile (375x667), Tablet (768x1024), Desktop (1920x1080)
5. **Error Handling**: Network failures, invalid inputs, edge cases

## Known Issues & TODOs
1. **PDF Size Limit**: Currently truncates to 10,000 characters
2. **Session Persistence**: Uses Flask session, not persistent across browser sessions
3. **Rate Limiting**: Not implemented yet
4. **Tests**: Playwright test suite now available (test_app.py)
5. **Monitoring**: Basic health check only, no detailed metrics
6. **Multi-PDF**: Single PDF at a time currently

## Recent Changes
- **NEW**: Implemented multi-criteria evaluation system with checkboxes for Groundedness, Factual, Completeness, Relevance
- **NEW**: Added inline evaluation details that expand under clicked history items (not at top)
- **NEW**: Combined feedback system using multiple evaluation criteria for response improvement
- **NEW**: Persistent evaluation history with localStorage (survives page refresh)
- **NEW**: Enhanced backend to handle multiple evaluation criteria simultaneously
- **NEW**: Clear evaluation history functionality
- Added independent scrolling panels for chat and evaluation
- Implemented markdown parsing for better message formatting
- Added evaluation history tracking in session
- Configured for Render.com deployment with PostgreSQL
- Added health check endpoint for monitoring
- Implemented prompt customization with templates

## Performance Considerations
- Gunicorn configured with `workers = CPU * 2 + 1`
- Request timeout: 120 seconds
- Max requests per worker: 1000 (then recycled)
- Database connections pooled by SQLAlchemy
- Redis used for session caching when available

## Security Notes
- API keys stored in environment variables
- CORS enabled for all origins (should restrict in production)
- SQL injection prevented via SQLAlchemy ORM
- XSS protection needed for user-generated content
- File upload limited to PDFs only

## Deployment Information
- **Platform**: Render.com
- **URL**: https://chat-eval.onrender.com (when deployed)
- **Health Check**: https://chat-eval.onrender.com/health
- **Auto-deploy**: Enabled from main branch
- **Database**: PostgreSQL on Render
- **Build Command**: `chmod +x build.sh && ./build.sh`
- **Start Command**: `gunicorn app:app --config gunicorn.conf.py`

## Development Workflow
1. Make changes locally
2. Test with `python app.py`
3. Commit and push to GitHub
4. Render auto-deploys from main branch
5. Check health endpoint after deployment

## API Integration
- **Anthropic Claude**: Used for chat responses and evaluations
- **Model**: claude-3-haiku-20240307
- **Max Tokens**: 1000 for responses, 500 for evaluations
- **Context Window**: Truncated to 3000 chars for evaluation

## UI/UX Decisions
- **Two-panel layout**: Chat on left, evaluation on right
- **Fixed headers**: Stay visible while scrolling
- **Markdown support**: Better formatting for AI responses
- **Dark mode**: System preference aware
- **Responsive**: Mobile-friendly with panel collapse

## Future Enhancements (from PRD.md)
- WebSocket support for real-time updates
- Multiple PDF support
- User authentication
- Analytics dashboard
- Export functionality (CSV/JSON)
- Batch evaluation
- Voice input/output
- Team workspaces

## Helpful Commands for Debugging
```bash
# Check app logs
heroku logs --tail  # If using Heroku
render logs         # In Render dashboard

# Database queries
flask shell
>>> from app import db, ChatSession, Message, Evaluation
>>> ChatSession.query.all()

# Test health endpoint
curl https://chat-eval.onrender.com/health

# Local environment
export FLASK_ENV=development
export ANTHROPIC_API_KEY="your-key"
python app.py
```

## Contact & Resources
- **Repository**: https://github.com/amank94/chat-eval
- **Deployment Guide**: DEPLOYMENT.md
- **PRD**: PRD.md (Product Requirements Document)
- **Quick Deploy**: DEPLOY_NOW.md

## Important Notes for Future Development
1. **Multi-Criteria System**: The evaluation system now supports multiple criteria simultaneously - preserve this functionality in future changes
2. **Inline Details**: Users expect evaluation details to show inline under history items, not at the top
3. **localStorage Persistence**: Evaluation history is stored in localStorage and Flask session - maintain both for reliability
4. **Combined Feedback**: The system uses feedback from all selected criteria to improve responses - don't break this workflow
5. Always test PDF upload functionality after changes
6. Ensure markdown parsing doesn't break with special characters
7. Keep evaluation prompts customizable
8. Maintain backwards compatibility with session data
9. Test on both light and dark modes
10. Verify mobile responsiveness
11. Check database migrations before deploying
12. Monitor API usage to control costs
13. Keep health endpoint functional for monitoring
14. Document any new environment variables

---
*Last Updated*: 2025-08-11 (Multi-Criteria Evaluation System Implementation)
*Purpose*: Provide context for AI assistants working on this codebase

## Latest Feature Implementation Summary (2025-08-11)

### Completed: Multi-Criteria Evaluation System
All three requested features have been fully implemented and tested:

#### 1. Inline Evaluation Details ✅
- **Implementation**: `toggleEvaluationDetails()` function in `script_simple_auth.js`
- **Behavior**: Clicking evaluation history items shows details **inline below the item**
- **Key Code**: Uses `eval-details-{index}` divs that expand/collapse under each history item
- **User Benefit**: No confusion about which evaluation is being viewed

#### 2. Multi-Criteria Checkboxes ✅  
- **Implementation**: 4 evaluation criteria checkboxes in `index_simple_auth.html`
- **Criteria**: Groundedness, Factual, Completeness, Relevance
- **Behavior**: Users can select multiple criteria simultaneously
- **Key Code**: `getSelectedEvaluationCriteria()` function collects all checked criteria
- **User Benefit**: Comprehensive evaluation from multiple perspectives

#### 3. Combined Feedback System ✅
- **Implementation**: Enhanced `/chat` and `/improve` endpoints in `app.py`
- **Behavior**: Uses feedback from ALL selected criteria to improve responses
- **Key Code**: Backend processes `evaluation_criteria` array and generates `combined_evaluation`
- **User Benefit**: More nuanced and comprehensive response improvements

### Technical Implementation Details
- **Files Modified**: `app.py`, `templates/index_simple_auth.html`, `static/script_simple_auth.js`
- **Backend Changes**: Multi-criteria evaluation processing, combined feedback generation
- **Frontend Changes**: Evaluation history UI with inline details, multi-select checkboxes
- **Persistence**: localStorage for evaluation history (survives page refreshes)
- **Testing**: Comprehensive Playwright test validation completed

### Usage Instructions
1. **Select Criteria**: Check desired evaluation criteria (multiple allowed)
2. **Send Message**: System evaluates response against ALL selected criteria  
3. **View History**: All evaluations stored in interactive history list
4. **Inline Details**: Click any history item to see evaluation details expand inline below it
5. **Improve Responses**: System uses combined feedback from all criteria for improvements

The system now provides a sophisticated multi-dimensional evaluation capability exactly as requested.