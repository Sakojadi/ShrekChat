from fastapi import Request, HTTPException, status, WebSocket
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.database import SessionLocal, User

# WebSocket connections
active_connections: Dict[str, WebSocket] = {}
# Map usernames to user IDs
username_to_id: Dict[str, int] = {}
# Map user IDs to usernames
id_to_username: Dict[int, str] = {}

# Database dependency
def get_db():
    """Database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Chat middleware to check if user is logged in
def get_current_user(request: Request):
    """Get current logged-in user from session"""
    username = request.session.get("username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return username

def get_current_user_from_session(request: Request, db: Session) -> User:
    """Get current User object from session"""
    username = request.session.get("username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Not authenticated"
        )
    
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    
    return user