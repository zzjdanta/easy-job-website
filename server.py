from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory
from flask_cors import CORS
import requests
import json
import os
import socket
import database

# Set static folder to current directory
app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app)  # Enable CORS for all routes

# Configuration
API_KEY = "sk-e66576b892ea490599f0a5c366611858"
TARGET_URL = "https://api.deepseek.com/chat/completions"
PORT = 8000

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# --- 新增：职位搜索接口 ---
@app.route('/api/jobs', methods=['GET'])
def list_jobs():
    try:
        # 获取前端传来的查询参数
        loc = request.args.get('location')
        cat = request.args.get('category')
        sal = request.args.get('salary')
        
        # 调用数据库函数获取数据
        jobs = database.get_jobs(location=loc, category=cat, min_salary=sal)
        return jsonify(jobs)
    except Exception as e:
        print(f"Error fetching jobs: {e}")
        return jsonify({"error": {"message": str(e)}}), 500
# ------------------------


@app.route('/api/jobs/<int:job_id>', methods=['GET'])
def get_job_detail(job_id):
    try:
        job = database.get_job_by_id(job_id)
        if job:
            return jsonify(job)
        return jsonify({"error": "Job not found"}), 404
    except Exception as e:
        return jsonify({"error": {"message": str(e)}}), 500

@app.route('/api/chat', methods=['POST'])
def proxy_chat():
    if not API_KEY:
        return jsonify({"error": {"message": "Server configuration error: Missing API Key"}}), 401

    try:
        data = request.json
        user_message = data.get('messages', [])[-1].get('content', '')

        if user_message:
            database.save_message('user', user_message)

        headers = {
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

        resp = requests.post(TARGET_URL, json=data, headers=headers, stream=True)

        if resp.status_code != 200:
            return jsonify({"error": {"message": f"Upstream API Error: {resp.text}"}}), resp.status_code

        def generate():
            ai_response_content = ""
            for chunk in resp.iter_lines():
                if chunk:
                    yield chunk + b'\n'
                    try:
                        chunk_str = chunk.decode('utf-8')
                        if chunk_str.startswith('data: ') and chunk_str != 'data: [DONE]':
                            json_str = chunk_str[6:]
                            chunk_data = json.loads(json_str)
                            delta = chunk_data['choices'][0]['delta'].get('content', '')
                            ai_response_content += delta
                    except:
                        pass
            
            if ai_response_content:
                database.save_message('assistant', ai_response_content)

        return Response(stream_with_context(generate()), content_type='text/event-stream')

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": {"message": str(e)}}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    try:
        history = database.get_history()
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": {"message": str(e)}}), 500

@app.route('/api/clear', methods=['POST'])
def clear_history():
    try:
        database.clear_history()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": {"message": str(e)}}), 500

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"



def analyze_resume_with_ai(job_reqs, resume_text):
    """Call DeepSeek to analyze fit"""
    if not API_KEY: return {"score": 0, "reason": "Server API Key missing"}
    
    prompt = f"""
    You are a professional HR AI. Compare the Job Requirements and Candidate Resume below.
    
    [Job Requirements]
    {job_reqs}
    
    [Candidate Resume]
    {resume_text}
    
    Task:
    1. Give a Match Score (0-100).
    2. Explain the gap (what skills are missing).
    3. Provide brief advice.
    
    Output strictly in JSON format:
    {{
        "score": 85,
        "reason": "...",
        "advice": "..."
    }}
    """
    
    try:
        headers = {
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        }
        data = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"}
        }
        
        resp = requests.post(TARGET_URL, json=data, headers=headers, timeout=30)
        if resp.status_code == 200:
            result = resp.json()
            content = result['choices'][0]['message']['content']
            return json.loads(content)
    except Exception as e:
        print(f"AI Analysis failed: {e}")
    
    return {"score": 50, "reason": "AI Analysis failed", "advice": "Please contact HR manually."}

@app.route('/api/apply', methods=['POST'])
def apply_job():
    try:
        data = request.json
        job_id = data.get('job_id')
        name = data.get('name')
        email = data.get('email')
        resume = data.get('resume') # Changed from message to resume
        
        if not all([job_id, name, email, resume]):
            return jsonify({"error": "Missing required fields"}), 400
            
        # 1. Get Job Details for AI
        job = database.get_job_by_id(job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404
            
        # 2. Perform AI Analysis
        analysis = analyze_resume_with_ai(job.get('requirements', ''), resume)
        score = analysis.get('score', 0)
        
        # 3. Logic based on score
        response_data = {
            "analysis": analysis,
            "status": "applied"
        }
        
        if score < 60:
            # Low match: Don't just save, offer help
            response_data['status'] = 'low_match'
            # Get recommendations (same category but different id)
            recs = database.get_jobs(category=job.get('category'), limit=3)
            response_data['recommendations'] = [r for r in recs if r['id'] != job_id]
        
        # Always save application for now (or optional: only save if > 60)
        database.apply_for_job(job_id, name, email, resume)
        
        return jsonify(response_data)

    except Exception as e:
        print(f"Apply error: {e}")
        return jsonify({"error": {"message": str(e)}}), 500



@app.route('/api/jobs/create', methods=['POST'])
def create_job_route():
    try:
        data = request.json
        # Validate required fields
        required = ['title', 'company', 'salary', 'category', 'location', 'requirements']
        if not all(k in data for k in required):
            return jsonify({"error": "Missing required fields"}), 400
            
        new_id = database.create_job(
            data['title'],
            data['company'],
            data['salary'],
            data['category'],
            data['location'],
            data['requirements']
        )
        
        if new_id:
            return jsonify({"status": "success", "id": new_id})
        else:
            return jsonify({"error": "Database error"}), 500
    except Exception as e:
        return jsonify({"error": {"message": str(e)}}), 500


@app.route('/api/quiz/analyze', methods=['POST'])
def analyze_quiz():
    try:
        data = request.json
        answers = data.get('answers', [])
        
        # Simple AI simulation or Real AI call
        # Let's try to map answers to categories using AI logic if possible, 
        # but for stability, let's use a logic-based mapping first, then maybe AI.
        
        # Construct a prompt for AI
        prompt = f"""
        User Profile based on quiz answers:
        1. Work Environment: {answers[0]}
        2. Key Strength: {answers[1]}
        3. Interest Field: {answers[2]}
        
        Task:
        1. Analyze their personality and career path.
        2. Recommend the best matching Job Category from this list: 
           [IT, Marketing, Admin, Sales, Finance, Design, Engineering, Service, Education]
        3. Provide a short encouraging comment.
        
        Output strictly in JSON:
        {{
            "category": "Marketing", 
            "comment": "You are creative and social...",
            "roles": ["Social Media Manager", "Content Creator"]
        }}
        """
        
        # Call DeepSeek (using the same logic as resume analysis)
        # Reusing the existing API_KEY and logic
        if API_KEY:
            headers = {
                'Authorization': f'Bearer {API_KEY}',
                'Content-Type': 'application/json'
            }
            req_data = {
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"}
            }
            try:
                resp = requests.post(TARGET_URL, json=req_data, headers=headers, timeout=30)
                if resp.status_code == 200:
                    ai_result = resp.json()['choices'][0]['message']['content']
                    result_json = json.loads(ai_result)
                    
                    # Fetch real jobs from DB based on recommended category
                    cat = result_json.get('category', 'General')
                    jobs = database.get_jobs(category=cat, limit=3)
                    
                    return jsonify({
                        "analysis": result_json,
                        "jobs": jobs
                    })
            except Exception as e:
                print(f"AI Quiz failed: {e}")

        # Fallback if AI fails
        return jsonify({
            "analysis": {
                "category": "General",
                "comment": "We think you are open to many opportunities!",
                "roles": ["Management Trainee"]
            },
            "jobs": database.get_jobs(limit=3)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    local_ip = get_local_ip()
    print(f"Starting Flask server on port {PORT}...")
    print(f"✅ Local Access:   http://localhost:{PORT}/job-search.html")
    print(f"📡 Network Access: http://{local_ip}:{PORT}/job-search.html")
    
    app.run(host='0.0.0.0', port=PORT, debug=True)
