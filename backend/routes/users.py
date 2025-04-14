from fastapi import APIRouter, Depends, HTTPException
from database import get_db
import sqlite3
from routes.utils import get_current_user

# Initialize router
users_routes = APIRouter()

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
