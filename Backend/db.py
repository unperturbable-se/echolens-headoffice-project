import os
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv(override=True)


def connect() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ["db_host"],
        port=int(os.environ["db_port"]),
        dbname=os.environ["db_name"],
        user=os.environ["db_user"],
        password=os.environ["db_password"],
        sslmode=os.getenv("DB_SSLMODE", "require"),
        row_factory=dict_row,
    )


# ---------------- auth / session ----------------

def get_login(conn, p_email: str):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM api.get_login(%s::public.citext)", (p_email,))
        return cur.fetchone()


def create_session(conn, p_user: UUID, p_hash: str, p_ip: str | None,
                   p_ua: str | None, p_exp: datetime) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.create_session(%s::uuid, %s::char(64), %s::inet, %s, %s::timestamptz)",
            (p_user, p_hash, p_ip, p_ua, p_exp),
        )


def validate_session(conn, p_hash: str):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM api.validate_session(%s::char(64))", (p_hash,))
        return cur.fetchone()


def delete_session(conn, p_hash: str) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT api.delete_session(%s::char(64))", (p_hash,))


# ---------------- branches / users ----------------

def create_branch(conn, p_actor: UUID, p_code: str, p_name_en: str, p_name_ur: str,
                  p_city: str, p_addr_en: str, p_addr_ur: str) -> UUID:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.create_branch(%s::uuid, %s, %s, %s, %s, %s, %s)",
            (p_actor, p_code, p_name_en, p_name_ur, p_city, p_addr_en, p_addr_ur),
        )
        return cur.fetchone()["create_branch"]


def create_user(conn, p_actor: UUID, p_branch: UUID | None, p_name: str,
                p_email: str, p_hash: str, p_role: str) -> UUID:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.create_user(%s::uuid, %s::uuid, %s, %s::public.citext, %s, %s::public.user_role)",
            (p_actor, p_branch, p_name, p_email, p_hash, p_role),
        )
        return cur.fetchone()["create_user"]


def set_user_active(conn, p_actor: UUID, p_id: UUID, p_active: bool) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.set_user_active(%s::uuid, %s::uuid, %s)",
            (p_actor, p_id, p_active),
        )


# ---------------- collections / reports / members ----------------

def submit_collection(conn, p_actor: UUID, p_title_en: str, p_title_ur: str,
                      p_amount: Decimal, p_date: date) -> UUID:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.submit_collection(%s::uuid, %s, %s, %s::numeric, %s::date)",
            (p_actor, p_title_en, p_title_ur, p_amount, p_date),
        )
        return cur.fetchone()["submit_collection"]


def review_collection(conn, p_actor: UUID, p_id: UUID, p_approve: bool,
                      p_notes: str | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.review_collection(%s::uuid, %s::uuid, %s, %s)",
            (p_actor, p_id, p_approve, p_notes),
        )


def submit_weekly_report(conn, p_actor: UUID, p_start: date, p_end: date,
                         p_en: str, p_ur: str, p_active: int, p_new: int) -> UUID:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.submit_weekly_report(%s::uuid, %s::date, %s::date, %s, %s, %s::int, %s::int)",
            (p_actor, p_start, p_end, p_en, p_ur, p_active, p_new),
        )
        return cur.fetchone()["submit_weekly_report"]


def add_member(conn, p_actor: UUID, p_branch: UUID | None, p_name_en: str,
               p_name_ur: str, p_cnic: str, p_phone: str) -> UUID:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.add_member(%s::uuid, %s::uuid, %s, %s, %s, %s)",
            (p_actor, p_branch, p_name_en, p_name_ur, p_cnic, p_phone),
        )
        return cur.fetchone()["add_member"]


def set_member_active(conn, p_actor: UUID, p_id: UUID, p_active: bool) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.set_member_active(%s::uuid, %s::uuid, %s)",
            (p_actor, p_id, p_active),
        )


# ---------------- notices / inquiries ----------------

def save_notice(conn, p_actor: UUID, p_id: UUID | None, p_title_en: str,
                p_title_ur: str, p_content_en: str, p_content_ur: str,
                p_publish: bool) -> UUID:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.save_notice(%s::uuid, %s::uuid, %s, %s, %s, %s, %s)",
            (p_actor, p_id, p_title_en, p_title_ur, p_content_en, p_content_ur, p_publish),
        )
        return cur.fetchone()["save_notice"]


def submit_inquiry(conn, p_name: str, p_email: str, p_subject: str, p_message: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.submit_inquiry(%s, %s::public.citext, %s, %s)",
            (p_name, p_email, p_subject, p_message),
        )


def resolve_inquiry(conn, p_actor: UUID, p_id: UUID) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.resolve_inquiry(%s::uuid, %s::uuid)",
            (p_actor, p_id),
        )


# ---------------- list / read ----------------

def list_branches(conn, p_actor: UUID) -> list:
    with conn.cursor() as cur:
        cur.execute("SELECT api.list_branches(%s::uuid) AS data", (p_actor,))
        return cur.fetchone()["data"] or []


def list_users(conn, p_actor: UUID) -> list:
    with conn.cursor() as cur:
        cur.execute("SELECT api.list_users(%s::uuid) AS data", (p_actor,))
        return cur.fetchone()["data"] or []


def list_collections(conn, p_actor: UUID, p_status: str | None = None) -> list:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.list_collections(%s::uuid, %s::public.approval_status) AS data",
            (p_actor, p_status),
        )
        return cur.fetchone()["data"] or []


def list_weekly_reports(conn, p_actor: UUID) -> list:
    with conn.cursor() as cur:
        cur.execute("SELECT api.list_weekly_reports(%s::uuid) AS data", (p_actor,))
        return cur.fetchone()["data"] or []


def list_members(conn, p_actor: UUID) -> list:
    with conn.cursor() as cur:
        cur.execute("SELECT api.list_members(%s::uuid) AS data", (p_actor,))
        return cur.fetchone()["data"] or []


def list_notices(conn, p_actor: UUID) -> list:
    with conn.cursor() as cur:
        cur.execute("SELECT api.list_notices(%s::uuid) AS data", (p_actor,))
        return cur.fetchone()["data"] or []


def list_inquiries(conn, p_actor: UUID) -> list:
    with conn.cursor() as cur:
        cur.execute("SELECT api.list_inquiries(%s::uuid) AS data", (p_actor,))
        return cur.fetchone()["data"] or []


def list_audit_logs(conn, p_actor: UUID, p_limit: int = 100) -> list:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT api.list_audit_logs(%s::uuid, %s::int) AS data",
            (p_actor, p_limit),
        )
        return cur.fetchone()["data"] or []


def list_published_notices(conn) -> list:
    with conn.cursor() as cur:
        cur.execute("SELECT api.list_published_notices() AS data")
        return cur.fetchone()["data"] or []


# ---------------- maintenance ----------------

def purge_expired_sessions(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT private.purge_expired_sessions()")