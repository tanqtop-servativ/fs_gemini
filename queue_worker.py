#!/usr/bin/env python3
import psycopg2
import json
import requests
import os
import io
import boto3
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()
from PIL import Image

# --- CONFIGURATION ---
# --- CONFIGURATION ---
DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")
HCP_API_KEY = os.getenv("HCP_API_KEY")

# --- R2 CONFIGURATION ---
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")

def get_r2_client():
    return boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )

def compress_and_upload(photo_id, storage_path):
    print(f"     🎨 Compressing: {storage_path}")
    
    s3 = get_r2_client()

    # 1. Download Original
    try:
        obj = s3.get_object(Bucket=R2_BUCKET_NAME, Key=storage_path)
        img_bytes = io.BytesIO(obj['Body'].read())
    except Exception as e:
        raise Exception(f"Download Failed: {e}")

    # 2. Compress with PIL
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
    output_io.seek(0)
    try:
        s3.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=storage_path,
            Body=output_io,
            ContentType='image/jpeg'
        )
    except Exception as e:
        raise Exception(f"Upload Failed: {e}")

    return True

def process_queue():
    conn = None
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        print("✅ Worker Connected")

        # Fetch ONE pending job with locking
        # Using FOR UPDATE SKIP LOCKED to allow multiple workers
        cur.execute("""
            SELECT id, action_type, payload, attempts, max_attempts 
            FROM job_queue 
            WHERE status = 'PENDING' 
              AND run_after <= NOW()
            ORDER BY priority DESC, run_after ASC 
            LIMIT 1 
            FOR UPDATE SKIP LOCKED
        """)
        job = cur.fetchone()

        if not job:
            print("💤 No pending jobs.")
            return

        queue_id, action, payload, attempts, max_attempts = job
        print(f"⚡ Processing Job #{queue_id}: {action} (Attempt {attempts + 1}/{max_attempts})")

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
            cur.execute("""
                UPDATE job_queue 
                SET status = 'COMPLETED', 
                    processed_at = NOW(), 
                    error_message = %s,
                    attempts = attempts + 1
                WHERE id = %s
            """, (result_note, queue_id))
            conn.commit()
            print(f"  ✅ Job #{queue_id} Completed")

        except Exception as e:
            print(f"  ❌ Job #{queue_id} Failed: {e}")
            
            # Retry Logic
            new_attempts = attempts + 1
            if new_attempts < max_attempts:
                # Schedule Retry (Exponential Backoff: 1m, 2m, 4m...)
                backoff_minutes = 2 ** (new_attempts - 1)
                cur.execute("""
                    UPDATE job_queue 
                    SET attempts = %s,
                        run_after = NOW() + (INTERVAL '1 minute' * %s),
                        error_message = %s
                    WHERE id = %s
                """, (new_attempts, backoff_minutes, str(e), queue_id))
                print(f"     -> Retrying in {backoff_minutes} minutes...")
            else:
                # Mark Failed
                cur.execute("""
                    UPDATE job_queue 
                    SET status = 'FAILED', 
                        attempts = %s,
                        processed_at = NOW(), 
                        error_message = %s 
                    WHERE id = %s
                """, (new_attempts, str(e), queue_id))
                print(f"     -> Marked as FAILED (Max attempts reached)")
            
            conn.commit()

    except Exception as e:
        print(f"❌ Critical Error: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    # Run in a loop or just once? The original ran once.
    # Usually workers run in a loop. Let's keep it running once for now as per original, 
    # but typically you'd want `while True: process_queue(); time.sleep(5)`
    process_queue()
