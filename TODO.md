# 📌 Project Parking Lot

## 1. The "Ghost Booking" Filter
**Priority:** Medium
**Status:** Pending

**The Problem:** Airbnb and VRBO calendars are cross-synced to prevent double bookings. 
- Airbnb feed contains "Blocked" events that are actually VRBO bookings.
- VRBO feed contains "Blocked" events that are actually Airbnb bookings.
- Current system imports BOTH, resulting in duplicate "Shadow" blocks on the dashboard.

**The Fix:**
Update `sync_runner.py` to inspect the iCal event description/summary.
- If processing Airbnb Feed: Ignore events where description contains "Imported from VRBO" (or similar).
- If processing VRBO Feed: Ignore events where description contains "Imported from Airbnb".

**Goal:** Only import "Native" bookings from each feed so they slot together perfectly without overlap.

## 2. Service Orchestration v2
**Priority:** High
**Status:** Planning

**The Problem:** The current workflow (Kitting -> Field) is linear and basic.
**Needs:**
-   **Complex Dependencies:** Support for parallel jobs, conditional branches, and failure handling.
-   **Resource Scheduling:** Assign staff based on availability and skills.
-   **Inventory Integration:** Deduct inventory when Kitting is complete.
-   **Mobile View:** Specialized view for field staff to see instructions and update status.
-   **Notifications:** Alert staff when jobs are assigned or unblocked.

## 3. Fix Address Comma Accumulation (Database)
**Priority:** Low (band-aid in place)
**Status:** Pending migration

**The Problem:** The `properties_enriched` view concatenates `address || ', ' || city || zip`, causing trailing commas when city/zip are null. Each edit/save cycle accumulates more commas.

**Current Band-Aid:** Frontend trims trailing commas on display (all views) and on form load.

**The Proper Fix:** Apply migration `migrations/fix_properties_enriched_address.sql` to use raw `p.address AS display_address` without concatenation. Then clean up existing corrupted addresses in the database.
