from fastapi import APIRouter, Request, Depends, HTTPException, status, Form, UploadFile, File, Response
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr
from typing import Optional, Any, List
import bcrypt
import jwt
import os
import shutil
import secrets
from pathlib import Path
from app.database import SessionLocal, User, get_db, BlockedUser
from app.routers.session import get_current_user_from_session as get_current_user
from sqlalchemy.orm import Session
from app.routers.session import manager

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")  # In production, use a secure key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
# Password reset token expiration (1 hour)
RESET_TOKEN_EXPIRE_MINUTES = 60

router = APIRouter(tags=["authentication"])
templates = Jinja2Templates(directory="app/templates")

# Directory to store uploaded avatars
UPLOAD_DIR = Path("app/static/uploads/avatars")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)  # Create the directory if it doesn't exist

# Pydantic models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    confirm_password: str

# Helper functions
def get_user(username: str):
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    db.close()
    return user

def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def authenticate_user(login_input: str, password: str):
    db = SessionLocal()
    try:
        # Try to find user by username or email without referencing registration_date
        # Use specific column selection to avoid ORM loading non-existent columns
        user = db.query(
            User.id, User.username, User.email, User.hashed_password, 
            User.full_name, User.bio, User.phone_number, User.country,
            User.is_online, User.last_seen, User.avatar
        ).filter(
            (User.username == login_input) | (User.email == login_input)
        ).first()
        
        if not user:
            return False
        if not verify_password(password, user.hashed_password):
            return False
        return user
    finally:
        db.close()

def create_password_reset_token(email: str):
    """Create a secure token for password reset"""
    token_data = {
        "sub": email,
        "exp": datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    }
    # Add some randomness to make the token more secure
    token_data["jti"] = secrets.token_hex(8)
    return jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

def verify_reset_token(token: str):
    """Verify the password reset token and return the user's email"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        exp = payload.get("exp")
        
        if email is None:
            return None
            
        # Check if token is expired
        if datetime.utcnow() > datetime.fromtimestamp(exp):
            return None
            
        return email
    except jwt.PyJWTError:
        return None

# Routes
@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("auth/login.html", {"request": request})

@router.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    user = authenticate_user(username, password)
    if not user:
        # Return the username input so it can be preserved in the form
        return templates.TemplateResponse(
            "auth/login.html", 
            {
                "request": request, 
                "error": "Invalid username or password",
                "username": username  # Pass the username back to preserve it
            }
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    # Generate WebSocket token using the manager
    ws_token = manager.create_token(user.username, user.id)
    
    # Update user's online status
    db = SessionLocal()
    try:
        db_user = db.query(User).filter(User.username == user.username).first()
        if db_user:
            db_user.is_online = True
            db_user.last_seen = datetime.utcnow()
            db.commit()
    except:
        db.rollback()
    finally:
        db.close()
    
    # Store tokens and user data in session
    request.session["access_token"] = access_token
    request.session["ws_token"] = ws_token
    request.session["username"] = user.username
    request.session["user_id"] = user.id
    
    return RedirectResponse("/chat", status_code=status.HTTP_303_SEE_OTHER)

@router.get("/register", response_class=HTMLResponse, name="register_page")
async def register_page(request: Request):
    return templates.TemplateResponse("auth/registration.html", {"request": request})

@router.post("/register")
async def register(request: Request, username: str = Form(...), email: str = Form(...), 
                  password: str = Form(...), confirm_password: str = Form(...)):
    if password != confirm_password:
        return templates.TemplateResponse(
            "auth/registration.html",
            {"request": request, "error": "Passwords do not match"}
        )
    db = SessionLocal()
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        db.close()
        return templates.TemplateResponse(
            "auth/registration.html",
            {"request": request, "error": "Username already exists"}
        )
    existing_email = db.query(User).filter(User.email == email).first()
    if existing_email:
        db.close()
        return templates.TemplateResponse(
            "auth/registration.html",
            {"request": request, "error": "Email already registered"}
        )
    hashed_password = get_password_hash(password)
    user = User(username=username, email=email, hashed_password=hashed_password, full_name=username)
    db.add(user)
    db.commit()
    db.close()
    return RedirectResponse("/login", status_code=status.HTTP_303_SEE_OTHER)

@router.get("/logout")
async def logout(request: Request):
    # Update user's online status to offline
    if "username" in request.session:
        db = SessionLocal()
        try:
            username = request.session["username"]
            user = db.query(User).filter(User.username == username).first()
            if user:
                user.is_online = False
                user.last_seen = datetime.utcnow()
                db.commit()
        except:
            db.rollback()
        finally:
            db.close()
    
    # Clear session
    request.session.clear()
    return RedirectResponse("/login")

# Password reset routes
@router.get("/reset-password", response_class=HTMLResponse)
async def reset_password_request_page(request: Request):
    """Render the password reset request page"""
    return templates.TemplateResponse("auth/reset_password/request.html", {"request": request})

@router.post("/reset-password")
async def reset_password_request(request: Request, email: str = Form(...)):
    """Handle the password reset request"""
    db = SessionLocal()
    try:
        # Find user by email
        user = db.query(User).filter(User.email == email).first()
        
        # We'll show the same message even if email doesn't exist for security reasons
        if not user:
            # In a real-world application, you would log this for monitoring
            print(f"Password reset requested for non-existent email: {email}")
            return templates.TemplateResponse(
                "auth/reset_password/request.html",
                {
                    "request": request,
                    "success": "Если указанный email зарегистрирован в системе, вы получите инструкции по сбросу пароля"
                }
            )
            
        # Generate a password reset token
        reset_token = create_password_reset_token(email)
        
        # In a real-world application, you would send an email with the reset link
        # For this example, we'll just show the link on the page for demonstration purposes
        reset_link = f"{request.base_url}reset-password/{reset_token}"
        
        print(f"Password reset link for {email}: {reset_link}")
        
        # Return success message to the user
        return templates.TemplateResponse(
            "auth/reset_password/request.html",
            {
                "request": request,
                "success": "Если указанный email зарегистрирован в системе, вы получите инструкции по сбросу пароля",
                "debug_link": reset_link  # In production, remove this and send an email instead
            }
        )
        
    finally:
        db.close()

@router.get("/reset-password/{token}", response_class=HTMLResponse)
async def reset_password_form(request: Request, token: str):
    """Render the password reset form"""
    # Verify token first
    email = verify_reset_token(token)
    if not email:
        # If token is invalid or expired, redirect to the request page with an error
        return templates.TemplateResponse(
            "auth/reset_password/request.html",
            {
                "request": request,
                "error": "Ссылка для сброса пароля недействительна или истекла. Пожалуйста, запросите новую ссылку."
            }
        )
        
    # Token is valid, show the reset form
    return templates.TemplateResponse(
        "auth/reset_password/reset.html",
        {
            "request": request,
            "token": token
        }
    )

@router.post("/reset-password/{token}")
async def reset_password_submit(
    request: Request, 
    token: str,
    password: str = Form(...),
    confirm_password: str = Form(...)
):
    """Handle the password reset submission"""
    # Verify token first
    email = verify_reset_token(token)
    if not email:
        # If token is invalid or expired, redirect to the request page with an error
        return templates.TemplateResponse(
            "auth/reset_password/request.html",
            {
                "request": request,
                "error": "Ссылка для сброса пароля недействительна или истекла. Пожалуйста, запросите новую ссылку."
            }
        )
    
    # Validate passwords
    if password != confirm_password:
        return templates.TemplateResponse(
            "auth/reset_password/reset.html",
            {
                "request": request,
                "token": token,
                "error": "Пароли не совпадают"
            }
        )
    
    if len(password) < 6:
        return templates.TemplateResponse(
            "auth/reset_password/reset.html",
            {
                "request": request,
                "token": token,
                "error": "Пароль должен содержать минимум 6 символов"
            }
        )
    
    # Update the user's password
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return templates.TemplateResponse(
                "auth/reset_password/reset.html",
                {
                    "request": request,
                    "token": token,
                    "error": "Пользователь не найден"
                }
            )
        
        # Update the password
        user.hashed_password = get_password_hash(password)
        db.commit()
        
        # Redirect to success page
        return RedirectResponse(
            "/reset-password/success",
            status_code=status.HTTP_303_SEE_OTHER
        )
    
    finally:
        db.close()

@router.get("/reset-password/success", response_class=HTMLResponse)
async def reset_password_success(request: Request):
    """Show success message after password reset"""
    return templates.TemplateResponse(
        "auth/reset_password/success.html",
        {"request": request}
    )

@router.post("/api/profile/update")
async def update_profile(
    request: Request,
    username: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    full_name: Optional[str] = Form(None),
    phone_number: Optional[str] = Form(None),
    country: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None)
):
    if "username" not in request.session:
        return {"success": False, "message": "Not authenticated"}

    current_username = request.session["username"]
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == current_username).first()
        if not user:
            return {"success": False, "message": "User not found"}

        # Handle avatar upload
        new_avatar_url = user.avatar  # Default to current avatar
        if avatar:
            # Validate file type
            if not avatar.content_type.startswith('image/'):
                return {"success": False, "message": "Invalid file type. Please upload an image."}
            
            # Generate a unique filename for the avatar
            file_extension = avatar.filename.split(".")[-1]
            avatar_filename = f"{user.id}_{current_username}.{file_extension}"
            avatar_path = UPLOAD_DIR / avatar_filename

            # Save the file to the server
            with avatar_path.open("wb") as buffer:
                shutil.copyfileobj(avatar.file, buffer)

            # Update the user's avatar path in the database
            user.avatar = f"/static/uploads/avatars/{avatar_filename}"
            new_avatar_url = user.avatar

        # Update other fields
        username_changed = False
        if username and username != user.username:
            existing_username = db.query(User).filter(User.username == username).first()
            if existing_username:
                return {"success": False, "message": "Username already in use"}
            user.username = username
            username_changed = True

        if email and email != user.email:
            existing_email = db.query(User).filter(User.email == email).first()
            if existing_email:
                return {"success": False, "message": "Email already in use"}
            user.email = email

        if full_name:
            user.full_name = full_name
        if phone_number:
            user.phone_number = phone_number
        if country:
            user.country = country
        if bio is not None:
            user.bio = bio

        # Save changes
        db.commit()

        # Broadcast avatar update to other users
        if avatar:  # Only broadcast if the avatar was updated
            try:
                from app.routers.websockets import broadcast_avatar_update
                await broadcast_avatar_update(user.id, new_avatar_url)
            except ImportError as e:
                print(f"Could not broadcast avatar update: {e}")

        # Update session if username changed
        if username_changed:
            access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = create_access_token(
                data={"sub": user.username}, expires_delta=access_token_expires
            )
            request.session["access_token"] = access_token
            request.session["username"] = user.username

        return {"success": True, "message": "Profile updated successfully"}
    except Exception as e:
        db.rollback()
        return {"success": False, "message": str(e)}
    finally:
        db.close()

@router.get("/api/profile")
async def get_profile(request: Request):
    # Check if user is logged in
    if "username" not in request.session:
        return {"success": False, "message": "Not authenticated"}
    
    username = request.session["username"]
    db = SessionLocal()
    try:
        # Get current user
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return {"success": False, "message": "User not found"}
        
        # Return user profile data
        return {
            "success": True, 
            "data": {
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name or "",
                "phone_number": user.phone_number or "",
                "country": user.country or "",
                "bio": user.bio or "",
                "avatar": user.avatar or "/static/images/default-avatar.jpg"  # Include avatar
            }
        }
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        db.close()

@router.post("/upload-avatar")
async def upload_avatar(request: Request, file: UploadFile = File(...)):
    """Endpoint to upload a new profile avatar."""
    # Get current user from session
    if "username" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    username = request.session["username"]
    user_id = request.session.get("user_id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in session")
    
    # Open database connection
    db = SessionLocal()
    try:
        # Get user from database
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image")
        
        # Create upload directory if it doesn't exist
        upload_dir = Path("app/static/uploads/avatars")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate a unique filename with timestamp to avoid caching issues
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        file_extension = os.path.splitext(file.filename)[1]
        avatar_filename = f"user_{user.id}_{timestamp}{file_extension}"
        
        # Save the file
        file_path = upload_dir / avatar_filename
        
        # Use proper way to write file in Python
        with open(file_path, "wb") as buffer:
            # Read file in chunks to handle large files
            contents = await file.read()
            buffer.write(contents)
        
        # Create URL path for database
        avatar_path = f"/static/uploads/avatars/{avatar_filename}"
        
        # Update user in database
        user.avatar = avatar_path
        db.commit()
        
        print(f"Avatar updated successfully for user {user.id} at path {avatar_path}")
        
        # Broadcast avatar update to other users
        try:
            from app.routers.websockets import broadcast_avatar_update
            await broadcast_avatar_update(user.id, avatar_path)
            print(f"Avatar update broadcast sent for user {user.id}")
        except Exception as e:
            print(f"Could not broadcast avatar update: {e}")
        
        return {"success": True, "message": "Avatar updated successfully", "avatar_url": avatar_path}
    
    except Exception as e:
        db.rollback()
        print(f"Avatar upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload avatar: {str(e)}")
    
    finally:
        db.close()

# User blocking endpoints
@router.post("/api/users/block/{user_id}")
async def block_user(request: Request, user_id: int):
    """Block a user by their ID"""
    if "username" not in request.session:
        return JSONResponse(status_code=401, content={"success": False, "message": "Not authenticated"})
    
    # Get current user
    current_username = request.session["username"]
    current_user_id = request.session.get("user_id")
    
    if not current_user_id:
        return JSONResponse(status_code=401, content={"success": False, "message": "User ID not found in session"})
    
    # Check if trying to block self
    if int(user_id) == int(current_user_id):
        return JSONResponse(status_code=400, content={"success": False, "message": "You cannot block yourself"})
    
    db = SessionLocal()
    try:
        # Check if user exists
        user_to_block = db.query(User).filter(User.id == user_id).first()
        if not user_to_block:
            return JSONResponse(status_code=404, content={"success": False, "message": "User not found"})
        
        # Check if already blocked
        existing_block = db.query(BlockedUser).filter(
            BlockedUser.user_id == current_user_id,
            BlockedUser.blocked_user_id == user_id
        ).first()
        
        if existing_block:
            return JSONResponse(status_code=400, content={"success": False, "message": "User is already blocked"})
        
        # Create new block relationship
        new_block = BlockedUser(
            user_id=current_user_id,
            blocked_user_id=user_id
        )
        
        db.add(new_block)
        db.commit()
        
        return JSONResponse(content={"success": True, "message": f"Successfully blocked user {user_to_block.username}"})
    
    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})
    
    finally:
        db.close()

@router.delete("/api/users/unblock/{user_id}")
async def unblock_user(request: Request, user_id: int):
    """Unblock a previously blocked user"""
    if "username" not in request.session:
        return JSONResponse(status_code=401, content={"success": False, "message": "Not authenticated"})
    
    # Get current user
    current_user_id = request.session.get("user_id")
    
    if not current_user_id:
        return JSONResponse(status_code=401, content={"success": False, "message": "User ID not found in session"})
    
    db = SessionLocal()
    try:
        # Find the block relationship
        block = db.query(BlockedUser).filter(
            BlockedUser.user_id == current_user_id,
            BlockedUser.blocked_user_id == user_id
        ).first()
        
        if not block:
            return JSONResponse(status_code=404, content={"success": False, "message": "User is not blocked"})
        
        # Delete the block
        db.delete(block)
        db.commit()
        
        return JSONResponse(content={"success": True, "message": "User unblocked successfully"})
    
    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})
    
    finally:
        db.close()

@router.get("/api/users/blocked")
async def get_blocked_users(request: Request):
    """Get a list of all users blocked by the current user"""
    if "username" not in request.session:
        return JSONResponse(status_code=401, content={"success": False, "message": "Not authenticated"})
    
    # Get current user
    current_user_id = request.session.get("user_id")
    
    if not current_user_id:
        return JSONResponse(status_code=401, content={"success": False, "message": "User ID not found in session"})
    
    db = SessionLocal()
    try:
        # Query for blocked relationships and join with User to get details
        blocked_users = db.query(
            User.id,
            User.username,
            User.full_name,
            User.avatar,
            BlockedUser.blocked_at
        ).join(
            BlockedUser, User.id == BlockedUser.blocked_user_id
        ).filter(
            BlockedUser.user_id == current_user_id
        ).all()
        
        # Convert to list of dictionaries
        result = []
        for user in blocked_users:
            result.append({
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name or user.username,
                "avatar": user.avatar,
                "blocked_at": user.blocked_at.isoformat() if user.blocked_at else None
            })
        
        return JSONResponse(content={"success": True, "blocked_users": result})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})
    
    finally:
        db.close()

@router.get("/api/users/check-blocked/{user_id}")
async def check_if_blocked(request: Request, user_id: int):
    """Check if a specific user is blocked or has blocked the current user"""
    if "username" not in request.session:
        return JSONResponse(status_code=401, content={"success": False, "message": "Not authenticated"})
    
    # Get current user
    current_user_id = request.session.get("user_id")
    
    if not current_user_id:
        return JSONResponse(status_code=401, content={"success": False, "message": "User ID not found in session"})
    
    db = SessionLocal()
    try:
        # Check if target user is blocked by current user
        is_blocked = db.query(BlockedUser).filter(
            BlockedUser.user_id == current_user_id,
            BlockedUser.blocked_user_id == user_id
        ).first() is not None
        
        # Check if current user is blocked by target user
        is_blocker = db.query(BlockedUser).filter(
            BlockedUser.user_id == user_id,
            BlockedUser.blocked_user_id == current_user_id
        ).first() is not None
        
        return JSONResponse(content={
            "success": True,
            "is_blocked": is_blocked,  # Current user has blocked the other user
            "is_blocker": is_blocker   # The other user has blocked the current user
        })
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})
    
    finally:
        db.close()