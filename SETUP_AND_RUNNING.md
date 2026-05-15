# 🚀 BioStream - Complete Setup & Running Guide

## Overview

BioStream consists of **TWO separate applications** that work together:

1. **Landing Page** (Next.js) - Authentication & marketing site on port **3000**
2. **BioStream App** (Vite/React) - Main bioinformatics workspace on port **5173**

---

## ⚡ Quick Start - Run Both Apps

### Option 1: Two Separate Terminals (Recommended for Development)

#### Terminal 1 - Landing Page
```bash
cd biostream_landing-master
npm install
npm run dev
```
✅ Runs on: **http://localhost:3000**

#### Terminal 2 - BioStream Workspace
```bash
cd protv3-main/biostream
npm install
npm run dev
```
✅ Runs on: **http://localhost:5173**

---

### Option 2: Single Command (Using Concurrently)

Install concurrently in the landing page:
```bash
cd biostream_landing-master
npm install concurrently --save-dev
```

Add to `biostream_landing-master/package.json`:
```json
{
  "scripts": {
    "dev": "next dev",
    "dev:full": "concurrently \"npm run dev\" \"cd ../protv3-main/biostream && npm run dev\""
  }
}
```

Run both with one command:
```bash
npm run dev:full
```

---

## 🔄 How It Works

### Authentication Flow

```
1. User visits http://localhost:3000 (Landing Page)
   ↓
2. Clicks "Sign In"
   ↓
3. Enters credentials (example@gmail.com / 1234567)
   ↓
4. Stored in localStorage
   ↓
5. Redirected to http://localhost:3000/workspace
   ↓
6. Workspace page redirects to http://localhost:5173 (BioStream App)
   ↓
7. BioStream App checks localStorage for authentication
   ↓
8. If authenticated → Show full BioStream workspace
   If NOT authenticated → Redirect back to sign-in
```

---

## 🧪 Testing the Complete Flow

### Step 1: Start Both Applications

**Terminal 1:**
```bash
cd biostream_landing-master
npm run dev
```

**Terminal 2:**
```bash
cd protv3-main/biostream
npm run dev
```

### Step 2: Test Authentication

1. Open browser to: **http://localhost:3000**
2. Click **"Sign In"** button
3. Enter test credentials:
   - Email: `example@gmail.com`
   - Password: `1234567`
4. Click **"Sign In"**
5. You'll be redirected to **http://localhost:5173**
6. The full BioStream workspace loads! ✅

### Step 3: Use BioStream

Now you can:
- Upload FASTA files
- Run sequence alignments
- View worksheets
- Manage projects
- All features from the original BioStream app!

### Step 4: Sign Out

To sign out, clear localStorage:
```javascript
// In browser console (F12)
localStorage.removeItem('isAuthenticated');
localStorage.removeItem('user');
window.location.href = 'http://localhost:3000';
```

Or add a sign-out button to the BioStream app (see below).

---

## 🔧 Adding Sign-Out to BioStream App

To make sign-out easier, add a button to the BioStream app:

Edit `protv3-main/biostream/src/components/layout/LeftNavSidebar.tsx`:

Add this function:
```typescript
const handleSignOut = () => {
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('user');
  window.location.href = 'http://localhost:3000';
};
```

Add a sign-out button in the JSX (near the user avatar):
```tsx
<button 
  onClick={handleSignOut}
  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
  title="Sign Out"
>
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
</button>
```

---

## 📁 Project Structure

```
landing_workspace/
├── biostream_landing-master/          # Landing Page (Port 3000)
│   ├── app/
│   │   ├── page.tsx                   # Home page with sign-in button
│   │   ├── signin/page.tsx            # Authentication page
│   │   └── workspace/page.tsx         # Redirects to BioStream app
│   └── package.json
│
└── protv3-main/
    └── biostream/                     # BioStream App (Port 5173)
        ├── src/
        │   ├── App.tsx                # Main app with auth check
        │   ├── components/
        │   ├── hooks/
        │   └── ...
        └── package.json
```

---

## 🔐 Authentication Details

### How Authentication Works

**Landing Page stores:**
```javascript
localStorage.setItem('isAuthenticated', 'true');
localStorage.setItem('user', JSON.stringify({
  email: 'example@gmail.com',
  name: 'Test User'
}));
```

**BioStream App checks:**
```javascript
const authStatus = localStorage.getItem('isAuthenticated');
if (authStatus === 'true') {
  // Allow access
} else {
  // Redirect to sign-in
  window.location.href = 'http://localhost:3000/signin';
}
```

Both apps share the same `localStorage` because they're on the same domain (`localhost`).

---

## 🐛 Troubleshooting

### Problem: "404 Not Found" when clicking links

**Solution:** Make sure BOTH apps are running:
- Landing page on port 3000
- BioStream app on port 5173

### Problem: Redirected back to sign-in repeatedly

**Solution:** 
1. Check browser console (F12) for errors
2. Verify localStorage has authentication data:
   ```javascript
   console.log(localStorage.getItem('isAuthenticated'));
   console.log(localStorage.getItem('user'));
   ```
3. If empty, sign in again

### Problem: Port already in use

**Solution:**
```bash
# Kill process on port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:3000 | xargs kill -9

# Same for port 5173
```

### Problem: BioStream app shows white screen

**Solution:**
1. Check browser console for errors
2. Make sure all dependencies are installed:
   ```bash
   cd protv3-main/biostream
   npm install
   ```
3. Restart the dev server

### Problem: Can't upload files or run alignments

**Solution:**
The BioStream backend (FastAPI) needs to be running too:
```bash
cd protv3-main/Biobackend
pip install -r requirements.txt
python main.py
```

Backend runs on: **http://localhost:8000**

---

## 🎯 Complete System Architecture

```
┌─────────────────────────────────────────┐
│   User Browser                          │
│                                         │
│   http://localhost:3000  (Landing)     │
│   http://localhost:5173  (BioStream)   │
└────────────┬────────────┬──────────────┘
             │            │
             │            │
    ┌────────▼────┐  ┌───▼────────────┐
    │ Landing Page│  │ BioStream App  │
    │ (Next.js)   │  │ (Vite/React)   │
    │             │  │                │
    │ - Auth UI   │  │ - Workspace    │
    │ - Sign In   │  │ - Alignment    │
    │ - Marketing │  │ - Sequences    │
    └─────────────┘  └───┬────────────┘
                         │
                         │ API Calls
                         │
              ┌──────────▼──────────┐
              │  FastAPI Backend    │
              │  (Port 8000)        │
              │                     │
              │ - ClustalOmega      │
              │ - BLAST             │
              │ - UniProt           │
              └─────────────────────┘
```

---

## 📋 Checklist for First-Time Setup

- [ ] Install Node.js 18+ and npm
- [ ] Install Python 3.8+ and pip
- [ ] Navigate to `biostream_landing-master`
- [ ] Run `npm install`
- [ ] Navigate to `protv3-main/biostream`
- [ ] Run `npm install`
- [ ] (Optional) Navigate to `protv3-main/Biobackend`
- [ ] (Optional) Run `pip install -r requirements.txt`
- [ ] Start landing page: `npm run dev` in landing folder
- [ ] Start BioStream: `npm run dev` in biostream folder
- [ ] (Optional) Start backend: `python main.py` in Biobackend folder
- [ ] Open http://localhost:3000
- [ ] Sign in with test credentials
- [ ] Verify redirect to BioStream workspace
- [ ] Test file upload and alignment features

---

## 🚀 Production Deployment

When ready for production:

1. **Build Landing Page:**
   ```bash
   cd biostream_landing-master
   npm run build
   ```

2. **Build BioStream App:**
   ```bash
   cd protv3-main/biostream
   npm run build
   ```

3. **Deploy:**
   - Landing page → Vercel, Netlify, or any static host
   - BioStream app → Same host or separate
   - Backend → Railway, Render, or cloud server

4. **Update URLs:**
   Change hardcoded `localhost` URLs to production domains in:
   - `biostream_landing-master/app/workspace/page.tsx`
   - `protv3-main/biostream/src/App.tsx`

---

## 💡 Pro Tips

### Auto-Start Script

Create `start-all.bat` (Windows) in root directory:
```batch
@echo off
start cmd /k "cd biostream_landing-master && npm run dev"
timeout /t 3
start cmd /k "cd protv3-main\biostream && npm run dev"
timeout /t 3
start cmd /k "cd protv3-main\Biobackend && python main.py"
echo All services started!
pause
```

Create `start-all.sh` (macOS/Linux):
```bash
#!/bin/bash
cd biostream_landing-master && npm run dev &
sleep 2
cd protv3-main/biostream && npm run dev &
sleep 2
cd protv3-main/Biobackend && python main.py &
echo "All services started!"
wait
```

### Browser Tabs Management

Keep these tabs open during development:
1. http://localhost:3000 - Landing page
2. http://localhost:5173 - BioStream workspace
3. http://localhost:8000/docs - FastAPI docs (if backend running)

---

## 📞 Need Help?

- Check browser console (F12) for errors
- Verify both servers are running
- Ensure ports 3000 and 5173 are available
- Review documentation in `AUTHENTICATION_COMPLETE_GUIDE.md`

---

## ✅ Success Indicators

You know it's working when:
- ✅ Landing page loads at http://localhost:3000
- ✅ Sign-in accepts test credentials
- ✅ Automatic redirect to http://localhost:5173
- ✅ BioStream workspace displays fully
- ✅ Can upload files and run alignments
- ✅ No 404 errors
- ✅ No authentication loops

---

## 🎉 You're Ready!

Follow the steps above and you'll have the complete BioStream system running with:
- Professional landing page
- Secure authentication
- Full bioinformatics workspace
- All original features intact

Happy analyzing! 🧬🔬