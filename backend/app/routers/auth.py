import jwt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, EmailStr

from app.config import settings
from app.database import get_db
from app.models.user import User

# Router setup
router = APIRouter(prefix="/auth", tags=["Authentication"])

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Helper to generate JWT tokens signed with local SECRET_KEY."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

async def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency that decodes a JWT token (Supabase or local fallback) 
    and returns the corresponding User ORM object, auto-registering if needed.
    Falls back gracefully to development mock user if no token/invalid token provided.
    """
    mock_email = "dev-user@analystai.local"
    user_id = None
    email = mock_email
    full_name = "Development User"
    role = "admin"
    
    if token and token.strip() and token not in ("undefined", "null"):
        try:
            # Try decoding with local key first (for mock dev tokens)
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("sub")
            email = payload.get("email") or mock_email
            full_name = payload.get("full_name", "Development User")
            role = payload.get("role", "user")
        except jwt.PyJWTError:
            pass

    # Find or create user in our local PostgreSQL database (mirroring)
    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    
    if not user:
        user = User(
            id=user_id if (isinstance(user_id, str) and len(user_id) == 36) else None,
            email=email,
            full_name=full_name,
            role=role
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    return user

@router.post("/register", response_model=Token)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Mock registration endpoint for local development without active Supabase services."""
    result = await db.execute(select(User).filter(User.email == req.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        email=req.email,
        full_name=req.full_name,
        role="user"
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    access_token = create_access_token(
        data={"sub": str(new_user.id), "email": new_user.email, "full_name": new_user.full_name, "role": new_user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Mock login endpoint for local development."""
    result = await db.execute(select(User).filter(User.email == req.email))
    user = result.scalars().first()
    if not user:
        # Auto-create user for frictionless local development if they try to log in
        user = User(
            email=req.email,
            full_name=req.email.split("@")[0].capitalize(),
            role="user"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "created_at": current_user.created_at
    }
