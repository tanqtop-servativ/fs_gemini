#!/usr/bin/env python3
import psycopg2
import requests
from ics import Calendar
import json
import re
import os
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---
DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

if not DB_CONNECTION_STRING:
    raise ValueError("DB_CONNECTION_STRING not found in environment variables.")

def fetch_and_parse():
    conn = None
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        print("✅ Connected to Database")

        # CHANGED: Now we fetch FEEDS, not just properties
        cur.execute("SELECT id, name, url, property_id FROM calendar_feeds")
        feeds = cur.fetchall()

        if not feeds:
            print("⚠️ No calendar feeds found.")

        for feed in feeds:
            feed_id, feed_name, url, prop_id = feed
            print(f"🔄 Processing Feed #{feed_id}: {feed_name}...")

            try:
                headers = { 'User-Agent': 'Mozilla/5.0 ...' }
                response = requests.get(url, headers=headers)
                response.raise_for_status() 
                
                c = Calendar(response.text)
                
                events_payload = []
                for event in c.events:
                    desc = event.description if event.description else ""
                    
                    code = None
                    match = re.search(r'reservations/details/([A-Z0-9]+)', desc)
                    if match: code = match.group(1)

                    events_payload.append({
                        'uid': event.uid,
                        'start': event.begin.isoformat(),
                        'end': event.end.isoformat(),
                        'summary': event.name,
                        'description': desc,
                        'conf_code': code
                    })

                print(f"   found {len(events_payload)} events. Syncing...")
                
                # CHANGED: We pass feed_id now
                # Use SELECT because sync_ical_data is a FUNCTION, not a PROCEDURE
                cur.execute("SELECT sync_ical_data(%s, %s)", (feed_id, json.dumps(events_payload)))
                conn.commit() 
                print("   ✅ Synced.")

            except Exception as e:
                conn.rollback() # Reset transaction so next feed can be processed
                print(f"   ❌ Error fetching feed: {e}")

    except Exception as e:
        print(f"❌ Critical Database Error: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    fetch_and_parse()
