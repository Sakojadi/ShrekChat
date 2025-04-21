from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.database import GroupMember, User, Message
from typing import List
from datetime import datetime
from app.routers.session import active_connections, id_to_username
import pytz

def format_message_time(timestamp: datetime) -> str:
    """Format message timestamp for display"""
    now = datetime.now(pytz.timezone('Asia/Bishkek'))
    
    if now.date() == timestamp.date():
        # Today, just show the time
        return timestamp.strftime("%H:%M")
    elif (now.date() - timestamp.date()).days == 1:
        # Yesterday
        return "Yesterday"
    else:
        # Other days, show date
        return timestamp.strftime("%d.%m.%Y")

def check_group_membership(db: Session, group_id: int, user_id: int) -> GroupMember:
    """Check if user is a member of the group and return membership record"""
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    return membership

def check_group_admin(db: Session, group_id: int, user_id: int) -> GroupMember:
    """Check if user is an admin of the group and return admin record"""
    admin = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
        GroupMember.is_admin == True
    ).first()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can perform this action"
        )
    
    return admin

async def broadcast_presence_update(user_id: int, status: str, db: Session) -> None:
    """Broadcast online/offline status to all contacts"""
    username = id_to_username.get(user_id)
    if not username:
        return
    
    # Get all direct chat rooms (non-group) where this user is a member
    from app.database import Room, room_members
    from sqlalchemy import and_
    
    # Find all direct chat rooms where user_id is a member
    direct_rooms = db.query(Room).filter(
        and_(
            Room.members.any(id=user_id),
            Room.is_group == False
        )
    ).all()
    
    # For each direct room, find the other member and send status update
    for room in direct_rooms:
        for member in room.members:
            # Skip self
            if member.id == user_id:
                continue
                
            # Send status update if other member is online
            if member.username in active_connections:
                await active_connections[member.username].send_json({
                    "type": "status_update",
                    "user_id": user_id,
                    "username": username,
                    "status": status
                })

async def send_read_receipts(sender_id: int, messages: List[Message]) -> None:
    """Send read receipts to message sender"""
    sender_username = id_to_username.get(sender_id)
    if not sender_username or sender_username not in active_connections:
        return
    
    for msg in messages:
        await active_connections[sender_username].send_json({
            "type": "read_receipt",
            "message_id": msg.id,
            "read_at": msg.read_at.isoformat() if msg.read_at else datetime.now(pytz.timezone('Asia/Bishkek')).isoformat()
        })

def reset_unread_count(room_id: int, user_id: int, db: Session) -> None:
    """Reset unread message count for a specific room and user"""
    from sqlalchemy import and_
    
    # Mark all unread messages in this room as read (only those sent by others)
    unread_messages = db.query(Message).filter(
        and_(
            Message.room_id == room_id,
            Message.sender_id != user_id,
            Message.read == False
        )
    ).all()
    
    # Update read status for all messages
    for message in unread_messages:
        message.read = True
        message.read_at = datetime.now(pytz.timezone('Asia/Bishkek'))
    
    db.commit()
    
    # Return number of messages marked as read
    return len(unread_messages)