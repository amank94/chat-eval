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
3. **Groundedness Evaluation**: Automatic evaluation of AI responses against document context
4. **Evaluation History**: Session-based tracking of all evaluations
5. **Prompt Customization**: Editable evaluation prompts with templates
6. **Dark Mode**: Toggle between light and dark themes
7. **Responsive Design**: Mobile-friendly interface
8. **Markdown Rendering**: Proper formatting of AI responses
9. **Panel Management**: Resizable, collapsible, independent scrolling panels

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
- **Markdown Parsing**: Uses marked.js to render formatted responses
- **Session Storage**: Evaluation history stored in Flask session
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
# Visit http://localhost:5001
```

### Testing Commands
```bash
# No formal tests yet, but should add:
pytest tests/
npm run lint  # If adding JS linting
```

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

## Known Issues & TODOs
1. **PDF Size Limit**: Currently truncates to 10,000 characters
2. **Session Persistence**: Uses Flask session, not persistent across browser sessions
3. **Rate Limiting**: Not implemented yet
4. **Tests**: No test suite implemented
5. **Monitoring**: Basic health check only, no detailed metrics
6. **Multi-PDF**: Single PDF at a time currently

## Recent Changes
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
1. Always test PDF upload functionality after changes
2. Ensure markdown parsing doesn't break with special characters
3. Keep evaluation prompts customizable
4. Maintain backwards compatibility with session data
5. Test on both light and dark modes
6. Verify mobile responsiveness
7. Check database migrations before deploying
8. Monitor API usage to control costs
9. Keep health endpoint functional for monitoring
10. Document any new environment variables

---
*Last Updated*: Generated on project completion
*Purpose*: Provide context for AI assistants working on this codebase