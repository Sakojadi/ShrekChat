from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
import os
from pathlib import Path
from routes.auth import auth_routes
from routes.chat import chat_routes, socket_app
from routes.users import users_routes
from routes.contacts import contacts_routes
from database import create_tables

# Create database tables
create_tables()

# Get the base directory
BASE_DIR = Path(__file__).resolve().parent

# Initialize FastAPI app
app = FastAPI(title="ShrekChat")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

# Set up Jinja2 templates
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Include routes first
app.include_router(auth_routes, prefix="/api/auth")
app.include_router(chat_routes, prefix="/api/chat")
app.include_router(users_routes, prefix="/api/users")
app.include_router(contacts_routes, prefix="/api/contacts")

# Mount Socket.IO ASGI application at a specific path that doesn't conflict with API routes
app.mount("/socket.io", socket_app)

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Render the home page using Jinja2 templates"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/chat", response_class=HTMLResponse)
async def chat_page(request: Request):
    """Render the chat page using Jinja2 templates"""
    return templates.TemplateResponse("chat.html", {"request": request})

# Run with `uvicorn main:app --reload`
