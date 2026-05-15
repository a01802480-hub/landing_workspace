# BioStream Authentication Integration Guide

This guide explains how to run the application locally, integrate it with a backend server, and connect Google/GitHub OAuth.

---

## 🚀 Running Locally (Current Setup)

### Quick Start

The landing page currently uses **localStorage** for authentication testing. Here's how to run it:

```bash
cd biostream_landing-master
npm install

```

Access at: `http://localhost:3000`

### Test Credentials
- **Email:** example@gmail.com
- **Password:** 1234567

### How It Works Now
1. User clicks "Sign In" → redirected to `/signin`
2. Enters test credentials → stored in localStorage
3. Redirected to `/workspace` (protected route)
4. Sign out clears localStorage and returns to home

---

## 🔧 Integrating with a Backend Server

To make authentication production-ready, you need to connect to a real backend. Here are two approaches:

### Option 1: Use Your Existing Biobackend (FastAPI)

#### Step 1: Add Authentication Endpoints to FastAPI

Create a new file: `protv3-main/Biobackend/auth_router.py`

```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import jwt
from datetime import datetime, timedelta
import os

router = APIRouter(prefix="/auth", tags=["Authentication"])

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

class LoginRequest(BaseModel):
    email: str
    password: str

class SignUpRequest(BaseModel):
    email: str
    password: str
    name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

# Mock user database (replace with real database)
users_db = {
    "example@gmail.com": {
        "email": "example@gmail.com",
        "password": "1234567",  # In production, hash this!
        "name": "Test User"
    }
}

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    user = users_db.get(request.email)
    
    if not user or user["password"] != request.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(
        data={"sub": user["email"], "name": user["name"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"email": user["email"], "name": user["name"]}
    }

@router.post("/signup", response_model=TokenResponse)
async def signup(request: SignUpRequest):
    if request.email in users_db:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    users_db[request.email] = {
        "email": request.email,
        "password": request.password,  # Hash in production!
        "name": request.name
    }
    
    access_token = create_access_token(
        data={"sub": request.email, "name": request.name}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"email": request.email, "name": request.name}
    }
```

#### Step 2: Register the Router in main.py

Add to `protv3-main/Biobackend/main.py`:

```python
from auth_router import router as auth_router


app.include_router(auth_router)
```

#### Step 3: Install JWT Library

```bash
cd protv3-main/Biobackend
pip install PyJWT
```

#### Step 4: Update Frontend to Use Backend

Modify `biostream_landing-master/app/signin/page.tsx`:

```typescript
const handleEmailAuth = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);

  try {
    const endpoint = isSignUp ? '/auth/signup' : '/auth/login';
    const response = await fetch('http://localhost:8000' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        ...(isSignUp && { name })
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Authentication failed');
    }

    const data = await response.json();
    
    // Store token
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('isAuthenticated', 'true');
    
    router.push('/workspace');
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

---

### Option 2: Use Next.js API Routes (Simpler)

Create `biostream_landing-master/app/api/auth/login/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: Request) {
  const { email, password } = await request.json();

  // Test credentials (replace with database query)
  if (email === 'example@gmail.com' && password === '1234567') {
    const token = jwt.sign(
      { email, name: 'Test User' },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    return NextResponse.json({
      access_token: token,
      user: { email, name: 'Test User' }
    });
  }

  return NextResponse.json(
    { error: 'Invalid credentials' },
    { status: 401 }
  );
}
```

Install JWT:
```bash
npm install jsonwebtoken
npm install @types/jsonwebtoken --save-dev
```

---

## 🔐 Integrating Google OAuth

### Method 1: Using NextAuth.js (Recommended)

#### Step 1: Install NextAuth

```bash
npm install next-auth
```

#### Step 2: Configure NextAuth

Create `biostream_landing-master/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
```

#### Step 3: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret

#### Step 4: Get GitHub OAuth Credentials

1. Go to [GitHub Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Set Homepage URL: `http://localhost:3000`
4. Set Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
5. Copy Client ID and generate Client Secret

#### Step 5: Create Environment Variables

Create `.env.local` in `biostream_landing-master/`:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-random-string
JWT_SECRET=your-jwt-secret-random-string
```

#### Step 6: Update Sign-In Page

Replace social auth handlers in `signin/page.tsx`:

```typescript
import { signIn } from 'next-auth/react';

const handleGoogleSignIn = () => {
  signIn('google', { callbackUrl: '/workspace' });
};

const handleGitHubSignIn = () => {
  signIn('github', { callbackUrl: '/workspace' });
};
```

Add import at top:
```typescript
'use client';
import { signIn } from 'next-auth/react';
```

---

### Method 2: Manual OAuth Implementation

If you prefer more control, implement OAuth manually:

#### Google OAuth Flow

```typescript
const handleGoogleSignIn = () => {
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!);
  googleAuthUrl.searchParams.set('redirect_uri', 'http://localhost:3000/auth/callback/google');
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  
  window.location.href = googleAuthUrl.toString();
};
```

Create callback handler `app/auth/callback/google/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect('/signin?error=no_code');
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'http://localhost:3000/auth/callback/google',
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenResponse.json();

  // Get user info
  const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  const user = await userInfo.json();

  // Create session
  const sessionToken = jwt.sign(user, process.env.JWT_SECRET!, { expiresIn: '1h' });

  const response = NextResponse.redirect('/workspace');
  response.cookies.set('session', sessionToken, { httpOnly: true });

  return response;
}
```

---

## 📦 Complete Setup with NPM Scripts

### Update package.json

Add these scripts to `biostream_landing-master/package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "dev:full": "concurrently \"npm run dev:backend\" \"npm run dev\"",
    "dev:backend": "cd ../protv3-main/Biobackend && python main.py",
    "setup": "npm install && cd ../protv3-main/Biobackend && pip install -r requirements.txt"
  }
}
```

Install concurrently:
```bash
npm install concurrently --save-dev
```

Now you can run everything with:
```bash
npm run dev:full
```

---

## 🔄 Auto-Start Workspace After Sign-In

The workspace already auto-starts after sign-in via the redirect in the authentication handler:

```typescript
// After successful authentication
router.push('/workspace');
```

The workspace page checks authentication on mount:
```typescript
useEffect(() => {
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  if (!isAuthenticated) {
    router.push('/signin');
  }
}, [router]);
```

---

## 🎯 Production Deployment Checklist

1. **Environment Variables**
   - Set `JWT_SECRET` to a strong random string
   - Configure OAuth credentials for production domains
   - Update redirect URIs in Google/GitHub consoles

2. **Database Integration**
   - Replace mock user database with PostgreSQL/MongoDB
   - Implement password hashing (bcrypt)
   - Add user registration validation

3. **Security**
   - Enable HTTPS
   - Add rate limiting
   - Implement CSRF protection
   - Use httpOnly cookies instead of localStorage for tokens

4. **Backend CORS**
   - Update allowed origins in FastAPI
   - Configure proper CORS headers

5. **Error Handling**
   - Add proper error boundaries
   - Implement retry logic
   - Add loading states

---

## 📝 Testing the Current Setup

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000`

3. Click "Sign In"

4. Use test credentials:
   - Email: `example@gmail.com`
   - Password: `1234567`

5. You'll be redirected to the workspace

6. Click "Sign Out" to return to home

---

## 🔗 Useful Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT Best Practices](https://jwt.io/introduction)

---

## ❓ Common Issues

### Google OAuth Not Working
- Check redirect URI matches exactly
- Ensure Google+ API is enabled
- Verify Client ID and Secret are correct

### CORS Errors
- Add frontend URL to backend's allowed origins
- Use proxy in development if needed

### Token Expiration
- Implement refresh token logic
- Redirect to sign-in when token expires

### Session Persistence
- Use cookies instead of localStorage for better security
- Implement "Remember Me" functionality
