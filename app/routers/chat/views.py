from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.routers.chat.session import get_db, get_current_user, active_connections
from app.database import User, Contact

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")

@router.get("/chat", response_class=HTMLResponse)
async def chat_page(request: Request, username: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Render the main chat page with user's contacts"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Get all contacts of the current user
    contacts = db.query(Contact, User).join(
        User, Contact.contact_id == User.id
    ).filter(
        Contact.user_id == current_user.id
    ).all()
    
    contacts_list = []
    for contact, user in contacts:
        # Check if contact is in active connections
        status = "online" if user.username in active_connections else "offline"
        
        contact_data = {
            "id": user.id,
            "name": user.full_name or user.username,
            "username": user.username,
            "email": user.email,
            "avatar": "/static/images/shrek.jpg",  # Default avatar
            "status": status,
            "last_message": "Click to start chatting!",  # Placeholder 
            "last_message_time": "Now",  # Placeholder
            "unread_count": 0  # Placeholder
        }
        contacts_list.append(contact_data)
    
    return templates.TemplateResponse("chat.html", {
        "request": request,
        "username": username,
        "contacts": contacts_list
    })