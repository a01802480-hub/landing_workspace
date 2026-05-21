# 🚀 Cloudflare Pages Deployment - Quick Reference

## Prerequisites Installation

```bash
# Install Wrangler CLI globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

## Deployment Commands

### Option 1: Using npm scripts (Recommended) ✅

```bash
cd biostream_landing-master

# Build and deploy in one command
npm run deploy
```

This single command does:
1. Builds the Next.js app for static export
2. Converts it for Cloudflare Pages compatibility
3. Deploys to Cloudflare Pages

### Option 2: Step-by-step

```bash
cd biostream_landing-master

# Step 1: Install dependencies (first time only)
npm install

# Step 2: Build for Cloudflare
npm run pages:build

# Step 3: Preview locally (optional, for testing)
npm run pages:preview

# Step 4: Deploy to production
npx wrangler pages deploy
```

### Option 3: Direct Wrangler commands

```bash
cd biostream_landing-master

# Build the app
npm run build

# Convert for Cloudflare
npx @cloudflare/next-on-pages

# Deploy
npx wrangler pages deploy
```

## Environment Configuration

### Set Backend API URL

**Method 1: Edit wrangler.toml**
```toml
[vars]
NEXT_PUBLIC_API_URL = "https://your-backend.com"
```

**Method 2: Use Wrangler CLI**
```bash
wrangler pages secret put NEXT_PUBLIC_API_URL
# Enter your backend URL when prompted
```

**Method 3: Cloudflare Dashboard**
1. Go to Cloudflare Dashboard → Pages → Your Project
2. Settings → Environment Variables
3. Add `NEXT_PUBLIC_API_URL` with your backend URL

## Continuous Deployment (Git Integration)

### Automatic Deployments from Git

1. **Connect Repository**:
   - Cloudflare Dashboard → Pages → Create Project
   - Connect GitHub/GitLab repository
   
2. **Configure Build Settings**:
   ```
   Build command: npm run pages:build
   Build output directory: .vercel/output/static
   Root directory: biostream_landing-master
   ```

3. **Set Environment Variables** in dashboard:
   - `NEXT_PUBLIC_API_URL`: Your production backend URL

4. **Deploy Triggers**:
   - Push to `main` branch → Production deployment
   - Push to other branches → Preview deployments

## Common Issues & Solutions

### Build Fails
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run deploy
```

### Images Not Loading
- Ensure `images.unoptimized: true` in `next.config.ts` ✅ (already configured)
- Use external image URLs or CDN

### API Calls Fail After Deploy
- Update `NEXT_PUBLIC_API_URL` in wrangler.toml or Cloudflare dashboard
- Ensure backend CORS allows your Cloudflare domain

### Wrong Output Directory
- Cloudflare expects: `.vercel/output/static`
- Already configured in `wrangler.toml` ✅

## Verification Checklist

Before deploying:
- [ ] `next.config.ts` has `output: 'export'` ✅
- [ ] `next.config.ts` has `images.unoptimized: true` ✅
- [ ] `wrangler.toml` configured with correct output dir ✅
- [ ] Backend URL set in environment variables
- [ ] All dependencies installed (`npm install`)
- [ ] Backend is deployed and accessible
- [ ] CORS configured on backend for your domain

## Monitoring & Logs

```bash
# View deployment logs
wrangler pages deployment list

# View specific deployment logs
wrangler pages deployment tail <deployment-id>

# Check project status
wrangler pages project list
```

## Rollback

```bash
# List deployments
wrangler pages deployment list

# Rollback to previous deployment (via dashboard)
# Cloudflare Dashboard → Pages → Your Project → Deployments
# Click "..." on desired deployment → "Rollback"
```

## Cost & Limits

**Cloudflare Pages Free Tier**:
- ✅ Unlimited sites
- ✅ 500 builds/month
- ✅ 100 GB bandwidth/month
- ✅ Custom domains
- ✅ HTTPS included

---

**Remember**: The default deployment command is:
```bash
npx wrangler pages deploy
```

But using `npm run deploy` is better as it builds first! 🎯
