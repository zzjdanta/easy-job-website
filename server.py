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
PORT = int(os.environ.get("PORT", 8000))

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    try:
        location = request.args.get('location')
        salary = request.args.get('salary')
        category = request.args.get('category')
        
        jobs = database.get_jobs(location=location, min_salary=salary, category=category)
        return jsonify(jobs)
    except Exception as e:
        print(f"Error getting jobs: {e}")
        return jsonify({"error": {"message": str(e)}}), 500

@app.route('/api/jobs/<int:job_id>', methods=['GET'])
def get_job_detail(job_id):
    try:
        job = database.get_job_by_id(job_id)
        if job:
            return jsonify(job)
        return jsonify({"error": "Job not found"}), 404
    except Exception as e:
        return jsonify({"error": {"message": str(e)}}), 500

@app.route('/api/jobs/<int:job_id>/apply', methods=['POST'])
def apply_job(job_id):
    try:
        data = request.json
        success = database.apply_for_job(
            job_id, 
            data.get('name'), 
            data.get('email'), 
            data.get('message')
        )
        if success:
            return jsonify({"status": "success"})
        return jsonify({"error": "Failed to save application"}), 500
    except Exception as e:
        return jsonify({"error": {"message": str(e)}}), 500

@app.route('/api/hr/jobs', methods=['POST'])
def post_job():
    try:
        data = request.json
        new_id = database.create_job(
            data.get('title'),
            data.get('company'),
            data.get('salary'),
            data.get('category'),
            data.get('location'),
            data.get('requirements')
        )
        if new_id:
            return jsonify({"status": "success", "id": new_id})
        return jsonify({"error": "Failed to create job"}), 500
    except Exception as e:
        return jsonify({"error": {"message": str(e)}}), 500

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/chat', methods=['POST'])
def proxy_chat():
    if not API_KEY:
        return jsonify({"error": {"message": "Server configuration error: Missing API Key"}}), 401

    try:
        # Get data from frontend
        data = request.json
        user_message = data.get('messages', [])[-1].get('content', '')

        # Save user message to DB
        if user_message:
            database.save_message('user', user_message)

        # Prepare request to DeepSeek
        headers = {
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

        # Stream response from DeepSeek
        resp = requests.post(TARGET_URL, json=data, headers=headers, stream=True)

        if resp.status_code != 200:
            return jsonify({"error": {"message": f"Upstream API Error: {resp.text}"}}), resp.status_code

        def generate():
            ai_response_content = ""
            for chunk in resp.iter_lines():
                if chunk:
                    # Forward the chunk to the client
                    yield chunk + b'\n'
                    
                    # Parse chunk to accumulate AI response for DB
                    try:
                        chunk_str = chunk.decode('utf-8')
                        if chunk_str.startswith('data: ') and chunk_str != 'data: [DONE]':
                            json_str = chunk_str[6:]  # Remove "data: " prefix
                            chunk_data = json.loads(json_str)
                            delta = chunk_data['choices'][0]['delta'].get('content', '')
                            ai_response_content += delta
                    except:
                        pass
            
            # Save AI response to DB after stream finishes
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

# Helper to get local IP
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

if __name__ == '__main__':
    local_ip = get_local_ip()
    print(f"Starting Flask server on port {PORT}...")
    print(f"✅ Local Access:   http://localhost:{PORT}/coach.html")
    print(f"📡 Network Access: http://{local_ip}:{PORT}/coach.html")
    
    # Use 0.0.0.0 to listen on all interfaces
    app.run(host='0.0.0.0', port=PORT, debug=True)
