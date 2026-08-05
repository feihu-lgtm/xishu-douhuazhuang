#!/bin/bash
cd "$(dirname "$0")" || exit 1
port=8742
echo "鱼定村小馆 · 开张 http://localhost:$port"
(sleep 1; open "http://localhost:$port") &
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$port"
else
  node server.mjs "$port"
fi
