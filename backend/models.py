from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any

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
