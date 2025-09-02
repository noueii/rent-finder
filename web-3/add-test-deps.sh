#!/bin/bash

# Add React Testing Library dependencies
npm install --save-dev @testing-library/react@latest @testing-library/jest-dom@latest @testing-library/user-event@latest identity-obj-proxy jest-environment-jsdom

echo "React Testing Library dependencies added successfully!"
echo "You can now run: npm run test:react"