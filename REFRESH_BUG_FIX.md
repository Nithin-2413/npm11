# Frontend Refresh Bug Fix

## 🔴 Issue
The frontend was experiencing **unexpected full-page refreshes/reloads** during test execution and prompting, which disrupted the user's workflow.

## 🔍 Root Cause Analysis

### Primary Cause: **Vite File Watcher Triggering HMR**
Vite's development server was watching ALL files in the `/app` directory, including:
- `/app/backend/screenshots/` - Playwright saves screenshots here during every test step
- `/app/backend/uploads/` - File upload storage
- `/app/backend/logs/` - Backend logs

**What was happening:**
1. User starts a test execution
2. Playwright automation runs and saves screenshots to `/app/backend/screenshots/`
3. Vite's file watcher detects new files in watched directories
4. Vite triggers Hot Module Replacement (HMR)
5. **Full page reload occurs**, killing the WebSocket connection and active test session

This created a frustrating loop where tests would restart themselves mid-execution.

## ✅ Fixes Applied

### Fix #1: Vite Watch Configuration
**File:** `/app/frontend/vite.config.ts`

Added aggressive file exclusions to `server.watch.ignored`:
```typescript
watch: {
  ignored: [
    "**/node_modules/**",
    "**/.git/**",
    "**/.emergent/**",
    "**/backend/screenshots/**",  // ← Playwright screenshots
    "**/backend/uploads/**",       // ← File uploads
    "**/backend/logs/**",          // ← Backend logs
    "**/backend/traces/**",        // ← Trace files
    "**/backend/**/*.log",         // ← Any log files
    "/var/log/**",                 // ← System logs
  ],
}
```

**Impact:** Vite will now ignore all backend-generated files, preventing unwanted page reloads during test execution.

### Fix #2: Backend URL Configuration
**File:** `/app/frontend/.env`

Set the external backend URL for API calls:
```env
REACT_APP_BACKEND_URL="https://demobackend.emergentagent.com"
```

**Impact:** Frontend can now properly communicate with the backend API, and you can test the application from your side.

## 🧪 Testing Instructions for User

### Manual Testing Steps:
1. Open the application at your external URL
2. Navigate to the Execute page
3. Enter a test command (e.g., "Go to amazon.com, search for wireless mouse")
4. Click "Run"
5. **Expected behavior:** 
   - WebSocket connection indicator shows 🔗
   - Live terminal shows execution logs
   - Screenshots update in "Live Browser" panel
   - **NO page refresh/reload occurs during execution**
6. Let the test complete fully
7. Verify AI diagnosis appears if any errors occurred
8. Try running multiple tests back-to-back

### What to Verify:
✅ Page stays stable during execution  
✅ WebSocket remains connected (🔗 icon in "Running..." button)  
✅ Live terminal logs stream continuously  
✅ Screenshots update without page reload  
✅ Test completes successfully with final status  
✅ No unexpected page refreshes when prompting or interacting with UI  

### If Issues Persist:
- Check browser console for errors (F12 → Console tab)
- Verify WebSocket connection status in Network tab (F12 → Network → WS filter)
- Share any error messages or screenshots with the developer

## 📝 Technical Notes

### Why HMR was disabled but still caused reloads:
While `hmr: false` was set in the Vite config, this only disables *code hot-swapping*. The underlying file watcher was still active and triggering full page reloads when files changed in watched directories.

### WebSocket Reconnection Strategy:
The code already has robust WebSocket handling with:
- Exponential backoff reconnection (1s, 1.5s, 2.25s, 3.4s, 5.1s)
- Automatic fallback to polling after 5 failed reconnect attempts
- Prevention of reconnect loops on component unmount

### Prevention of Future Issues:
If you add new backend directories for file storage (e.g., traces, videos, reports), remember to add them to the `watch.ignored` array in `vite.config.ts`.

---

**Status:** ✅ Fixed and ready for user testing  
**Next Step:** User manual testing as per instructions above
