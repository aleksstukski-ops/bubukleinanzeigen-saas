import sys
import json
import os

# Run docker compose ps and capture output
import subprocess
result = subprocess.run(['docker', 'compose', 'ps', '--format', 'json'], capture_output=True, text=True, env={**dict(os.environ), 'PATH': '/Applications/Docker.app/Contents/Resources/bin:' + os.environ.get('PATH', '')})

if result.returncode != 0:
    print('Docker command failed:', result.stderr)
    sys.exit(1)

# Parse and display each container
for line in result.stdout.strip().split('\n'):
    if line.strip():
        try:
            container = json.loads(line)
            name = container.get('Name', 'unknown')
            state = container.get('State', 'unknown')
            health = container.get('Health', '')
            print(f'{name}: {state} {health}')
            
            # Check for problems
            if state.lower() != 'up':
                print(f'PROBLEM: Container {name} is not UP')
                sys.exit(1)
                
            if 'unhealthy' in health.lower():
                print(f'PROBLEM: Container {name} is unhealthy')
                sys.exit(1)
                
        except json.JSONDecodeError:
            print(f'Could not parse JSON: {line}')
            sys.exit(1)

print('All containers are healthy')