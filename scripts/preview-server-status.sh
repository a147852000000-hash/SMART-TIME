#!/usr/bin/env bash
# SMART-TIME preview server status / restart helper (platform-safe daemonization).
# Lives inside the repo so it survives sandbox recycles — restore the external
# copy from here after any reset:
#   mkdir -p /home/z/my-project/scripts
#   cp scripts/preview-server-status.sh /home/z/my-project/scripts/st-server-status.sh
if curl -s -m 3 http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "SMART-TIME server: UP"
else
  echo "SMART-TIME server: DOWN — restarting via detached spawn..."
  node "$(dirname "$0")/preview-spawn-server.cjs"
  sleep 4
  curl -s -m 3 http://localhost:3000/api/health >/dev/null 2>&1 && echo "restarted: UP" || echo "restart FAILED"
fi
