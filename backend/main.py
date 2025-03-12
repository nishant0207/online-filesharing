from fastapi import FastAPI
from app.routes import router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="File Sharing API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to specific frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],  # Allow all headers
)

# Include authentication routes
app.include_router(router)



@app.get("/")
def read_root():
    return {"message": "Welcome to the File Sharing API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)