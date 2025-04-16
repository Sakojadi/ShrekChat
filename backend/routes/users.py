from fastapi import APIRouter, Depends, HTTPException, Body
from database import get_db
import sqlite3
from routes.utils import get_current_user
from typing import Optional
from pydantic import BaseModel

# Initialize router
users_routes = APIRouter()

# User profile update model
class UserProfileUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    status: Optional[str] = None

@users_routes.get("/profile")
async def get_user_profile(current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            # Get user profile data
            cursor.execute(
                """
                SELECT username, email, phone, status, profile_picture
                FROM users
                WHERE username = ?
                """,
                (current_user["username"],)
            )
            
            user_data = cursor.fetchone()
            
            if not user_data:
                raise HTTPException(status_code=404, detail="User not found")
            
            return {
                "username": user_data["username"],
                "email": user_data["email"],
                "phone": user_data["phone"] if "phone" in user_data else None,
                "status": user_data["status"] if "status" in user_data else "Online",
                "profilePicture": user_data["profile_picture"] if "profile_picture" in user_data else None
            }
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@users_routes.get("/all")
async def get_all_users(current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            # Get all users except current user
            cursor.execute(
                """
                SELECT username, email, profile_picture, status
                FROM users
                """
            )
            users = cursor.fetchall()
            
            return {
                "users": [{
                    "username": user["username"],
                    "email": user["email"],
                    "profilePicture": user["profile_picture"] if "profile_picture" in user else None,
                    "status": user["status"] if "status" in user else "Offline"
                } for user in users]
            }
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@users_routes.put("/update-profile")
async def update_user_profile(profile: UserProfileUpdate, current_user = Depends(get_current_user)):
    with get_db() as db:
        cursor = db.cursor()
        
        try:
            # Check if username already exists (if changing username)
            if profile.username and profile.username != current_user["username"]:
                cursor.execute("SELECT * FROM users WHERE username = ? AND id != ?", 
                              (profile.username, current_user["id"]))
                if cursor.fetchone():
                    raise HTTPException(status_code=400, detail="Username already taken")
            
            # Check if email already exists (if changing email)
            if profile.email and profile.email != current_user["email"]:
                cursor.execute("SELECT * FROM users WHERE email = ? AND id != ?", 
                              (profile.email, current_user["id"]))
                if cursor.fetchone():
                    raise HTTPException(status_code=400, detail="Email already taken")
            
            # Update fields that are provided
            update_fields = []
            update_values = []
            
            if profile.username:
                update_fields.append("username = ?")
                update_values.append(profile.username)
                
            if profile.email:
                update_fields.append("email = ?")
                update_values.append(profile.email)
                
            if profile.phone is not None:  # Allow empty string to clear phone
                update_fields.append("phone = ?")
                update_values.append(profile.phone)
                
            if profile.country is not None:  # Allow empty string to clear country
                update_fields.append("country = ?")
                update_values.append(profile.country)
                
            if profile.status:
                update_fields.append("status = ?")
                update_values.append(profile.status)
            
            if not update_fields:
                return {"message": "No fields to update"}
            
            # Add user ID to values
            update_values.append(current_user["id"])
            
            # Construct and execute update query
            query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
            cursor.execute(query, update_values)
            db.commit()
            
            return {"message": "Profile updated successfully"}
            
        except sqlite3.Error as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
