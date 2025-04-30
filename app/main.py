from fastapi import FastAPI
from app.routers import auth, chat, websockets, sendAttach, sendAudio, block_users

app = FastAPI()

# Include routers
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(websockets.router)
app.include_router(sendAttach.router)
app.include_router(sendAudio.router)
app.include_router(block_users.router)  # Add the block_users router