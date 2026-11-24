from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image
from starlette.datastructures import Headers

from app.services import image_upload


def upload(data, filename="test.png", mime="image/png"):
    return UploadFile(BytesIO(data), filename=filename,
                      headers=Headers({"content-type": mime}))


def raster(fmt="PNG", size=(32, 32), mode="RGBA", **kwargs):
    out = BytesIO()
    Image.new(mode, size, (10, 20, 30, 0) if mode == "RGBA" else (10, 20, 30)).save(
        out, format=fmt, **kwargs)
    return out.getvalue()


@pytest.mark.parametrize("fmt,ext,mime,flags", [
    ("JPEG", "jpg", "image/jpeg", {}),
    ("PNG", "png", "image/png", {}),
    ("WEBP", "webp", "image/webp", {}),
    ("GIF", "gif", "image/gif", {"allow_gif": True}),
    ("ICO", "ico", "image/x-icon", {"allow_ico": True}),
])
def test_valid_image_reencoded(fmt, ext, mime, flags):
    data = raster(fmt, mode="RGB")
    result = image_upload.read_safe_image(upload(data, "test." + ext, mime), **flags)
    with Image.open(BytesIO(result)) as image:
        assert image.format == "WEBP"
        assert image.size == (32, 32)
        image.load()


def test_alpha_and_metadata_and_trailing_bytes():
    exif = Image.Exif()
    exif[270] = "private metadata"
    data = raster(exif=exif) + b"UNTRUSTED_TRAILING_PAYLOAD"
    result = image_upload.read_safe_image(upload(data))
    with Image.open(BytesIO(result)) as image:
        assert image.getpixel((0, 0))[-1] == 0
        assert not image.getexif()
        assert "exif" not in image.info
    assert b"UNTRUSTED_TRAILING_PAYLOAD" not in result
    assert b"private metadata" not in result


@pytest.mark.parametrize("data,filename,mime", [
    (b"<html>fake</html>", "test.png", "image/png"),
    (b"\x89PNG\r\n\x1a\n", "test.png", "image/png"),
    (raster("JPEG", mode="RGB"), "test.png", "image/png"),
    (raster(), "test.png", "text/html"),
    (raster(), "test.svg", "image/svg+xml"),
    (b"", "test.png", "image/png"),
])
def test_invalid_upload_rejected(data, filename, mime):
    with pytest.raises(HTTPException) as exc:
        image_upload.read_safe_image(upload(data, filename, mime))
    assert exc.value.status_code == 400


def test_byte_limit(monkeypatch):
    monkeypatch.setattr(image_upload, "MAX_IMAGE_BYTES", 16)
    with pytest.raises(HTTPException) as exc:
        image_upload.read_safe_image(upload(raster()))
    assert exc.value.status_code == 413


def test_pixel_limit(monkeypatch):
    monkeypatch.setattr(image_upload, "MAX_PIXELS", 100)
    with pytest.raises(HTTPException) as exc:
        image_upload.read_safe_image(upload(raster()))
    assert exc.value.status_code == 413


def test_resize(monkeypatch):
    monkeypatch.setattr(image_upload, "MAX_OUTPUT_DIMENSION", 16)
    result = image_upload.read_safe_image(upload(raster(size=(64, 32))))
    with Image.open(BytesIO(result)) as image:
        assert image.size == (16, 8)


def test_animated_gif_rejected():
    out = BytesIO()
    Image.new("RGB", (16, 16), "red").save(
        out, format="GIF", save_all=True,
        append_images=[Image.new("RGB", (16, 16), "blue")], duration=100, loop=0)
    with pytest.raises(HTTPException) as exc:
        image_upload.read_safe_image(upload(out.getvalue(), "test.gif", "image/gif"), allow_gif=True)
    assert exc.value.status_code == 400
