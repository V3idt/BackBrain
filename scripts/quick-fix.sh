#!/bin/bash

echo "🔧 Quick Fix: Installing dependencies and testing..."
echo ""

cd "$(dirname "$0")/.."

echo "1. Installing root dependencies..."
bun install

echo ""
echo "2. Installing extension dependencies..."
cd packages/extension
bun install

echo ""
echo "3. Type checking..."
cd ../..
bun run typecheck

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All checks passed! Extension is ready to test."
    echo ""
    echo "Next: Press F5 in VS Code to launch Extension Development Host"
else
    echo ""
    echo "❌ Type check failed. See errors above."
    exit 1
fi
