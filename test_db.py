import psycopg2
import sys

# 数据库连接配置 (Supabase Connection Pooler)
DB_HOST = "aws-1-ap-southeast-1.pooler.supabase.com"
DB_NAME = "postgres"
DB_USER = "postgres.ylpzdegpjbkrhfbqcbvc"
DB_PASS = "Danta0902%4012"
DB_PORT = "6543"

DB_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
DB_SSL_MODE = "require"

print(f"Testing connection to: {DB_HOST}:{DB_PORT}...")

try:
    conn = psycopg2.connect(DB_URL, sslmode=DB_SSL_MODE)
    print("✅ Connection successful!")
    
    # Test a simple query
    cur = conn.cursor()
    cur.execute("SELECT 1;")
    result = cur.fetchone()
    print(f"✅ Query result: {result}")
    
    conn.close()
    sys.exit(0)
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)
