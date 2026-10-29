import os
import psycopg
from dotenv import load_dotenv

load_dotenv(override=True)

with psycopg.connect(
    host=os.environ["db_host"],
    port=int(os.environ["db_port"]),
    dbname=os.environ["db_name"],
    user=os.environ["db_user"],
    password=os.environ["db_password"],
    sslmode="require",
) as conn:
    with conn.cursor() as cur:
        cur.execute("select current_user, inet_server_addr(), version();")
        print(cur.fetchone())