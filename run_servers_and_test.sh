#!/bin/bash
# Ensuring executable permission for run_servers.sh
chmod +x run_servers.sh

# Start servers
./run_servers.sh &
SERVERS_PID=$!


# Run bun test
echo "Running tests..."
bun test

# Kill the server processes and any child processes
echo "Killing server processes and their children..."
pkill -P $SERVERS_PID
kill -9 $SERVERS_PID  # Using SIGKILL to ensure termination

wait $SERVERS_PID  # Ensure processes have terminated
echo "All processes terminated."