#!/bin/bash

# BubuKleinanzeigen Health Check Script
# Führt CHECK1 durch und meldet Probleme an Chef

# Pfad zum Projekt
PROJECT_DIR="/Users/miniagent/Projects/bubukleinanzeigen-saas"
cd "$PROJECT_DIR"

# Temporäre Log Datei
LOG_FILE="/tmp/health_check_$(date +%Y%m%d_%H%M%S).log"
ERROR_LOG="/tmp/health_check_error_$(date +%Y%m%d_%H%M%S).log"

# Funktion zur Fehlermeldung an Chef
send_alert() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local symptom="$1"
    local output="$2"
    local container="$3"
    
    local message="🚨 [$timestamp] CHECK1\nSymptom: $symptom\nOutput: $output\nBetroffen: $container"
    
    # Schreibe in Log Datei
    echo "$message" | tee -a "$ERROR_LOG"
    
    # Sende an Chef (über Notification Script oder direkt)
    # TODO: Hier kann eine Benachrichtigungsmethode hinzugefügt werden
    # z.B. über Telegram, Slack oder E-Mail
    echo "$message"
}

# CHECK 1: Docker Compose Status
echo "=== CHECK 1: Docker Container Status ===" > "$LOG_FILE"
DOCKER_STATUS=$(docker compose ps --format json 2>/dev/null)
if [ $? -ne 0 ]; then
    send_alert "Docker Compose Fehler" "docker compose fehlgeschlagen" "alle Container"
    exit 1
fi

echo "$DOCKER_STATUS" | python3 -c "
import sys, json
try:
    containers = [json.loads(l) for l in sys.stdin if l.strip()]
    for container in containers:
        name = container['Name']
        state = container['State']
        health = container.get('Health', '')
        
        print(f'{name}: {state} {health}')
        
        # Prüfe ob Container nicht running ist
        if state.lower() != 'running':
            print(f'ERROR: Container {name} ist nicht im Zustand running', file=sys.stderr)
            exit(1)
        
        # Prüfe Health Status (wenn vorhanden)
        if health and health.lower() != 'healthy':
            print(f'ERROR: Container {name} Health Status ist nicht healthy: {health}', file=sys.stderr)
            exit(1)
except Exception as e:
    print(f'ERROR bei Docker Status Auswertung: {e}', file=sys.stderr)
    exit(1)
" >> "$LOG_FILE" 2>> "$LOG_FILE"

if [ $? -ne 0 ]; then
    ERROR_OUTPUT=$(tail -5 "$LOG_FILE" | grep "ERROR" | tail -1)
    send_alert "Docker Container Problem" "$ERROR_OUTPUT" "Docker Container"
    exit 1
fi

# CHECK 2: API Health Endpunkt
echo -e "\n=== CHECK 2: API Health Endpunkt ===" >> "$LOG_FILE"
API_RESPONSE=$(curl -s http://localhost:8000/api/health 2>> "$LOG_FILE")
API_STATUS=$?

if [ $API_STATUS -ne 0 ]; then
    send_alert "API Health Endpunkt nicht erreichbar" "curl Fehler: $API_STATUS" "backend"
    exit 1
fi

# Prüfe API Response (wenn JSON)
if echo "$API_RESPONSE" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
    IS_HEALTHY=$(echo "$API_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('healthy', False))")
    if [ "$IS_HEALTHY" != "true" ]; then
        send_alert "API Health Status nicht healthy" "$API_RESPONSE" "backend"
        exit 1
    fi
else
    send_alert "API Response ist kein valides JSON" "$API_RESPONSE" "backend"
    exit 1
fi

echo "API Health Check erfolgreich: $API_RESPONSE" >> "$LOG_FILE"

# Alles OK, exit 0
echo "Alle Checks erfolgreich! $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
exit 0