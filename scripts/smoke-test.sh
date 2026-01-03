#!/bin/bash

echo "🧪 BackBrain Smoke Test"
echo ""

cd "$(dirname "$0")/.."

echo "1. Building extension..."
cd packages/extension && bun run build
if [ $? -ne 0 ]; then echo "❌ Build failed"; exit 1; fi
echo "✅ Build successful"
echo ""

echo "2. Running unit tests..."
cd ../.. && bun run test:unit
if [ $? -ne 0 ]; then echo "❌ Unit tests failed"; exit 1; fi
echo "✅ Unit tests passed"
echo ""

echo "3. Type checking..."
bun run typecheck
if [ $? -ne 0 ]; then echo "❌ Type check failed"; exit 1; fi
echo "✅ Type check passed"
echo ""

echo "4. Analyzing bundle..."
bun run analyze:bundle
if [ $? -ne 0 ]; then echo "⚠️  Bundle size warning"; fi
echo ""

echo "✅ All automated tests passed!"
echo ""
echo "📋 Next Steps:"
echo "  1. Open project in VS Code"
echo "  2. Press F5 to launch Extension Development Host"
echo "  3. Test manually (see docs/TESTING_GUIDE.md)"
