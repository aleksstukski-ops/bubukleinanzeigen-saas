import sys
import json
import subprocess

result = subprocess.run(['/Applications/Docker.app/Contents/Resources/bin/docker', 'compose', 'ps', '--format', 'json'], capture_output=True, text=True)

if result.returncode == 0:
    for line in result.stdout.split('\n'):
        if line.strip():
            j = json.loads(line)
            print(f"{j['Name']}: {j['State']} {j.get('Health', '')}")
else:
    print("Error: Unable to get docker compose status")