# BioStream - Quick Reference Guide

This guide provides quick commands to run each application independently.

---

## 📁 Application Structure

The workspace contains **two separate applications**:

1. **Landing Page** (`biostream_landing-master/`) - Next.js marketing site
2. **Main App** (`protv3-main/`) - Full-stack bioinformatics tool
   - Frontend: React/Vite (`biostream/`)
   - Backend: FastAPI (`Biobackend/`)

---

## 🚀 Running the Landing Page

### Setup (First Time Only)
```bash
cd biostream_landing-master
npm install
```

### Development Mode
```bash
npm run dev
```
Access at: `http://localhost:3000`

### Production Build
```bash
npm run build
npm start
```

---

## 🚀 Running the Main Application

Both frontend and backend must be running simultaneously.

### 1. Start Backend (Terminal 1)

#### Setup (First Time Only)
```bash
cd protv3-main/Biobackend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Run Backend
```bash
# Make sure virtual environment is activated
python main.py
```
Backend runs at: `http://localhost:8000`

### 2. Start Frontend (Terminal 2)

#### Setup (First Time Only)
```bash
cd protv3-main/biostream
npm install
```

#### Run Frontend
```bash
npm run dev
```
Frontend runs at: `http://localhost:5173` (or next available port)

### Access the Application
Open your browser and navigate to the frontend URL shown in Terminal 2 (typically `http://localhost:5173`).

---

## 📝 Important Notes

- **These apps are NOT connected yet** - They work independently
- Each app has its own dependencies and configuration
- Keep both terminals open when running the main app
- The backend uses external APIs (EBI, UniProt, etc.) - internet connection required

---

## 🛠️ Troubleshooting

### Port Already in Use
```bash
# Backend (port 8000)
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:8000 | xargs kill -9

# Frontend (port 5173)
# Vite will automatically use next available port
# Or specify manually:
npm run dev -- --port 3001
```

### Dependencies Issues
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install

# Python virtual environment issues
rm -rf venv
python -m venv venv
# ... then reactivate and reinstall
```

### Check Installation
```bash
# Verify Python packages
pip list | grep -E "fastapi|uvicorn|pydantic|requests"

# Verify Node packages
npm list react typescript vite
```

---

## 📚 Documentation

- Main setup guide: `protv3-main/requirements.md`
- Frontend docs: `protv3-main/biostream/README.md`
- Frontend quick start: `protv3-main/biostream/QUICK_START.md`
- Landing page: `biostream_landing-master/README.md`

---

## 🔧 Development Tips

### Backend Development
- Edit files in `protv3-main/Biobackend/apis/` to modify API endpoints
- Main entry point: `protv3-main/Biobackend/main.py`
- Uvicorn auto-reloads on code changes

### Frontend Development
- Edit files in `protv3-main/biostream/src/`
- Main entry point: `protv3-main/biostream/src/App.tsx`
- Vite provides hot module replacement (HMR)

### Landing Page Development
- Edit files in `biostream_landing-master/app/`
- Main page: `biostream_landing-master/app/page.tsx`
- Next.js provides fast refresh
