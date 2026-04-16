#!/usr/bin/env python3
import subprocess
import json
import sys
import os
from datetime import datetime

timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# Check Docker containers
try:
    # Try to use the Docker Desktop path
    docker_path = '/Applications/Docker.app/Contents/Resources/bin/docker'
    compose_result = subprocess.run([docker_path, 'compose', 'ps', '--format', 'json'], 
                                  capture_output=True, text=True, timeout=30)
    
    if compose_result.returncode != 0:
        print(f"🚨 [{timestamp}] CHECK1")
        print(f"Symptom: Docker compose command failed")
        print(f"Output: {compose_result.stderr.strip()}")
        print(f"Betroffen: Docker Compose")
        sys.exit(1)
    
    containers = []
    has_problems = False
    
    for line in compose_result.stdout.strip().split('\n'):
        if line.strip():
            try:
                container = json.loads(line)
                name = container.get('Name', 'unknown')
                state = container.get('State', 'unknown')
                health = container.get('Health', '')
                
                containers.append(f"{name}: {state} {health}")
                
                # Check for problems
                if state.lower() != 'up':
                    has_problems = True
                    
                if 'unhealthy' in health.lower():
                    has_problems = True
                    
            except json.JSONDecodeError:
                pass
    
    if has_problems:
        print(f"🚨 [{timestamp}] CHECK1")
        print("Symptom: Docker containers not running or unhealthy")
        print("Output:")
        for container in containers:
            print(f"  {container}")
        print("Betroffen: Docker Compose")
        sys.exit(1)
        
    print("Docker containers OK")
    
except Exception as e:
    print(f"🚨 [{timestamp}] CHECK1")
    print(f"Symptom: Docker check failed")
    print(f"Output: {str(e)}")
    print("Betroffen: Docker Compose")
    sys.exit(1)

# Check API health
try:
    import requests
    response = requests.get('http://localhost:8000/api/health', timeout=10)
    
    if response.status_code != 200:
        print(f"🚨 [{timestamp}] CHECK1")
        print(f"Symptom: API health endpoint returned {response.status_code}")
        print(f"Output: {response.text}")
        print("Betroffen: API Backend")
        sys.exit(1)
    
    health_data = response.json()
    if not health_data.get('status') == 'ok':
        print(f"🚨 [{timestamp}] CHECK1")
        print(f"Symptom: API health status is not OK")
        print(f"Output: {health_data}")
        print("Betroffen: API Backend")
        sys.exit(1)
    
    print("API health OK")
    
except Exception as e:
    print(f"🚨 [{timestamp}] CHECK1")
    print(f"Symptom: API health check failed")
    print(f"Output: {str(e)}")
    print("Betroffen: API Backend")
    sys.exit(1)

print("All systems OK")