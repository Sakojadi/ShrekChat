from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class User(BaseModel):
    username: str
    email: EmailStr

class Message(BaseModel):
    sender: str
    receiver: str
    content: str
    timestamp: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class UserProfile(BaseModel):
    username: str
    email: EmailStr
    phone: Optional[str] = None
    status: Optional[str] = None
    profilePicture: Optional[str] = None

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    members: List[str]
