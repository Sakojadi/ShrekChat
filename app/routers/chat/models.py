from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ContactResponse(BaseModel):
    """Response model for contact information"""
    id: int
    name: str
    username: str
    email: str
    avatar: str = "/static/images/shrek.jpg"  # Default avatar
    status: str = "offline"  # Default status
    added_at: Optional[datetime] = None

class GroupCreateRequest(BaseModel):
    """Request model for group creation"""
    name: str
    description: Optional[str] = None
    member_ids: List[int]

class GroupUpdateRequest(BaseModel):
    """Request model for group update"""
    name: Optional[str] = None
    description: Optional[str] = None