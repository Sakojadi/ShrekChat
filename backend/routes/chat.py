from fastapi import APIRouter, Depends, HTTPException, status, Request
import socketio
from models import Message, UserProfile
from database import get_db
import sqlite3
from routes.utils import get_current_user
import json
import jwt
import os
from config import SECRET_KEY, ALGORITHM
from typing import Dict, List, Optional
import asyncio
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pathlib import Path

# Initialize router
chat_routes = APIRouter()

# Get the base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Set up Jinja2 templates
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Initialize Socket.IO - create a standalone socket.io server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=["*"],  # Allow all origins
    logger=True,
    engineio_logger=True
)

# Create a Socket.IO App that we'll mount later in main.py
socket_app = socketio.ASGIApp(sio)

# Store active user connections
active_users = {}

# Helper function to validate token directly (for Socket.IO)
def get_current_user_from_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            return None
        
        with get_db() as db:
            cursor = db.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            user = cursor.fetchone()
            
            if user is None:
                return None
            
            return {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"]
            }
    except jwt.PyJWTError as e:
        print(f"JWT Token error: {str(e)}")
        return None
    except Exception as e:
        print(f"Authentication error: {str(e)}")
        return None

# Socket.IO event handlers
@sio.event
async def connect(sid, environ):
    print(f"New connection attempt from SID: {sid}")
    print(f"Environment data: {environ.get('HTTP_ORIGIN', 'No origin')}")
    # Accept all connections initially, authentication will happen in a separate event
    return True

@sio.event
async def authenticate(sid, data):
    print(f"Authentication attempt from sid {sid}: {data}")
    
    if not data or "token" not in data:
        print("No token provided")
        await sio.emit("auth_error", {"message": "No authentication token provided"}, to=sid)
        return False
    
    token = data["token"]
    user = get_current_user_from_token(token)
    
    if not user:
        print("Invalid token or user not found")
        await sio.emit("auth_error", {"message": "Invalid token or user not found"}, to=sid)
        return False
    
    username = user["username"]
    
    # Store the user's session information
    active_users[sid] = {
        "username": username,
        "user_id": user["id"]
    }
    
    # Join a personal room for direct messages
    await sio.enter_room(sid, username)
    
    # Notify other users that this user is online
    await sio.emit("user_status", {"username": username, "status": "online"}, broadcast=True, skip_sid=sid)
    
    # Get online status of all active users for this user
    online_users = list(set([data["username"] for data in active_users.values()]))
    await sio.emit("users_online", {"users": online_users}, to=sid)
    
    # Send authentication success
    await sio.emit("auth_success", {"username": username}, to=sid)
    
    print(f"User {username} authenticated with SID: {sid}")
    return True

@sio.event
async def disconnect(sid):
    # Check if user was authenticated before disconnecting
    if sid in active_users:
        username = active_users[sid]["username"]
        print(f"User {username} disconnected")
        
        # Remove user from active users
        del active_users[sid]
        
        # Notify others that user is offline
        await sio.emit("user_status", {"username": username, "status": "offline"}, broadcast=True)
    else:
        print(f"Unauthenticated client disconnected: {sid}")

@sio.event
async def message(sid, data):
    if sid not in active_users:
        await sio.emit("error", {"message": "Not authenticated"}, to=sid)
        return
    
    sender_username = active_users[sid]["username"]
    print(f"Message from {sender_username}: {data}")
    
    # Validate message data
    required_fields = ["receiver", "content"]
    if not all(field in data for field in required_fields):
        await sio.emit("error", {"message": "Message missing required fields"}, to=sid)
        return
    
    receiver = data["receiver"]
    content = data["content"]
    timestamp = data.get("timestamp") or asyncio.get_event_loop().time()
    
    try:
        # Store message in database
        with get_db() as db:
            cursor = db.cursor()
            cursor.execute(
                "INSERT INTO messages (sender, receiver, content, timestamp) VALUES (?, ?, ?, ?)",
                (sender_username, receiver, content, timestamp)
            )
            db.commit()
            message_id = cursor.lastrowid
        
        # Prepare message object
        message = {
            "id": message_id,
            "sender": sender_username,
            "receiver": receiver,
            "content": content,
            "timestamp": timestamp,
            "read": False
        }
        
        print(f"Sending message to {receiver}: {message}")
        # Send to recipient (if online)
        await sio.emit("new_message", message, to=receiver)
        
        # Send confirmation back to sender
        await sio.emit("message_delivered", {
            "message_id": message_id,
            "status": "delivered"
        }, to=sid)
        
    except sqlite3.Error as e:
        print(f"Database error: {str(e)}")
        await sio.emit("error", {"message": f"Database error: {str(e)}"}, to=sid)
    except Exception as e:
        print(f"Error handling message: {str(e)}")
        await sio.emit("error", {"message": "Error processing message"}, to=sid)

@sio.event
async def read_messages(sid, data):
    if sid not in active_users:
        await sio.emit("error", {"message": "Not authenticated"}, to=sid)
        return
    
    if "message_ids" not in data or not isinstance(data["message_ids"], list):
        await sio.emit("error", {"message": "Invalid message_ids"}, to=sid)
        return
    
    try:
        with get_db() as db:
            cursor = db.cursor()
            for message_id in data["message_ids"]:
                cursor.execute("UPDATE messages SET read = 1 WHERE id = ?", (message_id,))
            db.commit()
        
        # Notify the sender that their messages were read
        if "sender" in data:
            await sio.emit("messages_read", {
                "message_ids": data["message_ids"],
                "reader": active_users[sid]["username"]
            }, to=data["sender"])
            
    except sqlite3.Error as e:
        print(f"Database error marking messages as read: {str(e)}")
        await sio.emit("error", {"message": f"Database error: {str(e)}"}, to=sid)

# Debug route to check Socket.IO setup
@chat_routes.get("/socket-status")
async def socket_status():
    """Debug endpoint to check if Socket.IO is properly initialized"""
    active_count = len(active_users)
    return {
        "status": "Socket.IO server running",
        "active_connections": active_count,
        "active_users": list(active_users.values())
    }

# Route for rendering chat page with Jinja2
@chat_routes.get("/view", response_class=HTMLResponse)
async def chat_page_view(request: Request, current_user = Depends(get_current_user)):
    """Render chat page with Jinja2 templates"""
    # Get user's contacts
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute("""
            SELECT u.id, u.username, u.email, u.status, u.profile_picture, u.country
            FROM contacts c
            JOIN users u ON c.contact_id = u.id
            WHERE c.user_id = ?
        """, (current_user["id"],))
        contacts = []
        for row in cursor.fetchall():
            # Get last message for this contact
            cursor.execute("""
                SELECT content, timestamp, read FROM messages
                WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
                ORDER BY timestamp DESC LIMIT 1
            """, (current_user["username"], row["username"], row["username"], current_user["username"]))
            
            last_message = cursor.fetchone()
            
            # Get unread count
            cursor.execute("""
                SELECT COUNT(*) as count FROM messages
                WHERE sender = ? AND receiver = ? AND read = 0
            """, (row["username"], current_user["username"]))
            
            unread = cursor.fetchone()
            
            contacts.append({
                "id": row["id"],
                "username": row["username"],
                "email": row["email"],
                "status": row["status"],
                "profilePicture": row["profile_picture"],
                "country": row["country"],
                "lastMessage": last_message["content"] if last_message else None,
                "lastMessageTime": last_message["timestamp"] if last_message else None,
                "unreadCount": unread["count"] if unread and unread["count"] > 0 else None
            })
    
    # Pass data to the template
    return templates.TemplateResponse("chat.html", {
        "request": request,
        "user_data": {
            "username": current_user["username"],
            "email": current_user["email"],
            "token": "", # Token is stored in localStorage
        },
        "contacts": json.dumps(contacts),
        "server_url": request.url.scheme + "://" + request.url.netloc,
        "socketio_path": "/socket.io/"
    })

# Standard API routes for messages

@chat_routes.get("/messages/{contact}")
async def get_messages(contact: str, current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            # Get messages where current user is sender or receiver and contact is the other party
            cursor.execute(
                """
                SELECT id, sender, receiver, content, timestamp, read
                FROM messages 
                WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
                ORDER BY timestamp ASC
                """,
                (current_user["username"], contact, contact, current_user["username"])
            )
            
            # Convert rows to dictionaries with proper field names
            messages = [
                {
                    "id": row[0],
                    "sender": row[1],
                    "receiver": row[2],
                    "content": row[3],
                    "timestamp": row[4],
                    "read": bool(row[5])
                } for row in cursor.fetchall()
            ]
            
            return {"messages": messages}
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@chat_routes.delete("/delete-messages/{contact}")
async def delete_messages(contact: str, current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            # Delete all messages between current user and the specified contact
            cursor.execute(
                """
                DELETE FROM messages 
                WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
                """,
                (current_user["username"], contact, contact, current_user["username"])
            )
            
            db.commit()
            return {"message": f"All messages with {contact} have been deleted"}
        except sqlite3.Error as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
