from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from database import get_db
import jwt

# JWT settings - keep them in sync with auth.py
SECRET_KEY = "your-secret-key-for-jwt"
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        with get_db() as db:
            cursor = db.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            user = cursor.fetchone()
            
            if user is None:
                raise HTTPException(status_code=401, detail="User not found")
            
            return {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"]
            }
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
