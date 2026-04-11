from __future__ import annotations

from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "dc": "http://purl.org/dc/elements/1.1/",
    "lr": "http://ns.adobe.com/lightroom/1.0/",
    "xmpRights": "http://ns.adobe.com/xap/1.0/rights/",
    "photoshop": "http://ns.adobe.com/photoshop/1.0/",
    "xmp": "http://ns.adobe.com/xap/1.0/",
    "acdsee": "http://ns.acdsee.com/iptc/1.0/",
    "darktable": "http://darktable.sf.net/",
    "exif": "http://ns.adobe.com/exif/1.0/",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
}


def _first_text(root: ET.Element, xpath: str) -> str:
    node = root.find(xpath, NS)
    if node is None or node.text is None:
        return ""
    return node.text


def _bag_values(root: ET.Element, xpath: str) -> list[str]:
    return [node.text or "" for node in root.findall(xpath, NS) if node.text]


def _attribute_values(root: ET.Element, xpath: str, attribute_name: str) -> list[str]:
    values: list[str] = []
    for node in root.findall(xpath, NS):
        value = node.attrib.get(attribute_name)
        if value:
            values.append(value)
    return values


def _darktable_color_labels(root: ET.Element) -> list[int]:
    labels: list[int] = []
    for value in _bag_values(root, ".//darktable:colorlabels/rdf:Seq/rdf:li"):
        try:
            labels.append(int(value))
        except ValueError:
            continue
    return labels


def inspect_xmp_fields(path: Path) -> dict[str, object]:
    root = ET.parse(path).getroot()
    description_node = root.find(".//rdf:Description", NS)
    creator_candidates = _bag_values(root, ".//dc:creator/rdf:Seq/rdf:li")
    rights_candidates = [
        _first_text(root, ".//dc:rights/rdf:Alt/rdf:li"),
        _first_text(root, ".//xmpRights:UsageTerms/rdf:Alt/rdf:li"),
        _first_text(root, ".//xmpRights:WebStatement"),
    ]
    note_candidates = [
        description_node.attrib.get("{http://ns.acdsee.com/iptc/1.0/}notes", "")
        if description_node is not None
        else "",
        _first_text(root, ".//xmp:Label"),
        _first_text(root, ".//photoshop:Instructions"),
        _first_text(root, ".//photoshop:Headline"),
    ]

    return {
        "path": str(path),
        "title": _first_text(root, ".//dc:title/rdf:Alt/rdf:li"),
        "description": _first_text(root, ".//dc:description/rdf:Alt/rdf:li"),
        "creator": creator_candidates[0] if creator_candidates else "",
        "rights": next((value for value in rights_candidates if value), ""),
        "notes": next((value for value in note_candidates if value), ""),
        "flatSubjects": _bag_values(root, ".//dc:subject/rdf:Bag/rdf:li"),
        "hierarchicalSubjects": _bag_values(root, ".//lr:hierarchicalSubject/rdf:Bag/rdf:li"),
        "creatorCandidates": creator_candidates,
        "rightsCandidates": rights_candidates,
        "notesCandidates": note_candidates,
        "rating": description_node.attrib.get("{http://ns.adobe.com/xap/1.0/}Rating", "")
        if description_node is not None
        else "",
        "colorLabels": _darktable_color_labels(root),
        "captureDate": description_node.attrib.get("{http://ns.adobe.com/exif/1.0/}DateTimeOriginal", "")
        if description_node is not None
        else "",
        "darktableAttributes": {
            "importTimestamp": description_node.attrib.get("{http://darktable.sf.net/}import_timestamp", "")
            if description_node is not None
            else "",
            "changeTimestamp": description_node.attrib.get("{http://darktable.sf.net/}change_timestamp", "")
            if description_node is not None
            else "",
            "exportTimestamp": description_node.attrib.get("{http://darktable.sf.net/}export_timestamp", "")
            if description_node is not None
            else "",
        },
        "historyOperations": _attribute_values(
            root,
            ".//darktable:history/rdf:Seq/rdf:li",
            "{http://darktable.sf.net/}operation",
        ),
    }
