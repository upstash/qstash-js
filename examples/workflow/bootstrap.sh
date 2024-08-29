#!/bin/bash

set -e

# Check if an argument is provided
if [ $# -eq 0 ]; then
    echo "Please provide a path argument."
    echo "Usage: $0 <path>"
    exit 1
fi

# store project argument
project_arg="$1"

# install dependencies
cd $project_arg
npm install
cd ..

# Start ngrok and capture the public URL
ngrok http localhost:3001 --log=stdout > ngrok.log &
NGROK_PID=$!
sleep 5  # Allow some time for ngrok to start

# Extract the ngrok URL from the logs
ngrok_url=$(grep -o 'url=https://[a-zA-Z0-9.-]*\.ngrok-free\.app' ngrok.log | cut -d '=' -f 2 | head -n1)
export UPSTASH_WORKFLOW_URL=$ngrok_url

final_path=$ngrok_url
echo "Setup complete. Full URL: $final_path"
echo "ngrok is running. Press Ctrl+C to stop it."


# Open the URL in Chrome
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$final_path"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "$final_path"
elif [[ "$OSTYPE" == "cygwin" ]]; then
    cygstart "$final_path"
elif [[ "$OSTYPE" == "msys" ]]; then
    start "$final_path"
elif [[ "$OSTYPE" == "win32" ]]; then
    start "$final_path"
else
    echo "Unsupported OS type: $OSTYPE"
fi

# go to project directory
cd $project_arg

# Start next.js server
npm run dev
# Wait for ngrok to be manually stopped
wait $NGROK_PID
