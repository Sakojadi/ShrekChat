from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from models import UserCreate, Token
from database import get_db, create_tables
from datetime import datetime, timedelta
import jwt
import sqlite3
import hashlib
import os
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

# Initialize router
auth_routes = APIRouter()

# Password hashing with fallback
try:
    # Try to import passlib
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    print("Using passlib for password hashing")
except ImportError:
    # Fallback if passlib is not installed
    print("passlib not found, using fallback SHA-256 hasher")
    
    class FallbackPasswordHasher:
        def verify(self, plain_password, hashed_password):
            # Format: algorithm$salt$hash
            parts = hashed_password.split('$')
            if len(parts) != 3:
                return False
            
            algorithm, salt, stored_hash = parts
            if algorithm != 'sha256':
                return False
            
            computed_hash = hashlib.sha256((salt + plain_password).encode()).hexdigest()
            return computed_hash == stored_hash
        
        def hash(self, password):
            salt = os.urandom(16).hex()
            hash_value = hashlib.sha256((salt + password).encode()).hexdigest()
            return f"sha256${salt}${hash_value}"
    
    pwd_context = FallbackPasswordHasher()
except AttributeError:
    # Fallback if bcrypt has issues
    print("bcrypt issue detected, using fallback SHA-256 hasher")
    
    class FallbackPasswordHasher:
        def verify(self, plain_password, hashed_password):
            # Format: algorithm$salt$hash
            parts = hashed_password.split('$')
            if len(parts) != 3:
                return False
            
            algorithm, salt, stored_hash = parts
            if algorithm != 'sha256':
                return False
            
            computed_hash = hashlib.sha256((salt + plain_password).encode()).hexdigest()
            return computed_hash == stored_hash
        
        def hash(self, password):
            salt = os.urandom(16).hex()
            hash_value = hashlib.sha256((salt + password).encode()).hexdigest()
            return f"sha256${salt}${hash_value}"
    
    pwd_context = FallbackPasswordHasher()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def authenticate_user(username, password):
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            return False
        
        if not verify_password(password, user["password"]):
            return False
        
        return {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"]
        }

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Auth routes
@auth_routes.post("/register")
async def register(user: UserCreate):
    # Create tables if they don't exist
    create_tables()
    
    with get_db() as db:
        cursor = db.cursor()
        
        # Check if username already exists
        cursor.execute("SELECT * FROM users WHERE username = ?", (user.username,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail="Username already registered"
            )
        
        # Check if email already exists
        cursor.execute("SELECT * FROM users WHERE email = ?", (user.email,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )
        
        # Hash password and store user
        hashed_password = get_password_hash(user.password)
        
        try:
            cursor.execute(
                "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
                (user.username, user.email, hashed_password)
            )
            db.commit()
            
            return {"message": "User registered successfully"}
        except sqlite3.Error as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@auth_routes.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверное имя пользователя или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }
