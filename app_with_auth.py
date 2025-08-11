from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from authlib.integrations.flask_client import OAuth
from cryptography.fernet import Fernet
import anthropic
import os
from dotenv import load_dotenv
from pypdf import PdfReader
import io
import base64
from datetime import datetime, timedelta
import redis
import json
import uuid

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///chateval_auth.db')
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Encryption key for API keys (generate a new one for production)
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key().decode())
cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

# Initialize extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# OAuth setup
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID'),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# Redis configuration (optional)
try:
    redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379')
    redis_client = redis.from_url(redis_url)
    redis_client.ping()
except:
    redis_client = None
    print("Redis not available, using in-memory storage")

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    google_id = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(100))
    encrypted_api_key = db.Column(db.Text)  # Encrypted Anthropic API key
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, default=datetime.utcnow)
    usage_count = db.Column(db.Integer, default=0)
    
    # Relationships
    sessions = db.relationship('ChatSession', backref='user', lazy=True)
    
    def set_api_key(self, api_key):
        """Encrypt and store API key"""
        if api_key:
            self.encrypted_api_key = cipher_suite.encrypt(api_key.encode()).decode()
    
    def get_api_key(self):
        """Decrypt and return API key"""
        if self.encrypted_api_key:
            return cipher_suite.decrypt(self.encrypted_api_key.encode()).decode()
        return None
    
    def get_anthropic_client(self):
        """Get Anthropic client with user's API key"""
        api_key = self.get_api_key()
        if api_key:
            return anthropic.Anthropic(api_key=api_key)
        return None

class ChatSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    pdf_content = db.Column(db.Text)  # Store PDF content per session
    messages = db.relationship('Message', backref='session', lazy=True)
    evaluations = db.relationship('Evaluation', backref='session', lazy=True)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_session.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class Evaluation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_session.id'), nullable=False)
    question = db.Column(db.Text, nullable=False)
    response = db.Column(db.Text, nullable=False)
    evaluation_result = db.Column(db.Text, nullable=False)
    groundedness_level = db.Column(db.String(50))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class UsageLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    action = db.Column(db.String(50))  # 'chat', 'evaluation', 'improve'
    tokens_used = db.Column(db.Integer, default=0)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Groundedness prompt
GROUNDEDNESS_PROMPT = """You are evaluating whether an AI response is grounded in the provided document context.

Document Context:
{context}

User Question:
{question}

AI Response:
{response}

Evaluate the response and provide:
1. A label: "Grounded", "Partially Grounded", or "Not Grounded"
2. A brief explanation (2-3 sentences) of your evaluation

Format your response as:
Label: [your label]
Explanation: [your explanation]"""

@app.route('/')
def index():
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
    
    # Check if user has API key
    if not current_user.get_api_key():
        return redirect(url_for('setup_api_key'))
    
    return render_template('index_with_auth.html', user=current_user)

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/auth/google')
def google_login():
    redirect_uri = url_for('google_callback', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/auth/google/callback')
def google_callback():
    token = google.authorize_access_token()
    user_info = token.get('userinfo')
    
    if user_info:
        # Check if user exists
        user = User.query.filter_by(google_id=user_info['sub']).first()
        
        if not user:
            # Create new user
            user = User(
                google_id=user_info['sub'],
                email=user_info['email'],
                name=user_info.get('name', user_info['email'])
            )
            db.session.add(user)
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Login user
        login_user(user, remember=True)
        
        # Check if user has API key
        if not user.get_api_key():
            return redirect(url_for('setup_api_key'))
        
        return redirect(url_for('index'))
    
    return redirect(url_for('login'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/setup_api_key')
@login_required
def setup_api_key():
    return render_template('setup_api_key.html', user=current_user)

@app.route('/save_api_key', methods=['POST'])
@login_required
def save_api_key():
    data = request.json
    api_key = data.get('api_key')
    
    if not api_key:
        return jsonify({'error': 'API key is required'}), 400
    
    # Test the API key
    try:
        test_client = anthropic.Anthropic(api_key=api_key)
        # Make a minimal test request
        test_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=10,
            messages=[{"role": "user", "content": "Hi"}]
        )
    except Exception as e:
        return jsonify({'error': f'Invalid API key: {str(e)}'}), 400
    
    # Save the API key
    current_user.set_api_key(api_key)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'API key saved successfully'})

@app.route('/chat', methods=['POST'])
@login_required
def chat():
    try:
        # Get user's Anthropic client
        client = current_user.get_anthropic_client()
        if not client:
            return jsonify({'error': 'Please configure your API key first'}), 400
        
        data = request.json
        user_message = data.get('message', '')
        session_id = data.get('session_id')
        custom_prompt = data.get('evaluation_prompt', None)
        
        # Get or create session
        chat_session = None
        if session_id:
            chat_session = ChatSession.query.filter_by(
                session_id=session_id, 
                user_id=current_user.id
            ).first()
        
        if not chat_session:
            chat_session = ChatSession(
                session_id=str(uuid.uuid4()),
                user_id=current_user.id
            )
            db.session.add(chat_session)
            db.session.commit()
        
        # Prepare messages
        messages = []
        pdf_content = chat_session.pdf_content or ""
        
        if pdf_content:
            messages.append({
                "role": "user",
                "content": f"""You are a helpful AI assistant. Please answer the following question based on the provided document context.

**Important Instructions:**
- Structure your response using markdown formatting
- Use bullet points or numbered lists for key insights
- Keep paragraphs concise (2-3 sentences max)
- Bold important terms and concepts
- If applicable, use headers (##) to organize different sections
- Be clear and direct, avoiding unnecessary verbosity

Document context:
{pdf_content}

User question: {user_message}"""
            })
        else:
            messages.append({
                "role": "user",
                "content": f"""Please answer the following question. Use markdown formatting for clarity:
- Use bullet points for lists
- Bold important terms
- Keep responses concise and well-structured

Question: {user_message}"""
            })
        
        # Get AI response
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            messages=messages
        )
        
        ai_response = response.content[0].text
        
        # Save message to database
        msg = Message(
            session_id=chat_session.id,
            role='user',
            content=user_message
        )
        db.session.add(msg)
        
        msg = Message(
            session_id=chat_session.id,
            role='assistant',
            content=ai_response
        )
        db.session.add(msg)
        
        # Evaluate if PDF content exists
        evaluation = None
        if pdf_content:
            eval_prompt = custom_prompt or GROUNDEDNESS_PROMPT
            eval_prompt = eval_prompt.replace('{context}', pdf_content[:3000])
            eval_prompt = eval_prompt.replace('{question}', user_message)
            eval_prompt = eval_prompt.replace('{response}', ai_response)
            
            eval_response = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=500,
                messages=[{
                    "role": "user",
                    "content": eval_prompt
                }]
            )
            evaluation = eval_response.content[0].text
            
            # Save evaluation
            eval_obj = Evaluation(
                session_id=chat_session.id,
                question=user_message,
                response=ai_response,
                evaluation_result=evaluation
            )
            db.session.add(eval_obj)
        
        # Update usage count
        current_user.usage_count += 1
        
        # Log usage
        usage = UsageLog(
            user_id=current_user.id,
            action='chat',
            tokens_used=1000  # Approximate
        )
        db.session.add(usage)
        
        db.session.commit()
        
        return jsonify({
            'response': ai_response,
            'evaluation': evaluation,
            'session_id': chat_session.session_id
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload_pdf', methods=['POST'])
@login_required
def upload_pdf():
    try:
        data = request.json
        pdf_data = data.get('pdf_data', '')
        session_id = data.get('session_id')
        
        if pdf_data.startswith('data:application/pdf;base64,'):
            pdf_data = pdf_data.split(',')[1]
        
        pdf_bytes = base64.b64decode(pdf_data)
        pdf_file = io.BytesIO(pdf_bytes)
        
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        # Get or create session
        if session_id:
            chat_session = ChatSession.query.filter_by(
                session_id=session_id,
                user_id=current_user.id
            ).first()
        else:
            chat_session = ChatSession(
                session_id=str(uuid.uuid4()),
                user_id=current_user.id
            )
            db.session.add(chat_session)
        
        # Store PDF content in session
        chat_session.pdf_content = text[:10000]
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'PDF uploaded successfully. Extracted {len(text)} characters.',
            'session_id': chat_session.session_id
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/user_sessions')
@login_required
def user_sessions():
    """Get all sessions for the current user"""
    sessions = ChatSession.query.filter_by(user_id=current_user.id)\
        .order_by(ChatSession.created_at.desc())\
        .limit(10)\
        .all()
    
    return jsonify({
        'sessions': [{
            'id': s.session_id,
            'created_at': s.created_at.isoformat(),
            'message_count': len(s.messages),
            'has_pdf': bool(s.pdf_content)
        } for s in sessions]
    })

@app.route('/usage_stats')
@login_required
def usage_stats():
    """Get usage statistics for the current user"""
    total_messages = Message.query.join(ChatSession)\
        .filter(ChatSession.user_id == current_user.id)\
        .count()
    
    total_evaluations = Evaluation.query.join(ChatSession)\
        .filter(ChatSession.user_id == current_user.id)\
        .count()
    
    return jsonify({
        'total_messages': total_messages,
        'total_evaluations': total_evaluations,
        'usage_count': current_user.usage_count,
        'member_since': current_user.created_at.isoformat()
    })

@app.route('/health')
def health_check():
    """Health check endpoint for Render monitoring"""
    try:
        db.session.execute('SELECT 1')
        db_status = 'healthy'
    except:
        db_status = 'unhealthy'
    
    redis_status = 'not configured'
    if redis_client:
        try:
            redis_client.ping()
            redis_status = 'healthy'
        except:
            redis_status = 'unhealthy'
    
    return jsonify({
        'status': 'healthy',
        'database': db_status,
        'redis': redis_status,
        'auth': 'google_oauth',
        'timestamp': datetime.utcnow().isoformat()
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    if os.environ.get('FLASK_ENV') == 'production':
        app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
    else:
        app.run(debug=True, port=5001)