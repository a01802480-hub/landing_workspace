# 🚀 Quick Start - Get BioStream Running in 2 Minutes

## ✅ Prerequisites Check

Before starting, make sure you have:
- [ ] Python 3.9+ installed (`python --version`)
- [ ] Node.js/npm installed (`npm --version`)
- [ ] Terminal/PowerShell open
- [ ] Browser (Chrome or Firefox)

---

## 🎬 Step 1: Start Backend (Terminal 1)

```bash
cd c:\Users\Santiago Arizpe\protv3\Biobackend
python -m pip install fastapi uvicorn pydantic requests --upgrade
python start_backend.py
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

✅ **Leave this running**

---

## 🎬 Step 2: Start Frontend (Terminal 2)

```bash
cd c:\Users\Santiago Arizpe\protv3\biostream
npm install
npm run dev
```

**Expected output:**
```
VITE v5.x.x ready in xxx ms

➜  Local:   http://localhost:3001
```

✅ **Leave this running**

---

## 🎬 Step 3: Open Browser

1. Open browser → http://localhost:3001
2. Should see BioStream interface
3. Press **F12** to open Developer Tools
4. Click **Console** tab

---

## 🧪 Quick Test (5 seconds)

1. Click **"Upload Sequence"** button
2. Paste this FASTA:
   ```
   >test1
   MVLSPADKTNVKAAWGKVGKKVGAPDAVNGVGAAHAGEYGAEALER
   ```
3. **Check Console** - should see ✅ logs with filenames
4. Should appear in **file list** on left
5. Click it to see **colored sequence** on right

---

## 🎯 If It Works

Console should show logs like:
```
📤 UPLOAD STARTED: { workspaceId: "...", filesCount: 1 }
✅ PARSE COMPLETE: { totalSequences: 1, ... }
📤 ADDING 1 ENTRIES TO WORKSPACE
↓
File appears in list
↓
Click file
↓
✅ FILE RECEIVED IN DETAIL TAB: { sequenceLength: 47, ... }
↓
Colored sequence displays
```

---

## ❌ If It Doesn't Work

Check one thing at a time:

| Issue | Check | Fix |
|---|---|---|
| Backend won't start | Terminal shows error | Run: `pip install -r requirements.txt` |
| Frontend won't start | `npm ERR` | Run: `npm install` then `npm run dev` |
| Page doesn't load | Browser shows error | Wait 30 seconds, refresh |
| File doesn't upload | No ✅ logs in console | Check FASTA format has `>` and data |
| Sequence shows empty | `❌ EMPTY SEQUENCE:` in console | Try different FASTA file |

---

## 🔍 Verify System (Optional)

In a new terminal, run:
```bash
cd c:\Users\Santiago Arizpe\protv3
node VERIFY_SYSTEM.js
```

Will show ✅ for all working systems.

---

## 📖 Full Docs

After quick test, read full docs:
- **DEBUG_GUIDE.md** - Complete debugging steps
- **ERROR_DIAGNOSIS.md** - Error reference
- **COMPLETE_DEBUGGING_REPORT.md** - Full overview

---

## 🆘 Still Stuck?

1. Copy **entire console output** (right-click → Save As)
2. Share it along with:
   - What action you took (e.g., "uploaded FASTA")
   - What you expected (e.g., "file to appear")
   - What happened instead (e.g., "nothing happened")
   - Screenshot of the console

That gives me everything needed to fix it.

---

## 🚫 Common Error Messages & Fixes

### **"Cannot find module 'fastapi'"**
```bash
pip install fastapi uvicorn
```

### **"npm ERR! code ERESOLVE"**
```bash
npm install --legacy-peer-deps
npm run dev
```

### **"EADDRINUSE :::8000"** (Port already in use)
```bash
# Find what's using port 8000
netstat -ano | findstr :8000
# Kill it, then restart
taskkill /PID [PID] /F
python start_backend.py
```

### **"EADDRINUSE :::3001"** (Frontend port taken)
```bash
# Kill whatever is using 3001
netstat -ano | findstr :3001
taskkill /PID [PID] /F
npm run dev
```

### **Alignment times out (> 60 seconds)**
EBI ClustalOmega service is slow. This is normal. Wait or try simpler sequences.

---

## ✨ You're Ready!

Everything is set up. Just run the 2 commands and test it out.

**Any issues? Check the console logs first - they tell you exactly what's happening.**
