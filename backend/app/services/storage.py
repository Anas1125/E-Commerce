"""File storage for uploaded images.

- When BLOB_READ_WRITE_TOKEN is set (Vercel Blob, free on the Hobby plan),
  files are uploaded to Vercel Blob and the public blob URL is returned.
- Otherwise files are written to the local ``uploads/`` folder (local dev).

Vercel's serverless filesystem is read-only, so production must use Blob.
"""

import logging
import os
from pathlib import Path
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"
BLOB_API_URL = "https://blob.vercel-storage.com"
BLOB_API_VERSION = "7"
BLOB_HOST_SUFFIX = ".blob.vercel-storage.com"


def _blob_token() -> str | None:
    return os.getenv("BLOB_READ_WRITE_TOKEN") or None


def using_blob_storage() -> bool:
    return _blob_token() is not None


def save_file(
    folder: str,
    filename: str,
    data: bytes,
    content_type: str,
    local_url: str,
) -> str:
    """Store ``data`` and return the URL to save in the database.

    ``local_url`` is returned when running without Blob storage.
    """
    token = _blob_token()

    if token:
        response = requests.put(
            f"{BLOB_API_URL}/{folder}/{filename}",
            data=data,
            headers={
                "authorization": f"Bearer {token}",
                "x-api-version": BLOB_API_VERSION,
                "x-content-type": content_type,
                "x-add-random-suffix": "0",
                "x-cache-control-max-age": "31536000",
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["url"]

    directory = UPLOADS_ROOT / folder
    directory.mkdir(parents=True, exist_ok=True)
    (directory / filename).write_bytes(data)
    return local_url


def delete_file(url: str | None, folder: str) -> None:
    """Best-effort delete of a previously uploaded file. Never raises."""
    if not url:
        return

    try:
        host = urlparse(url).netloc

        if host.endswith(BLOB_HOST_SUFFIX):
            token = _blob_token()
            if token:
                requests.post(
                    f"{BLOB_API_URL}/delete",
                    json={"urls": [url]},
                    headers={
                        "authorization": f"Bearer {token}",
                        "x-api-version": BLOB_API_VERSION,
                    },
                    timeout=15,
                ).raise_for_status()
            return

        marker = f"/uploads/{folder}/"
        if marker not in url:
            return

        name = url.split(marker, 1)[1].split("?", 1)[0]
        if not name or Path(name).name != name:
            return

        directory = (UPLOADS_ROOT / folder).resolve()
        path = (directory / name).resolve()
        if path.parent == directory:
            path.unlink(missing_ok=True)
    except Exception:
        logger.exception("Could not delete uploaded file %s", url)
