# This file now serves as a redirect to the modular chat structure
# All functionality has been moved to app/routers/chat/ directory

# Import and export the router from the chat module
from app.routers.chat import router

# This allows the main app to import the router from here
__all__ = ["router"]