# 🚀 BioStream - Quick Start Card

## ⚡ Fastest Way to Run

### Windows
```bash
start-all.bat
```

### macOS/Linux
```bash
chmod +x start-all.sh && ./start-all.sh
```

That's it! All services will start automatically.

---

## 🧪 Test Authentication

1. Open: **http://localhost:3000**
2. Click **"Sign In"**
3. Use credentials:
   - **Email:** `example@gmail.com`
   - **Password:** `1234567`
4. You'll be redirected to the **full BioStream workspace**! ✅

---

## 📍 URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Landing Page | http://localhost:3000 | Sign in / Marketing |
| BioStream App | http://localhost:5173 | Main workspace |
| Backend API | http://localhost:8000 | Alignment tools |

---

## 🔧 Manual Start (If Needed)

**Terminal 1:**
```bash
cd biostream_landing-master && npm run dev
```

**Terminal 2:**
```bash
cd protv3-main/biostream && npm run dev
```

**Terminal 3 (Optional):**
```bash
cd protv3-main/Biobackend && python main.py
```

---

## ✨ What You Get

✅ Professional landing page  
✅ Secure authentication  
✅ Full BioStream workspace  
✅ Sequence alignment tools  
✅ Project management  
✅ All original features  

---

## 📖 Full Documentation

- **[FIX_SUMMARY.md](file://c:\Users\Santiago%20Arizpe\Downloads\landing_workspace\FIX_SUMMARY.md)** - What was fixed
- **[SETUP_AND_RUNNING.md](file://c:\Users\Santiago%20Arizpe\Downloads\landing_workspace\SETUP_AND_RUNNING.md)** - Complete setup guide
- **[AUTHENTICATION_COMPLETE_GUIDE.md](file://c:\Users\Santiago%20Arizpe\Downloads\landing_workspace\AUTHENTICATION_COMPLETE_GUIDE.md)** - Auth details

---

## 🐛 Issues?

**Problem:** 404 errors  
**Solution:** Make sure both apps are running (ports 3000 AND 5173)

**Problem:** Redirect loop  
**Solution:** Clear localStorage and sign in again

**Problem:** White screen  
**Solution:** Run `npm install` in both directories

---

## 🎯 Quick Commands

```bash
# Start everything
start-all.bat          # Windows
./start-all.sh         # macOS/Linux

# Check if running
netstat -ano | findstr :3000   # Windows
lsof -ti:3000                  # macOS/Linux

# Kill process
taskkill /PID <PID> /F         # Windows
kill <PID>                     # macOS/Linux
```

---

**Ready to go!** Just run `start-all.bat` and start analyzing sequences! 🧬🔬