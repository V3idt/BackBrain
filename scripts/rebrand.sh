#!/bin/bash

# BackBrain Rebranding Script
# Usage: ./scripts/rebrand.sh NewName

set -e

OLD_NAME="BackBrain"
OLD_LOWER="backbrain"
OLD_UPPER="BACKBRAIN"

if [ -z "$1" ]; then
    echo "❌ Error: New name required"
    echo "Usage: ./scripts/rebrand.sh NewName"
    echo "Example: ./scripts/rebrand.sh CodeGuard"
    exit 1
fi

NEW_NAME=$1
NEW_LOWER=$(echo "$NEW_NAME" | tr '[:upper:]' '[:lower:]')
NEW_UPPER=$(echo "$NEW_NAME" | tr '[:lower:]' '[:upper:]')

echo "🔄 Rebranding from $OLD_NAME to $NEW_NAME..."
echo ""
echo "Replacements:"
echo "  $OLD_NAME → $NEW_NAME"
echo "  $OLD_LOWER → $NEW_LOWER"
echo "  $OLD_UPPER → $NEW_UPPER"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "📝 Updating files..."

# Function to replace in files
replace_in_files() {
    local old=$1
    local new=$2
    
    find . -type f \( -name "*.ts" -o -name "*.json" -o -name "*.md" -o -name "*.sh" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/.git/*" \
        ! -path "*/dist/*" \
        ! -path "*/bun.lockb" \
        -exec sed -i.bak "s/$old/$new/g" {} \; \
        -exec rm {}.bak \;
}

# Replace all variations
replace_in_files "$OLD_NAME" "$NEW_NAME"
replace_in_files "$OLD_LOWER" "$NEW_LOWER"
replace_in_files "$OLD_UPPER" "$NEW_UPPER"

echo "✅ File updates complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review changes: git diff"
echo "2. Reinstall dependencies:"
echo "   rm -rf node_modules bun.lockb && bun install"
echo "3. Run tests: bun test"
echo "4. Type check: bun run typecheck"
echo "5. Rename project folder:"
echo "   cd .. && mv $OLD_LOWER $NEW_LOWER"
echo ""
echo "⚠️  Don't forget to:"
echo "- Update git remote if needed"
echo "- Check VS Code Marketplace for name availability"
echo "- Update any external references (docs, websites, etc.)"
