# 🚀 Quick Start - Authentication & Deployment

## ✅ What's Done

✓ Backend authentication with bcrypt + JWT  
✓ Frontend integrated with backend API  
✓ Cloudflare Pages configuration ready  
✓ All tests passing  

---

## 🔑 Deployment Commands

### For Cloudflare Pages (Landing Page)

```bash
cd biostream_landing-master

# ONE COMMAND TO DEPLOY (Recommended)
npm run deploy

# OR step-by-step:
npm run pages:build      # Build for Cloudflare
npx wrangler pages deploy  # Deploy to Cloudflare
```

### Prerequisites

```bash
# Install Wrangler CLI (one time)
npm install -g wrangler

# Login to Cloudflare (one time)
wrangler login
```

---

## 🔐 Test Authentication

```bash
cd protv3-main/Biobackend

# Run all auth tests
python test_auth.py
```

Expected: All 8 tests pass ✓

---

## 🌐 Access Points

- **Landing Page**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## ⚙️ Before Deploying

1. **Set Backend URL** in `wrangler.toml`:
   ```toml
   [vars]
   NEXT_PUBLIC_API_URL = "https://your-backend.com"
   ```

2. **Or use CLI**:
   ```bash
   wrangler pages secret put NEXT_PUBLIC_API_URL
   ```

---

## 📝 Key Files Modified

- ✓ `protv3-main/Biobackend/apis/auth/auth_router.py` - Auth endpoints
- ✓ `biostream_landing-master/app/signin/page.tsx` - Calls backend
- ✓ `biostream_landing-master/app/workspace/page.tsx` - Validates tokens
- ✓ `biostream_landing-master/next.config.mjs` - Static export
- ✓ `biostream_landing-master/wrangler.toml` - Cloudflare config
- ✓ `biostream_landing-master/package.json` - Deploy scripts

---

## 🎯 Remember

**Authentication happens on the BACKEND**, not frontend!  
Cannot be bypassed by manipulating localStorage.

**Default deploy command**: `npx wrangler pages deploy`  
**Better command**: `npm run deploy` (builds first)

---

For full documentation, see: `AUTHENTICATION_AND_DEPLOYMENT_GUIDE.md`
