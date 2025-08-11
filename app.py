from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import anthropic
import os
from dotenv import load_dotenv
from pypdf import PdfReader
import io
import base64
from datetime import datetime
import redis
import json
import uuid
import hashlib
import tempfile

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///chateval.db')
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)

# Redis configuration (optional, fallback to in-memory if not available)
try:
    redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379')
    redis_client = redis.from_url(redis_url)
    redis_client.ping()
except:
    redis_client = None
    print("Redis not available, using in-memory storage")

# PDF storage - use temp files to avoid session size limits
# Dictionary to store PDF content with session-based keys
pdf_storage = {}

# Database Models (for future use)
class ChatSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
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
    # Initialize session if not exists
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
        session['evaluation_history'] = []
    
    # Clean up old PDF storage entries (keep only last 100 sessions)
    if len(pdf_storage) > 100:
        # Remove oldest entries
        keys_to_remove = list(pdf_storage.keys())[:-100]
        for key in keys_to_remove:
            pdf_storage.pop(key, None)
    
    return render_template('index_simple_auth.html')

@app.route('/validate_api_key', methods=['POST'])
def validate_api_key():
    """Validate an Anthropic API key"""
    try:
        data = request.json
        api_key = data.get('api_key', '')
        
        if not api_key:
            return jsonify({'valid': False, 'error': 'No API key provided'}), 400
        
        # Test the API key with a minimal request
        test_client = anthropic.Anthropic(api_key=api_key)
        test_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=10,
            messages=[{"role": "user", "content": "Hi"}]
        )
        
        return jsonify({'valid': True, 'message': 'API key is valid'})
    
    except anthropic.AuthenticationError:
        return jsonify({'valid': False, 'error': 'Invalid API key'}), 401
    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)}), 400

@app.route('/health')
def health_check():
    """Health check endpoint for Render monitoring"""
    try:
        # Check database connection
        db.session.execute('SELECT 1')
        db_status = 'healthy'
    except:
        db_status = 'unhealthy'
    
    # Check Redis connection if available
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
        'timestamp': datetime.utcnow().isoformat(),
        'version': '2.1.2',  # Force Render redeploy - fix UI deployment
        'deployment_id': 'ui-update-' + str(int(datetime.utcnow().timestamp()))
    })

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_message = data.get('message', '')
        api_key = data.get('api_key', '')
        custom_prompt = data.get('evaluation_prompt', None)
        evaluation_criteria = data.get('evaluation_criteria', [])
        
        if not api_key:
            return jsonify({'error': 'API key is required. Please add your Anthropic API key.'}), 401
        
        # Create Anthropic client with user's API key
        try:
            client = anthropic.Anthropic(api_key=api_key)
        except Exception as e:
            return jsonify({'error': f'Invalid API key: {str(e)}'}), 401
        
        # Get PDF content from in-memory storage using session ID
        session_id = session.get('session_id', '')
        pdf_content = pdf_storage.get(session_id, '')
        
        messages = []
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
        
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            messages=messages
        )
        
        ai_response = response.content[0].text
        
        evaluation = None
        combined_evaluation = None
        
        if evaluation_criteria and len(evaluation_criteria) > 0:
            # Process multiple evaluation criteria
            evaluations = []
            for criterion in evaluation_criteria:
                criterion_type = criterion.get('type', 'groundedness')
                criterion_prompt = criterion.get('prompt', '')
                
                if criterion_prompt:
                    # Replace placeholders in custom prompt
                    eval_prompt = criterion_prompt.replace('{document_content}', pdf_content[:3000] if pdf_content else 'No document provided.')
                    eval_prompt = eval_prompt.replace('{question}', user_message)
                    eval_prompt = eval_prompt.replace('{response}', ai_response)
                    eval_prompt = eval_prompt.replace('{timestamp}', str(datetime.now()))
                else:
                    # Use appropriate default prompt based on criterion type and document availability
                    if criterion_type == 'groundedness' and pdf_content:
                        eval_prompt = GROUNDEDNESS_PROMPT.format(
                            context=pdf_content[:3000],
                            question=user_message,
                            response=ai_response
                        )
                    else:
                        # Generic evaluation prompt for non-document-based criteria
                        eval_prompt = f"""Evaluate this AI response based on {criterion_type} criteria.

User Question:
{user_message}

AI Response:
{ai_response}

Evaluate and provide:
1. A label indicating the quality (e.g., "Good", "Fair", "Poor")
2. A brief explanation (2-3 sentences) of your evaluation

Format your response as:
Label: [your label]
Explanation: [your explanation]"""
                
                eval_response = client.messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=500,
                    messages=[{
                        "role": "user",
                        "content": eval_prompt
                    }]
                )
                evaluations.append({
                    'type': criterion_type,
                    'evaluation': eval_response.content[0].text
                })
            
            # Combine evaluations into a single structured response
            combined_evaluation = evaluations
            evaluation = evaluations[0]['evaluation'] if evaluations else None
        elif pdf_content:
            # Fallback to single evaluation if no criteria specified
            if custom_prompt:
                eval_prompt = custom_prompt.replace('{document_content}', pdf_content[:3000])
                eval_prompt = eval_prompt.replace('{question}', user_message)
                eval_prompt = eval_prompt.replace('{response}', ai_response)
                eval_prompt = eval_prompt.replace('{timestamp}', str(datetime.now()))
            else:
                eval_prompt = GROUNDEDNESS_PROMPT.format(
                    context=pdf_content[:3000],
                    question=user_message,
                    response=ai_response
                )
            
            eval_response = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=500,
                messages=[{
                    "role": "user",
                    "content": eval_prompt
                }]
            )
            evaluation = eval_response.content[0].text
        
        # Add to session history if there's an evaluation (with size limit)
        if evaluation and 'evaluation_history' in session:
            # Limit session history to prevent cookie overflow
            if len(session['evaluation_history']) >= 10:
                session['evaluation_history'] = session['evaluation_history'][-5:]  # Keep only last 5
            
            session['evaluation_history'].append({
                'id': len(session['evaluation_history']) + 1,
                'question': user_message,
                'response': ai_response,
                'evaluation': evaluation,
                'timestamp': datetime.now().isoformat()
            })
            session.modified = True
        
        return jsonify({
            'response': ai_response,
            'evaluation': evaluation,
            'combined_evaluation': combined_evaluation,
            'evaluation_history': session.get('evaluation_history', [])
        })
    
    except anthropic.AuthenticationError:
        return jsonify({'error': 'Invalid API key. Please check your Anthropic API key.'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload_pdf', methods=['POST'])
def upload_pdf():
    try:
        data = request.json
        pdf_data = data.get('pdf_data', '')
        
        if pdf_data.startswith('data:application/pdf;base64,'):
            pdf_data = pdf_data.split(',')[1]
        
        pdf_bytes = base64.b64decode(pdf_data)
        pdf_file = io.BytesIO(pdf_bytes)
        
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        # Store PDF content in memory storage instead of session (to avoid cookie size limits)
        session_id = session.get('session_id', '')
        if session_id:
            pdf_storage[session_id] = text[:10000]
        session.modified = True
        
        return jsonify({
            'success': True,
            'message': f'PDF uploaded successfully. Extracted {len(text)} characters.',
            'preview': text[:500]
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/clear_history', methods=['POST'])
def clear_history():
    """Clear the evaluation history for the current session"""
    if 'evaluation_history' in session:
        session['evaluation_history'] = []
        session.modified = True
    return jsonify({'success': True})

@app.route('/improve', methods=['POST'])
def improve_response():
    try:
        data = request.json
        original_question = data.get('question', '')
        original_response = data.get('response', '')
        evaluation = data.get('evaluation', '')
        combined_evaluation = data.get('combined_evaluation', [])
        api_key = data.get('api_key', '')
        custom_prompt = data.get('evaluation_prompt', None)
        evaluation_criteria = data.get('evaluation_criteria', [])
        
        if not api_key:
            return jsonify({'error': 'API key is required'}), 401
        
        # Create Anthropic client with user's API key
        try:
            client = anthropic.Anthropic(api_key=api_key)
        except Exception as e:
            return jsonify({'error': f'Invalid API key: {str(e)}'}), 401
        
        # Get PDF content from in-memory storage using session ID
        session_id = session.get('session_id', '')
        pdf_content = pdf_storage.get(session_id, '')
        
        # Build improvement prompt based on all evaluations
        if combined_evaluation and len(combined_evaluation) > 0:
            feedback_text = "Previous evaluations:\n"
            for eval_item in combined_evaluation:
                feedback_text += f"\n{eval_item['type'].upper()}: {eval_item['evaluation']}\n"
            improvement_prompt = f"""{feedback_text}

Based on ALL the above feedback, please improve your response to better address the question.

**Important Instructions:**
- Use markdown formatting for clarity
- Structure key points with bullet points or numbered lists
- Bold important terms from the document
- Keep paragraphs concise and focused
- Cite specific information from the document when possible
- Be more precise and direct than the previous response

Document context:
{pdf_content[:3000]}

Original question: {original_question}

Please provide an improved, well-formatted response:"""
        else:
            improvement_prompt = f"""Previous evaluation: {evaluation}

Please improve your response to better address the question while being more grounded in the document.

**Important Instructions:**
- Use markdown formatting for clarity
- Structure key points with bullet points or numbered lists
- Bold important terms from the document
- Keep paragraphs concise and focused
- Cite specific information from the document when possible
- Be more precise and direct than the previous response

Document context:
{pdf_content[:3000]}

Original question: {original_question}

Please provide an improved, well-formatted response:"""
        
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": improvement_prompt
            }]
        )
        
        improved_response = response.content[0].text
        
        # Re-evaluate the improved response with all criteria
        new_combined_evaluation = None
        if evaluation_criteria and len(evaluation_criteria) > 0:
            evaluations = []
            for criterion in evaluation_criteria:
                criterion_type = criterion.get('type', 'groundedness')
                criterion_prompt = criterion.get('prompt', '')
                
                if criterion_prompt:
                    eval_prompt = criterion_prompt.replace('{document_content}', pdf_content[:3000])
                    eval_prompt = eval_prompt.replace('{question}', original_question)
                    eval_prompt = eval_prompt.replace('{response}', improved_response)
                    eval_prompt = eval_prompt.replace('{timestamp}', str(datetime.now()))
                else:
                    eval_prompt = GROUNDEDNESS_PROMPT.format(
                        context=pdf_content[:3000],
                        question=original_question,
                        response=improved_response
                    )
                
                eval_response = client.messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=500,
                    messages=[{
                        "role": "user",
                        "content": eval_prompt
                    }]
                )
                evaluations.append({
                    'type': criterion_type,
                    'evaluation': eval_response.content[0].text
                })
            
            new_combined_evaluation = evaluations
            new_evaluation = evaluations[0]['evaluation'] if evaluations else None
        elif custom_prompt:
            eval_prompt = custom_prompt.replace('{document_content}', pdf_content[:3000])
            eval_prompt = eval_prompt.replace('{question}', original_question)
            eval_prompt = eval_prompt.replace('{response}', improved_response)
            eval_prompt = eval_prompt.replace('{timestamp}', str(datetime.now()))
        else:
            eval_prompt = GROUNDEDNESS_PROMPT.format(
                context=pdf_content[:3000],
                question=original_question,
                response=improved_response
            )
        
        eval_response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": eval_prompt
            }]
        )
        new_evaluation = eval_response.content[0].text
        
        # Add improved evaluation to session history
        if new_evaluation and 'evaluation_history' in session:
            session['evaluation_history'].append({
                'id': len(session['evaluation_history']) + 1,
                'question': original_question,
                'response': improved_response,
                'evaluation': new_evaluation,
                'timestamp': datetime.now().isoformat(),
                'is_improved': True
            })
            session.modified = True
        
        return jsonify({
            'response': improved_response,
            'evaluation': new_evaluation,
            'combined_evaluation': new_combined_evaluation,
            'evaluation_history': session.get('evaluation_history', [])
        })
    
    except anthropic.AuthenticationError:
        return jsonify({'error': 'Invalid API key. Please check your Anthropic API key.'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    # Check if running in production
    if os.environ.get('FLASK_ENV') == 'production':
        app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
    else:
        app.run(debug=True, port=5002)