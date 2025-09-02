#!/bin/bash

# Fix all motion/react imports to use framer-motion
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "motion/react"|from "framer-motion"|g' {} \;

echo "Fixed all motion/react imports to framer-motion"