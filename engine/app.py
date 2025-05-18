import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), 'core'))

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Text
from sqlalchemy.orm import sessionmaker, declarative_base
from predict import predict
from config import load_config
import uvicorn

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

config = load_config()

db_cfg = config["database"]
DB_URL = (
    f"postgresql://{db_cfg['username']}:{db_cfg['password']}"
    f"@{db_cfg.get('host', 'localhost')}:{db_cfg['port']}/{db_cfg['name']}"
)

engine = create_engine(DB_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Tweet(Base):
    __tablename__ = "tweets"
    id = Column(String, primary_key=True)
    author = Column(String)
    text = Column(Text)
    label = Column(String)

class PredictionRequest(BaseModel):
    text: str

class StoreRequest(BaseModel):
    id: str
    author: str
    text: str
    label: str

@app.post("/predict")
async def predict_handler(req: PredictionRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty.")
    
    label = predict(req.text.strip())
    return {"label": label}

@app.post("/store")
def store_tweet(req: StoreRequest):
    db = SessionLocal()
    try:
        tweet = Tweet(**req.model_dump())
        db.merge(tweet)
        db.commit()
        return {"status": "stored"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
        
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=config['server']['port'])