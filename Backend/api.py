"""
Application/service layer.

Contains:
  * Pydantic request models
  * Security helpers (token generation, hashing, password verification)
  * FastAPI dependency `require_actor` — the *only* place that turns a
    bearer token into a trusted actor UUID
  * Business logic functions. Each one is self-contained: opens its own
    connection, calls one or more db.* functions, and returns a plain
    dict on success or raises HTTPException on failure.

SECURITY NOTES
--------------
1. The SQL functions trust `p_actor`. The *only* place that derives
   `p_actor` from a real session is `require_actor` below. Never trust
   a client-supplied actor UUID.
2. Session tokens are opaque (secrets.token_urlsafe(32)). Only the
   SHA-256 hash is sent to the DB — the raw token never touches the DB.
3. `verify_password` uses hmac.compare_digest (constant-time).
4. `api.get_login` returns password_hash — it is consumed here and never
   forwarded to the client.
5. Session hash parameters and the `user_sessions.token_hash` column must
    use `CHAR(64)` to match the 64-character SHA-256 hex digest.
"""

import hashlib
import hmac
import secrets
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import db
import psycopg
from fastapi import Header, HTTPException, Request, status
from pydantic import BaseModel, Field

# ===================================================================
# Constants
# ===================================================================

SESSION_TTL = timedelta(hours=8)
TOKEN_BYTES = 32
ALLOWED_ORIGINS = [o.strip() for o in __import__(
    "os").environ.get("cors_origins", "").split(",") if o.strip()]


# ===================================================================
# Security helpers
# ===================================================================

def generate_token() -> str:
    """Cryptographically-random opaque bearer token."""
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_token(token: str) -> str:
    """SHA-256 hex digest — what we persist in user_sessions.token_hash."""
    return hashlib.sha256(token.encode()).hexdigest()


def verify_password(plain: str, stored: str) -> bool:
    """
    Constant-time verification.

    Supported stored formats:
      * 'pbkdf2_sha256$<iterations>$<salt>$<hex>'  (preferred)
      * plain sha256 hex                          (legacy fallback)
    """
    if not stored:
        return False
    if stored.startswith("pbkdf2_sha256$"):
        try:
            _, iters_s, salt, expected = stored.split("$", 3)
            digest = hashlib.pbkdf2_hmac(
                "sha256", plain.encode(), salt.encode(), int(iters_s)
            ).hex()
            return hmac.compare_digest(digest, expected)
        except (ValueError, TypeError):
            return False
    digest = hashlib.sha256(plain.encode()).hexdigest()
    return hmac.compare_digest(digest, stored)


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="empty bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token


# ===================================================================
# Session validation dependency (THE trust boundary)
# ===================================================================

def require_actor(authorization: str | None = Header(None, alias="Authorization")) -> UUID:
    """
    Resolve the bearer token to a trusted actor UUID via api.validate_session.
    Never trust X-Actor-Id from the client.
    """
    token = _extract_bearer(authorization)
    token_hash = hash_token(token)
    try:
        with db.connect() as conn:
            row = db.validate_session(conn, token_hash)
    except psycopg.Error:
        raise HTTPException(status_code=500, detail="session lookup failed")
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return row["user_id"]


# ===================================================================
# Error mapping: Postgres RAISE EXCEPTION -> HTTP
# ===================================================================

def _map_db_error(exc: psycopg.Error) -> HTTPException:
    msg = str(exc).lower()
    if "forbidden" in msg:
        return HTTPException(status_code=403, detail="forbidden")
    if "not pending" in msg:
        return HTTPException(status_code=409, detail="collection is not pending")
    if "not found" in msg:
        return HTTPException(status_code=404, detail="not found")
    if "duplicate key" in msg or "unique constraint" in msg:
        return HTTPException(status_code=409, detail="already exists")
    if "permission denied" in msg:
        # don't leak internal privilege details
        return HTTPException(status_code=500, detail="internal error")
    return HTTPException(status_code=400, detail=str(exc))


# ===================================================================
# Pydantic models
# ===================================================================

class LoginIn(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1, max_length=200)


class CreateBranchIn(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    name_en: str = Field(..., min_length=1, max_length=200)
    name_ur: str = Field(..., min_length=1, max_length=200)
    city: str = Field(..., min_length=1, max_length=100)
    address_en: str = Field(..., min_length=1, max_length=500)
    address_ur: str = Field(..., min_length=1, max_length=500)


class CreateUserIn(BaseModel):
    branch_id: UUID | None = None
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=254)
    password_hash: str = Field(..., min_length=1, max_length=500)
    role: str = Field(..., min_length=1, max_length=50)


class SetUserActiveIn(BaseModel):
    user_id: UUID
    is_active: bool


class SubmitCollectionIn(BaseModel):
    title_en: str = Field(..., min_length=1, max_length=200)
    title_ur: str = Field(..., min_length=1, max_length=200)
    amount: Decimal = Field(..., gt=0)
    collection_date: date


class ReviewCollectionIn(BaseModel):
    collection_id: UUID
    approve: bool
    notes: str | None = Field(None, max_length=2000)


class ListCollectionsIn(BaseModel):
    status: str | None = None


class SubmitWeeklyReportIn(BaseModel):
    week_start: date
    week_end: date
    summary_en: str = Field(..., min_length=1, max_length=5000)
    summary_ur: str = Field(..., min_length=1, max_length=5000)
    total_members_active: int = Field(..., ge=0)
    new_registrations: int = Field(..., ge=0)


class AddMemberIn(BaseModel):
    branch_id: UUID | None = None
    name_en: str = Field(..., min_length=1, max_length=200)
    name_ur: str = Field(..., min_length=1, max_length=200)
    cnic: str = Field(..., min_length=1, max_length=50)
    phone: str = Field(..., min_length=1, max_length=50)


class SetMemberActiveIn(BaseModel):
    member_id: UUID
    is_active: bool


class SaveNoticeIn(BaseModel):
    notice_id: UUID | None = None
    title_en: str = Field(..., min_length=1, max_length=200)
    title_ur: str = Field(..., min_length=1, max_length=200)
    content_en: str = Field(..., min_length=1, max_length=20000)
    content_ur: str = Field(..., min_length=1, max_length=20000)
    publish: bool


class SubmitInquiryIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=254)
    subject: str = Field(..., min_length=1, max_length=300)
    message: str = Field(..., min_length=1, max_length=5000)


class ResolveInquiryIn(BaseModel):
    inquiry_id: UUID


class ListAuditLogsIn(BaseModel):
    limit: int = Field(100, ge=1, le=1000)


# ===================================================================
# Auth business logic
# ===================================================================

def _client_ip(request: Request) -> str | None:
    # If behind a trusted reverse proxy, prefer X-Forwarded-For.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


def login(body: LoginIn, request: Request) -> dict:
    ip = _client_ip(request)
    ua = (request.headers.get("user-agent") or "")[:500]

    with db.connect() as conn:
        row = db.get_login(conn, body.email)
        if row is None or not verify_password(body.password, row["password_hash"]):
            # Same error for both cases to avoid user enumeration.
            raise HTTPException(status_code=401, detail="invalid credentials")

        raw_token = generate_token()
        token_hash = hash_token(raw_token)
        expires_at = datetime.now(UTC) + SESSION_TTL

        db.create_session(conn, row["id"], token_hash, ip, ua, expires_at)

    return {
        "status": "success",
        "data": {
            "token": raw_token,
            "expires_at": expires_at.isoformat(),
            "user": {
                "id": str(row["id"]),
                "role": row["role"],
                "branch_id": str(row["branch_id"]) if row["branch_id"] else None,
            },
        },
    }


def logout(authorization: str | None) -> dict:
    token = _extract_bearer(authorization)
    token_hash = hash_token(token)
    with db.connect() as conn:
        db.delete_session(conn, token_hash)
    return {"status": "success"}


# ===================================================================
# Health
# ===================================================================

def check_db() -> str:
    try:
        with db.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
        return "connected"
    except Exception:
        return "disconnected"


# ===================================================================
# Branches
# ===================================================================

def create_branch(actor: UUID, body: CreateBranchIn) -> dict:
    try:
        with db.connect() as conn:
            branch_id = db.create_branch(
                conn, actor,
                body.code, body.name_en, body.name_ur, body.city,
                body.address_en, body.address_ur,
            )
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": {"id": str(branch_id)}}


def list_branches(actor: UUID) -> dict:
    try:
        with db.connect() as conn:
            rows = db.list_branches(conn, actor)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": rows}


# ===================================================================
# Users
# ===================================================================

def create_user(actor: UUID, body: CreateUserIn) -> dict:
    try:
        with db.connect() as conn:
            user_id = db.create_user(
                conn, actor, body.branch_id,
                body.name, body.email, body.password_hash, body.role,
            )
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": {"id": str(user_id)}}


def set_user_active(actor: UUID, body: SetUserActiveIn) -> dict:
    try:
        with db.connect() as conn:
            db.set_user_active(conn, actor, body.user_id, body.is_active)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success"}


def list_users(actor: UUID) -> dict:
    try:
        with db.connect() as conn:
            rows = db.list_users(conn, actor)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": rows}


# ===================================================================
# Collections
# ===================================================================

def submit_collection(actor: UUID, body: SubmitCollectionIn) -> dict:
    try:
        with db.connect() as conn:
            cid = db.submit_collection(
                conn, actor,
                body.title_en, body.title_ur, body.amount, body.collection_date,
            )
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": {"id": str(cid)}}


def review_collection(actor: UUID, body: ReviewCollectionIn) -> dict:
    try:
        with db.connect() as conn:
            db.review_collection(
                conn, actor, body.collection_id, body.approve, body.notes,
            )
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success"}


def list_collections(actor: UUID, body: ListCollectionsIn) -> dict:
    try:
        with db.connect() as conn:
            rows = db.list_collections(conn, actor, body.status)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": rows}


# ===================================================================
# Weekly reports
# ===================================================================

def submit_weekly_report(actor: UUID, body: SubmitWeeklyReportIn) -> dict:
    try:
        with db.connect() as conn:
            rid = db.submit_weekly_report(
                conn, actor,
                body.week_start, body.week_end,
                body.summary_en, body.summary_ur,
                body.total_members_active, body.new_registrations,
            )
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": {"id": str(rid)}}


def list_weekly_reports(actor: UUID) -> dict:
    try:
        with db.connect() as conn:
            rows = db.list_weekly_reports(conn, actor)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": rows}


# ===================================================================
# Members
# ===================================================================

def add_member(actor: UUID, body: AddMemberIn) -> dict:
    try:
        with db.connect() as conn:
            mid = db.add_member(
                conn, actor, body.branch_id,
                body.name_en, body.name_ur, body.cnic, body.phone,
            )
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": {"id": str(mid)}}


def set_member_active(actor: UUID, body: SetMemberActiveIn) -> dict:
    try:
        with db.connect() as conn:
            db.set_member_active(conn, actor, body.member_id, body.is_active)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success"}


def list_members(actor: UUID) -> dict:
    try:
        with db.connect() as conn:
            rows = db.list_members(conn, actor)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": rows}


# ===================================================================
# Notices
# ===================================================================

def save_notice(actor: UUID, body: SaveNoticeIn) -> dict:
    try:
        with db.connect() as conn:
            nid = db.save_notice(
                conn, actor, body.notice_id,
                body.title_en, body.title_ur,
                body.content_en, body.content_ur, body.publish,
            )
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": {"id": str(nid)}}


def list_notices(actor: UUID) -> dict:
    try:
        with db.connect() as conn:
            rows = db.list_notices(conn, actor)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": rows}


def list_published_notices() -> dict:
    try:
        with db.connect() as conn:
            rows = db.list_published_notices(conn)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": rows}


# ===================================================================
# Inquiries
# ===================================================================

def submit_inquiry(body: SubmitInquiryIn) -> dict:
    try:
        with db.connect() as conn:
            db.submit_inquiry(conn, body.name, body.email,
                              body.subject, body.message)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success"}


def resolve_inquiry(actor: UUID, body: ResolveInquiryIn) -> dict:
    try:
        with db.connect() as conn:
            db.resolve_inquiry(conn, actor, body.inquiry_id)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success"}


def list_inquiries(actor: UUID) -> dict:
    try:
        with db.connect() as conn:
            rows = db.list_inquiries(conn, actor)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": rows}


# ===================================================================
# Audit
# ===================================================================

def list_audit_logs(actor: UUID, body: ListAuditLogsIn) -> dict:
    try:
        with db.connect() as conn:
            rows = db.list_audit_logs(conn, actor, body.limit)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success", "data": rows}


# ===================================================================
# Maintenance
# ===================================================================

def purge_expired_sessions() -> dict:
    try:
        with db.connect() as conn:
            db.purge_expired_sessions(conn)
    except psycopg.Error as e:
        raise _map_db_error(e)
    return {"status": "success"}


# ===================================================================
# Middleware
# ===================================================================

async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return response
