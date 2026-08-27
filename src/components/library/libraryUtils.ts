import type { ExportFilterSettings, ImageRecord } from "../../types";

export function collectExportSourcePaths(
  images: ImageRecord[],
  selectedIds: number[],
  exportFilters: ExportFilterSettings,
): string[] {
  const selectedSet = new Set(selectedIds);
  const baseImages = selectedSet.size > 0
    ? images.filter((image) => selectedSet.has(image.id))
    : images;

  return baseImages
    .filter((image) => matchesExportFilters(image, exportFilters))
    .map((image) => image.sourcePath?.trim() ?? "")
    .filter(Boolean);
}

export function shortenPath(value: string): string {
  if (!value || value === "Not configured" || value.length <= 42) {
    return value;
  }

  const normalized = value.split("\\").join("/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const prefix = normalized.startsWith("/") ? "/" : "";
    return `${prefix}.../${parts.slice(-2).join("/")}`;
  }

  return `${value.slice(0, 18)}...${value.slice(-18)}`;
}

function matchesExportFilters(image: ImageRecord, exportFilters: ExportFilterSettings): boolean {
  if (exportFilters.rating !== null && image.rating !== exportFilters.rating) {
    return false;
  }

  if (exportFilters.colorLabel && image.colorLabel !== exportFilters.colorLabel) {
    return false;
  }

  if (exportFilters.tags.length === 0) {
    return true;
  }

  return exportFilters.tags.every((tag) => imageMatchesTag(image, tag));
}

export function imageMatchesTag(image: ImageRecord, requestedTag: string): boolean {
  const normalized = requestedTag.trim().toLocaleLowerCase();
  if (!normalized) {
    return true;
  }

  const flatTags = image.tags.map((tag) => tag.toLocaleLowerCase());
  if (flatTags.includes(normalized)) {
    return true;
  }

  const hierarchicalTags = (image.hierarchicalTags ?? []).map((tag) => tag.toLocaleLowerCase());
  return hierarchicalTags.some((tag) => tag === normalized || tag.startsWith(`${normalized}|`));
}
