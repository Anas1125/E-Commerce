"""Decode untrusted raster uploads and store only freshly encoded pixels."""
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_DIMENSION = 8192
MAX_PIXELS = 20_000_000
MAX_OUTPUT_DIMENSION = 2400

FORMATS = {
    ".jpg": ("JPEG", ("image/jpeg",)),
    ".jpeg": ("JPEG", ("image/jpeg",)),
    ".png": ("PNG", ("image/png",)),
    ".webp": ("WEBP", ("image/webp",)),
}
GIF = ("GIF", ("image/gif",))
ICO = ("ICO", ("image/x-icon", "image/vnd.microsoft.icon"))


def read_safe_image(file: UploadFile, *, allow_gif=False, allow_ico=False) -> bytes:
    """Read a bounded upload; caller owns and closes the upload stream."""
    formats = dict(FORMATS)
    if allow_gif:
        formats[".gif"] = GIF
    if allow_ico:
        formats[".ico"] = ICO

    extension = Path(file.filename or "").suffix.lower()
    if extension not in formats:
        raise HTTPException(400, "Unsupported image extension")
    expected, mime_types = formats[extension]
    if file.content_type not in (*mime_types, "application/octet-stream"):
        raise HTTPException(400, "Image file type does not match its extension")

    data = file.file.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(400, "The selected image is empty")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Images must be 10 MB or smaller")

    try:
        # Limit the decoder to the declared raster format. Check dimensions
        # before allocating the full pixel buffer wherever the decoder permits.
        with Image.open(BytesIO(data), formats=[expected]) as probe:
            _check_image(probe)
            probe.verify()
        # verify() invalidates the image object; reopen and fully decode.
        with Image.open(BytesIO(data), formats=[expected]) as source:
            _check_image(source)
            source.load()
            oriented = ImageOps.exif_transpose(source)
            rgba = oriented.convert("RGBA" if (
                "A" in oriented.getbands() or "transparency" in oriented.info
            ) else "RGB")
            rgba.thumbnail((MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION), Image.Resampling.LANCZOS)
            # New image has no EXIF, GPS, XMP, ICC or other source metadata.
            clean = Image.new(rgba.mode, rgba.size)
            clean.paste(rgba)
            output = BytesIO()
            clean.save(output, format="WEBP", quality=85, method=4)
            result = output.getvalue()
    except Image.DecompressionBombError as exc:
        raise HTTPException(413, "Image dimensions are too large") from exc
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, EOFError, OverflowError, IndexError) as exc:
        raise HTTPException(400, "The selected file is not a valid supported image") from exc

    if len(result) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Processed image is too large")
    return result


def _check_image(image: Image.Image) -> None:
    width, height = image.size
    if (width <= 0 or height <= 0 or max(width, height) > MAX_DIMENSION
            or width * height > MAX_PIXELS):
        raise HTTPException(413, "Image dimensions are too large")
    if getattr(image, "is_animated", False):
        raise HTTPException(400, "Animated images are not supported; upload a static image")
