from typing import Optional
from uuid import UUID

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi import Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
import api

app = FastAPI(
    title="ShipLens Platform API",
    description="Branch-to-Head-Office Management Platform Backend",
    version="0.1.0",
)

app.middleware("http")(api.security_headers_middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=api.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
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
        content={"status": "healthy", "database": api.check_db()},
    )

# -------------------------------------------------------------------
# Auth
# -------------------------------------------------------------------

@app.post("/auth/login")
def login(body: api.LoginIn, request: Request):
    return api.login(body, request)


@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None, alias="Authorization")):
    return api.logout(authorization)


# -------------------------------------------------------------------
# Branches
# -------------------------------------------------------------------

@app.post("/branches", status_code=201)
def create_branch(body: api.CreateBranchIn, actor: UUID = Depends(api.require_actor)):
    return api.create_branch(actor, body)


@app.post("/branches/list")
def list_branches(actor: UUID = Depends(api.require_actor)):
    return api.list_branches(actor)


# -------------------------------------------------------------------
# Users
# -------------------------------------------------------------------

@app.post("/users", status_code=201)
def create_user(body: api.CreateUserIn, actor: UUID = Depends(api.require_actor)):
    return api.create_user(actor, body)


@app.post("/users/active")
def set_user_active(body: api.SetUserActiveIn, actor: UUID = Depends(api.require_actor)):
    return api.set_user_active(actor, body)


@app.post("/users/list")
def list_users(actor: UUID = Depends(api.require_actor)):
    return api.list_users(actor)


# -------------------------------------------------------------------
# Collections
# -------------------------------------------------------------------

@app.post("/collections", status_code=201)
def submit_collection(body: api.SubmitCollectionIn, actor: UUID = Depends(api.require_actor)):
    return api.submit_collection(actor, body)


@app.post("/collections/review")
def review_collection(body: api.ReviewCollectionIn, actor: UUID = Depends(api.require_actor)):
    return api.review_collection(actor, body)


@app.post("/collections/list")
def list_collections(body: api.ListCollectionsIn, actor: UUID = Depends(api.require_actor)):
    return api.list_collections(actor, body)


# -------------------------------------------------------------------
# Weekly reports
# -------------------------------------------------------------------

@app.post("/reports", status_code=201)
def submit_weekly_report(body: api.SubmitWeeklyReportIn, actor: UUID = Depends(api.require_actor)):
    return api.submit_weekly_report(actor, body)


@app.post("/reports/list")
def list_weekly_reports(actor: UUID = Depends(api.require_actor)):
    return api.list_weekly_reports(actor)


# -------------------------------------------------------------------
# Members
# -------------------------------------------------------------------

@app.post("/members", status_code=201)
def add_member(body: api.AddMemberIn, actor: UUID = Depends(api.require_actor)):
    return api.add_member(actor, body)


@app.post("/members/active")
def set_member_active(body: api.SetMemberActiveIn, actor: UUID = Depends(api.require_actor)):
    return api.set_member_active(actor, body)


@app.post("/members/list")
def list_members(actor: UUID = Depends(api.require_actor)):
    return api.list_members(actor)


# -------------------------------------------------------------------
# Notices
# -------------------------------------------------------------------

@app.post("/notices")
def save_notice(body: api.SaveNoticeIn, actor: UUID = Depends(api.require_actor)):
    return api.save_notice(actor, body)


@app.post("/notices/list")
def list_notices(actor: UUID = Depends(api.require_actor)):
    return api.list_notices(actor)


@app.post("/notices/published")
def list_published_notices():
    return api.list_published_notices()


# -------------------------------------------------------------------
# Inquiries
# -------------------------------------------------------------------

@app.post("/inquiries", status_code=201)
def submit_inquiry(body: api.SubmitInquiryIn):
    return api.submit_inquiry(body)


@app.post("/inquiries/resolve")
def resolve_inquiry(body: api.ResolveInquiryIn, actor: UUID = Depends(api.require_actor)):
    return api.resolve_inquiry(actor, body)


@app.post("/inquiries/list")
def list_inquiries(actor: UUID = Depends(api.require_actor)):
    return api.list_inquiries(actor)


# -------------------------------------------------------------------
# Audit
# -------------------------------------------------------------------

@app.post("/audit/list")
def list_audit_logs(body: api.ListAuditLogsIn, actor: UUID = Depends(api.require_actor)):
    return api.list_audit_logs(actor, body)


# -------------------------------------------------------------------
# Maintenance
# -------------------------------------------------------------------

@app.post("/maintenance/purge-sessions")
def purge_expired_sessions():
    return api.purge_expired_sessions()