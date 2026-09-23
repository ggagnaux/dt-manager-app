from __future__ import annotations

from pathlib import Path
from xml.etree import ElementTree as ET

from .models import MetadataEdit
from .tags import image_tags, normalize_tags

NS = {
    "x": "adobe:ns:meta/",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "dc": "http://purl.org/dc/elements/1.1/",
    "lr": "http://ns.adobe.com/lightroom/1.0/",
    "xmp": "http://ns.adobe.com/xap/1.0/",
    "acdsee": "http://ns.acdsee.com/iptc/1.0/",
    "darktable": "http://darktable.sf.net/",
}

for prefix, uri in NS.items():
    ET.register_namespace(prefix, uri)


def apply_edit_to_xmp(
    source_image_path: Path,
    xmp_path: Path | None,
    current_metadata: dict[str, object],
    edit: MetadataEdit,
) -> Path:
    resolved_xmp_path = xmp_path or source_image_path.with_suffix(f"{source_image_path.suffix}.xmp")
    root = _load_or_create_root(resolved_xmp_path)
    description = _ensure_description(root)

    current_tags = image_tags(current_metadata)
    requested_tags = normalize_tags(edit.tags)
    next_tags = _apply_tag_mode(current_tags, requested_tags, edit.mode)

    _set_alt_text(description, "title", edit.title.strip() or str(current_metadata.get("title", "")))
    _set_alt_text(
        description,
        "description",
        edit.description.strip() or str(current_metadata.get("description", "")),
    )
    _set_seq_text(description, "creator", str(current_metadata.get("creator", "")))
    _set_alt_text(description, "rights", str(current_metadata.get("rights", "")))
    _set_bag_values(description, "subject", next_tags, namespace="dc")
    _set_bag_values(description, "hierarchicalSubject", next_tags, namespace="lr")

    if edit.rating is not None:
        description.set(_qualified("xmp", "Rating"), str(edit.rating))

    if edit.color_label is not None:
        _set_color_labels(description, edit.color_label)

    current_notes = str(current_metadata.get("notes", "") or "")
    next_notes = current_notes
    description.set(_qualified("acdsee", "notes"), next_notes)

    resolved_xmp_path.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(root).write(resolved_xmp_path, encoding="UTF-8", xml_declaration=True)
    return resolved_xmp_path


def _load_or_create_root(xmp_path: Path) -> ET.Element:
    if xmp_path.exists():
        return ET.parse(xmp_path).getroot()

    root = ET.Element(_qualified("x", "xmpmeta"))
    rdf = ET.SubElement(root, _qualified("rdf", "RDF"))
    ET.SubElement(rdf, _qualified("rdf", "Description"), {_qualified("rdf", "about"): ""})
    return root


def _ensure_description(root: ET.Element) -> ET.Element:
    description = root.find(".//rdf:Description", NS)
    if description is not None:
        return description

    rdf = root.find(".//rdf:RDF", NS)
    if rdf is None:
        rdf = ET.SubElement(root, _qualified("rdf", "RDF"))
    return ET.SubElement(rdf, _qualified("rdf", "Description"), {_qualified("rdf", "about"): ""})


def _set_alt_text(description: ET.Element, local_name: str, value: str, namespace: str = "dc") -> None:
    tag = description.find(f"{namespace}:{local_name}", NS)
    if tag is None:
        tag = ET.SubElement(description, _qualified(namespace, local_name))
    alt = tag.find("rdf:Alt", NS)
    if alt is None:
        alt = ET.SubElement(tag, _qualified("rdf", "Alt"))
    li = alt.find("rdf:li", NS)
    if li is None:
        li = ET.SubElement(alt, _qualified("rdf", "li"), {"{http://www.w3.org/XML/1998/namespace}lang": "x-default"})
    li.text = value


def _set_seq_text(description: ET.Element, local_name: str, value: str, namespace: str = "dc") -> None:
    tag = description.find(f"{namespace}:{local_name}", NS)
    if tag is None:
        tag = ET.SubElement(description, _qualified(namespace, local_name))
    seq = tag.find("rdf:Seq", NS)
    if seq is None:
        seq = ET.SubElement(tag, _qualified("rdf", "Seq"))
    for child in list(seq):
        seq.remove(child)
    if value:
        li = ET.SubElement(seq, _qualified("rdf", "li"))
        li.text = value


def _set_bag_values(description: ET.Element, local_name: str, values: list[str], namespace: str) -> None:
    tag = description.find(f"{namespace}:{local_name}", NS)
    if tag is None:
        tag = ET.SubElement(description, _qualified(namespace, local_name))
    bag = tag.find("rdf:Bag", NS)
    if bag is None:
        bag = ET.SubElement(tag, _qualified("rdf", "Bag"))
    for child in list(bag):
        bag.remove(child)
    for value in values:
        li = ET.SubElement(bag, _qualified("rdf", "li"))
        li.text = value


def _set_color_labels(description: ET.Element, color_label: str) -> None:
    tag = description.find("darktable:colorlabels", NS)
    if tag is None:
        tag = ET.SubElement(description, _qualified("darktable", "colorlabels"))
    seq = tag.find("rdf:Seq", NS)
    if seq is None:
        seq = ET.SubElement(tag, _qualified("rdf", "Seq"))
    for child in list(seq):
        seq.remove(child)
    if color_label:
        li = ET.SubElement(seq, _qualified("rdf", "li"))
        li.text = str(_color_label_to_value(color_label))


def _qualified(prefix: str, local_name: str) -> str:
    return f"{{{NS[prefix]}}}{local_name}"


def _apply_tag_mode(current_tags: list[str], requested_tags: list[str], mode: str) -> list[str]:
    if not requested_tags and mode != "replace":
        return list(current_tags)
    if mode == "replace":
        return list(requested_tags)
    if mode == "remove":
        requested_lookup = {tag.casefold() for tag in requested_tags}
        return [tag for tag in current_tags if tag.casefold() not in requested_lookup]

    merged = {tag.casefold(): tag for tag in current_tags}
    for tag in requested_tags:
        merged[tag.casefold()] = tag
    return sorted(merged.values(), key=str.casefold)


def _color_label_to_value(label: str) -> int:
    values = {
        "red": 0,
        "yellow": 1,
        "green": 2,
        "blue": 3,
        "purple": 4,
    }
    return values[label.casefold()]
