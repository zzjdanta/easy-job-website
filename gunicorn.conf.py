import os

# Render sets the PORT environment variable
port = os.environ.get("PORT", "8000")
bind = "0.0.0.0:" + port

# Worker configuration
workers = 2
threads = 4
timeout = 120
