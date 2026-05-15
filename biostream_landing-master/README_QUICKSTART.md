# BioStream Landing Page - Quick Start Guide

## 🚀 Running the Application Locally

### Prerequisites
- Node.js 18+ and npm installed

### Installation & Run

```bash
# Navigate to landing page directory
cd biostream_landing-master

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at: **http://localhost:3000**

---

## 🔐 Testing Authentication

### Test Credentials
- **Email:** `example@gmail.com`
- **Password:** `1234567`

### How to Test

1. Open http://localhost:3000
2. Click **"Sign In"** button (top right or "Get Started")
3. Enter the test credentials above
4. You'll be redirected to the **Workspace** page
5. Click **"Sign Out"** to return to home

### Features Available

✅ Sign In / Sign Up toggle  
✅ Email authentication (test mode)  
✅ Google OAuth button (placeholder)  
✅ GitHub OAuth button (placeholder)  
✅ Protected workspace route  
✅ Automatic redirect after login  
✅ Session persistence using localStorage  

---

## 📁 Project Structure

```
biostream_landing-master/
├── app/
│   ├── page.tsx              # Landing page with sign-in button
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   ├── signin/
│   │   └── page.tsx          # Sign-in/Sign-up page
│   └── workspace/
│       └── page.tsx          # Protected workspace page
├── package.json
├── tsconfig.json
└── AUTH_INTEGRATION_GUIDE.md # Full integration guide
```

---

## 🔧 Next Steps

### 1. Connect to Backend Server

See [`AUTH_INTEGRATION_GUIDE.md`](./AUTH_INTEGRATION_GUIDE.md) for detailed instructions on:
- Integrating with FastAPI backend
- Setting up JWT authentication
- Connecting Google OAuth
- Connecting GitHub OAuth
- Production deployment

### 2. Google OAuth Setup

Quick steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Set redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Add credentials to `.env.local`
5. Install NextAuth.js: `npm install next-auth`

See full guide in [`AUTH_INTEGRATION_GUIDE.md`](./AUTH_INTEGRATION_GUIDE.md)

### 3. GitHub OAuth Setup

Quick steps:
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App
3. Set callback URL: `http://localhost:3000/api/auth/callback/github`
4. Add credentials to `.env.local`

---

## 🎯 Current Implementation

### Authentication Flow

```
Landing Page (/)
    ↓ Click "Sign In"
Sign In Page (/signin)
    ↓ Enter credentials
Authentication Check
    ↓ Valid credentials
Workspace (/workspace)
    ↓ Click "Sign Out"
Landing Page (/)
```

### Storage (Test Mode)

Currently uses `localStorage`:
- `isAuthenticated`: "true" | "false"
- `user`: { email, name }

For production, replace with:
- JWT tokens
- HTTP-only cookies
- Backend session management

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:3000 | xargs kill -9
```

### Dependencies Issues
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
These are normal before running `npm install`. They will disappear after installation.

---

## 📚 Documentation

- **Quick Start**: This file
- **Full Integration Guide**: [`AUTH_INTEGRATION_GUIDE.md`](./AUTH_INTEGRATION_GUIDE.md)
- **Next.js Docs**: https://nextjs.org/docs

---

## ✨ Features to Implement

- [ ] Real backend integration
- [ ] Google OAuth
- [ ] GitHub OAuth
- [ ] Password reset functionality
- [ ] Email verification
- [ ] User profile management
- [ ] Persistent sessions
- [ ] Remember me option
- [ ] Two-factor authentication

---

## 🎨 Customization

### Change Test Credentials

Edit `app/signin/page.tsx`:
```typescript
if (email === 'your-email@example.com' && password === 'your-password') {
  // Authentication logic
}
```

### Styling

Uses Tailwind CSS. Modify classes in components to change appearance.

### Colors

Primary color: Indigo (`bg-indigo-600`)
Change in components or update Tailwind config.

---

## 🚀 Deployment

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Follow prompts to deploy.

---

## 📞 Support

For issues or questions:
1. Check [`AUTH_INTEGRATION_GUIDE.md`](./AUTH_INTEGRATION_GUIDE.md)
2. Review Next.js documentation
3. Check browser console for errors
