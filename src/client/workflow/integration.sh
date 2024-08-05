#!/bin/bash

# Check if enough arguments are provided
if [ $# -lt 2 ]; then
    echo "Please provide two arguments: MOCK_QSTASH_URL and MOCK_QSTASH_TOKEN."
    echo "Usage: $0 <MOCK_QSTASH_URL> <MOCK_QSTASH_TOKEN>"
    exit 1
fi

# Store the provided arguments
MOCK_QSTASH_URL="$1"
MOCK_QSTASH_TOKEN="$2"

echo "INFO: starting ngrok tunnel"

# Start ngrok with the provided configuration file
ngrok start --all --config integration.yml --log=stdout > ngrok.log &
NGROK_PID=$!
sleep 5  # Allow some time for ngrok to start

echo "INFO: ngrok tunnel started."

# Extract the ngrok URLs from the logs
ngrok_url_3000=$(grep -o 'url=https://[a-zA-Z0-9.-]*\.ngrok-free\.app' ngrok.log | grep -m 1 -o 'https://[a-zA-Z0-9.-]*\.ngrok-free\.app' | head -n1)
ngrok_url_3001=$(grep -o 'url=https://[a-zA-Z0-9.-]*\.ngrok-free\.app' ngrok.log | grep -m 2 -o 'https://[a-zA-Z0-9.-]*\.ngrok-free\.app' | tail -n1)


# Update the integration.test.ts file
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's/\.skip//g' integration.test.ts
    sed -i '' "s|const LOCAL_WORKFLOW_URL = .*|const LOCAL_WORKFLOW_URL = '$ngrok_url_3000';|" integration.test.ts
    sed -i '' "s|const LOCAL_THIRD_PARTY_URL = .*|const LOCAL_THIRD_PARTY_URL = '$ngrok_url_3001';|" integration.test.ts
else
    sed -i 's/\.skip//g' integration.test.ts
    sed -i "s|const LOCAL_WORKFLOW_URL = .*|const LOCAL_WORKFLOW_URL = '$ngrok_url_3000';|" integration.test.ts
    sed -i "s|const LOCAL_THIRD_PARTY_URL = .*|const LOCAL_THIRD_PARTY_URL = '$ngrok_url_3001';|" integration.test.ts
fi

echo "INFO: integration.test.ts updated."

# Set environment variables
export MOCK_QSTASH_URL="$MOCK_QSTASH_URL"
export MOCK_QSTASH_TOKEN="$MOCK_QSTASH_TOKEN"

echo "INFO: running tests."

# Run integration tests
bun test integration.test.ts --bail

# Wait for ngrok process to be manually stopped
wait $NGROK_PID
