"""One-time migration: copy every /uploads/... image into Vercel Blob and
rewrite the URLs stored in the database.

Run it AFTER the data has been restored into the new database:

    cd backend
    DATABASE_URL="<new Neon URL>" \
    BLOB_READ_WRITE_TOKEN="<token from Vercel Blob>" \
    OLD_API_URL="https://<your-old-app>.up.railway.app" \
    .venv/bin/python scripts/migrate_uploads_to_blob.py

For each image it first looks in the local backend/uploads folder and, if the
file isn't there, downloads it from OLD_API_URL (the Railway backend, which
must still be running). Pass --dry-run to only print what would change.
"""

import mimetypes
import os
import sys
from pathlib import Path

import requests
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import engine  # noqa: E402
from app.services.storage import UPLOADS_ROOT, save_file  # noqa: E402

COLUMNS = [
    ("categories", "image_url"),
    ("product_images", "image_url"),
    ("brands", "logo_url"),
    ("order_items", "image_url"),
    ("site_settings", "navbar_logo_url"),
    ("site_settings", "hero_image_url"),
    ("site_settings", "footer_logo_url"),
    ("site_settings", "favicon_url"),
]

DRY_RUN = "--dry-run" in sys.argv
OLD_API_URL = os.getenv("OLD_API_URL", "").rstrip("/")


def load_bytes(folder: str, name: str, original_url: str) -> bytes:
    local = UPLOADS_ROOT / folder / name
    if local.is_file():
        return local.read_bytes()

    candidates = []
    if original_url.startswith(("http://", "https://")):
        candidates.append(original_url)
    if OLD_API_URL:
        candidates.append(f"{OLD_API_URL}/uploads/{folder}/{name}")

    for url in candidates:
        response = requests.get(url, timeout=30)
        if response.ok and response.content:
            return response.content

    raise FileNotFoundError(f"{folder}/{name} not found locally or at {candidates}")


def main() -> None:
    if not DRY_RUN and not os.getenv("BLOB_READ_WRITE_TOKEN"):
        sys.exit("BLOB_READ_WRITE_TOKEN is not set.")

    migrated: dict[str, str] = {}
    failures = 0

    with engine.begin() as conn:
        for table, column in COLUMNS:
            rows = conn.execute(
                text(
                    f"SELECT DISTINCT {column} FROM {table} "
                    f"WHERE {column} LIKE '%/uploads/%'"
                )
            ).scalars().all()

            for old_url in rows:
                if old_url not in migrated:
                    path = old_url.split("/uploads/", 1)[1].split("?", 1)[0]
                    folder, _, name = path.partition("/")
                    if not name or "/" in name:
                        print(f"  skip (unexpected path): {old_url}")
                        continue

                    if DRY_RUN:
                        migrated[old_url] = f"<blob>/{folder}/{name}"
                    else:
                        try:
                            data = load_bytes(folder, name, old_url)
                        except Exception as exc:
                            failures += 1
                            print(f"  FAILED {old_url}: {exc}")
                            continue
                        content_type = (
                            mimetypes.guess_type(name)[0]
                            or "application/octet-stream"
                        )
                        migrated[old_url] = save_file(
                            folder, name, data, content_type, local_url=old_url
                        )

                new_url = migrated[old_url]
                print(f"  {table}.{column}: {old_url} -> {new_url}")

                if not DRY_RUN:
                    conn.execute(
                        text(
                            f"UPDATE {table} SET {column} = :new "
                            f"WHERE {column} = :old"
                        ),
                        {"new": new_url, "old": old_url},
                    )

    print(
        f"\nDone. {len(migrated)} file(s) "
        f"{'would be ' if DRY_RUN else ''}migrated, {failures} failure(s)."
    )


if __name__ == "__main__":
    main()
