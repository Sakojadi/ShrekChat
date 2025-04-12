from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth_routes, chat_routes

app = FastAPI(title="ShrekChat")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(auth_routes, prefix="/api/auth")
app.include_router(chat_routes, prefix="/api/chat")

@app.get("/")
def home():
    return {"message": "Welcome to ShrekChat"}

# Run with `uvicorn main:app --reload`
