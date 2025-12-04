import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

def verify_query():
    print("🧪 Verifying Frontend Query...")
    
    # Fetch the most recent opportunity (which should have tasks)
    opps = supabase.table('service_opportunities').select('id').order('id', desc=True).limit(1).execute()
    if not opps.data:
        print("❌ No opportunities found.")
        return

    opp_id = opps.data[0]['id']
    print(f"   Checking Opportunity ID: {opp_id}")

    # Run the exact query from frontend
    response = supabase.table('jobs').select('*, job_tasks (id, title, status)').eq('service_opportunity_id', opp_id).execute()
    
    if response.data:
        for job in response.data:
            print(f"   Job {job['id']} ({job['type']}):")
            tasks = job.get('job_tasks', [])
            if tasks:
                for t in tasks:
                    print(f"     - {t['title']} ({t['status']})")
            else:
                print("     (No tasks)")
    else:
        print("❌ No jobs found.")

if __name__ == "__main__":
    verify_query()
