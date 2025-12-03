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
