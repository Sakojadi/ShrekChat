from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
import uvicorn

# Direct imports from new router files in app/routers/
from app.routers.auth import router as auth_router
from app.routers.views import router as views_router
from app.routers.direct_messages import router as direct_messages_router
from app.routers.groups import router as groups_router
from app.routers.websockets import router as websockets_router

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

# Include routers directly
app.include_router(auth_router)
app.include_router(views_router)
app.include_router(direct_messages_router)
app.include_router(groups_router)
app.include_router(websockets_router)

# Root route redirects to login
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return RedirectResponse(url="/login")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)