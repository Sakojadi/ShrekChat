from fastapi import APIRouter, Depends, HTTPException
from models import Message, UserProfile
from database import get_db
import sqlite3
from routes.utils import get_current_user

# Initialize router
chat_routes = APIRouter()

# Chat routes
@chat_routes.post("/send")
async def send_message(message: Message, current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            cursor.execute(
                "INSERT INTO messages (sender, receiver, content, timestamp) VALUES (?, ?, ?, ?)",
                (message.sender, message.receiver, message.content, message.timestamp)
            )
            db.commit()
            
            return {"message": "Message sent successfully", "id": cursor.lastrowid}
        except sqlite3.Error as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@chat_routes.get("/messages/{contact}")
async def get_messages(contact: str, current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            # Get messages where current user is sender or receiver and contact is the other party
            cursor.execute(
                """
                SELECT * FROM messages 
                WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
                ORDER BY timestamp ASC
                """,
                (current_user["username"], contact, contact, current_user["username"])
            )
            
            messages = cursor.fetchall()
            return {"messages": messages}
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@chat_routes.get("/contacts")
async def get_contacts(current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            # Find all distinct users that have exchanged messages with the current user
            cursor.execute(
                """
                SELECT DISTINCT 
                    CASE 
                        WHEN sender = ? THEN receiver 
                        ELSE sender 
                    END as contact_name
                FROM messages
                WHERE sender = ? OR receiver = ?
                """,
                (current_user["username"], current_user["username"], current_user["username"])
            )
            
            contacts = cursor.fetchall()
            return {"contacts": [contact["contact_name"] for contact in contacts]}
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
