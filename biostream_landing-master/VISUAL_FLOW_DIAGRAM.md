# BioStream Authentication - Visual Flow Diagram

## 🔄 Complete User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                    LANDING PAGE (/)                         │
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │  BioStream Logo                              │ [Sign In]│
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │   Advanced Bioinformatics                     │          │
│  │   Sequence Analysis                           │          │
│  │                                               │          │
│  │   Professional-grade tools for researchers    │          │
│  │                                               │          │
│  │   [Get Started]  [Learn More]                 │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  Features:                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │Alignment │ │  Fast    │ │   Data   │                   │
│  │  Tools   │ │Analysis  │ │Management│                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
└────────────────────┬────────────────────────────────────────┘
                     │ Click "Sign In" or "Get Started"
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                  SIGN IN PAGE (/signin)                     │
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │  [Sign In] | [Create Account]                │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │  [G] Continue with Google                    │          │
│  │  [🐙] Continue with GitHub                   │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│         ────── Or continue with email ──────               │
│                                                             │
│  Email:    [you@example.com        ]                       │
│  Password: [••••••••••             ]                       │
│                                                             │
│  Test: example@gmail.com / 1234567                         │
│                                                             │
│            [Sign In] button                                │
│                                                             │
│  Don't have an account? Create one                         │
└────────────────────┬────────────────────────────────────────┘
                     │ Enter credentials & submit
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              AUTHENTICATION CHECK                           │
│                                                             │
│  Current (Test Mode):                                       │
│  ┌──────────────────────────────────────────────┐          │
│  │  if email === "example@gmail.com" &&         │          │
│  │     password === "1234567"                   │          │
│  │  then SUCCESS ✓                              │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  Future (Production):                                       │
│  ┌──────────────────────────────────────────────┐          │
│  │  POST /api/auth/login                        │          │
│  │  → Validate credentials                      │          │
│  │  → Generate JWT token                        │          │
│  │  → Return token + user data                  │          │
│  └──────────────────────────────────────────────┘          │
└────────────────────┬────────────────────────────────────────┘
                     │ Authentication successful
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              STORE SESSION DATA                             │
│                                                             │
│  Test Mode (localStorage):                                  │
│  ┌──────────────────────────────────────────────┐          │
│  │  localStorage.setItem(                       │          │
│  │    'isAuthenticated', 'true'                 │          │
│  │  )                                           │          │
│  │  localStorage.setItem(                       │          │
│  │    'user', JSON.stringify({                  │          │
│  │      email: 'example@gmail.com',             │          │
│  │      name: 'Test User'                       │          │
│  │    })                                        │          │
│  │  )                                           │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  Production (JWT + Cookies):                                │
│  ┌──────────────────────────────────────────────┐          │
│  │  Set-Cookie: token=eyJhbG...; HttpOnly       │          │
│  │  localStorage.setItem('user', userData)      │          │
│  └──────────────────────────────────────────────┘          │
└────────────────────┬────────────────────────────────────────┘
                     │ Automatic redirect
                     ↓
┌─────────────────────────────────────────────────────────────┐
│               WORKSPACE (/workspace)                        │
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │  BioStream  Welcome, Test User      [Sign Out]│          │
│  │               test@example.com                │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  Welcome back, Test User!                                   │
│  Ready to analyze some sequences?                           │
│                                                             │
│  Quick Actions:                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ New      │ │ My       │ │Settings  │                   │
│  │Analysis  │ │Projects  │ │          │                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
│                                                             │
│  Recent Activity:                                           │
│  ┌──────────────────────────────────────────────┐          │
│  │  No recent activity yet                      │          │
│  │  Start a new analysis to see your work here  │          │
│  └──────────────────────────────────────────────┘          │
└────────────────────┬────────────────────────────────────────┘
                     │ Click "Sign Out"
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                  CLEAR SESSION                              │
│                                                             │
│  Test Mode:                                                 │
│  ┌──────────────────────────────────────────────┐          │
│  │  localStorage.removeItem(                    │          │
│  │    'isAuthenticated'                         │          │
│  │  )                                           │          │
│  │  localStorage.removeItem('user')             │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  Production:                                                │
│  ┌──────────────────────────────────────────────┐          │
│  │  Clear cookie                                │          │
│  │  POST /api/auth/logout                       │          │
│  │  Invalidate JWT token                        │          │
│  └──────────────────────────────────────────────┘          │
└────────────────────┬────────────────────────────────────────┘
                     │ Redirect to home
                     ↓
              Back to Landing Page (/)
```

---

## 🔐 Authentication Methods Comparison

### Current Implementation (Test Mode)

```javascript
// Sign In Handler
const handleEmailAuth = async (e) => {
  e.preventDefault();
  
  // Simulate API call
  setTimeout(() => {
    if (email === 'example@gmail.com' && password === '1234567') {
      // Store in localStorage
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user', JSON.stringify({
        email: 'example@gmail.com',
        name: 'Test User'
      }));
      
      // Redirect to workspace
      router.push('/workspace');
    } else {
      setError('Invalid credentials');
    }
  }, 500);
};
```

**Pros:**
- ✅ No backend required
- ✅ Instant setup
- ✅ Perfect for UI testing
- ✅ Easy to understand

**Cons:**
- ❌ Not secure
- ❌ Credentials hardcoded
- ❌ No real authentication
- ❌ Cannot scale

---

### Production Implementation (Backend Integration)

```javascript
// Sign In Handler with Backend
const handleEmailAuth = async (e) => {
  e.preventDefault();
  
  try {
    // Call real backend API
    const response = await fetch('http://localhost:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    // Store JWT token
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    // Redirect to workspace
    router.push('/workspace');
  } catch (error) {
    setError(error.message);
  }
};
```

**Backend (FastAPI):**
```python
@router.post("/login")
async def login(request: LoginRequest):
    # Verify credentials against database
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate JWT token
    access_token = create_access_token(
        data={"sub": user.email, "name": user.name}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"email": user.email, "name": user.name}
    }
```

**Pros:**
- ✅ Secure authentication
- ✅ Real user management
- ✅ Scalable
- ✅ Token expiration
- ✅ Password hashing

**Cons:**
- ❌ Requires backend setup
- ❌ More complex
- ❌ Database needed

---

## 🌐 Google OAuth Flow

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Your App   │         │   Google     │         │   Your       │
│              │         │   Auth       │         │   Backend    │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │  1. Click "Sign in     │                        │
       │     with Google"       │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │  2. Show Google        │                        │
       │     login page         │                        │
       │<───────────────────────│                        │
       │                        │                        │
       │  3. User logs in       │                        │
       │     and grants         │                        │
       │     permission         │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │  4. Redirect with      │                        │
       │     authorization      │                        │
       │     code               │                        │
       │<───────────────────────│                        │
       │                        │                        │
       │  5. Exchange code for  │                        │
       │     access token       │                        │
       │────────────────────────────────────────────────>│
       │                        │                        │
       │  6. Return user info   │                        │
       │     + JWT token        │                        │
       │<────────────────────────────────────────────────│
       │                        │                        │
       │  7. Store token &      │                        │
       │     redirect to        │                        │
       │     workspace          │                        │
       │                        │                        │
```

---

## 📊 State Management Flow

### Test Mode (Current)

```
┌─────────────────┐
│  User Action    │
│  (Sign In)      │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Update          │
│ localStorage    │
│                 │
│ isAuthenticated │
│ = "true"        │
│                 │
│ user = {...}    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ React Router    │
│ redirects to    │
│ /workspace      │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Workspace       │
│ checks          │
│ localStorage on │
│ mount           │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ If valid:       │
│ Show workspace  │
│                 │
│ If invalid:     │
│ Redirect to     │
│ /signin         │
└─────────────────┘
```

### Production Mode (Future)

```
┌─────────────────┐
│  User Action    │
│  (Sign In)      │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ POST to         │
│ /api/auth/login │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Backend         │
│ validates &     │
│ returns JWT     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Store JWT in    │
│ httpOnly cookie │
│ Store user in   │
│ state/context   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Redirect to     │
│ /workspace      │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Middleware      │
│ validates JWT   │
│ on each request │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ If valid:       │
│ Allow access    │
│                 │
│ If invalid:     │
│ Redirect to     │
│ /signin         │
└─────────────────┘
```

---

## 🎯 Route Protection Logic

```typescript
// app/workspace/page.tsx

export default function Workspace() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check authentication on component mount
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const userData = localStorage.getItem('user');

    if (!isAuthenticated || !userData) {
      // Not authenticated - redirect to sign in
      router.push('/signin');
      return;
    }

    // Authenticated - set user data
    setUser(JSON.parse(userData));
  }, [router]);

  if (!user) {
    // Show loading while checking auth
    return <LoadingSpinner />;
  }

  // Show workspace
  return <WorkspaceContent user={user} />;
}
```

---

## 🚀 Development vs Production

| Feature | Development (Now) | Production (Future) |
|---------|------------------|---------------------|
| **Auth Method** | localStorage | JWT + Cookies |
| **Credentials** | Hardcoded | Database |
| **Password** | Plain text | Hashed (bcrypt) |
| **Session** | Browser storage | HTTP-only cookies |
| **Google OAuth** | Placeholder | Fully integrated |
| **GitHub OAuth** | Placeholder | Fully integrated |
| **Security** | None | Full security |
| **Scalability** | Single user | Unlimited users |
| **Backend** | Not needed | Required |

---

## 📝 Code Snippets Reference

### Test Credentials Check
```typescript
if (email === 'example@gmail.com' && password === '1234567') {
  // Success
}
```

### localStorage Operations
```typescript
// Store
localStorage.setItem('key', 'value');
localStorage.setItem('user', JSON.stringify({ email, name }));

// Retrieve
const value = localStorage.getItem('key');
const user = JSON.parse(localStorage.getItem('user'));

// Remove
localStorage.removeItem('key');
localStorage.clear();
```

### Navigation
```typescript
import { useRouter } from 'next/navigation';

const router = useRouter();
router.push('/workspace');  // Navigate to workspace
router.push('/signin');     // Navigate to sign in
router.back();              // Go back
```

### Form Handling
```typescript
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');

<form onSubmit={handleSubmit}>
  <input 
    type="email" 
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
  <input 
    type="password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
  />
  <button type="submit">Sign In</button>
</form>
```

---

## 🎨 UI Component Hierarchy

```
App
├── Landing Page (/)
│   ├── Header
│   │   ├── Logo
│   │   └── Sign In Button → /signin
│   ├── Hero Section
│   │   ├── Title
│   │   ├── Description
│   │   └── CTA Buttons
│   └── Features Grid
│       ├── Feature Card 1
│       ├── Feature Card 2
│       └── Feature Card 3
│
├── Sign In Page (/signin)
│   ├── Logo
│   ├── Auth Mode Toggle
│   │   ├── Sign In Tab
│   │   └── Create Account Tab
│   ├── Social Auth Buttons
│   │   ├── Google Button
│   │   └── GitHub Button
│   ├── Divider
│   ├── Email Form
│   │   ├── Name Field (sign up only)
│   │   ├── Email Field
│   │   ├── Password Field
│   │   └── Submit Button
│   └── Toggle Link
│
└── Workspace (/workspace)
    ├── Header
    │   ├── Logo
    │   ├── User Info
    │   └── Sign Out Button
    ├── Welcome Section
    ├── Quick Actions Grid
    │   ├── New Analysis Card
    │   ├── My Projects Card
    │   └── Settings Card
    └── Recent Activity
```

---

This visual guide shows exactly how everything works together! 🎉