#!/bin/bash

# Check if an argument is provided
if [ $# -eq 0 ]; then
    echo "Please provide a path argument."
    echo "Usage: $0 <path>"
    exit 1
fi

# store project argument
project_arg="$1"

# Store the path argument
path_arg="$2"

# Start ngrok and capture the public URL
ngrok http localhost:3001 --log=stdout > ngrok.log &
NGROK_PID=$!
sleep 5  # Allow some time for ngrok to start

# Extract the ngrok URL from the logs
ngrok_url=$(grep -o 'url=https://[a-zA-Z0-9.-]*\.ngrok-free\.app' ngrok.log | cut -d '=' -f 2 | head -n1)

# Append the path argument to the ngrok URL
if [ "$project_arg" == "nuxt" ]; then
    full_url="${ngrok_url}/api/${path_arg}"
else
    full_url="${ngrok_url}/${path_arg}"
fi

# Navigate to the parent directory
cd ../..


# Update the URL in the context.ts file
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|this\.url = .*|this.url = '$full_url';|" src/client/workflow/context.ts
else
    sed -i "s|this\.url = .*|this.url = '$full_url';|" src/client/workflow/context.ts
fi

# Install dependencies
bun install

# Build the project
bun run build

# Navigate to the examples/workflow directory
cd examples/workflow/${project_arg}

# Install the local package
npm install @upstash/qstash@file:../../../dist

final_path=$ngrok_url?function=$path_arg
echo "Setup complete. Full URL: $final_path"
echo "ngrok is running. Press Ctrl+C to stop it."


# Open the URL in Chrome
if [[ "$OSTYPE" == "darwin"* ]]; then
    open -a "Google Chrome" "$final_path"
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

# Start next.js server
npm run dev
# Wait for ngrok to be manually stopped
wait $NGROK_PID
