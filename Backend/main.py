from fastapi import FastAPI
from fastapi.responses import JSONResponse
from logic_handling import *

app = FastAPI(
    title="ShipLens Platform API",
    description="Branch-to-Head-Office Management Platform Backend",
    version="0.1.0",
)

@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {
        "status": "online",
        "message": "ShipLens Management Platform API is running"
    }

@app.get("/health")
async def health_check():
    return JSONResponse(
        status_code=200,
        content=
        {
            "status": "healthy",
            "database": "disconnected"
        }
    )