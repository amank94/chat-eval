from flask import Flask, render_template, request, jsonify, session, send_file
from flask_cors import CORS
import anthropic
import os
from dotenv import load_dotenv
from pypdf import PdfReader
import io
import base64
import uuid
from datetime import datetime, timedelta
import json
import csv
from models import db, EvaluationHistory

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///evaluation_history.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app)
db.init_app(app)

client = anthropic.Anthropic()

pdf_content = ""
pdf_filename = ""

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

@app.before_request
def before_request():
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    session.permanent = True
    app.permanent_session_lifetime = timedelta(days=7)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    global pdf_content, pdf_filename
    
    try:
        data = request.json
        user_message = data.get('message', '')
        
        messages = []
        if pdf_content:
            messages.append({
                "role": "user",
                "content": f"Document context:\n{pdf_content}\n\nUser question: {user_message}"
            })
        else:
            messages.append({
                "role": "user",
                "content": user_message
            })
        
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            messages=messages
        )
        
        ai_response = response.content[0].text
        
        evaluation = None
        groundedness_level = None
        evaluation_explanation = None
        
        if pdf_content:
            eval_response = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=500,
                messages=[{
                    "role": "user",
                    "content": GROUNDEDNESS_PROMPT.format(
                        context=pdf_content[:3000],
                        question=user_message,
                        response=ai_response
                    )
                }]
            )
            evaluation = eval_response.content[0].text
            groundedness_level, evaluation_explanation = EvaluationHistory.parse_evaluation(evaluation)
        
        # Store in database
        eval_history = EvaluationHistory(
            session_id=session['session_id'],
            question=user_message,
            response=ai_response,
            evaluation=evaluation or '',
            groundedness_level=groundedness_level,
            evaluation_explanation=evaluation_explanation,
            pdf_content=pdf_content[:1000] if pdf_content else None,
            pdf_filename=pdf_filename
        )
        db.session.add(eval_history)
        db.session.commit()
        
        return jsonify({
            'response': ai_response,
            'evaluation': evaluation,
            'history_id': eval_history.id
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload_pdf', methods=['POST'])
def upload_pdf():
    global pdf_content, pdf_filename
    
    try:
        data = request.json
        pdf_data = data.get('pdf_data', '')
        filename = data.get('filename', 'unknown.pdf')
        
        if pdf_data.startswith('data:application/pdf;base64,'):
            pdf_data = pdf_data.split(',')[1]
        
        pdf_bytes = base64.b64decode(pdf_data)
        pdf_file = io.BytesIO(pdf_bytes)
        
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        pdf_content = text[:10000]
        pdf_filename = filename
        
        return jsonify({
            'success': True,
            'message': f'PDF uploaded successfully. Extracted {len(text)} characters.',
            'preview': text[:500],
            'filename': filename
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/improve', methods=['POST'])
def improve_response():
    global pdf_content
    
    try:
        data = request.json
        original_question = data.get('question', '')
        original_response = data.get('response', '')
        evaluation = data.get('evaluation', '')
        history_id = data.get('history_id')
        
        improvement_prompt = f"""Previous evaluation: {evaluation}

Please improve your response to better address the question while being more grounded in the document.

Document context:
{pdf_content[:3000]}

Original question: {original_question}

Please provide an improved response:"""
        
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": improvement_prompt
            }]
        )
        
        improved_response = response.content[0].text
        
        eval_response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": GROUNDEDNESS_PROMPT.format(
                    context=pdf_content[:3000],
                    question=original_question,
                    response=improved_response
                )
            }]
        )
        new_evaluation = eval_response.content[0].text
        
        # Update history if ID provided
        if history_id:
            eval_history = EvaluationHistory.query.get(history_id)
            if eval_history:
                eval_history.improved_response = improved_response
                eval_history.improved_evaluation = new_evaluation
                db.session.commit()
        
        return jsonify({
            'response': improved_response,
            'evaluation': new_evaluation
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/history', methods=['GET'])
def get_history():
    try:
        # Get query parameters
        session_id = request.args.get('session_id', session.get('session_id'))
        groundedness = request.args.get('groundedness')
        search = request.args.get('search')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        # Build query
        query = EvaluationHistory.query
        
        if session_id:
            query = query.filter_by(session_id=session_id)
        
        if groundedness:
            query = query.filter_by(groundedness_level=groundedness)
        
        if search:
            query = query.filter(
                db.or_(
                    EvaluationHistory.question.contains(search),
                    EvaluationHistory.response.contains(search)
                )
            )
        
        if date_from:
            query = query.filter(EvaluationHistory.timestamp >= datetime.fromisoformat(date_from))
        
        if date_to:
            query = query.filter(EvaluationHistory.timestamp <= datetime.fromisoformat(date_to))
        
        # Get total count
        total = query.count()
        
        # Apply pagination and get results
        evaluations = query.order_by(EvaluationHistory.timestamp.desc())\
                          .limit(limit)\
                          .offset(offset)\
                          .all()
        
        return jsonify({
            'evaluations': [eval.to_dict() for eval in evaluations],
            'total': total,
            'limit': limit,
            'offset': offset
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/history/stats', methods=['GET'])
def get_history_stats():
    try:
        session_id = request.args.get('session_id', session.get('session_id'))
        
        query = EvaluationHistory.query
        if session_id:
            query = query.filter_by(session_id=session_id)
        
        total = query.count()
        grounded = query.filter_by(groundedness_level='Grounded').count()
        partially = query.filter_by(groundedness_level='Partially Grounded').count()
        not_grounded = query.filter_by(groundedness_level='Not Grounded').count()
        
        # Calculate improvement rate
        with_improvement = query.filter(EvaluationHistory.improved_response.isnot(None)).count()
        improvement_rate = (with_improvement / total * 100) if total > 0 else 0
        
        return jsonify({
            'total_evaluations': total,
            'grounded': grounded,
            'partially_grounded': partially,
            'not_grounded': not_grounded,
            'improvement_rate': round(improvement_rate, 2)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/history/export', methods=['GET'])
def export_history():
    try:
        format = request.args.get('format', 'json')
        session_id = request.args.get('session_id', session.get('session_id'))
        
        query = EvaluationHistory.query
        if session_id:
            query = query.filter_by(session_id=session_id)
        
        evaluations = query.order_by(EvaluationHistory.timestamp.desc()).all()
        
        if format == 'csv':
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=[
                'id', 'timestamp', 'question', 'response', 'groundedness_level',
                'evaluation_explanation', 'pdf_filename', 'improved_response'
            ])
            writer.writeheader()
            
            for eval in evaluations:
                writer.writerow({
                    'id': eval.id,
                    'timestamp': eval.timestamp.isoformat(),
                    'question': eval.question,
                    'response': eval.response,
                    'groundedness_level': eval.groundedness_level,
                    'evaluation_explanation': eval.evaluation_explanation,
                    'pdf_filename': eval.pdf_filename,
                    'improved_response': eval.improved_response
                })
            
            output.seek(0)
            return send_file(
                io.BytesIO(output.getvalue().encode()),
                mimetype='text/csv',
                as_attachment=True,
                download_name=f'evaluation_history_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            )
        
        else:  # JSON format
            data = [eval.to_dict() for eval in evaluations]
            return send_file(
                io.BytesIO(json.dumps(data, indent=2).encode()),
                mimetype='application/json',
                as_attachment=True,
                download_name=f'evaluation_history_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/history/<int:id>', methods=['DELETE'])
def delete_history_item(id):
    try:
        eval_history = EvaluationHistory.query.get_or_404(id)
        db.session.delete(eval_history)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5002)