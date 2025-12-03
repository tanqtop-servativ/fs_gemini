#!/usr/bin/env python3
import psycopg2
import json
import requests
import os
import io
from PIL import Image

# --- CONFIGURATION ---
DB_CONNECTION_STRING = "postgresql://postgres:z5yvNT+Qkya6L5tJ8nTXyWGy<W7h_VKugE}@db.bittvioqzhfqfsdbuxvd.supabase.co:5432/postgres"
HCP_API_KEY = "8b2875acc9794a8cb6d689267a53a2c7"

# --- SUPABASE SERVICE KEY (REQUIRED FOR STORAGE WRITE) ---
# You must fill this in from Supabase Dashboard -> Settings -> API -> service_role
SUPABASE_URL = "https://bittvioqzhfqfsdbuxvd.supabase.co"
SUPABASE_SERVICE_KEY = "YOUR_SERVICE_ROLE_KEY_HERE" 

def compress_and_upload(photo_id, storage_path):
    print(f"     🎨 Compressing: {storage_path}")
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }

    # 1. Download Original
    download_url = f"{SUPABASE_URL}/storage/v1/object/properties/{storage_path}"
    resp = requests.get(download_url) # Public bucket, no auth needed to read usually
    if resp.status_code != 200:
        # Try with auth if bucket is private
        resp = requests.get(download_url, headers=headers)
        if resp.status_code != 200:
            raise Exception(f"Download Failed: {resp.status_code}")

    # 2. Compress with PIL
    img_bytes = io.BytesIO(resp.content)
    img = Image.open(img_bytes)
    
    # Convert RGBA (PNG) to RGB (JPG) if needed
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    # Resize loop
    output_io = io.BytesIO()
    quality = 85
    while True:
        output_io.seek(0)
        output_io.truncate()
        img.save(output_io, format="JPEG", quality=quality)
        size_kb = output_io.tell() / 1024
        
        if size_kb <= 500 or quality <= 30:
            break
        quality -= 10

    print(f"     📉 Compressed to {int(size_kb)}KB (Q={quality})")

    # 3. Re-Upload (Overwrite)
    # Supabase requires 'x-upsert: true' header to overwrite
    upload_headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "image/jpeg",
        "x-upsert": "true"
    }
    output_io.seek(0)
    up_resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/properties/{storage_path}", 
        headers=upload_headers, 
        data=output_io
    )
    
    if up_resp.status_code not in [200, 201]:
        raise Exception(f"Upload Failed: {up_resp.text}")

    return True

def process_queue():
    conn = None
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        print("✅ Worker Connected")

        # Fetch PENDING jobs
        cur.execute("SELECT id, action_type, payload FROM job_queue WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT 5")
        jobs = cur.fetchall()

        if not jobs:
            print("💤 No pending jobs.")
            return

        print(f"⚡ Processing {len(jobs)} jobs...")

        for job in jobs:
            queue_id, action, payload = job
            print(f"  ► Job #{queue_id}: {action}")

            try:
                result_note = ""

                if action == 'COMPRESS_PHOTO':
                    photo_id = payload.get('photo_id')
                    path = payload.get('storage_path')
                    compress_and_upload(photo_id, path)
                    
                    # Update DB Status
                    cur.execute("UPDATE property_reference_photos SET compression_status = 'completed' WHERE id = %s", (photo_id,))
                    result_note = "Compressed successfully"

                elif action == 'CREATE_JOB':
                    # ... (Your existing HCP logic) ...
                    result_note = "Job Created (Mock)"

                # Mark Complete
                cur.execute("UPDATE job_queue SET status = 'COMPLETED', processed_at = NOW(), error_message = %s WHERE id = %s", (result_note, queue_id))
                conn.commit()

            except Exception as e:
                print(f"     ❌ Failed: {e}")
                cur.execute("UPDATE job_queue SET status = 'FAILED', error_message = %s, processed_at = NOW() WHERE id = %s", (str(e), queue_id))
                conn.commit()

    except Exception as e:
        print(f"❌ Critical Error: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    process_queue()
