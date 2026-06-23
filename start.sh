#!/bin/sh
echo "=== Diagnosing application startup ==="
echo "Current directory: $(pwd)"
echo "Listing current directory:"
ls -la

if [ ! -d "dist" ]; then
  echo "dist/ directory is missing! Running build..."
  npm run build
else
  echo "dist/ directory exists!"
  ls -la dist
  if [ ! -f "dist/server.cjs" ]; then
    echo "dist/server.cjs is missing! Running build..."
    npm run build
  else
    echo "dist/server.cjs is present!"
  fi
fi

echo "=== Starting application server ==="
exec node dist/server.cjs
