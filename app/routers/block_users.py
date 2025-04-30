
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List
from datetime import datetime
import json

from app.routers.session import get_db, get_current_user
from app.database import User, BlockedUser
from app.routers.websockets import notify_block_status_change

router = APIRouter(prefix="/api/users")

# Block a user
@router.post("/block/{user_id}")
async def block_user(
    user_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Block a user by ID"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Get user to block
    user_to_block = db.query(User).filter(User.id == user_id).first()
    if not user_to_block:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User to block not found")

    # Cannot block yourself
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot block yourself"
        )

    # Check if already blocked
    already_blocked = db.query(BlockedUser).filter(
        and_(
            BlockedUser.user_id == current_user.id,
            BlockedUser.blocked_user_id == user_id
        )
    ).first()

    if already_blocked:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"success": True, "message": "User is already blocked"}
        )

    # Create block entry
    new_block = BlockedUser(
        user_id=current_user.id,
        blocked_user_id=user_id,
        blocked_at=datetime.utcnow()
    )
    db.add(new_block)
    db.commit()

    # Send WebSocket notification to both users
    await notify_block_status_change(current_user.id, user_id, True)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"success": True, "message": "User has been blocked"}
    )

# Unblock a user
@router.delete("/unblock/{user_id}")
async def unblock_user(
    user_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unblock a user by ID"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Get user to unblock
    user_to_unblock = db.query(User).filter(User.id == user_id).first()
    if not user_to_unblock:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User to unblock not found")

    # Delete block entry
    block_entry = db.query(BlockedUser).filter(
        and_(
            BlockedUser.user_id == current_user.id,
            BlockedUser.blocked_user_id == user_id
        )
    ).first()

    if not block_entry:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"success": True, "message": "User is not blocked"}
        )

    db.delete(block_entry)
    db.commit()

    # Send WebSocket notification to both users
    await notify_block_status_change(current_user.id, user_id, False)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"success": True, "message": "User has been unblocked"}
    )

# Check if a user is blocked
@router.get("/check-blocked/{user_id}")
async def check_if_blocked(
    user_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if a user is blocked or is a blocker"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Check if target user exists
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found")

    # Check if current user has blocked target user
    is_blocked = db.query(BlockedUser).filter(
        and_(
            BlockedUser.user_id == current_user.id,
            BlockedUser.blocked_user_id == user_id
        )
    ).first() is not None

    # Check if current user is blocked by target user
    is_blocker = db.query(BlockedUser).filter(
        and_(
            BlockedUser.user_id == user_id,
            BlockedUser.blocked_user_id == current_user.id
        )
    ).first() is not None

    return {
        "success": True,
        "is_blocked": is_blocked,
        "is_blocker": is_blocker
    }

# Get all blocked users
@router.get("/blocked")
async def get_blocked_users(
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all users blocked by the current user"""
    # Get current user
    current_user = db.query(User).filter(User.username == username).first()
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Get all blocked users
    blocked_users_query = db.query(User).join(
        BlockedUser, 
        and_(
            BlockedUser.blocked_user_id == User.id,
            BlockedUser.user_id == current_user.id
        )
    ).all()

    blocked_users = []
    for user in blocked_users_query:
        blocked_users.append({
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "avatar": user.avatar or "/static/images/shrek.jpg",
            "blocked_at": db.query(BlockedUser).filter(
                and_(
                    BlockedUser.user_id == current_user.id,
                    BlockedUser.blocked_user_id == user.id
                )
            ).first().blocked_at.isoformat()
        })

    return {"success": True, "blocked_users": blocked_users}