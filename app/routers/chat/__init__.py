from fastapi import APIRouter

# Import all the router modules
from app.routers.chat.direct_messages import router as direct_messages_router
from app.routers.chat.group_chat import router as group_chat_router
from app.routers.chat.websockets import router as websockets_router
from app.routers.chat.views import router as views_router

# Create a main router and include all sub-routers
router = APIRouter()
router.include_router(views_router)  # Include the main chat view first
router.include_router(direct_messages_router)
router.include_router(group_chat_router)
router.include_router(websockets_router)

# Export the router to be imported by the main app
__all__ = ["router"]