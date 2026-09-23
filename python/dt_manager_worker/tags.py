"""Complete tag values shared by image loading, write previews, and XMP writes."""


def normalize_tags(values: list[str]) -> list[str]:
    tags = {}
    for value in values:
        tag = value.strip()
        if tag:
            tags.setdefault(tag.casefold(), tag)
    return sorted(tags.values(), key=str.casefold)


def image_tags(metadata: dict[str, object]) -> list[str]:
    return normalize_tags([
        str(tag)
        for field in ("hierarchicalTags", "tags")
        for tag in (metadata.get(field) or [])
    ])


def resolve_xmp_tags(flat: list[str], hierarchical: list[str], assigned: list[str]) -> list[str]:
    # Legacy dc:subject can contain projections of a hierarchy. A matching
    # explicit hierarchy/DB assignment proves that a standalone tag is real.
    explicit = {tag.casefold() for tag in normalize_tags(hierarchical + assigned)}
    components = {part.strip().casefold() for tag in hierarchical if "|" in tag
                  for part in tag.split("|")}
    standalone = [tag for tag in flat
                  if tag.strip().casefold() not in components or tag.strip().casefold() in explicit]
    return normalize_tags(hierarchical + standalone)
