from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, not_
from typing import Dict, List, Set, Optional
from datetime import datetime
import pytz
import json

# Import get_db and active_connections separately to avoid circular import issues
from app.routers.session import get_db, active_connections
# Import the ConnectionManager class and initialize it here instead of importing manager
from app.routers.session import ConnectionManager
# Initialize our own manager instance
manager = ConnectionManager()

from app.database import SessionLocal, User, Room, Message, room_members, GroupChat, BlockedUser

router = APIRouter()

# Active WebSocket connections mapped to rooms
# Format: {room_id: {user_id: websocket}}
room_connections: Dict[int, Dict[int, WebSocket]] = {}

async def notify_new_message(room_id: int, sender_id: int, message_data: dict):
    """
    Notify all users in a room about a new message
    
    Args:
        room_id: ID of the room where message was sent
        sender_id: ID of message sender
        message_data: Message data to send to clients
    """
    if room_id not in room_connections:
        room_connections[room_id] = {}
    
    try:
        # Get database connection
        db = next(get_db())
        
        # Get all members of this room excluding sender
        members = db.query(User).join(
            room_members, User.id == room_members.c.user_id
        ).filter(
            and_(
                room_members.c.room_id == room_id,
                User.id != sender_id  # Exclude sender
            )
        ).all()
        
        # Prepare the response message
        response = {
            "type": "message",
            "message": message_data
        }
        
        # Send to all connected users in the room
        for member in members:
            if member.username in active_connections:
                for ws in active_connections[member.username]:
                    try:
                        await ws.send_json(response)
                        print(f"Notified user {member.id} about new message in room {room_id}")
                        
                        # Add this connection to room_connections for future messages
                        room_connections[room_id][member.id] = ws
                    except Exception as e:
                        print(f"Error sending notification to user {member.id}: {str(e)}")
    except Exception as e:
        print(f"Error in notify_new_message: {str(e)}")

@router.websocket("/ws/chat/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    """WebSocket endpoint for chat messaging"""
    try:
        # Authenticate user from token
        user = await manager.get_user_from_token(token, db)
        if not user:
            await websocket.close(code=1008)  # Policy violation - invalid token
            return
        
        # Accept connection
        await websocket.accept()
        
        # Store connection
        if user.username not in active_connections:
            active_connections[user.username] = set()
        active_connections[user.username].add(websocket)
        
        # Broadcast user online status to all friends (connected users)
        await broadcast_status(user, "online", db)
        
        # Process messages
        try:
            while True:
                # Receive message
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Validate message format
                if "type" not in message_data:
                    await websocket.send_json({"error": "Invalid message format"})
                    continue
                
                # Handle different message types
                if message_data["type"] == "message":
                    await handle_chat_message(websocket, user, message_data, db)
                elif message_data["type"] == "seen":
                    await handle_seen_notification(websocket, user, message_data, db)
                elif message_data["type"] == "typing":
                    await handle_typing_notification(websocket, user, message_data, db)
                elif message_data["type"] == "update_message":
                    await handle_message_update(websocket, user, message_data, db)
                elif message_data["type"] == "delete_message":
                    await handle_message_delete(websocket, user, message_data, db)
                elif message_data["type"] == "call_offer":
                    await handle_call_offer(websocket, user, message_data, db)
                elif message_data["type"] == "call_answer":
                    await handle_call_answer(websocket, user, message_data, db)
                elif message_data["type"] == "call_ice_candidate":
                    await handle_ice_candidate(websocket, user, message_data, db)
                elif message_data["type"] == "call_end":
                    await handle_end_call(websocket, user, message_data, db)
                elif message_data["type"] == "call_decline":
                    await handle_decline_call(websocket, user, message_data, db)
                else:
                    await websocket.send_json({"error": "Unknown message type"})
        
        except WebSocketDisconnect:
            # Handle disconnect
            if user.username in active_connections:
                active_connections[user.username].discard(websocket)
                if not active_connections[user.username]:
                    del active_connections[user.username]
            
            # Remove from room connections
            for room_id in list(room_connections.keys()):
                if user.id in room_connections[room_id]:
                    room_connections[room_id].pop(user.id)
                    if not room_connections[room_id]:
                        room_connections.pop(room_id)
            
            # Broadcast offline status
            await broadcast_status(user, "offline", db)
    
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close(code=1011)  # Internal error
        except:
            pass

@router.websocket("/ws/presence")
async def presence_endpoint(websocket: WebSocket, username: str, db: Session = Depends(get_db)):
    """WebSocket endpoint for presence status updates"""
    try:
        # Authenticate user from username parameter
        user = db.query(User).filter(User.username == username).first()
        if not user:
            await websocket.close(code=1008)  # Policy violation - user not found
            return
        
        # Accept connection
        await websocket.accept()
        
        # Store connection
        if user.username not in active_connections:
            active_connections[user.username] = set()
        active_connections[user.username].add(websocket)
        
        # Set user online status in database
        user.is_online = True
        user.last_seen = datetime.utcnow()
        db.commit()
        
        # Broadcast user online status to all friends
        await broadcast_status(user, "online", db)
        
        try:
            while True:
                # Just keep connection alive and handle "ping" messages
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
        
        except WebSocketDisconnect:
            # Handle disconnect
            if user.username in active_connections:
                active_connections[user.username].discard(websocket)
                if not active_connections[user.username]:
                    del active_connections[user.username]
            
            # Update user status in database
            user.is_online = False
            user.last_seen = datetime.utcnow()
            db.commit()
            
            # Broadcast offline status
            await broadcast_status(user, "offline", db)
    
    except Exception as e:
        print(f"Presence WebSocket error: {e}")
        try:
            await websocket.close(code=1011)  # Internal error
        except:
            pass

async def handle_chat_message(websocket: WebSocket, user: User, message_data: dict, db: Session):
    """Handle chat message"""
    try:
        # Validate message data
        required_fields = ["room_id", "content"]
        if not all(field in message_data for field in required_fields):
            await websocket.send_json({"error": "Missing required fields"})
            return
        
        room_id = message_data["room_id"]
        content = message_data["content"]
        # Extract temp_id if provided by client
        temp_id = message_data.get("temp_id")
        
        # Check if room exists
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            await websocket.send_json({"error": "Room not found"})
            return
        
        # Check if user is a member of this room
        is_member = db.query(room_members).filter(
            and_(
                room_members.c.room_id == room_id,
                room_members.c.user_id == user.id
            )
        ).first() is not None
        
        if not is_member:
            await websocket.send_json({"error": "You are not a member of this room"})
            return
        
        # For direct messages, check if either user has blocked the other
        if not room.is_group:
            # Get the other user in the direct message
            other_user = db.query(User).join(
                room_members, User.id == room_members.c.user_id
            ).filter(
                and_(
                    room_members.c.room_id == room_id,
                    User.id != user.id
                )
            ).first()
            
            if other_user:
                # Check if either user has blocked the other
                blocked_check = db.query(BlockedUser).filter(
                    or_(
                        and_(BlockedUser.user_id == user.id, BlockedUser.blocked_user_id == other_user.id),
                        and_(BlockedUser.user_id == other_user.id, BlockedUser.blocked_user_id == user.id)
                    )
                ).first()
                
                if blocked_check:
                    await websocket.send_json({
                        "error": "Cannot send message", 
                        "type": "blocked",
                        "message": "You cannot exchange messages with this user"
                    })
                    return
        
        # Create message
        new_message = Message(
            content=content,
            sender_id=user.id,
            room_id=room_id,
            timestamp=datetime.now(pytz.timezone('Asia/Bishkek')),
            delivered=True,  # Delivered to server
            read=False       # Not read by recipient(s) yet
        )
        db.add(new_message)
        db.commit()
        db.refresh(new_message)
        
        # Prepare base message response with real sender information
        base_message_response = {
            "id": new_message.id,
            "content": new_message.content,
            "sender_id": new_message.sender_id,
            "sender": user.username,  # The actual username of sender
            "sender_name": user.full_name or user.username,
            "sender_avatar": user.avatar or "/static/images/shrek.jpg",  # Add sender's avatar URL
            "room_id": room_id,
            "timestamp": new_message.timestamp.isoformat(),
            "time": new_message.timestamp.strftime("%H:%M"),
            "delivered": True,
            "read": False,
            "is_group": room.is_group
        }
        
        # Send confirmation to sender with special "user" marker for client-side identification
        sender_response = {
            "type": "message",
            "message": {
                **base_message_response,
                "sender": "user"  # Special marker for the sender's UI
            }
        }
        
        # Include the temp_id in the response to the sender if it was provided
        if temp_id:
            sender_response["message"]["temp_id"] = temp_id
            
        await websocket.send_json(sender_response)
        
        # Get IDs of users who have blocked the current user or who have been blocked by the current user
        if room.is_group:
            # For group chats, exclude users who have blocked the sender
            blocked_sender_user_ids = db.query(BlockedUser.user_id).filter(
                BlockedUser.blocked_user_id == user.id
            ).all()
            blocked_sender_ids = [id for (id,) in blocked_sender_user_ids]
            
            # Send to all other room members who are connected, except those who blocked the sender
            members = db.query(User.id).join(
                room_members, User.id == room_members.c.user_id
            ).filter(
                and_(
                    room_members.c.room_id == room_id,
                    User.id != user.id,  # Exclude sender
                    not_(User.id.in_(blocked_sender_ids))  # Exclude users who blocked sender
                )
            ).all()
        else:
            # For direct messages, we already checked blocking status above
            members = db.query(User.id).join(
                room_members, User.id == room_members.c.user_id
            ).filter(
                and_(
                    room_members.c.room_id == room_id,
                    User.id != user.id  # Exclude sender
                )
            ).all()
        
        member_ids = [member.id for member in members]
        
        # Prepare recipient message - this keeps the actual sender information
        recipient_response = {
            "type": "message",
            "message": base_message_response  # Use base response with real sender info
        }
        
        # Initialize room connections if not exists
        if room_id not in room_connections:
            room_connections[room_id] = {}
        
        # Add current user to room connections
        room_connections[room_id][user.id] = websocket
        
        # Get online members and send message
        for member_id in member_ids:
            member = db.query(User).filter(User.id == member_id).first()
            if member and member.username in active_connections:
                # Find sockets for this user
                for member_ws in active_connections[member.username]:
                    await member_ws.send_json(recipient_response)
                    
                    # Add this connection to room connections
                    room_connections[room_id][member_id] = member_ws
    except Exception as e:
        print(f"Error handling chat message: {e}")
        await websocket.send_json({"error": "Failed to send message"})

async def handle_seen_notification(websocket: WebSocket, user: User, message_data: dict, db: Session):
    """Handle seen notification"""
    try:
        # Validate data
        required_fields = ["room_id", "message_ids"]
        if not all(field in message_data for field in required_fields):
            await websocket.send_json({"error": "Missing required fields"})
            return
        
        room_id = message_data["room_id"]
        message_ids = message_data["message_ids"]
        
        # Check if room exists
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            await websocket.send_json({"error": "Room not found"})
            return
        
        # Check if user is a member of this room
        is_member = db.query(room_members).filter(
            and_(
                room_members.c.room_id == room_id,
                room_members.c.user_id == user.id
            )
        ).first() is not None
        
        if not is_member:
            await websocket.send_json({"error": "You are not a member of this room"})
            return
        
        # Mark messages as read
        messages = db.query(Message).filter(
            and_(
                Message.id.in_(message_ids),
                Message.room_id == room_id,
                Message.sender_id != user.id,  # Don't mark own messages
                Message.read == False
            )
        ).all()
        
        read_message_ids = []
        senders = set()
        
        for message in messages:
            message.read = True
            message.read_at = datetime.utcnow()
            read_message_ids.append(message.id)
            senders.add(message.sender_id)
        
        db.commit()
        
        # Send confirmation to current user
        await websocket.send_json({
            "type": "seen_confirmation",
            "room_id": room_id,
            "message_ids": read_message_ids
        })
        
        # Notify senders that their messages were read
        for sender_id in senders:
            sender = db.query(User).filter(User.id == sender_id).first()
            if sender and sender.username in active_connections:
                for sender_ws in active_connections[sender.username]:
                    await sender_ws.send_json({
                        "type": "message_read",
                        "room_id": room_id,
                        "reader_id": user.id,
                        "reader": user.username,
                        "message_ids": read_message_ids
                    })
    except Exception as e:
        print(f"Error handling seen notification: {e}")
        await websocket.send_json({"error": "Failed to process seen notification"})

async def handle_typing_notification(websocket: WebSocket, user: User, message_data: dict, db: Session):
    """Handle typing notification"""
    try:
        # Validate data
        required_fields = ["room_id", "status"]
        if not all(field in message_data for field in required_fields):
            await websocket.send_json({"error": "Missing required fields"})
            return
        
        room_id = message_data["room_id"]
        status = message_data["status"]  # "typing" or "idle"
        
        # Check if room exists
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            await websocket.send_json({"error": "Room not found"})
            return
        
        # Check if user is a member of this room
        is_member = db.query(room_members).filter(
            and_(
                room_members.c.room_id == room_id,
                room_members.c.user_id == user.id
            )
        ).first() is not None
        
        if not is_member:
            await websocket.send_json({"error": "You are not a member of this room"})
            return
        
        # Send typing notification to all other members in the room
        members = db.query(User.id).join(
            room_members, User.id == room_members.c.user_id
        ).filter(
            and_(
                room_members.c.room_id == room_id,
                User.id != user.id  # Exclude sender
            )
        ).all()
        
        typing_notification = {
            "type": "typing",
            "room_id": room_id,
            "user_id": user.id,
            "username": user.username,
            "status": status
        }
        
        for member in members:
            member_user = db.query(User).filter(User.id == member.id).first()
            if member_user and member_user.username in active_connections:
                for member_ws in active_connections[member_user.username]:
                    await member_ws.send_json(typing_notification)
    except Exception as e:
        print(f"Error handling typing notification: {e}")
        await websocket.send_json({"error": "Failed to process typing notification"})

async def handle_message_update(websocket: WebSocket, user: User, message_data: dict, db: Session):
    """Handle message update"""
    try:
        message_id = message_data.get("message_id")
        room_id = message_data.get("room_id")
        content = message_data.get("content", "").strip()
        
        if not message_id or not room_id or not content:
            await websocket.send_json({"error": "Invalid update data"})
            return
        
        # Get the message
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            await websocket.send_json({"error": "Message not found"})
            return
        
        # Check if user is the sender of the message
        if message.sender_id != user.id:
            await websocket.send_json({"error": "You can only edit your own messages"})
            return
        
        # Check if message is too old (older than 5 minutes)
        time_diff = (datetime.utcnow() - message.timestamp).total_seconds() / 60
        if time_diff > 5:
            await websocket.send_json({"error": "Messages can only be edited within 5 minutes of sending"})
            return
        
        # Update message
        message.content = content
        message.edited = True
        message.edited_at = datetime.utcnow()
        db.commit()
        
        # Send confirmation to sender
        await websocket.send_json({
            "type": "message_updated",
            "message_id": message_id,
            "content": content,
            "edited_at": message.edited_at.isoformat(),
            "room_id": room_id
        })
        
        # Broadcast update to other users in room
        members = db.query(User.id).join(
            room_members, User.id == room_members.c.user_id
        ).filter(
            and_(
                room_members.c.room_id == room_id,
                User.id != user.id  # Exclude sender
            )
        ).all()
        
        for member in members:
            member_user = db.query(User).filter(User.id == member.id).first()
            if member_user and member_user.username in active_connections:
                for member_ws in active_connections[member_user.username]:
                    await member_ws.send_json({
                        "type": "message_updated",
                        "message_id": message_id,
                        "room_id": room_id,
                        "content": content,
                        "edited": True,
                        "edited_at": message.edited_at.isoformat()
                    })
    except Exception as e:
        print(f"Error handling message update: {e}")
        await websocket.send_json({"error": "Failed to update message"})

async def handle_message_delete(websocket: WebSocket, user: User, message_data: dict, db: Session):
    """Handle message delete"""
    try:
        message_id = message_data.get("message_id")
        room_id = message_data.get("room_id")
        
        if not message_id or not room_id:
            await websocket.send_json({"error": "Invalid delete data"})
            return
        
        # Get the message
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            await websocket.send_json({"error": "Message not found"})
            return
        
        # Check if user is the sender of the message or an admin in a group chat
        is_sender = message.sender_id == user.id
        is_admin = False
        
        # Check if this is a group chat and if the user is an admin
        room = db.query(Room).filter(Room.id == message.room_id).first()
        if room and room.is_group:
            is_admin = db.query(room_members).filter(
                and_(
                    room_members.c.room_id == message.room_id,
                    room_members.c.user_id == user.id,
                    room_members.c.is_admin == True
                )
            ).first() is not None
        
        if not (is_sender or is_admin):
            await websocket.send_json({"error": "You can only delete your own messages or any message if you're a group admin"})
            return
        
        # Delete the message
        db.delete(message)
        db.commit()
        
        # Send confirmation to the user who deleted the message
        await websocket.send_json({
            "type": "message_deleted",
            "message_id": message_id,
            "room_id": room_id
        })
        
        # Broadcast deletion to other users in room
        members = db.query(User.id).join(
            room_members, User.id == room_members.c.user_id
        ).filter(
            and_(
                room_members.c.room_id == room_id,
                User.id != user.id  # Exclude sender
            )
        ).all()
        
        for member in members:
            member_user = db.query(User).filter(User.id == member.id).first()
            if member_user and member_user.username in active_connections:
                for member_ws in active_connections[member_user.username]:
                    await member_ws.send_json({
                        "type": "message_deleted",
                        "message_id": message_id,
                        "room_id": room_id,
                        "deleted_by": user.username
                    })
    except Exception as e:
        print(f"Error handling message delete: {e}")
        await websocket.send_json({"error": "Failed to delete message"})

async def handle_call_offer(websocket: WebSocket, user: User, message_data: dict, db: Session):
    """Handle WebRTC call offer"""
    try:
        # Validate data
        required_fields = ["target_user_id", "room_id", "sdp"]
        if not all(field in message_data for field in required_fields):
            await websocket.send_json({"type": "error", "message": "Missing required fields for call offer"})
            return
        
        room_id = message_data["room_id"]
        target_user_id = message_data["target_user_id"]
        sdp = message_data["sdp"]
        
        # Check if room exists
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            await websocket.send_json({"type": "error", "message": "Room not found"})
            return
        
        # Check if both users are members of this room
        are_members = db.query(room_members).filter(
            and_(
                room_members.c.room_id == room_id,
                room_members.c.user_id.in_([user.id, target_user_id])
            )
        ).count() == 2
        
        if not are_members:
            await websocket.send_json({"type": "error", "message": "User is not a member of this room"})
            return
        
        # Get target user
        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            await websocket.send_json({"type": "error", "message": "Target user not found"})
            return
        
        # Forward the call offer to the target user if they're online
        if target_user.username in active_connections:
            for ws in active_connections[target_user.username]:
                await ws.send_json({
                    "type": "call_offer",
                    "caller_id": user.id,
                    "caller_name": user.full_name or user.username,
                    "caller_avatar": user.avatar,
                    "room_id": room_id,
                    "sdp": sdp
                })
            
            await websocket.send_json({
                "type": "call_initiated",
                "target_user_id": target_user_id,
                "room_id": room_id
            })
        else:
            await websocket.send_json({
                "type": "error",
                "message": "User is offline",
                "code": "user_offline"
            })
    
    except Exception as e:
        print(f"Error handling call offer: {e}")
        await websocket.send_json({"type": "error", "message": "Failed to process call offer"})

async def handle_call_answer(websocket: WebSocket, user: User, message_data: dict, db: Session):
    """Handle WebRTC call answer"""
    try:
        # Validate data
        required_fields = ["target_user_id", "room_id", "sdp"]
        if not all(field in message_data for field in required_fields):
            await websocket.send_json({"type": "error", "message": "Missing required fields for call answer"})
            return
        
        room_id = message_data["room_id"]
        target_user_id = message_data["target_user_id"]
        sdp = message_data["sdp"]
        
        # Forward the call answer to the target user
        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user or target_user.username not in active_connections:
            await websocket.send_json({"type": "error", "message": "Target user not available"})
            return
        
        # Forward answer to caller
        for ws in active_connections[target_user.username]:
            await ws.send_json({
                "type": "call_answer",
                "responder_id": user.id,
                "responder_name": user.full_name or user.username,
                "room_id": room_id,
                "sdp": sdp
            })
        
        await websocket.send_json({
            "type": "call_answer_sent",
            "target_user_id": target_user_id,
            "room_id": room_id
        })
    
    except Exception as e:
        print(f"Error handling call answer: {e}")
        await websocket.send_json({"type": "error", "message": "Failed to process call answer"})

async def handle_ice_candidate(websocket: WebSocket, user: User, message_data: dict, db: Session):
    """Handle ICE candidate exchange for WebRTC"""
    try:
        # Validate data
        required_fields = ["target_user_id", "room_id", "candidate"]
        if not all(field in message_data for field in required_fields):
            await websocket.send_json({"type": "error", "message": "Missing required fields for ICE candidate"})
            return
        
        room_id = message_data["room_id"]
        target_user_id = message_data["target_user_id"]
        candidate = message_data["candidate"]
        
        # Forward the ICE candidate to the target user
        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user or target_user.username not in active_connections:
            return  # Silently fail, as this is not critical
        
        # Forward candidate
        for ws in active_connections[target_user.username]:
            await ws.send_json({
                "type": "call_ice_candidate",
                "sender_id": user.id,
                "room_id": room_id,
                "candidate": candidate
            })
    
    except Exception as e:
        print(f"Error handling ICE candidate: {e}")

async def handle_end_call(websocket: WebSocket, user: User, message_data: dict, db: Session):
    """Handle WebRTC call end"""
    try:
        # Validate data
        required_fields = ["target_user_id", "room_id"]
        if not all(field in message_data for field in required_fields):
            return  # Silently fail, as the call is ending anyway
        
        room_id = message_data["room_id"]
        target_user_id = message_data["target_user_id"]
        
        # Forward the call end to the target user
        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user or target_user.username not in active_connections:
            return  # Silently fail, as the call is ending anyway
        
        # Forward call end
        for ws in active_connections[target_user.username]:
            await ws.send_json({
                "type": "call_end",
                "sender_id": user.id,
                "room_id": room_id
            })
    
    except Exception as e:
        print(f"Error handling end call: {e}")

async def handle_decline_call(websocket: WebSocket, user: User, message_data: dict, db: Session):
    """Handle WebRTC call decline"""
    try:
        # Validate data
        required_fields = ["target_user_id", "room_id"]
        if not all(field in message_data for field in required_fields):
            return  # Silently fail
        
        room_id = message_data["room_id"]
        target_user_id = message_data["target_user_id"]
        
        # Forward the call decline to the target user
        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user or target_user.username not in active_connections:
            return  # Silently fail
        
        # Forward call decline
        for ws in active_connections[target_user.username]:
            await ws.send_json({
                "type": "call_decline",
                "decliner_id": user.id,
                "room_id": room_id
            })
    
    except Exception as e:
        print(f"Error handling decline call: {e}")

async def broadcast_status(user: User, status: str, db: Session):
    """Broadcast user's online/offline status to contacts"""
    # Find all users who have direct chat rooms with this user
    rooms_with_user = db.query(Room).join(
        room_members, Room.id == room_members.c.room_id
    ).filter(
        and_(
            Room.is_group == False,  # Only direct chats
            room_members.c.user_id == user.id
        )
    ).all()
    
    room_ids = [room.id for room in rooms_with_user]
    
    if not room_ids:
        return
    
    # Find all users who are in these rooms
    contacts = db.query(User).join(
        room_members, User.id == room_members.c.user_id
    ).filter(
        and_(
            room_members.c.room_id.in_(room_ids),
            User.id != user.id  # Exclude the user themselves
        )
    ).all()
    
    # Send status to all online contacts
    for contact in contacts:
        if contact.username in active_connections:
            status_message = {
                "type": "status",
                "user_id": user.id,
                "username": user.username,
                "status": status
            }
            for ws in active_connections[contact.username]:
                await ws.send_json(status_message)

async def notify_new_room(room_id: int, target_user_id: int, current_user: User, db: Session):
    """Notify a user about a new room they've been added to"""
    # Get the target user
    target_user = db.query(User).filter(User.id == target_user_id).first()
    if not target_user or target_user.username not in active_connections:
        # User not found or not online
        return
        
    # Get the room data to send to the user
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        return
        
    # For direct messages, customize the room display for the target user
    room_data = {
        "id": room.id,
        "name": current_user.full_name or current_user.username,
        "username": current_user.username,
        "avatar": current_user.avatar or "/static/images/shrek.jpg",
        "user_id": current_user.id,
        "is_group": False,
        "last_message": "Click to start chatting!",
        "last_message_time": "Now",
        "unread_count": 0,
        "status": "online" if current_user.is_online else "offline"
    }
    
    # Send the notification to all of the target user's connections
    for ws in active_connections[target_user.username]:
        await ws.send_json({
            "type": "new_room",
            "room": room_data
        })

async def notify_new_group(room_id: int, target_user_ids: list, db: Session):
    """Notify users about a new group chat they've been added to"""
    # Get the room data to send to the users
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        return
        
    # Get group info
    group_info = db.query(GroupChat).filter(GroupChat.id == room_id).first()
    if not group_info:
        return
    
    # Create room data for notification
    room_data = {
        "id": room.id,
        "name": room.name,
        "avatar": group_info.avatar or "/static/images/shrek-logo.png",
        "is_group": True,
        "last_message": "Group created. Click to start chatting!",
        "last_message_time": "Now",
        "unread_count": 0,
        "description": group_info.description
    }
    
    # Notify each online user
    for user_id in target_user_ids:
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.username in active_connections:
            for ws in active_connections[user.username]:
                await ws.send_json({
                    "type": "new_room",
                    "room": room_data
                })

async def notify_group_deleted(room_id: int, target_user_ids: list, db: Session):
    """Notify users that a group chat has been deleted"""
    # Notify each online user
    for user_id in target_user_ids:
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.username in active_connections:
            for ws in active_connections[user.username]:
                await ws.send_json({
                    "type": "group_deleted",
                    "room_id": room_id
                })

async def broadcast_avatar_update(user_id: int, avatar_url: str):
    """Broadcast avatar update to all connected users who have contact with this user"""
    try:
        db = SessionLocal()
        # Get all users with direct or group connections to this user
        connected_users = set()
        
        # Find users with direct messages
        direct_contacts = db.query(User.id).join(
            room_members, User.id == room_members.c.user_id
        ).join(
            Room, room_members.c.room_id == Room.id
        ).filter(
            and_(
                Room.is_group == False,
                room_members.c.room_id.in_(
                    db.query(room_members.c.room_id).filter(
                        room_members.c.user_id == user_id
                    )
                ),
                User.id != user_id
            )
        ).all()
        
        for contact in direct_contacts:
            connected_users.add(contact.id)
        
        # Find users in shared group chats
        group_contacts = db.query(User.id).join(
            room_members, User.id == room_members.c.user_id
        ).filter(
            and_(
                room_members.c.room_id.in_(
                    db.query(room_members.c.room_id).filter(
                        and_(
                            room_members.c.user_id == user_id,
                            room_members.c.room_id.in_(
                                db.query(Room.id).filter(Room.is_group == True)
                            )
                        )
                    )
                ),
                User.id != user_id
            )
        ).all()
        
        for contact in group_contacts:
            connected_users.add(contact.id)
        
        # Send update to all connected users
        for contact_id in connected_users:
            contact = db.query(User).filter(User.id == contact_id).first()
            if contact and contact.username in active_connections:
                for ws in active_connections[contact.username]:
                    await ws.send_json({
                        "type": "avatar_update",
                        "user_id": user_id,
                        "avatar_url": avatar_url
                    })
        
        # Also update the user's own connections
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.username in active_connections:
            for ws in active_connections[user.username]:
                await ws.send_json({
                    "type": "own_avatar_update",
                    "avatar_url": avatar_url
                })
                
    except Exception as e:
        print(f"Error broadcasting avatar update: {e}")
    finally:
        db.close()

async def notify_block_status_change(user_id: int, blocked_user_id: int, is_blocked: bool):
    """
    Notify a user that they have been blocked or unblocked
    
    Args:
        user_id: ID of the user who is blocking/unblocking
        blocked_user_id: ID of the user being blocked/unblocked
        is_blocked: True if user is being blocked, False if being unblocked
    """
    try:
        db = SessionLocal()
        
        # Get both users
        user = db.query(User).filter(User.id == user_id).first()
        blocked_user = db.query(User).filter(User.id == blocked_user_id).first()
        
        if not user or not blocked_user:
            print(f"ERROR: Could not find user {user_id} or blocked user {blocked_user_id}")
            return
        
        # Notification data
        notification = {
            "type": "block_status_change",
            "blocker_id": user_id,
            "blocker_name": user.full_name or user.username,
            "is_blocked": is_blocked,
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"DEBUG: Preparing to send block status notification. Blocker: {user.username}, Blocked: {blocked_user.username}, Action: {'block' if is_blocked else 'unblock'}")
        
        # Send notification to the user who was blocked/unblocked
        notification_sent = False
        if blocked_user.username in active_connections:
            for ws in active_connections[blocked_user.username]:
                try:
                    await ws.send_json(notification)
                    notification_sent = True
                    print(f"SUCCESS: Sent block status notification to {blocked_user.username}")
                except Exception as e:
                    print(f"ERROR: Failed to send notification to {blocked_user.username}: {str(e)}")
        
        if not notification_sent:
            print(f"WARNING: Could not send notification to {blocked_user.username} - no active connections")
        
        # Also send notification to the blocker for confirmation and page refresh
        blocker_notification_sent = False
        if user.username in active_connections:
            for ws in active_connections[user.username]:
                try:
                    await ws.send_json({
                        **notification,
                        "type": "own_block_action_confirmed"
                    })
                    blocker_notification_sent = True
                    print(f"SUCCESS: Sent block action confirmation to {user.username}")
                except Exception as e:
                    print(f"ERROR: Failed to send confirmation to {user.username}: {str(e)}")
        
        if not blocker_notification_sent:
            print(f"WARNING: Could not send confirmation to {user.username} - no active connections")
                
    except Exception as e:
        print(f"ERROR: Failed in notify_block_status_change: {str(e)}")
    finally:
        db.close()