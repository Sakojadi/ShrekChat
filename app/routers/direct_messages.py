from fastapi import APIRouter, Request, Depends, HTTPException, status, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from typing import List, Dict, Any
from datetime import datetime

from app.database import User, Contact, Message
from app.routers.session import get_db, get_current_user_from_session, active_connections
from app.routers.utils import format_message_time, send_read_receipts

router = APIRouter(prefix="/api")

@router.get("/contacts", response_model=List[Dict[str, Any]])
async def get_contacts(request: Request, db: Session = Depends(get_db)):
    """Get all contacts of the current user"""
    current_user = get_current_user_from_session(request, db)
    
    # Get all contacts of the current user
    contacts = db.query(Contact, User).join(
        User, Contact.contact_id == User.id
    ).filter(
        Contact.user_id == current_user.id
    ).all()
    
    result = []
    for contact, user in contacts:
        # Check if contact is online
        status = "online" if user.username in active_connections else "offline"
        
        # Get the last message between the user and this contact
        last_sent_message = db.query(Message).filter(
            Message.sender_id == current_user.id,
            Message.recipient_id == user.id
        ).order_by(Message.timestamp.desc()).first()
        
        last_received_message = db.query(Message).filter(
            Message.sender_id == user.id,
            Message.recipient_id == current_user.id
        ).order_by(Message.timestamp.desc()).first()
        
        # Determine which message is more recent
        last_message = None
        if last_sent_message and last_received_message:
            last_message = last_sent_message if last_sent_message.timestamp > last_received_message.timestamp else last_received_message
        else:
            last_message = last_sent_message or last_received_message
            
        # Format last message and timestamp
        last_message_text = "Click to start chatting!"
        last_message_time = "Now"
        
        if last_message:
            # Truncate message content if too long
            content = last_message.content
            if len(content) > 30:
                content = content[:27] + "..."
                
            # Format timestamp
            last_message_time = format_message_time(last_message.timestamp)
            last_message_text = content
        
        # Get unread messages count
        unread_count = db.query(Message).filter(
            Message.sender_id == user.id,
            Message.recipient_id == current_user.id,
            Message.read == False
        ).count()
            
        contact_data = {
            "id": user.id,
            "name": user.full_name or user.username,
            "username": user.username,
            "email": user.email,
            "avatar": "/static/images/shrek.jpg",  # Default avatar
            "status": status,
            "last_message": last_message_text,
            "last_message_time": last_message_time,
            "unread_count": unread_count,
            "added_at": contact.added_at,
            "type": "contact"  # To distinguish from groups
        }
        result.append(contact_data)
    
    # Sort contacts by the most recent message
    result.sort(key=lambda x: x["added_at"] if x["last_message"] == "Click to start chatting!" else datetime.now(), reverse=True)
    
    return result

@router.post("/contacts/add")
async def add_contact(request: Request, contact_username: str = Form(...), db: Session = Depends(get_db)):
    """Add a new contact"""
    current_user = get_current_user_from_session(request, db)
    
    # Find contact user by username or email
    if "@" in contact_username:
        contact_user = db.query(User).filter(User.email == contact_username).first()
    else:
        contact_user = db.query(User).filter(User.username == contact_username).first()
    
    if not contact_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Check if trying to add self
    if current_user.id == contact_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, 
                          detail="You cannot add yourself as a contact")
    
    # Check if already contacts
    existing_contact = db.query(Contact).filter(
        Contact.user_id == current_user.id, 
        Contact.contact_id == contact_user.id
    ).first()
    
    if existing_contact:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, 
                          detail="This user is already in your contacts")
    
    try:
        # Create bidirectional relationship - add each other as contacts
        now = datetime.utcnow()
        
        # Current user adds contact
        contact1 = Contact(user_id=current_user.id, contact_id=contact_user.id, added_at=now)
        db.add(contact1)
        
        # Contact adds current user
        contact2 = Contact(user_id=contact_user.id, contact_id=current_user.id, added_at=now)
        db.add(contact2)
        
        db.commit()
        return {"status": "success", "message": f"Added {contact_username} to contacts"}
    
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, 
                          detail="Contact relationship already exists")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                          detail=f"Error adding contact: {str(e)}")

@router.delete("/contacts/remove/{contact_id}")
async def remove_contact(request: Request, contact_id: int, db: Session = Depends(get_db)):
    """Remove a contact (bidirectional)"""
    current_user = get_current_user_from_session(request, db)
    
    # Check if contact exists
    contact_user = db.query(User).filter(User.id == contact_id).first()
    if not contact_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    
    try:
        # Delete bidirectional relationship
        # First direction - user removes contact
        db.query(Contact).filter(
            Contact.user_id == current_user.id, 
            Contact.contact_id == contact_id
        ).delete()
        
        # Second direction - contact removes user
        db.query(Contact).filter(
            Contact.user_id == contact_id, 
            Contact.contact_id == current_user.id
        ).delete()
        
        db.commit()
        return {"status": "success", "message": "Contact removed successfully"}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                          detail=f"Error removing contact: {str(e)}")

@router.get("/messages/{contact_id}")
async def get_messages(contact_id: int, request: Request, db: Session = Depends(get_db)):
    """Get all messages between current user and contact"""
    current_user = get_current_user_from_session(request, db)
    
    # Get contact user
    contact_user = db.query(User).filter(User.id == contact_id).first()
    if not contact_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    
    # Get messages between current user and contact
    messages_sent = db.query(Message).filter(
        Message.sender_id == current_user.id,
        Message.recipient_id == contact_id
    ).all()
    
    messages_received = db.query(Message).filter(
        Message.sender_id == contact_id,
        Message.recipient_id == current_user.id
    ).all()
    
    # Mark received messages as read
    for msg in messages_received:
        if not msg.read:
            msg.read = True
            msg.read_at = datetime.utcnow()
    
    db.commit()
    
    # Notify the sender that their messages were read
    if contact_user.username in active_connections and messages_received:
        await send_read_receipts(contact_user.id, messages_received)
    
    # Combine and sort messages by timestamp
    all_messages = messages_sent + messages_received
    all_messages.sort(key=lambda x: x.timestamp)
    
    # Format messages for frontend
    result = []
    for msg in all_messages:
        time_str = msg.timestamp.strftime("%H:%M")
        if msg.sender_id == current_user.id:
            sender = "user"
            # Add delivery status
            status = "sent"
            if msg.delivered:
                status = "delivered"
            if msg.read:
                status = "read"
        else:
            sender = "contact"
            status = None  # No status for incoming messages
        
        result.append({
            "id": msg.id,
            "sender": sender,
            "content": msg.content,
            "time": time_str,
            "status": status
        })
    
    return result

@router.get("/users/search")
async def search_users(request: Request, query: str, db: Session = Depends(get_db)):
    """Search for users by username, email, or full name"""
    current_user = get_current_user_from_session(request, db)
    
    # Search for users
    users = db.query(User).filter(
        or_(
            User.username.like(f"%{query}%"),
            User.email.like(f"%{query}%"),
            User.full_name.like(f"%{query}%")
        )
    ).filter(
        User.username != current_user.username  # Don't return the current user
    ).limit(10).all()
    
    return [
        {
            "id": user.id, 
            "username": user.username, 
            "email": user.email, 
            "name": user.full_name or user.username
        } 
        for user in users
    ]