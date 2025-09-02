#!/bin/bash

# Script to fix all @/ imports to ~/ imports
echo "Fixing import path aliases from @/ to ~/"

# Find all TypeScript and TSX files with @/ imports
files=$(grep -r "@/" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | cut -d: -f1 | sort | uniq)

count=0
for file in $files; do
    echo "Processing: $file"
    # Use sed to replace all @/ with ~/
    sed -i 's|from "@/|from "~/|g' "$file"
    sed -i 's|import("@/|import("~/|g' "$file"
    count=$((count + 1))
done

echo "✅ Fixed imports in $count files"

# Verify no @/ imports remain
remaining=$(grep -r "@/" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | wc -l)
if [ $remaining -eq 0 ]; then
    echo "✅ All @/ imports have been updated to ~/"
else
    echo "⚠️  Warning: $remaining @/ imports still remain"
fi