from fastapi import APIRouter, Depends, HTTPException, Body
from database import get_db
import sqlite3
from routes.utils import get_current_user
from typing import List

# Initialize router
contacts_routes = APIRouter()

@contacts_routes.get("/contacts")
async def get_contacts(current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            # Get all contacts for the current user
            cursor.execute(
                """
                SELECT u.id, u.username, u.email, u.status, u.profile_picture
                FROM users u
                JOIN contacts c ON u.id = c.contact_id
                WHERE c.user_id = ?
                """,
                (current_user["id"],)
            )
            
            contacts = cursor.fetchall()
            return {
                "contacts": [
                    {
                        "id": contact["id"],
                        "username": contact["username"],
                        "email": contact["email"],
                        "status": contact["status"],
                        "profilePicture": contact["profile_picture"] 
                    }
                    for contact in contacts
                ]
            }
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@contacts_routes.post("/add-contact/{username}")
async def add_contact(username: str, current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            # Check if the contact exists
            if(username.__contains__("@")):
                cursor.execute("SELECT id FROM users WHERE email = ?", (username,))
                contact = cursor.fetchone()
            else:
                cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
                contact = cursor.fetchone()

            
            if not contact:
                raise HTTPException(status_code=404, detail="User not found")
            
            contact_id = contact["id"]
            
            # Check if trying to add self as contact
            if current_user["id"] == contact_id:
                raise HTTPException(status_code=400, detail="You cannot add yourself as a contact")
            
            # Check if already a contact
            cursor.execute(
                "SELECT * FROM contacts WHERE user_id = ? AND contact_id = ?",
                (current_user["id"], contact_id)
            )
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="User is already in your contacts")
            
            # Add contact (bidirectional - both users add each other)
            cursor.execute(
                "INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)",
                (current_user["id"], contact_id)
            )
            
            # Add the reverse relationship too
            cursor.execute(
                "INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)",
                (contact_id, current_user["id"])
            )
            
            db.commit()
            return {"message": f"Added {username} to contacts"}
        except sqlite3.Error as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@contacts_routes.delete("/remove-contact/{username}")
async def remove_contact(username: str, current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            # Get the contact's ID
            cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
            contact = cursor.fetchone()
            
            if not contact:
                raise HTTPException(status_code=404, detail="User not found")
            
            contact_id = contact["id"]
            
            # Delete the contact relationship in both directions
            cursor.execute(
                "DELETE FROM contacts WHERE user_id = ? AND contact_id = ?",
                (current_user["id"], contact_id)
            )
            
            cursor.execute(
                "DELETE FROM contacts WHERE user_id = ? AND contact_id = ?",
                (contact_id, current_user["id"])
            )
            
            db.commit()
            return {"message": f"Removed {username} from contacts"}
        except sqlite3.Error as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
