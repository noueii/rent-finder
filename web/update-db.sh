#!/bin/bash
cd /home/noueii/workspace/github.com/noueii/rent-finder/web

echo "Generating Prisma client..."
npx prisma generate

echo "Pushing schema to database..."
npx prisma db push --skip-generate

echo "Done!"