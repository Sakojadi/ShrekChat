from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from app.routers import auth, websockets, sendAttach, sendAudio, block_users, admin, views, direct_messages, groups

app = FastAPI()

# Add session middleware with a secure secret key
# In production, use a more secure random key
app.add_middleware(
    SessionMiddleware, 
    secret_key="YOUR_SECRET_KEY_REPLACE_THIS_IN_PRODUCTION",
    max_age=3600  # 1 hour session expiry
)

# Include routers
app.include_router(auth.router)
app.include_router(views.router)  # Using views instead of chat
app.include_router(direct_messages.router)  # Adding direct_messages router
app.include_router(groups.router)  # Add groups router if it exists
app.include_router(websockets.router)
app.include_router(sendAttach.router)
app.include_router(sendAudio.router)
app.include_router(block_users.router)
app.include_router(admin.router)

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")