#!/usr/bin/env python3
import requests
import json

# Test API health
try:
    response = requests.get('http://localhost:8000/api/health', timeout=5)
    api_health = response.json()
    print(f"API Health: {api_health}")
except Exception as e:
    print(f"API Health Error: {e}")

# Test database connectivity
try:
    import psycopg2
    conn = psycopg2.connect(
        host='localhost',
        port='5432',
        database='bubukleinanzeigen',
        user='bubu',
        password='bubu_dev'
    )
    cur = conn.cursor()
    cur.execute("SELECT 1")
    result = cur.fetchone()
    print(f"PostgreSQL: Connected successfully")
    cur.close()
    conn.close()
except Exception as e:
    print(f"PostgreSQL: Connection failed - {e}")

# Test Redis connectivity
try:
    import redis
    r = redis.Redis(host='localhost', port=6379)
    r.ping()
    print(f"Redis: Connected successfully")
except Exception as e:
    print(f"Redis: Connection failed - {e}")