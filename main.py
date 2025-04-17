from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from starlette.middleware.sessions import SessionMiddleware
import uvicorn

from app.routers import auth, chat

app = FastAPI(title="ShrekChat")

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Configure Jinja2 templates
templates = Jinja2Templates(directory="app/templates")

# Add session middleware
app.add_middleware(
    SessionMiddleware, 
    secret_key="your-secret-key-here",  # In production, use a proper secure key
    max_age=3600  # Session expiry time in seconds (1 hour)
)

# Include routers
app.include_router(auth.router)
app.include_router(chat.router)

# Root route redirects to login
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return RedirectResponse(url="/login")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)