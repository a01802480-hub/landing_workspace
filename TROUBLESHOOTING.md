# 🔧 Troubleshooting Guide - Quick Fixes

## Problem 1: "This site can't reach localhost:5173"

### Cause
The BioStream workspace app isn't running, or it's running on a different port.

### Solution

**Step 1: Check if BioStream is running**
Look for a terminal window titled "BioStream Workspace". If you don't see one, start it:

```bash
cd protv3-main\biostream
npm run dev
```

**Step 2: Find the correct port**
When BioStream starts, it will show something like:
```
➜  Local:   http://localhost:3002/
```
or
```
➜  Local:   http://localhost:5173/
```

**Note the port number!** It might be 3002, 3001, 5173, or another number if ports are occupied.

**Step 3: Update the redirect URL**
Edit `biostream_landing-master/app/workspace/page.tsx` and change this line:
```typescript
const bioStreamUrl = 'http://localhost:3002'; // Change 3002 to your actual port
```

---

## Problem 2: Sign In Button Doesn't Work

### Possible Causes & Solutions

**Cause 1: Landing page isn't running**
- Make sure you started the landing page
- Check if there's a terminal showing "Ready in X ms"
- Visit http://localhost:3000 manually

**Cause 2: TypeScript compilation errors**
Run this to check:
```bash
cd biostream_landing-master
npm run build
```
If there are errors, they'll be shown. Share them for help.

**Cause 3: Dependencies not installed**
```bash
cd biostream_landing-master
npm install
```

---

## Problem 3: Authentication Not Working

### Solution

**Check localStorage:**
1. Open browser (F12 for DevTools)
2. Go to Console tab
3. Type:
```javascript
localStorage.getItem('isAuthenticated')
localStorage.getItem('user')
```

If both return `null`, you need to sign in again.

**Sign in with test credentials:**
- Email: `example@gmail.com`
- Password: `1234567`

---

## Problem 4: Multiple Compilation Errors

### Solution

**Reinstall dependencies:**
```bash
cd biostream_landing-master
rm -rf node_modules package-lock.json
npm install
```

Then restart:
```bash
npm run dev
```

---

## Quick Diagnostic Checklist

Run these commands to check everything:

```bash
# 1. Check if landing page dependencies are installed
cd biostream_landing-master
npm list framer-motion lucide-react

# 2. Check if BioStream dependencies are installed
cd ../protv3-main/biostream
npm list vite react

# 3. Test if landing page builds
cd ../../biostream_landing-master
npm run build

# 4. Check what's running on which ports
netstat -ano | findstr :3000
netstat -ano | findstr :5173
netstat -ano | findstr :3002
```

---

## Current Setup (As of Now)

Based on your system:
- **Landing Page:** Running on http://localhost:3000 ✅
- **BioStream Workspace:** Running on http://localhost:3002 ✅ (updated in code)
- **Backend API:** Not running (optional for now)

### To Access:
1. **Landing Page:** http://localhost:3000
2. **Sign In:** Click button → use example@gmail.com / 1234567
3. **Workspace:** Will redirect to http://localhost:3002 automatically

---

## If Nothing Works - Nuclear Option

Reset everything:

```bash
# Stop all running processes (Ctrl+C in terminals)

# Reinstall landing page
cd biostream_landing-master
rm -rf node_modules .next package-lock.json
npm install

# Reinstall BioStream
cd ../protv3-main/biostream
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Start fresh
cd ../../biostream_landing-master
npm run dev

# In another terminal:
cd ../protv3-main/biostream
npm run dev
```

---

## Common Port Conflicts

Vite (BioStream) tries these ports in order:
1. 5173 (default)
2. 5174
3. 5175
... and so on

Next.js (Landing) tries:
1. 3000 (default)
2. 3001
3. 3002
... and so on

**Always check the terminal output for the actual port!**

---

## Need Help?

Share these details:
1. What error messages you see (copy exact text)
2. What happens when you click buttons
3. Output from terminal windows
4. Browser console errors (F12 → Console tab)