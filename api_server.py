import http.server
import socketserver
import json
import os
import requests
import boto3
from botocore.config import Config
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv

load_dotenv()

PORT = 8080
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# R2 Configuration
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_PUBLIC_DOMAIN = os.getenv("R2_PUBLIC_DOMAIN")

def get_r2_client():
    if not R2_ACCOUNT_ID or not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY:
        print("❌ Missing R2 Credentials")
        return None
    
    return boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto' # Must be one of: wnam, enam, weur, eeur, apac, auto
    )

class AdminRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/generate-upload-url':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            filename = data.get('filename')
            content_type = data.get('contentType')
            
            if not filename or not content_type:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'Missing filename or contentType')
                return

            s3 = get_r2_client()
            if not s3:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b'R2 Misconfigured')
                return

            try:
                # Generate Presigned URL
                upload_url = s3.generate_presigned_url(
                    'put_object',
                    Params={
                        'Bucket': R2_BUCKET_NAME,
                        'Key': filename,
                        'ContentType': content_type
                    },
                    ExpiresIn=3600
                )
                
                public_url = f"{R2_PUBLIC_DOMAIN}/{filename}"
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'uploadUrl': upload_url,
                    'publicUrl': public_url
                }).encode('utf-8'))
                
            except Exception as e:
                print(f"Error generating R2 URL: {e}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))

        elif self.path == '/create-user':
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
