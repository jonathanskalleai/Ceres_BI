"""Read application secrets from direct env vars or Docker ``_FILE`` mounts."""

from __future__ import annotations

import os
from pathlib import Path


def read_secret(name: str) -> str:
    direct = os.getenv(name, "").strip()
    file_path = os.getenv(f"{name}_FILE", "").strip()
    if direct and file_path:
        raise RuntimeError(f"configure somente {name} ou {name}_FILE")
    if file_path:
        try:
            value = Path(file_path).read_text(encoding="utf-8").strip()
        except OSError as exc:
            raise RuntimeError(f"não foi possível ler {name}_FILE") from exc
        if not value:
            raise RuntimeError(f"{name}_FILE está vazio")
        return value
    return direct
