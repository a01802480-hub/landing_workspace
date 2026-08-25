from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict
from datetime import datetime, timedelta
import bcrypt
from jose import JWTError, jwt
import os

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

# Security configuration
_SECRET_ENV = os.getenv("JWT_SECRET_KEY", "")
_DEFAULT_SECRET = "your-secret-key-change-in-production"

if not _SECRET_ENV:
    import warnings
    warnings.warn(
        "⚠️  JWT_SECRET_KEY is not set — using the DEFAULT (insecure) secret. "
        "Set the JWT_SECRET_KEY environment variable in production. "
        "Anyone who knows this default secret can forge valid JWTs.",
        RuntimeWarning,
    )

SECRET_KEY = _SECRET_ENV if _SECRET_ENV else _DEFAULT_SECRET
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

security = HTTPBearer()

# In-memory user storage (replace with database in production)
users_db: Dict[str, dict] = {}
refresh_tokens_db: Dict[str, str] = {}  # token -> user_id

# Pydantic models
class UserCreate(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# Helper functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = decode_token(token)
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = users_db.get(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# Routes
@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """Register a new user"""
    # Check if user already exists
    if any(u["email"] == user_data.email.lower() for u in users_db.values()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user_id = f"user_{len(users_db) + 1}"
    hashed_password = get_password_hash(user_data.password)
    
    user = {
        "id": user_id,
        "email": user_data.email.lower(),
        "name": user_data.name,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow().isoformat()
    }
    
    users_db[user_id] = user
    
    # Generate tokens
    access_token = create_access_token(data={"sub": user_id})
    refresh_token = create_refresh_token(data={"sub": user_id})
    refresh_tokens_db[refresh_token] = user_id
    
    return {
        "message": "User registered successfully",
        "user": {
            "id": user_id,
            "email": user["email"],
            "name": user["name"]
        },
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@router.post("/login", response_model=dict)
async def login(login_data: UserLogin):
    """Login and get access token"""
    # Find user by email
    user = None
    for u in users_db.values():
        if u["email"] == login_data.email.lower():
            user = u
            break
    
    if user is None or not verify_password(login_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate tokens
    access_token = create_access_token(data={"sub": user["id"]})
    refresh_token = create_refresh_token(data={"sub": user["id"]})
    refresh_tokens_db[refresh_token] = user["id"]
    
    return {
        "message": "Login successful",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"]
        },
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@router.post("/refresh", response_model=dict)
async def refresh_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token.

    The refresh token is cryptographically verified (JWT signature + expiry)
    AND checked against the server-side allow-list. Both checks must pass.
    After use, the old refresh token is revoked and a new one is issued
    (refresh token rotation) to limit the window for token replay attacks.
    """
    # 1. Cryptographically verify the JWT
    try:
        payload = decode_token(request.refresh_token)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Check the server-side allow-list (defense against revoked tokens)
    user_id = refresh_tokens_db.get(request.refresh_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify the payload matches
    if payload.get("sub") != user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload mismatch",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Revoke the old refresh token (rotation)
    del refresh_tokens_db[request.refresh_token]

    # 4. Issue new tokens
    new_access_token = create_access_token(data={"sub": user_id})
    new_refresh_token = create_refresh_token(data={"sub": user_id})
    refresh_tokens_db[new_refresh_token] = user_id

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"]
    }

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout current user (invalidate refresh tokens)"""
    # Remove all refresh tokens for this user
    tokens_to_remove = [
        token for token, uid in refresh_tokens_db.items() 
        if uid == current_user["id"]
    ]
    for token in tokens_to_remove:
        del refresh_tokens_db[token]
    
    return {"message": "Logged out successfully"}
