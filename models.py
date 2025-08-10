from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class EvaluationHistory(db.Model):
    __tablename__ = 'evaluation_history'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    question = db.Column(db.Text, nullable=False)
    response = db.Column(db.Text, nullable=False)
    evaluation = db.Column(db.Text, nullable=False)
    
    groundedness_level = db.Column(db.String(50))
    evaluation_explanation = db.Column(db.Text)
    
    pdf_content = db.Column(db.Text)
    pdf_filename = db.Column(db.String(255))
    
    improved_response = db.Column(db.Text)
    improved_evaluation = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'timestamp': self.timestamp.isoformat(),
            'question': self.question,
            'response': self.response,
            'evaluation': self.evaluation,
            'groundedness_level': self.groundedness_level,
            'evaluation_explanation': self.evaluation_explanation,
            'pdf_filename': self.pdf_filename,
            'improved_response': self.improved_response,
            'improved_evaluation': self.improved_evaluation
        }
    
    @staticmethod
    def parse_evaluation(evaluation_text):
        """Parse evaluation text to extract label and explanation"""
        lines = evaluation_text.split('\n') if evaluation_text else []
        label = ''
        explanation = ''
        
        for line in lines:
            if line.startswith('Label:'):
                label = line.replace('Label:', '').strip()
            elif line.startswith('Explanation:'):
                explanation = line.replace('Explanation:', '').strip()
            elif explanation and line.strip():
                explanation += ' ' + line.strip()
        
        return label, explanation