from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class MetadataEdit:
    mode: str
    tags: list[str] = field(default_factory=list)
    title: str = ""
    description: str = ""
    rating: int | None = None
    color_label: str | None = None


@dataclass(slots=True)
class ImageSearchFilters:
    text: str = ""
    tags: list[str] = field(default_factory=list)
    rating: int | None = None
    color_label: str | None = None
    folder: str = ""
    date_from: str = ""
    date_to: str = ""

