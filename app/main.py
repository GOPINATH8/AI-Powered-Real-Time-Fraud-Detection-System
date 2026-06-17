from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import joblib
from dotenv import load_dotenv
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import redis

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")
MODEL_PATH = os.getenv("MODEL_PATH", "app/model/iso_forest_model.pkl")
ENCODER_PATH = os.getenv("ENCODER_PATH", "app/model/onehot_encoder.pkl")

# Initialize FastAPI app
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model and encoder (fail early with helpful message)
try:
    iso_forest = joblib.load(MODEL_PATH)
except Exception:
    iso_forest = None

try:
    encoder = joblib.load(ENCODER_PATH)
except Exception:
    encoder = None

# Initialize database connection lazily at startup
conn = None

def create_db_connection(url: str):
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. "
            "Please configure it in app/.env or your environment before starting the app."
        )

    try:
        return psycopg2.connect(url, cursor_factory=RealDictCursor)
    except psycopg2.OperationalError as e:
        raise RuntimeError(
            "Failed to connect to the PostgreSQL database. "
            "Verify PostgreSQL is running, the host/port are correct, and the DATABASE_URL credentials are valid. "
            f"Configured DATABASE_URL: {url}\n"
            f"Original error: {e}"
        )
    except Exception as e:
        raise RuntimeError(f"Failed to connect to database: {e}")

@app.on_event("startup")
async def startup_event():
    global conn
    conn = create_db_connection(DATABASE_URL)

# Initialize Redis client if URL provided
redis_client = None
if REDIS_URL:
    try:
        redis_client = redis.StrictRedis.from_url(REDIS_URL)
    except Exception:
        redis_client = None


# Define input schema (all features used in training)
class Transaction(BaseModel):
    account_id: str
    TransactionAmount: float
    CustomerAge: int
    TransactionDuration: float
    LoginAttempts: int
    AccountBalance: float
    user_transaction_count: float
    user_avg_transaction_amount: float
    deviation_from_user_avg: float
    transaction_hour: int
    transaction_day_of_week: int
    TransactionType: str
    Location: str
    Channel: str
    CustomerOccupation: str
    user_primary_location: str
    is_unusual_location: str


@app.post("/transactions/ingest")
async def ingest_transaction(transaction: Transaction):
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO transactions (
                    account_id, amount, location, event_time, is_fraud, fraud_probability,
                    user_transaction_count, user_avg_transaction_amount, deviation_from_user_avg,
                    transaction_hour, transaction_day_of_week, transaction_type, channel,
                    customer_age, customer_occupation, login_attempts, account_balance, user_primary_location, is_unusual_location
                )
                VALUES (%s, %s, %s, NOW(), NULL, NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    str(transaction.account_id),
                    float(transaction.TransactionAmount),
                    str(transaction.Location),
                    float(transaction.user_transaction_count),
                    float(transaction.user_avg_transaction_amount),
                    float(transaction.deviation_from_user_avg),
                    int(transaction.transaction_hour),
                    int(transaction.transaction_day_of_week),
                    str(transaction.TransactionType),
                    str(transaction.Channel),
                    int(transaction.CustomerAge),
                    str(transaction.CustomerOccupation),
                    int(transaction.LoginAttempts),
                    float(transaction.AccountBalance),
                    str(transaction.user_primary_location),
                    str(transaction.is_unusual_location),
                ),
            )
        conn.commit()
        return {"message": "Transaction ingested successfully", "data": transaction.dict()}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/transactions/score")
async def score_transaction(transaction: Transaction):
    if iso_forest is None:
        raise HTTPException(status_code=500, detail="Model not loaded; check MODEL_PATH")

    try:
        # Prepare numeric features
        numeric_features = np.array([
            transaction.TransactionAmount,
            transaction.CustomerAge,
            transaction.TransactionDuration,
            transaction.LoginAttempts,
            transaction.AccountBalance,
            transaction.user_transaction_count,
            transaction.user_avg_transaction_amount,
            transaction.deviation_from_user_avg,
            transaction.transaction_hour,
            transaction.transaction_day_of_week,
        ]).reshape(1, -1)

        # Prepare categorical features (if encoder available)
        if encoder is not None:
            categorical_features = encoder.transform([[
                transaction.TransactionType,
                transaction.Location,
                transaction.Channel,
                transaction.CustomerOccupation,
                transaction.user_primary_location,
                transaction.is_unusual_location,
            ]])
        else:
            categorical_features = np.zeros((1, 0))

        features = np.hstack((numeric_features, categorical_features)).astype(np.float32)

        # Get anomaly score and prediction
        anomaly_score = float(-iso_forest.decision_function(features)[0])
        is_fraud = bool(iso_forest.predict(features)[0] == -1)
        prediction = "Fraudulent" if is_fraud else "Legitimate"

        # Save results to the database
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO transactions (
                    account_id, amount, location, event_time, is_fraud, fraud_probability,
                    user_transaction_count, user_avg_transaction_amount, deviation_from_user_avg,
                    transaction_hour, transaction_day_of_week, transaction_type, channel,
                    customer_age, customer_occupation, login_attempts, account_balance, user_primary_location, is_unusual_location
                )
                VALUES (%s, %s, %s, NOW(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    str(transaction.account_id),
                    float(transaction.TransactionAmount),
                    str(transaction.Location),
                    is_fraud,
                    anomaly_score,
                    float(transaction.user_transaction_count),
                    float(transaction.user_avg_transaction_amount),
                    float(transaction.deviation_from_user_avg),
                    int(transaction.transaction_hour),
                    int(transaction.transaction_day_of_week),
                    str(transaction.TransactionType),
                    str(transaction.Channel),
                    int(transaction.CustomerAge),
                    str(transaction.CustomerOccupation),
                    int(transaction.LoginAttempts),
                    float(transaction.AccountBalance),
                    str(transaction.user_primary_location),
                    str(transaction.is_unusual_location),
                ),
            )
        conn.commit()

        return {"fraud_score": round(anomaly_score, 2), "prediction": prediction}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")