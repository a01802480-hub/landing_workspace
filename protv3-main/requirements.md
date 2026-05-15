# 📋 BioStream Project Requirements

This document outlines all the necessary software, libraries, and extensions required to run and develop the BioStream application, including both the frontend and the backend components.

---

## 🚀 Quick Setup (All-in-One Commands)

### Windows (PowerShell)

Run these commands in order from the project root (`c:\Users\Santiago Arizpe\protv3`):

```powershell
# 1. Install Backend Dependencies
cd Biobackend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# 2. Install Frontend Dependencies
cd ..\biostream
npm install

# 3. Verify Installation
python --version
node --version
npm --version
pip list
npm list --depth=0
```

### macOS / Linux (Bash)

```bash
# 1. Install Backend Dependencies
cd Biobackend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Install Frontend Dependencies
cd ../biostream
npm install

# 3. Verify Installation
python3 --version
node --version
npm --version
pip list
npm list --depth=0
```

### Automated Setup Scripts

This project includes setup scripts for convenience:

**Windows:**
```powershell
.\start_backend.bat
```

**mac/Linux:**
```bash
chmod +x start_backend.sh
./start_backend.sh
```

---

## 1. Core Software & Tools

These are the fundamental tools required on your development machine.

| Tool | Minimum Version | Recommended | Notes |
|---|---|---|---|
| **Operating System** | - | Windows, macOS, Linux | Project scripts are available for both Windows (.bat) and Unix-like (.sh) systems. |
| **Node.js** | 16.0.0 | 18.0.0+ | Provides the JavaScript runtime for the frontend. [Download](https://nodejs.org/) |
| **npm** | 8.0.0 | 9.0.0+ | Node Package Manager, comes bundled with Node.js. |
| **Python** | 3.8 | 3.9+ | Required for the FastAPI backend server. [Download](https://python.org/) |
| **pip** | - | Latest | Python Package Installer, comes bundled with Python. |
| **Web Browser** | - | Chrome, Firefox, Edge | A modern browser is needed to view the application. |
| **Code Editor** | - | VS Code | Recommended for its integrated terminal and TypeScript/Python support. |
| **Git** | - | Latest | Optional, but recommended for version control. |

---

## 2. Backend Requirements (Python / FastAPI)

The backend is a Python server built with the FastAPI framework. It handles sequence alignment by communicating with the EBI ClustalOmega REST API.

### Dependencies

These Python packages are required for the backend.

- `fastapi`: The web framework for building the API.
- `uvicorn`: The ASGI server to run the FastAPI application.
- `pydantic`: Used for data validation and settings management.
- `requests`: Used to make HTTP requests to the external ClustalOmega API.

### Installation

Navigate to the project's root directory and install the dependencies. It is recommended to use a Python virtual environment.

```bash
# Navigate to the backend directory
cd c:\Users\Santiago Arizpe\protv3\Biobackend

# (Optional but recommended) Create and activate a virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install required packages from requirements.txt
pip install -r requirements.txt
```

Alternatively, you can install the packages individually:
```bash
pip install fastapi uvicorn pydantic requests
```

---

## 3. Frontend Requirements (Node.js / React)

The frontend is a single-page application built with React, TypeScript, and Vite.

### Core Libraries & Frameworks

These dependencies are managed by `npm` and are listed in `package.json`.

- `react`: (v18.2.0) The core UI library.
- `typescript`: (v5.0+) Provides static typing for the project.
- `vite`: (v4.3.9) The build tool and development server.
- `tailwindcss`: (v3.3.2) The CSS framework for styling.
- `@tanstack/react-table`: (v8.11.0) Powers the data grid in the "Worksheet" tab.
- `lucide-react`: (v0.263.1) For icons used throughout the application.

### Installation

Navigate to the frontend's root directory and run the `npm install` command.

```bash
# Navigate to the frontend directory
cd c:\Users\Santiago Arizpe\protv3\biostream

# Install all Node.js dependencies
npm install
```

---

## 4. Running the Full Application

To run BioStream, you need to start both the backend and frontend servers in separate terminals.

### Terminal 1: Start the Backend Server
```bash
cd c:\Users\Santiago Arizpe\protv3
python Biobackend/main.py
```
> You should see `INFO: Uvicorn running on http://0.0.0.0:8000`

### Terminal 2: Start the Frontend Server
```bash
cd c:\Users\Santiago Arizpe\protv3\biostream
npm run dev
```
> You should see `➜ Local: http://localhost:3001` (or a similar port).

Once both servers are running, you can access the BioStream application by opening **`http://localhost:3001`** in your web browser.

---

## 6. Troubleshooting & Common Issues

### Backend Issues

**Problem: `python: command not found` or `python3: command not found`**
- **Solution:** Ensure Python is installed and added to your PATH. Download from [python.org](https://python.org/)
- On Windows, try `py` instead of `python`

**Problem: `pip: command not found`**
- **Solution:** Install pip or use `python -m pip` instead of `pip`

**Problem: Port 8000 already in use**
```bash
# Kill process on port 8000 (Windows)
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Kill process on port 8000 (macOS/Linux)
lsof -ti:8000 | xargs kill -9
```

**Problem: Missing system dependencies for Python packages**
```bash
# Windows (usually not needed)
# macOS
brew install python3

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install python3-dev python3-venv
```

### Frontend Issues

**Problem: `npm: command not found`**
- **Solution:** Install Node.js from [nodejs.org](https://nodejs.org/). npm comes bundled with it.

**Problem: Node.js version too old**
```bash
# Check current version
node --version

# Use nvm to manage versions (recommended)
# Windows: https://github.com/coreybutler/nvm-windows
# macOS/Linux: https://github.com/nvm-sh/nvm

nvm install 18
nvm use 18
```

**Problem: Port 3001 already in use**
```bash
# Vite will automatically prompt to use another port
# Or manually specify a port:
npm run dev -- --port 3002
```

**Problem: `node_modules` corruption or strange errors**
```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### General Issues

**Problem: Virtual environment activation fails**
```bash
# Windows PowerShell (if execution policy blocks)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\venv\Scripts\activate

# Windows CMD
venv\Scripts\activate.bat

# macOS/Linux
source venv/bin/activate
```

**Problem: Permission denied errors**
```bash
# Windows: Run terminal as Administrator
# macOS/Linux: Use sudo (for global installs only)
sudo npm install -g <package>
```

**Problem: ClustalOmega API not responding**
- The backend uses the EBI ClustalOmega API. Ensure you have an active internet connection.
- Check API status: https://www.ebi.ac.uk/jdispatcher/services/

### Verification Checklist

Run these commands to verify your setup:

```bash
# Check Python installation
python --version  # Should show Python 3.8+

# Check pip installation
pip --version

# Check Node.js installation
node --version  # Should show v16.0.0+

# Check npm installation
npm --version   # Should show 8.0.0+

# Verify backend dependencies
cd Biobackend
pip list | findstr "fastapi uvicorn pydantic requests"  # Windows
pip list | grep -E "fastapi|uvicorn|pydantic|requests"  # macOS/Linux

# Verify frontend dependencies
cd ../biostream
npm list react typescript vite tailwindcss
```

All checks should pass before attempting to run the application.