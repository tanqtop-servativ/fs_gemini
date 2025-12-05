
import requests
import json

def test_upload():
    url = 'http://localhost:8080/generate-upload-url'
    payload = {
        'filename': 'test_upload_file.txt',
        'contentType': 'text/plain'
    }
    
    print(f"Requesting upload URL from {url}...")
    try:
        response = requests.post(url, json=payload)
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Is it running?")
        return

    if response.status_code != 200:
        print(f"❌ Failed to get upload URL. Status: {response.status_code}")
        print(f"Response: {response.text}")
        return

    try:
        data = response.json()
    except json.JSONDecodeError:
        print(f"❌ Invalid JSON response: {response.text}")
        return

    upload_url = data.get('uploadUrl')
    public_url = data.get('publicUrl')
    
    print(f"Upload URL: {upload_url[:50]}..." if upload_url else "Upload URL: None")
    print(f"Public URL: {public_url}")

    if not upload_url:
        print("❌ No uploadUrl received")
        return

    print("Attempting to PUT file to R2...")
    try:
        put_response = requests.put(upload_url, data="This is a test file content.", headers={'Content-Type': 'text/plain'})
        
        if put_response.status_code == 200:
            print("✅ Upload successful!")
        else:
            print(f"❌ Upload failed. Status: {put_response.status_code}")
            print(f"Response: {put_response.text}")
    except Exception as e:
        print(f"❌ Error during PUT: {e}")

if __name__ == "__main__":
    test_upload()
