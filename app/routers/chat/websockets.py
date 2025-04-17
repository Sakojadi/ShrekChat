from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, Any

from app.database import SessionLocal, User, Message, GroupMember, GroupMessage, GroupMessageRead
from app.routers.chat.session import active_connections, username_to_id, id_to_username
from app.routers.chat.utils import broadcast_presence_update, send_read_receipts

router = APIRouter()

@router.websocket("/ws/presence")
async def presence_websocket(websocket: WebSocket):
    """WebSocket for presence updates (online/offline status)"""
    await websocket.accept()
    
    # Get username from query parameters
    username = None
    try:
        query_params = dict(websocket.query_params)
        username = query_params.get("username")
    except Exception as e:
        print(f"Error parsing query params: {e}")
    
    if not username:
        await websocket.close(code=1008, reason="Username is required")
        return
        
    # Create database session
    db = SessionLocal()
    
    try:
        # Get user
        user = db.query(User).filter(User.username == username).first()
        if not user:
            await websocket.close(code=1008, reason="User not found")
            db.close()
            return
        
        # Store username to user ID mapping
        username_to_id[username] = user.id
        id_to_username[user.id] = username
        
        # Mark user as online
        user.is_online = True
        user.last_seen = datetime.utcnow()
        db.commit()
        
        # Store the connection
        active_connections[username] = websocket
        
        # Broadcast online status to all contacts
        await broadcast_presence_update(user.id, "online", db)
        
        try:
            # Keep connection alive to track presence
            while True:
                data = await websocket.receive_text()
                # Ping-pong to keep connection alive
                if data == "ping":
                    await websocket.send_text("pong")
                
        except WebSocketDisconnect:
            # Clean up when user disconnects
            cleanup_user_disconnect(username, user.id, db)
    finally:
        db.close()

def cleanup_user_disconnect(username, user_id, db):
    """Clean up when a user disconnects"""
    if username in active_connections:
        del active_connections[username]
    
    if username in username_to_id:
        del username_to_id[username]
        
    if user_id in id_to_username:
        del id_to_username[user_id]
    
    # Mark user as offline in database
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.is_online = False
        user.last_seen = datetime.utcnow()
        db.commit()
    
    # Broadcast offline status to all contacts
    broadcast_presence_update(user_id, "offline", db)

@router.websocket("/ws/chat/{contact_id}")
async def direct_chat_websocket(websocket: WebSocket, contact_id: int):
    """WebSocket for direct chat messages between users"""
    await websocket.accept()
    
    # Get username from query parameters
    username = None
    try:
        query_params = dict(websocket.query_params)
        username = query_params.get("username")
    except Exception as e:
        print(f"Error parsing query params: {e}")
        
    if not username:
        await websocket.close(code=1008, reason="Username is required")
        return
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Get sender user
        sender_user = db.query(User).filter(User.username == username).first()
        if not sender_user:
            await websocket.close(code=1008, reason="User not found")
            return
            
        # Get recipient user
        recipient_user = db.query(User).filter(User.id == contact_id).first()
        if not recipient_user:
            await websocket.close(code=1008, reason="Recipient not found")
            return
        
        # Store the connection with the username
        active_connections[username] = websocket
        
        # Store user ID mappings
        username_to_id[username] = sender_user.id
        id_to_username[sender_user.id] = username
        
        # Mark unread messages as read when opening a chat
        unread_messages = db.query(Message).filter(
            Message.sender_id == recipient_user.id,
            Message.recipient_id == sender_user.id,
            Message.read == False
        ).all()
        
        now = datetime.utcnow()
        for msg in unread_messages:
            msg.read = True
            msg.read_at = now
        
        db.commit()
        
        # If recipient is online, send read receipts
        if unread_messages and recipient_user.username in active_connections:
            await send_read_receipts(recipient_user.id, unread_messages)
        
        try:
            while True:
                data = await websocket.receive_json()
                
                # Handle different message types
                await handle_direct_message(data, sender_user, recipient_user, websocket, db)
        
        except WebSocketDisconnect:
            # Handle disconnection (presence update handled by presence socket)
            pass
        except Exception as e:
            print(f"WebSocket error: {e}")
    finally:
        db.close()

async def handle_direct_message(data, sender_user, recipient_user, websocket, db):
    """Handle different types of direct messages"""
    message_type = data.get("type", "message")
    
    if message_type == "message":
        await handle_text_message(data, sender_user, recipient_user, websocket, db)
    elif message_type == "read_receipt":
        await handle_read_receipt(data, sender_user, db)  
    elif message_type == "delivered_receipt":
        await handle_delivery_receipt(data, sender_user, db)

async def handle_text_message(data, sender_user, recipient_user, websocket, db):
    """Handle text message between users"""
    content = data.get("content")
    
    # Save message to database
    message = Message(
        sender_id=sender_user.id,
        recipient_id=recipient_user.id,
        content=content,
        timestamp=datetime.utcnow()
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Create response with message details
    message_response = {
        "type": "message",
        "id": message.id,
        "sender": sender_user.username,
        "content": content,
        "time": data.get("time"),
        "status": "sent"
    }
    
    # Check if recipient is online
    recipient_username = recipient_user.username
    if recipient_username in active_connections:
        # Send message to recipient
        await active_connections[recipient_username].send_json({
            "type": "message",
            "id": message.id,
            "sender": sender_user.username,
            "content": content,
            "time": data.get("time")
        })
        
        # Mark as delivered immediately since recipient is online
        message.delivered = True
        message.delivered_at = datetime.utcnow()
        db.commit()
        
        # Update status to delivered
        message_response["status"] = "delivered"
    
    # Echo back to sender with status
    await websocket.send_json(message_response)

async def handle_read_receipt(data, sender_user, db):
    """Handle read receipt for a message"""
    message_id = data.get("message_id")
    message = db.query(Message).filter(Message.id == message_id).first()
    
    if message:
        message.read = True
        message.read_at = datetime.utcnow()
        db.commit()
        
        # Send read receipt to the original sender
        original_sender_id = message.sender_id
        if (original_sender_id != sender_user.id and 
            original_sender_id in id_to_username and 
            id_to_username[original_sender_id] in active_connections):
                
            sender_username = id_to_username[original_sender_id]
            await active_connections[sender_username].send_json({
                "type": "read_receipt",
                "message_id": message_id,
                "read_at": message.read_at.isoformat()
            })

async def handle_delivery_receipt(data, sender_user, db):
    """Handle delivery receipt for a message"""
    message_id = data.get("message_id")
    message = db.query(Message).filter(Message.id == message_id).first()
    
    if message and not message.delivered:
        message.delivered = True
        message.delivered_at = datetime.utcnow()
        db.commit()
        
        # Notify original sender about delivery if they're online
        original_sender_id = message.sender_id
        if (original_sender_id != sender_user.id and 
            original_sender_id in id_to_username and 
            id_to_username[original_sender_id] in active_connections):
                
            sender_username = id_to_username[original_sender_id]
            await active_connections[sender_username].send_json({
                "type": "delivered_receipt",
                "message_id": message_id,
                "delivered_at": message.delivered_at.isoformat()
            })

@router.websocket("/ws/group/{group_id}")
async def group_chat_websocket(websocket: WebSocket, group_id: int):
    """WebSocket for group chat messages"""
    await websocket.accept()
    
    # Get username from query parameters
    username = None
    try:
        query_params = dict(websocket.query_params)
        username = query_params.get("username")
    except Exception as e:
        print(f"Error parsing query params: {e}")
    
    if not username:
        await websocket.close(code=1008, reason="Username is required")
        return
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Get user
        user = db.query(User).filter(User.username == username).first()
        if not user:
            await websocket.close(code=1008, reason="User not found")
            db.close()
            return
        
        # Check if user is member of the group
        is_member = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user.id
        ).first()
        
        if not is_member:
            await websocket.close(code=1008, reason="Not a member of this group")
            db.close()
            return
        
        # Store connection
        connection_key = f"group-{group_id}-{username}"
        active_connections[connection_key] = websocket
        
        # Store user ID mappings
        username_to_id[username] = user.id
        id_to_username[user.id] = username
        
        try:
            while True:
                data = await websocket.receive_json()
                
                # Handle message
                if data.get("type") == "message":
                    await handle_group_message(data, user, group_id, websocket, db)
        
        except WebSocketDisconnect:
            # Clean up when user disconnects
            if connection_key in active_connections:
                del active_connections[connection_key]
        
    finally:
        db.close()

async def handle_group_message(data, user, group_id, websocket, db):
    """Handle message in a group chat"""
    content = data.get("content")
    
    # Save message to database
    message = GroupMessage(
        group_id=group_id,
        sender_id=user.id,
        content=content,
        timestamp=datetime.utcnow()
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Create read receipt for sender
    read_receipt = GroupMessageRead(
        message_id=message.id,
        user_id=user.id,
        read_at=datetime.utcnow()
    )
    db.add(read_receipt)
    db.commit()
    
    # Prepare message for broadcast
    message_data = {
        "type": "message",
        "id": message.id,
        "sender_id": user.id,
        "sender_name": user.full_name or user.username,
        "content": content,
        "time": data.get("time"),
        "group_id": group_id
    }
    
    # Send message to all online group members
    members = db.query(GroupMember, User).join(
        User, GroupMember.user_id == User.id
    ).filter(
        GroupMember.group_id == group_id
    ).all()
    
    for member, member_user in members:
        # Don't send to self
        if member_user.id == user.id:
            continue
        
        # Check if member is online
        member_connection_key = f"group-{group_id}-{member_user.username}"
        if member_connection_key in active_connections:
            # Send message
            await active_connections[member_connection_key].send_json(message_data)
    
    # Echo back to sender
    await websocket.send_json({
        **message_data,
        "sender": "user"  # Mark as own message
    })