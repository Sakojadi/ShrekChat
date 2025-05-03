from fastapi import FastAPI
from app.routers import auth, websockets, sendAttach, sendAudio, block_users, admin, views, direct_messages

app = FastAPI()

# Include routers
app.include_router(auth.router)
app.include_router(views.router)  # Using views instead of chat
app.include_router(direct_messages.router)  # Adding direct_messages router
app.include_router(websockets.router)
app.include_router(sendAttach.router)
app.include_router(sendAudio.router)
app.include_router(block_users.router)
app.include_router(admin.router)