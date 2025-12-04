import os
import boto3
import io
from PIL import Image
from botocore.config import Config
from dotenv import load_dotenv
from queue_worker import compress_and_upload

load_dotenv()

# R2 Configuration
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

def test_worker():
    print("🧪 Testing R2 Worker...")
    
    s3 = get_r2_client()
    test_key = "test_image.jpg"
    
    # 1. Create a dummy large image
    print("   Creating dummy image...")
    img = Image.new('RGB', (2000, 2000), color = 'red')
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=100)
    buf.seek(0)
    
    # 2. Upload to R2
    print(f"   Uploading to R2 ({test_key})...")
    s3.put_object(Bucket=R2_BUCKET_NAME, Key=test_key, Body=buf, ContentType='image/jpeg')
    
    # 3. Run Compress Function
    print("   Running compress_and_upload...")
    try:
        compress_and_upload(999, test_key) # ID doesn't matter for this test part
        print("   ✅ Function returned success.")
    except Exception as e:
        print(f"   ❌ Function failed: {e}")
        return

    # 4. Verify Size Reduced
    print("   Verifying result...")
    obj = s3.get_object(Bucket=R2_BUCKET_NAME, Key=test_key)
    new_size = len(obj['Body'].read())
    print(f"   New Size: {new_size} bytes")
    
    if new_size < 500 * 1024:
        print("   ✅ Image compressed successfully!")
    else:
        print("   ⚠️ Image might not be compressed enough (or was already small).")

    # Cleanup
    # s3.delete_object(Bucket=R2_BUCKET_NAME, Key=test_key)

if __name__ == "__main__":
    test_worker()
