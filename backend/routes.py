from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from models import User, UserCreate, Message, Token
from database import get_db, create_tables
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
import sqlite3

# Initialize routers
auth_routes = APIRouter()
chat_routes = APIRouter()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = "your-secret-key-for-jwt"  # In production, use an environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

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

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        with get_db() as db:
            cursor = db.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            user = cursor.fetchone()
            
            if user is None:
                raise HTTPException(status_code=401, detail="User not found")
            
            return {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"]
            }
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

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
            detail="Incorrect username or password",
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

# Chat routes
@chat_routes.post("/send")
async def send_message(message: Message, current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            cursor.execute(
                "INSERT INTO messages (sender, receiver, content, timestamp) VALUES (?, ?, ?, ?)",
                (message.sender, message.receiver, message.content, message.timestamp)
            )
            db.commit()
            
            return {"message": "Message sent successfully", "id": cursor.lastrowid}
        except sqlite3.Error as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@chat_routes.get("/messages/{contact}")
async def get_messages(contact: str, current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            # Get messages where current user is sender or receiver and contact is the other party
            cursor.execute(
                """
                SELECT * FROM messages 
                WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
                ORDER BY timestamp ASC
                """,
                (current_user["username"], contact, contact, current_user["username"])
            )
            
            messages = cursor.fetchall()
            return {"messages": messages}
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@chat_routes.get("/contacts")
async def get_contacts(current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            # Find all distinct users that have exchanged messages with the current user
            cursor.execute(
                """
                SELECT DISTINCT 
                    CASE 
                        WHEN sender = ? THEN receiver 
                        ELSE sender 
                    END as contact_name
                FROM messages
                WHERE sender = ? OR receiver = ?
                """,
                (current_user["username"], current_user["username"], current_user["username"])
            )
            
            contacts = cursor.fetchall()
            return {"contacts": [contact["contact_name"] for contact in contacts]}
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
