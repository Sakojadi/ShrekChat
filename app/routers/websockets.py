from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
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

from app.database import User, Room, Message, room_members, GroupChat

router = APIRouter()

# Active WebSocket connections mapped to rooms
# Format: {room_id: {user_id: websocket}}
room_connections: Dict[int, Dict[int, WebSocket]] = {}

# Global notification WebSocket connections by username
notification_connections: Dict[str, Set[WebSocket]] = {}

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
                elif message_data["type"] == "call_response":
                    await handle_call_response(websocket, user, message_data, db)
                elif message_data["type"] == "ice_candidate":
                    await handle_ice_candidate(websocket, user, message_data, db)
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
        user.last_seen = datetime.now(pytz.timezone('Asia/Bishkek'))
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
            user.last_seen = datetime.now(pytz.timezone('Asia/Bishkek'))
            db.commit()
            
            # Broadcast offline status
            await broadcast_status(user, "offline", db)
    
    except Exception as e:
        print(f"Presence WebSocket error: {e}")
        try:
            await websocket.close(code=1011)  # Internal error
        except:
            pass

@router.websocket("/ws/notifications/{token}")
async def notifications_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    """WebSocket endpoint for global notifications that persist across chats"""
    try:
        # Authenticate user from token
        user = await manager.get_user_from_token(token, db)
        if not user:
            await websocket.close(code=1008)  # Policy violation - invalid token
            return
        
        # Accept connection
        await websocket.accept()
        
        # Store connection in notification_connections
        if user.username not in notification_connections:
            notification_connections[user.username] = set()
        notification_connections[user.username].add(websocket)
        
        print(f"User {user.username} connected to notifications WebSocket")
        
        try:
            # Keep connection open, handling pings
            while True:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
        
        except WebSocketDisconnect:
            # Handle disconnect
            if user.username in notification_connections:
                notification_connections[user.username].discard(websocket)
                if not notification_connections[user.username]:
                    del notification_connections[user.username]
    
    except Exception as e:
        print(f"Notifications WebSocket error: {e}")
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
        
        # Send to all other room members who are connected
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
            
        # Use the reset_unread_count function to mark all messages as read
        from app.routers.utils import reset_unread_count
        reset_unread_count(room_id, user.id, db)
        
        # Get messages that were specifically mentioned in the request
        messages = db.query(Message).filter(
            and_(
                Message.id.in_(message_ids),
                Message.room_id == room_id,
                Message.sender_id != user.id  # Don't mark own messages
            )
        ).all()
        
        read_message_ids = []
        senders = set()
        
        for message in messages:
            read_message_ids.append(message.id)
            senders.add(message.sender_id)
        
        # Send confirmation to current user
        await websocket.send_json({
            "type": "seen_confirmation",
            "room_id": room_id,
            "message_ids": read_message_ids
        })
        
        # Get info about who's reading the messages
        reader_info = {
            "user_id": user.id,
            "username": user.username,
            "timestamp": datetime.now(pytz.timezone('Asia/Bishkek')).isoformat()
        }
        
        # Notify senders that their messages were read with a more clear signal
        for sender_id in senders:
            sender = db.query(User).filter(User.id == sender_id).first()
            if sender:
                notify_data1 = {
                    "type": "message_read",
                    "room_id": room_id,
                    "reader_id": user.id,
                    "reader": user.username,
                    "message_ids": read_message_ids
                }
                notify_data2 = {
                    "type": "room_messages_read",
                    "room_id": room_id,
                    "reader": reader_info,
                    "message_ids": read_message_ids,
                    "total_read": len(read_message_ids)
                }
                # send via chat socket
                if sender.username in active_connections:
                    for sender_ws in active_connections[sender.username]:
                        await sender_ws.send_json(notify_data1)
                        await sender_ws.send_json(notify_data2)
                # send via global notification socket
                if sender.username in notification_connections:
                    for notify_ws in notification_connections[sender.username]:
                        await notify_ws.send_json(notify_data1)
                        await notify_ws.send_json(notify_data2)
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
        time_diff = (datetime.now(pytz.timezone('Asia/Bishkek')) - message.timestamp).total_seconds() / 60
        if time_diff > 5:
            await websocket.send_json({"error": "Messages can only be edited within 5 minutes of sending"})
            return
        
        # Update message
        message.content = content
        message.edited = True
        message.edited_at = datetime.now(pytz.timezone('Asia/Bishkek'))
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
    """Handle call offer"""
    try:
        # Validate data
        required_fields = ["room_id", "target_user_id", "sdp", "call_type"]
        if not all(field in message_data for field in required_fields):
            await websocket.send_json({"error": "Missing required fields"})
            return
        
        room_id = message_data["room_id"]
        target_user_id = message_data["target_user_id"]
        sdp = message_data["sdp"]
        call_type = message_data.get("call_type", "audio")  # Default to audio call
        
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
        
        # Check if target user exists and is a member of the room
        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            await websocket.send_json({"error": "Target user not found"})
            return
        
        is_target_member = db.query(room_members).filter(
            and_(
                room_members.c.room_id == room_id,
                room_members.c.user_id == target_user_id
            )
        ).first() is not None
        
        if not is_target_member:
            await websocket.send_json({"error": "Target user is not a member of this room"})
            return
        
        # Send call offer to target user if they are online
        if target_user.username in active_connections:
            # Notify the target user about the call
            call_offer = {
                "type": "call_offer",
                "room_id": room_id,
                "caller_id": user.id,
                "caller_name": user.username,
                "caller_full_name": user.full_name or user.username,
                "sdp": sdp,
                "call_type": call_type
            }
            
            for ws in active_connections[target_user.username]:
                try:
                    await ws.send_json(call_offer)
                except Exception as e:
                    print(f"Error sending call offer: {e}")
            
            await websocket.send_json({"type": "call_status", "status": "ringing"})
        else:
            # Target user is offline
            await websocket.send_json({
                "type": "call_status", 
                "status": "failed",
                "reason": "User is offline"
            })
            
    except Exception as e:
        print(f"Error handling call offer: {e}")
        await websocket.send_json({"error": "Failed to process call offer"})

async def handle_call_response(websocket: WebSocket, user: User, message_data: dict, db: Session):
    """Handle call response (accept/reject)"""
    try:
        # Validate data
        required_fields = ["room_id", "target_user_id", "status"]
        if not all(field in message_data for field in required_fields):
            await websocket.send_json({"error": "Missing required fields"})
            return
        
        room_id = message_data["room_id"]
        target_user_id = message_data["target_user_id"]
        status = message_data["status"]
        sdp = message_data.get("sdp")  # Only present for 'accepted' status
        
        # Check if target user exists
        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            await websocket.send_json({"error": "Target user not found"})
            return
        
        # Send call response to caller
        if target_user.username in active_connections:
            response_data = {
                "type": "call_response",
                "room_id": room_id,
                "responder_id": user.id,
                "responder_name": user.username,
                "status": status
            }
            
            # Include SDP answer if call was accepted
            if status == "accepted" and sdp:
                response_data["sdp"] = sdp
            
            for ws in active_connections[target_user.username]:
                try:
                    await ws.send_json(response_data)
                except Exception as e:
                    print(f"Error sending call response: {e}")
            
            await websocket.send_json({"type": "call_response_sent", "status": "success"})
        else:
            # Target user is offline (unlikely as they just sent the offer)
            await websocket.send_json({
                "type": "call_response_sent", 
                "status": "failed",
                "reason": "User is offline"
            })
            
    except Exception as e:
        print(f"Error handling call response: {e}")
        await websocket.send_json({"error": "Failed to process call response"})

async def handle_ice_candidate(websocket: WebSocket, user: User, message_data: dict, db: Session):
    """Handle ICE candidate exchange"""
    try:
        # Validate data
        if "candidate" not in message_data or "target_user_id" not in message_data:
            await websocket.send_json({"error": "Missing required fields"})
            return
        
        target_user_id = message_data["target_user_id"]
        candidate = message_data["candidate"]
        
        # Check if target user exists
        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            await websocket.send_json({"error": "Target user not found"})
            return
        
        # Forward the ICE candidate to the target user
        if target_user.username in active_connections:
            ice_data = {
                "type": "ice_candidate",
                "from_user_id": user.id,
                "candidate": candidate
            }
            
            for ws in active_connections[target_user.username]:
                try:
                    await ws.send_json(ice_data)
                except Exception as e:
                    print(f"Error sending ICE candidate: {e}")
        
    except Exception as e:
        print(f"Error handling ICE candidate: {e}")
        await websocket.send_json({"error": "Failed to process ICE candidate"})

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