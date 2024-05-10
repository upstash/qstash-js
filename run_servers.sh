#!/bin/bash
PORT=4000

# Check if the port is currently in use and kill the processes using it
lsof -ti:$PORT | xargs kill -9

# Export the PORT environment variable for use in processes
export PORT=$PORT

# Start the proxy server in the background
echo "Starting the proxy server..."
bun run proxy-server/server.ts &
SERVER_PID=$!

# Start the tunnel
echo "Starting the tunnel..."
lt --subdomain cookie-jar-103-181-222-27 --port $PORT &
TUNNEL_PID=$!

# Wait for both processes to finish
wait $SERVER_PID
wait $TUNNEL_PID
