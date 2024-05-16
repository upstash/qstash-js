#!/bin/bash

handle_error() {
    echo "Error: npm command failed."
    exit 1
}

pnpm run start &
NPM_PID=$!


sleep 5

# Check if the npm command is still running
if ps -p $NPM_PID > /dev/null; then
    echo "wrangler succeeded. Killing the process and continuing..."
    kill $NPM_PID
else
    handle_error
fi


echo "Script completed successfully."