# Tokyo Apartment Finder - Debugging Log

This document tracks debugging sessions and solutions for issues encountered during development.

## Debug Session 001: Instrumentation Module Not Found
**Date**: 2025-01-18
**Issue**: Application failed to start with module not found error

### Error Details
```
Module not found: Can't resolve '@/lib/monitoring'
  > 4 |     const { initMonitoring } = await import("@/lib/monitoring");
    |                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^

Error: An error occurred while loading instrumentation hook: Cannot find module '@/lib/monitoring'
```

### Root Cause
The instrumentation file was using the wrong path alias. The project uses `~/` as the path alias (configured in tsconfig.json), not `@/`.

### Solution
Changed the import statement in `src/instrumentation.ts`:
- **Before**: `import("@/lib/monitoring")`
- **After**: `import("~/lib/monitoring")`

### Prevention
- Always check tsconfig.json for the correct path alias configuration
- T3 stack uses `~/` by default, not `@/` which is common in other Next.js projects
- Consider adding a linter rule to catch incorrect path aliases

### Files Modified
- `src/instrumentation.ts` - Fixed import path alias

---

## Debug Session 002: Global Path Alias Update
**Date**: 2025-01-18
**Issue**: Inconsistent path aliases throughout codebase

### Error Details
After fixing the instrumentation file, discovered that the entire codebase was using `@/` imports instead of the configured `~/` path alias. This was causing potential issues and inconsistency.

### Root Cause
The codebase was developed with `@/` path alias convention (common in Next.js projects), but the T3 stack configuration uses `~/` as defined in tsconfig.json:
```json
"paths": {
  "~/*": ["./src/*"]
}
```

### Solution
Updated all imports throughout the codebase from `@/` to `~/`:
1. Created a script to find all files with `@/` imports
2. Used sed to replace all occurrences of `@/` with `~/`
3. Fixed 100+ import statements across 87 files

**Files affected**: All TypeScript and TSX files that had imports

### Prevention
- Establish path alias convention at project start
- Add ESLint rule to enforce consistent path aliases
- Document the path alias convention in README
- Consider adding pre-commit hook to check for incorrect path aliases

### Technical Details
Commands used to fix the imports:
```bash
# Find all files with @/ imports
grep -r "@/" src/ --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort | uniq

# Replace all @/ with ~/
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|@/|~/|g' {} \;
```

### Files Modified
- 87 files across the entire `src/` directory
- All import statements updated from `@/` to `~/`

---

## Debug Session 003: Worker Exit Uncaught Exception
**Date**: 2025-01-18
**Issue**: Application crashes with "the worker has exited" error

### Error Details
```
uncaughtException: Error: the worker has exited
    at process.eval (src/lib/monitoring/index.ts:78:21)
  76 |   // Uncaught exceptions
  77 |   process.on("uncaughtException", (error) => {
> 78 |     monitoringLogger.fatal({
     |                     ^
  79 |       error,
  80 |     }, "Uncaught Exception");
```

### Root Cause
The monitoring error handler itself was throwing an error when trying to log the uncaught exception. This was happening because:
1. Pino logger with `pino-pretty` transport doesn't work properly in worker processes
2. The monitoring system was trying to initialize in worker/edge runtime environments
3. No fallback error handling when the logger itself fails

### Solution
Applied three fixes to make the monitoring system more robust:

1. **Added try-catch in error handlers** (`src/lib/monitoring/index.ts`):
   - Wrapped logger calls in try-catch blocks
   - Added console.error fallback when logger fails
   - Prevents error handler from causing additional crashes

2. **Fixed logger configuration** (`src/lib/logging/index.ts`):
   - Disabled pino-pretty transport in worker/edge environments
   - Only use transport in main thread
   - Check for NEXT_RUNTIME and JEST_WORKER_ID

3. **Skip monitoring in workers** (`src/lib/monitoring/index.ts`):
   - Added early return for edge/worker runtimes
   - Prevents initialization of monitoring in inappropriate contexts
   - Added try-catch around entire initialization

### Prevention
- Always add error handling to error handlers themselves
- Be aware of runtime environments (main thread vs workers)
- Test logging/monitoring systems in different contexts
- Use console.error as ultimate fallback
- Don't assume all Node.js features work in all environments

### Files Modified
- `src/lib/monitoring/index.ts` - Added error handling and worker detection
- `src/lib/logging/index.ts` - Fixed pino transport configuration

---

## Debug Session 004: Next.js Config and Pino Worker Issues
**Date**: 2025-01-18
**Issue**: Multiple startup errors with instrumentation and logging

### Error Details
```
⚠ Invalid next.config.js options detected: 
⚠     Unrecognized key(s) in object: 'instrumentationHook' at "experimental"
⚠ `experimental.instrumentationHook` is no longer needed

[Error: Cannot find module '/ROOT/node_modules/thread-stream/lib/worker.js'] {
  code: 'MODULE_NOT_FOUND',
  requireStack: []
}
```

### Root Cause
1. **Next.js 15 removed `instrumentationHook`** - It's now enabled by default when `instrumentation.ts` exists
2. **Pino transport issues in instrumentation context** - The pino-pretty transport uses thread-stream which doesn't work in Next.js instrumentation

### Solution
1. **Removed deprecated config** (`next.config.js`):
   - Removed `instrumentationHook: true` from experimental config
   
2. **Fixed logger initialization** (`src/lib/logging/index.ts`):
   - Detect instrumentation context
   - Use basic config without transports in instrumentation
   
3. **Added error handling** (`src/instrumentation.ts`):
   - Wrapped monitoring initialization in try-catch
   - Prevents instrumentation failures from crashing the app

### Prevention
- Keep up with Next.js breaking changes
- Test logger initialization in different contexts
- Always wrap instrumentation code in error handling
- Avoid complex dependencies in instrumentation

### Files Modified
- `next.config.js` - Removed deprecated instrumentationHook
- `src/lib/logging/index.ts` - Added instrumentation context detection
- `src/instrumentation.ts` - Added error handling

---

## Debug Session 005: OpenTelemetry Import and CSS Parsing Errors
**Date**: 2025-01-18
**Issue**: Resource export not found and CSS pseudo-class syntax error

### Error Details
```
Export Resource doesn't exist in target module
> 3 | import { Resource } from "@opentelemetry/resources";
    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

'full-screen' is not recognized as a valid pseudo-class. Did you mean '::full-screen'
> 3175 | .leaflet-container:full-screen {
       |                     ^
```

### Root Cause
1. **OpenTelemetry API Change** - The `Resource` class is no longer directly exported from @opentelemetry/resources v2.x
2. **CSS Syntax Error** - The `:full-screen` pseudo-class should be `:fullscreen` (no hyphen)

### Solution
1. **Fixed OpenTelemetry import** (`src/lib/telemetry/index.ts`):
   - Changed from `import { Resource }` to `import { resourceFromAttributes }`
   - Updated usage from `new Resource()` to `resourceFromAttributes()`
   
2. **Fixed CSS pseudo-class** (`src/components/map/map.css`):
   - Changed `:full-screen` to `:fullscreen`
   - Kept vendor prefixes for compatibility

### Prevention
- Check breaking changes when updating major versions of packages
- Use correct CSS pseudo-class syntax (`:fullscreen` not `:full-screen`)
- Consider using PostCSS autoprefixer for CSS compatibility

### Files Modified
- `src/lib/telemetry/index.ts` - Fixed OpenTelemetry imports
- `src/components/map/map.css` - Fixed fullscreen pseudo-class

---

## Debug Session 006: Component Import Error on Homepage
**Date**: 2025-01-18
**Issue**: Homepage returns 500 error with "Element type is invalid" message

### Error Details
```
Element type is invalid: expected a string (for built-in components) or a class/function 
(for composite components) but got: undefined. You likely forgot to export your component 
from the file it's defined in, or you might have mixed up default and named imports.
```

### Root Cause
1. The motion package was imported incorrectly. The project had `motion` installed (which is the new Motion One library) but was trying to import from `motion/react` which doesn't exist. The correct import for the project should be from `framer-motion`.
2. JWT session error was masking the real component error - auth() was throwing due to cookie/secret mismatch

### Solution
1. Fixed all motion/react imports to use framer-motion package
2. Created HomepageSearch component to replace SearchForm that required props
3. Simplified the page and layout to minimal versions to isolate the issue
4. Minimal layout and page confirmed working - server now starts successfully
5. Added try-catch around auth() calls to handle JWT errors gracefully
6. **Status**: App still has component import error with full layout - needs further investigation

### Prevention
- Always verify package imports match the actual package name
- Check package.json to confirm which animation library is installed
- Ensure all components are properly exported
- Use TypeScript strict mode to catch import errors at compile time
- Handle auth errors gracefully to prevent cascading failures

### Files Modified
- All 30+ files with motion/react imports → changed to framer-motion
- `src/app/page.tsx` - Replaced SearchForm with HomepageSearch, added auth error handling
- `src/app/layout.tsx` - Added try-catch for auth() error handling
- `src/components/homepage-search.tsx` - Created new simple search component
- `scripts/fix-motion-imports.sh` - Script to fix all imports

---

## Debug Session 007: Component Import and Auth Errors
**Date**: 2025-01-18
**Issue**: Multiple layered errors preventing app startup

### Error Details
```
1. Element type is invalid: expected a string... but got: undefined
2. [auth][error] JWTSessionError: Read more at https://errors.authjs.dev#jwtsessionerror
3. [auth][cause]: Error: no matching decryption secret
4. Error: No QueryClient set, use QueryClientProvider to set one
```

### Root Causes
1. **Wrong NextAuth imports**: The project was importing from "next-auth/react" but with NextAuth v5 beta, the imports were incorrect
2. **JWT session error**: Browser had old JWT cookies encrypted with different AUTH_SECRET
3. **HydrateClient in page**: Page component was using HydrateClient without QueryClientProvider being set up

### Solution
1. **Fixed NextAuth imports**: 
   - Changed imports from "@auth/nextjs/react" back to "next-auth/react" (correct for v5 beta)
   - Fixed in both `src/hooks/use-auth.ts` and `src/components/auth/session-provider.tsx`

2. **JWT error handling**:
   - Added try-catch around auth() calls in layout and page
   - User needs to clear browser cookies for localhost:3000 or use incognito mode

3. **Removed HydrateClient**:
   - Removed HydrateClient wrapper from page.tsx
   - Added providers back to layout.tsx in correct order

### Prevention
- Always check NextAuth version and use correct imports
- Clear browser cookies when AUTH_SECRET changes
- Don't use HydrateClient without proper provider setup
- Test with incognito mode to avoid cookie issues

### Files Modified
- `src/hooks/use-auth.ts` - Fixed NextAuth import
- `src/components/auth/session-provider.tsx` - Fixed NextAuth import  
- `src/app/page.tsx` - Removed HydrateClient wrapper, removed motion.div (server component)
- `src/app/layout.tsx` - Added all providers back

---

## Debug Session 008: Motion Library Import Issue
**Date**: 2025-01-18
**Issue**: Motion components causing runtime errors in server and client components

### Error Details
```
Element type is invalid: expected a string... but got: undefined
Check the render method of `HomePage` / `Footer`
```

### Root Cause
1. **Server components can't use motion**: Server components (without "use client") cannot use framer-motion as it requires browser APIs
2. **Package confusion**: Project has `motion` package installed, not `framer-motion` directly. The imports from "framer-motion" still work because it's a dependency of motion package

### Solution
1. **For server components** (HomePage, Footer):
   - Removed motion imports completely
   - Replaced motion.div/motion.footer with regular HTML elements
   - Removed all animation props (initial, animate, transition, etc)

2. **For client components** (Header, etc):
   - Keep using motion as they have "use client" directive
   - Motion works fine in client components

### Prevention
- Always check if component is server or client before using motion
- Server components = no motion, no browser-only APIs
- Client components = can use motion, must have "use client"
- Consider creating wrapper client components for animations

### Files Modified
- `src/app/page.tsx` - Removed all motion elements (server component)
- `src/components/layout/footer.tsx` - Removed motion.footer (server component)
- `src/components/ui/alert.tsx` - Created missing alert component

---

## Debug Session 009: Authentication Session Not Created
**Date**: 2025-01-18
**Issue**: No session or session cookie created after authentication

### Error Details
```
[auth][cause]: TypeError: Cannot read properties of undefined (reading 'id')
    at Object.session (/home/noueii/workspace/github.com/noueii/rent-finder/web-3/.next/server/chunks/[root-of-the-server]__957dca3a._.js:347:30)
```

### Root Cause
When using JWT strategy with credentials provider in NextAuth v5, the session callback receives `token` parameter, not `user` parameter. The session callback was trying to access `user.id` which was undefined.

### Solution
1. **Fixed session callback** (`src/server/auth/config.ts`):
   - Changed from `async session({ session, user })` to `async session({ session, token })`
   - Extract user data from token instead of user object
   - This is required when using JWT strategy

2. **Created test user script** (`scripts/create-test-user.ts`):
   - Creates a test user with verified email
   - Email: test@example.com
   - Password: testpassword123

### Prevention
- Always check NextAuth documentation for the correct callback signatures based on session strategy
- JWT strategy = use token in session callback
- Database strategy = use user in session callback
- Create test users for authentication testing

### Files Modified
- `src/server/auth/config.ts` - Fixed session callback for JWT strategy
- `scripts/create-test-user.ts` - Created test user creation script

---

## Debug Session Template
**Date**: YYYY-MM-DD
**Issue**: Brief description

### Error Details
```
Paste error message here
```

### Root Cause
Explain what caused the issue

### Solution
Describe the fix applied

### Prevention
How to avoid this in the future

### Files Modified
- List files changed