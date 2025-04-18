from fastapi import APIRouter, Request, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
import os
import uuid
import shutil

from app.database import User, GroupChat, GroupMember, GroupMessage, GroupMessageRead
from app.routers.session import get_db, get_current_user_from_session, active_connections
from app.routers.utils import format_message_time, check_group_membership, check_group_admin

router = APIRouter(prefix="/api/groups")

@router.get("")
async def get_user_groups(request: Request, db: Session = Depends(get_db)):
    """Get all groups the current user is a member of"""
    current_user = get_current_user_from_session(request, db)
    
    # Get all groups the user is a member of
    user_groups = db.query(GroupMember, GroupChat).join(
        GroupChat, GroupMember.group_id == GroupChat.id
    ).filter(
        GroupMember.user_id == current_user.id
    ).all()
    
    result = []
    for member, group in user_groups:
        # Get last message in the group
        last_message = db.query(GroupMessage).filter(
            GroupMessage.group_id == group.id
        ).order_by(GroupMessage.timestamp.desc()).first()
        
        # Calculate unread messages count
        unread_count = 0
        if last_message:
            read_messages_count = db.query(GroupMessageRead).filter(
                GroupMessageRead.user_id == current_user.id,
                GroupMessageRead.message_id.in_(
                    db.query(GroupMessage.id).filter(GroupMessage.group_id == group.id)
                )
            ).count()
            
            total_messages_count = db.query(GroupMessage).filter(
                GroupMessage.group_id == group.id
            ).count()
            
            unread_count = max(0, total_messages_count - read_messages_count)
        
        # Format last message and timestamp
        last_message_text = "Click to start chatting!"
        last_message_time = "Now"
        
        if last_message:
            # Get sender name
            sender = db.query(User).filter(User.id == last_message.sender_id).first()
            sender_name = sender.username if sender else "Unknown"
            
            # Format content
            content = last_message.content
            if len(content) > 30:
                content = content[:27] + "..."
                
            # Format message preview
            if sender.id == current_user.id:
                last_message_text = f"You: {content}"
            else:
                last_message_text = f"{sender_name}: {content}"
            
            # Format timestamp
            last_message_time = format_message_time(last_message.timestamp)
        
        # Get member count
        member_count = db.query(GroupMember).filter(
            GroupMember.group_id == group.id
        ).count()
        
        # Format group data
        group_data = {
            "id": group.id,
            "name": group.name,
            "description": group.description,
            "avatar": group.avatar,
            "created_at": group.created_at,
            "last_message": last_message_text,
            "last_message_time": last_message_time,
            "unread_count": unread_count,
            "member_count": member_count,
            "is_admin": member.is_admin,
            "type": "group"  # To distinguish from direct contacts
        }
        result.append(group_data)
    
    # Sort by last message time (most recent first)
    result.sort(key=lambda x: x["created_at"], reverse=True)
    
    return result

@router.post("")
async def create_group(
    request: Request,
    name: str = Form(...),
    description: str = Form(None),
    member_ids: str = Form(...),  # Comma-separated IDs
    db: Session = Depends(get_db)
):
    """Create a new group chat"""
    current_user = get_current_user_from_session(request, db)
    
    # Create new group
    new_group = GroupChat(
        name=name,
        description=description,
        created_at=datetime.utcnow()
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    
    # Add current user as admin
    creator_member = GroupMember(
        group_id=new_group.id,
        user_id=current_user.id,
        is_admin=True,
        added_at=datetime.utcnow()
    )
    db.add(creator_member)
    
    # Add other members
    try:
        member_id_list = [int(id.strip()) for id in member_ids.split(',') if id.strip()]
        for member_id in member_id_list:
            # Check if user exists
            user = db.query(User).filter(User.id == member_id).first()
            if user and user.id != current_user.id:
                member = GroupMember(
                    group_id=new_group.id,
                    user_id=user.id,
                    is_admin=False,
                    added_at=datetime.utcnow()
                )
                db.add(member)
    except ValueError:
        # Handle invalid ID format
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid member ID format")
    
    db.commit()
    
    # Return the created group
    return {
        "id": new_group.id,
        "name": new_group.name,
        "description": new_group.description,
        "created_at": new_group.created_at,
        "avatar": new_group.avatar,
        "member_count": len(member_id_list) + 1  # +1 for creator
    }

@router.get("/{group_id}")
async def get_group_details(group_id: int, request: Request, db: Session = Depends(get_db)):
    """Get details of a specific group"""
    current_user = get_current_user_from_session(request, db)
    
    # Check if user is member of the group
    is_member = check_group_membership(db, group_id, current_user.id)
    
    # Get group details
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    
    # Get group members
    members = db.query(GroupMember, User).join(
        User, GroupMember.user_id == User.id
    ).filter(
        GroupMember.group_id == group_id
    ).all()
    
    member_list = []
    for member, user in members:
        member_data = {
            "id": user.id,
            "name": user.full_name or user.username,
            "username": user.username,
            "email": user.email,
            "avatar": "/static/images/shrek.jpg",  # Default avatar
            "is_admin": member.is_admin,
            "status": "online" if user.username in active_connections else "offline",
            "added_at": member.added_at
        }
        member_list.append(member_data)
    
    # Sort members: admins first, then by added date
    member_list.sort(key=lambda x: (not x["is_admin"], x["added_at"]))
    
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "avatar": group.avatar,
        "created_at": group.created_at,
        "members": member_list,
        "is_admin": is_member.is_admin
    }

@router.put("/{group_id}")
async def update_group(
    group_id: int,
    request: Request,
    name: str = Form(None),
    description: str = Form(None),
    db: Session = Depends(get_db)
):
    """Update group details (admin only)"""
    current_user = get_current_user_from_session(request, db)
    
    # Check if user is admin
    check_group_admin(db, group_id, current_user.id)
    
    # Get group
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    
    # Update fields
    if name:
        group.name = name
    if description is not None:  # Allow empty description
        group.description = description
    
    db.commit()
    
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "avatar": group.avatar
    }

@router.post("/{group_id}/upload-avatar")
async def upload_group_avatar(
    group_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a group avatar (admin only)"""
    current_user = get_current_user_from_session(request, db)
    
    # Check if user is admin
    check_group_admin(db, group_id, current_user.id)
    
    # Create uploads directory if it doesn't exist
    upload_dir = os.path.join("app", "static", "uploads", "groups")
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"group_{group_id}_{uuid.uuid4().hex}{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update group avatar in database
    relative_path = f"/static/uploads/groups/{unique_filename}"
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    group.avatar = relative_path
    db.commit()
    
    return {"avatar_url": relative_path}

@router.post("/{group_id}/members")
async def add_group_members(
    group_id: int,
    request: Request,
    member_ids: str = Form(...),  # Comma-separated IDs
    db: Session = Depends(get_db)
):
    """Add members to a group (admin only)"""
    current_user = get_current_user_from_session(request, db)
    
    # Check if user is admin
    check_group_admin(db, group_id, current_user.id)
    
    # Get current members
    existing_members = db.query(GroupMember.user_id).filter(
        GroupMember.group_id == group_id
    ).all()
    existing_member_ids = [member[0] for member in existing_members]
    
    # Add new members
    try:
        member_id_list = [int(id.strip()) for id in member_ids.split(',') if id.strip()]
        added_members = []
        
        for member_id in member_id_list:
            # Skip if already a member
            if member_id in existing_member_ids:
                continue
                
            # Check if user exists
            user = db.query(User).filter(User.id == member_id).first()
            if user:
                member = GroupMember(
                    group_id=group_id,
                    user_id=user.id,
                    is_admin=False,
                    added_at=datetime.utcnow()
                )
                db.add(member)
                added_members.append({
                    "id": user.id,
                    "name": user.full_name or user.username,
                    "username": user.username
                })
        
        db.commit()
        return {"added_members": added_members}
        
    except ValueError:
        # Handle invalid ID format
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid member ID format")

@router.delete("/{group_id}/members/{member_id}")
async def remove_group_member(
    group_id: int, 
    member_id: int, 
    request: Request, 
    db: Session = Depends(get_db)
):
    """Remove a member from a group (admin only) or leave group (self)"""
    current_user = get_current_user_from_session(request, db)
    
    # Check admin status and self-removal
    is_admin = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
        GroupMember.is_admin == True
    ).first()
    
    is_self_removal = current_user.id == member_id
    
    if not is_admin and not is_self_removal:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can remove members")
    
    # Check if member exists
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == member_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in group")
    
    # Cannot remove the last admin
    if member.is_admin:
        admin_count = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.is_admin == True
        ).count()
        
        if admin_count == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last admin. Make someone else an admin first."
            )
    
    # Remove the member
    db.delete(member)
    db.commit()
    
    # Check if there are any members left
    remaining_members = db.query(GroupMember).filter(
        GroupMember.group_id == group_id
    ).count()
    
    # If no members left, delete the group
    if remaining_members == 0:
        group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
        if group:
            db.delete(group)
            db.commit()
            return {"status": "success", "message": "Member removed and group deleted (no members left)"}
    
    return {"status": "success", "message": "Member removed successfully"}

@router.put("/{group_id}/members/{member_id}")
async def update_member_status(
    group_id: int,
    member_id: int,
    request: Request,
    is_admin: bool = Form(...),
    db: Session = Depends(get_db)
):
    """Update a member's admin status (admin only)"""
    current_user = get_current_user_from_session(request, db)
    
    # Check if current user is admin
    check_group_admin(db, group_id, current_user.id)
    
    # Get the member to update
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == member_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in group")
    
    # Update admin status
    member.is_admin = is_admin
    db.commit()
    
    # Get user info for the member
    user = db.query(User).filter(User.id == member_id).first()
    
    return {
        "id": member_id,
        "name": user.full_name if user else "Unknown",
        "username": user.username if user else "Unknown",
        "is_admin": is_admin
    }

@router.post("/{group_id}/members/{member_id}/make-admin")
async def make_member_admin(
    group_id: int,
    member_id: int, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Make a group member an admin (admin only)"""
    current_user = get_current_user_from_session(request, db)
    
    # Check if current user is admin
    check_group_admin(db, group_id, current_user.id)
    
    # Get the member to update
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == member_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in group")
    
    # Update admin status
    member.is_admin = True
    db.commit()
    
    # Get user info for the member
    user = db.query(User).filter(User.id == member_id).first()
    
    return {
        "id": member_id,
        "name": user.full_name if user else "Unknown",
        "username": user.username if user else "Unknown",
        "is_admin": True
    }

@router.get("/{group_id}/messages")
async def get_group_messages(group_id: int, request: Request, db: Session = Depends(get_db)):
    """Get all messages for a group and mark them as read"""
    current_user = get_current_user_from_session(request, db)
    
    # Check if user is member of the group
    check_group_membership(db, group_id, current_user.id)
    
    # Get messages
    messages = db.query(GroupMessage).filter(
        GroupMessage.group_id == group_id
    ).order_by(GroupMessage.timestamp).all()
    
    # Mark all messages as read by current user
    for message in messages:
        # Check if already read
        read_receipt = db.query(GroupMessageRead).filter(
            GroupMessageRead.message_id == message.id,
            GroupMessageRead.user_id == current_user.id
        ).first()
        
        if not read_receipt:
            # Create read receipt
            new_read = GroupMessageRead(
                message_id=message.id,
                user_id=current_user.id,
                read_at=datetime.utcnow()
            )
            db.add(new_read)
    
    db.commit()
    
    # Format messages for frontend
    result = []
    for msg in messages:
        # Get sender info
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        sender_name = sender.full_name or sender.username if sender else "Unknown"
        
        time_str = msg.timestamp.strftime("%H:%M")
        is_own = msg.sender_id == current_user.id
        
        result.append({
            "id": msg.id,
            "content": msg.content,
            "sender_id": msg.sender_id,
            "sender_name": sender_name,
            "sender": "user" if is_own else "other",
            "time": time_str
        })
    
    return result