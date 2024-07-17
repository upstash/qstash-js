#!/bin/bash

# Check if an argument is provided
if [ $# -eq 0 ]; then
    echo "Please provide a path argument."
    echo "Usage: $0 <path>"
    exit 1
fi

# Store the path argument
path_arg="$1"

# Start ngrok and capture the public URL
ngrok http localhost:3000 --log=stdout > ngrok.log &
NGROK_PID=$!
sleep 5  # Allow some time for ngrok to start

# Extract the ngrok URL from the logs
ngrok_url=$(grep -o 'url=https://[a-zA-Z0-9.-]*\.ngrok-free\.app' ngrok.log | cut -d '=' -f 2 | head -n1)

# Append the path argument to the ngrok URL
full_url="${ngrok_url}/${path_arg}"

# Navigate to the parent directory
cd ../..

# Install dependencies
bun install

# Build the project
bun run build

# Update the URL in the context.ts file
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|this\.url = .*|this.url = '$full_url';|" src/client/workflow/context.ts
else
    sed -i "s|this\.url = .*|this.url = '$full_url';|" src/client/workflow/context.ts
fi

# Navigate to the examples/workflow directory
cd examples/workflow

# Install the local package
npm install @upstash/qstash@file:../../dist

echo "Setup complete. Full URL: $ngrok_url"
echo "ngrok is running. Press Ctrl+C to stop it."

# Wait for ngrok to be manually stopped
wait $NGROK_PID
