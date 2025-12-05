---
description: Run End-to-End (E2E) tests for the web application
---

This workflow runs a basic sanity check on the web application using the browser subagent.

1.  **Check Server Status**:
    Ensure the web server is running.
    ```bash
    curl -I http://localhost:8080
    ```
    If the server is not running, start it:
    ```bash
    venv/bin/python api_server.py &
    ```

2.  **Browser Interaction**:
    Use the `browser_subagent` to perform the following:
    -   Navigate to `http://localhost:8080`.
    -   Verify the page loads successfully.
    -   Check for the presence of key elements (e.g., "Job Templates", "BOM Templates").
    -   Take a screenshot of the homepage.

    Task for subagent:
    "Navigate to http://localhost:8080. Log in using email 'admin@example.com' and password 'admin123'. Verify that the page loads and contains the text 'Job Templates'. Take a screenshot named 'homepage_verification'."
