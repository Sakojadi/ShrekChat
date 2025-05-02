from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import os
import httpx
from datetime import datetime

from app.routers.session import get_db, get_current_user
from app.database import Message, User

# Create router
router = APIRouter(prefix="/api")

# Load DeepL API key from environment variable
DEEPL_API_KEY = os.getenv("DEEPL_API_KEY", "")
DEEPL_API_URL = "https://api-free.deepl.com/v2/translate"

class TranslateRequest(BaseModel):
    message_id: Optional[int] = None
    text: str
    target_lang: str

@router.post("/translate")
async def translate_text(
    request: TranslateRequest,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Translate message text using DeepL API"""
    # Verify the user
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Check if text is provided
    if not request.text or not request.target_lang:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text and target language are required"
        )
    
    # Check if DeepL API key is configured
    if not DEEPL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Translation service is not configured"
        )
    
    # Check if message_id is provided and message exists
    message = None
    if request.message_id:
        message = db.query(Message).filter(Message.id == request.message_id).first()
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
    
    try:
        # Call DeepL API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                DEEPL_API_URL,
                data={
                    "auth_key": DEEPL_API_KEY,
                    "text": request.text,
                    "target_lang": request.target_lang
                }
            )
            
            # Check response
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Translation service error: {response.text}"
                )
            
            # Extract translation from response
            translation_data = response.json()
            translated_text = translation_data["translations"][0]["text"]
            
            # Update message in database if message_id was provided
            if message:
                # Only update if translation is successful
                if translated_text:
                    # If this is the first translation, store the original text
                    if not message.original_content:
                        message.original_content = message.content
                    
                    message.content = translated_text
                    message.is_translated = True
                    message.translated_at = datetime.utcnow()
                    message.translated_to = request.target_lang
                    db.commit()
            
            return {
                "success": True,
                "translated_text": translated_text,
                "source_text": request.text,
                "target_lang": request.target_lang
            }
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Translation failed: {str(e)}"
        )

@router.post("/translate/restore/{message_id}")
async def restore_original_text(
    message_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Restore the original text of a translated message"""
    # Verify the user
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Find the message
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Check if message has been translated
    if not message.is_translated or not message.original_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message has not been translated"
        )
    
    # Restore original content
    translated_content = message.content
    message.content = message.original_content
    message.is_translated = False
    message.translated_at = None
    message.translated_to = None
    
    db.commit()
    
    return {
        "success": True,
        "original_text": message.content,
        "translated_text": translated_content
    }
