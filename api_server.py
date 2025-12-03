import http.server
import socketserver
import json
import os
import requests
from dotenv import load_dotenv

load_dotenv()

PORT = 8080
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

class AdminRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/create-user':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            email = data.get('email')
            password = data.get('password')
            invite = data.get('invite', False)
            
            if not email:
                self.send_error(400, "Email is required")
                return

            try:
                # Call Supabase Admin API
                headers = {
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                }
                
                if invite:
                    # Invite User (Sends Email)
                    url = f"{SUPABASE_URL}/auth/v1/invite"
                    payload = {"email": email}
                else:
                    # Create User (Manual Password)
                    url = f"{SUPABASE_URL}/auth/v1/admin/users"
                    payload = {
                        "email": email,
                        "password": password or "tempPass123!", # Fallback if empty
                        "email_confirm": True
                    }

                response = requests.post(url, headers=headers, data=json.dumps(payload))
                
                if response.status_code >= 400:
                    self.send_response(response.status_code)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(response.content)
                    return

                user_data = response.json()
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "user": user_data}).encode())
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_error(404)

print(f"🔌 API Server running on port {PORT}")
with socketserver.TCPServer(("", PORT), AdminRequestHandler) as httpd:
    httpd.serve_forever()
