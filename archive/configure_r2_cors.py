import os
import boto3
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()

# R2 Configuration
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")

def configure_cors():
    if not R2_ACCOUNT_ID or not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY:
        print("❌ Missing R2 Credentials")
        return

    print(f"Connecting to R2 Bucket: {R2_BUCKET_NAME}...")
    
    s3 = boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )

    cors_configuration = {
        'CORSRules': [{
            'AllowedHeaders': ['*'],
            'AllowedMethods': ['GET', 'PUT', 'HEAD', 'POST', 'DELETE'],
            'AllowedOrigins': ['*'], # Allow all for development/testing
            'ExposeHeaders': ['ETag'],
            'MaxAgeSeconds': 3000
        }]
    }

    try:
        s3.put_bucket_cors(Bucket=R2_BUCKET_NAME, CORSConfiguration=cors_configuration)
        print("✅ CORS configuration applied successfully!")
        print("   - Allowed Origins: *")
        print("   - Allowed Methods: GET, PUT, HEAD, POST, DELETE")
        print("   - Allowed Headers: *")
    except Exception as e:
        print(f"❌ Error applying CORS: {e}")

if __name__ == "__main__":
    configure_cors()
