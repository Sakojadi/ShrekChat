from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from sqlalchemy.sql import text
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.routers.session import get_db, get_current_user
from app.database import User, Room, Message, room_members, GroupChat
from app.routers.websockets import notify_new_room  # Import the new notification function

# Add Pydantic model for request validation
class DirectMessageRequest(BaseModel):
    username_to_add: str

router = APIRouter(prefix="/api")

# Get all rooms for current user
@router.get("/rooms")
async def get_rooms(username: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all chat rooms for the current user"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Get all rooms where the user is a member
    rooms = db.query(Room).join(
        room_members, Room.id == room_members.c.room_id
    ).filter(
        room_members.c.user_id == current_user.id
    ).all()
    
    result = []
    for room in rooms:
        # Get latest message in the room
        latest_message = db.query(Message).filter(
            Message.room_id == room.id
        ).order_by(desc(Message.timestamp)).first()
        
        # For group chats
        if room.is_group:
            # Get group info
            group_chat = db.query(func.count(room_members.c.user_id).label('member_count')).filter(
                room_members.c.room_id == room.id
            ).scalar()
            
            # Count unread messages
            unread_count = db.query(func.count(Message.id)).filter(
                and_(
                    Message.room_id == room.id,
                    Message.sender_id != current_user.id,
                    Message.read == False
                )
            ).scalar()
            
            # Get group info for avatar
            group_info = db.query(GroupChat).filter(GroupChat.id == room.id).first()
            
            result.append({
                "id": room.id,
                "name": room.name,
                "is_group": True,
                "avatar": group_info.avatar if group_info else "/static/images/shrek-logo.png",
                "description": group_info.description if group_info else "",
                "member_count": group_chat,
                "last_message": latest_message.content if latest_message else "Group created. Click to start chatting!",
                "last_message_time": latest_message.timestamp.strftime("%H:%M") if latest_message else "Now",
                "unread_count": unread_count
            })
        # For direct chats
        else:
            # Get the other user in the room
            other_user = db.query(User).join(
                room_members, User.id == room_members.c.user_id
            ).filter(
                and_(
                    room_members.c.room_id == room.id,
                    User.id != current_user.id
                )
            ).first()
            
            # If no other user found, this might be a self-chat
            if not other_user:
                other_user = current_user
                
            # Count unread messages
            unread_count = db.query(func.count(Message.id)).filter(
                and_(
                    Message.room_id == room.id,
                    Message.sender_id != current_user.id,
                    Message.read == False
                )
            ).scalar()
            
            # Craft room name from other user's info
            room_name = other_user.full_name or other_user.username
            
            result.append({
                "id": room.id,
                "name": room_name,
                "username": other_user.username,
                "avatar": other_user.avatar or "/static/images/shrek.jpg",
                "user_id": other_user.id,
                "is_group": False,
                "last_message": latest_message.content if latest_message else "Click to start chatting!",
                "last_message_time": latest_message.timestamp.strftime("%H:%M") if latest_message else "Now",
                "unread_count": unread_count,
                "status": "online" if other_user.is_online else "offline"
            })
    
    # Sort by latest message time
    result.sort(key=lambda x: x.get("last_message_time", "1900-01-01") or "1900-01-01", reverse=True)
    
    return result

# Get or create a direct message room with another user
@router.get("/rooms/direct/{user_id}")
async def get_direct_room(
    user_id: int, 
    username: str = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Get or create a direct message room with another user"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Get target user
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found")
    
    # Check if a direct room already exists between these users
    existing_room = db.query(Room).join(
        room_members, Room.id == room_members.c.room_id
    ).filter(
        and_(
            Room.is_group == False,  # Direct chat only
            room_members.c.user_id == current_user.id
        )
    ).join(
        room_members.table, and_(
            room_members.c.room_id == Room.id,
            room_members.c.user_id == target_user.id
        )
    ).first()
    
    if existing_room:
        # Room exists, return it
        return {
            "id": existing_room.id,
            "name": target_user.full_name or target_user.username,
            "username": target_user.username,
            "avatar": target_user.avatar,
            "is_group": False
        }
    
    # Create new direct message room
    new_room = Room(
        name=f"DM: {current_user.username} - {target_user.username}",  # Internal name
        is_group=False,
        created_at=datetime.utcnow()
    )
    db.add(new_room)
    db.flush()  # Get ID of new room
    
    # Add both users to the room
    from sqlalchemy import insert
    db.execute(
        insert(room_members).values(
            room_id=new_room.id,
            user_id=current_user.id,
            joined_at=datetime.utcnow()
        )
    )
    db.execute(
        insert(room_members).values(
            room_id=new_room.id,
            user_id=target_user.id,
            joined_at=datetime.utcnow()
        )
    )
    
    db.commit()
    
    # Notify the target user about the new room
    await notify_new_room(new_room.id, target_user.id, current_user, db)
    
    return {
        "id": new_room.id,
        "name": target_user.full_name or target_user.username,
        "username": target_user.username,
        "avatar": target_user.avatar,
        "is_group": False
    }

# Create a direct message room with another user by username
@router.post("/rooms/direct")
async def create_direct_room_by_username(
    request_data: DirectMessageRequest,
    username: str = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Create a direct message room with another user by username"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    username_to_add = request_data.username_to_add
    if not username_to_add:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username to add is required")
    
    # Get target user
    target_user = db.query(User).filter(User.username == username_to_add).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Can't add self
    if current_user.id == target_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot create chat with yourself")
    
    # Check if a direct room already exists between these users
    # Fixed join syntax for correct query
    existing_room = db.query(Room).filter(Room.is_group == False).filter(
        Room.id.in_(
            db.query(room_members.c.room_id).filter(
                room_members.c.user_id == current_user.id
            ).intersect(
                db.query(room_members.c.room_id).filter(
                    room_members.c.user_id == target_user.id
                )
            )
        )
    ).first()
        
    if existing_room:
        return {
            "id": existing_room.id,
            "name": target_user.full_name or target_user.username,
            "username": target_user.username,
            "avatar": target_user.avatar,
            "is_group": False
        }
    
    # Create new direct message room
    new_room = Room(
        name=f"DM: {current_user.username} - {target_user.username}",  # Internal name
        is_group=False,
        created_at=datetime.utcnow()
    )
    db.add(new_room)
    db.flush()  # Get ID of new room
    
    # Add both users to the room
    from sqlalchemy import insert
    db.execute(
        insert(room_members).values(
            room_id=new_room.id,
            user_id=current_user.id,
            joined_at=datetime.utcnow()
        )
    )
    db.execute(
        insert(room_members).values(
            room_id=new_room.id,
            user_id=target_user.id,
            joined_at=datetime.utcnow()
        )
    )
    
    db.commit()
    
    # Notify the target user about the new room
    await notify_new_room(new_room.id, target_user.id, current_user, db)
    
    return {
        "id": new_room.id,
        "name": target_user.full_name or target_user.username,
        "username": target_user.username,
        "avatar": target_user.avatar,
        "is_group": False
    }

# Get messages from a specific room
@router.get("/messages/{room_id}")
async def get_room_messages(
    room_id: int, 
    before_id: Optional[int] = None,
    limit: int = 20,
    username: str = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Get messages from a specific room with pagination"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Check if room exists
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    
    # Check if user is a member of this room
    is_member = db.query(room_members).filter(
        and_(
            room_members.c.room_id == room_id,
            room_members.c.user_id == current_user.id
        )
    ).first() is not None
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this room"
        )
    
    # Get messages with pagination
    query = db.query(Message).filter(Message.room_id == room_id)
    
    if before_id:
        query = query.filter(Message.id < before_id)
    
    messages = query.order_by(desc(Message.timestamp)).limit(limit).all()
    
    # Format messages
    result = []
    for message in reversed(messages):  # Reverse to get chronological order
        sender = db.query(User).filter(User.id == message.sender_id).first()
        
        result.append({
            "id": message.id,
            "content": message.content,
            "sender_id": message.sender_id,
            "sender": "user" if message.sender_id == current_user.id else sender.username if sender else "unknown",
            "sender_name": sender.full_name or sender.username if sender else "Unknown",
            "timestamp": message.timestamp.isoformat(),
            "time": message.timestamp.strftime("%H:%M"),
            "delivered": message.delivered,
            "read": message.read
        })
    
    # Mark unread messages as read
    unread_messages = db.query(Message).filter(
        and_(
            Message.room_id == room_id,
            Message.sender_id != current_user.id,
            Message.read == False
        )
    ).all()
    
    for msg in unread_messages:
        msg.read = True
        msg.read_at = datetime.utcnow()
    
    db.commit()
    
    return result

# Search for users
@router.get("/users/search")
async def search_users(
    query: str,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search for users by username or full name"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Search for users
    search_pattern = f"%{query}%"
    users = db.query(User).filter(
        and_(
            or_(
                User.username.ilike(search_pattern),
                User.full_name.ilike(search_pattern)
            ),
            User.id != current_user.id  # Exclude current user
        )
    ).limit(10).all()
    
    result = []
    for user in users:
        # Check if direct chat room exists with this user
        direct_room = db.query(Room).join(
            room_members, Room.id == room_members.c.room_id
        ).filter(
            and_(
                Room.is_group == False,
                room_members.c.user_id == current_user.id
            )
        ).join(
            room_members, and_(
                room_members.c.room_id == Room.id, 
                room_members.c.user_id == user.id
            )
        ).first()
        
        result.append({
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "avatar": user.avatar,
            "has_chat": direct_room is not None,
            "room_id": direct_room.id if direct_room else None
        })
    
    return result