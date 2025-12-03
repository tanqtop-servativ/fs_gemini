#!/usr/bin/env python3
import requests
import psycopg2
import time
from datetime import datetime, timedelta

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- CONFIGURATION ---
DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")
HCP_API_KEY = os.getenv("HCP_API_KEY")

if not DB_CONNECTION_STRING:
    raise ValueError("DB_CONNECTION_STRING not found in environment variables.")
if not HCP_API_KEY:
    raise ValueError("HCP_API_KEY not found in environment variables.")

def fetch_hcp_jobs():
    conn = None
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        print("✅ Connected to Database")

        # 1. Get ONLY the Customers we care about
        cur.execute("SELECT DISTINCT hcp_customer_id FROM properties WHERE hcp_customer_id IS NOT NULL AND hcp_customer_id != ''")
        customers = cur.fetchall()
        
        if not customers:
            print("⚠️ No HCP Customer IDs found in properties table. Nothing to sync.")
            return

        print(f"🎯 Syncing jobs for {len(customers)} specific customers:")
        for c in customers:
            print(f"   - {c[0]}")
        print("---------------------------------------------------")
        
        url = "https://api.housecallpro.com/jobs"
        headers = {
            "Authorization": f"Token {HCP_API_KEY}",
            "Accept": "application/json"
        }
        
        total_synced = 0

        for row in customers:
            cust_id = row[0]
            print(f"   ► Checking Customer: {cust_id}...")
            total_synced_start = total_synced
            
            page = 1
            while True:
                # Filter by SPECIFIC CUSTOMER
                params = {
                    "page": page,
                    "page_size": 30, # Smaller batch is fine for single customer
                    "customer_id": cust_id, # <--- THE CRITICAL FILTER
                    "scheduled_start_min": (datetime.now() - timedelta(days=30)).isoformat()
                }
                
                try:
                    response = requests.get(url, headers=headers, params=params)
                    
                    if response.status_code == 429:
                        print("      ⏳ Rate Limit hit. Sleeping 10s...")
                        time.sleep(10)
                        continue # Retry
                    
                    if response.status_code != 200:
                        print(f"      ❌ API Error: {response.text}")
                        break

                    data = response.json()
                    jobs = data.get('jobs', [])
                    
                    if not jobs:
                        break 

                    # Upsert Logic
                    for job in jobs:
                        job_id = job.get('id')
                        addr_id = job.get('address', {}).get('id')
                        desc = job.get('description')
                        schedule = job.get('schedule', {})
                        start = schedule.get('scheduled_start')
                        end = schedule.get('scheduled_end')
                        status = job.get('job_status')
                        work_status = job.get('work_status')
                        total = job.get('total_amount_cents')

                        sql = """
                            INSERT INTO hcp_jobs (id, customer_id, address_id, description, scheduled_start, scheduled_end, status, work_status, total_amount_cents, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                            ON CONFLICT (id) DO UPDATE 
                            SET 
                                description = EXCLUDED.description,
                                scheduled_start = EXCLUDED.scheduled_start,
                                scheduled_end = EXCLUDED.scheduled_end,
                                status = EXCLUDED.status,
                                work_status = EXCLUDED.work_status,
                                total_amount_cents = EXCLUDED.total_amount_cents,
                                updated_at = NOW();
                        """
                        cur.execute(sql, (job_id, cust_id, addr_id, desc, start, end, status, work_status, total))
                        total_synced += 1
                    
                    # Check next page for THIS customer
                    if page >= data.get('total_pages', 1):
                        break
                    page += 1
                    
                    # Be nice to the API
                    time.sleep(0.2) 

                except Exception as e:
                    print(f"      ❌ Error processing page {page}: {e}")
                    break
            
            # Commit after EACH customer to save progress
            conn.commit()
            print(f"      ✅ Saved {total_synced - (total_synced_start if 'total_synced_start' in locals() else 0)} jobs for this customer.")

        print(f"🎉 Sync Complete. Total relevant jobs upserted: {total_synced}")

    except Exception as e:
        print(f"❌ Critical Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    fetch_hcp_jobs()
