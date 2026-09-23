import { useMemo } from "react";
import type { ReactNode } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ImageRecord } from "../../types";

export function DetailRow({
  label,
  value,
  scope,
  valueNode,
}: {
  label: string;
  value: string;
  scope?: "db+xmp" | "xmp";
  valueNode?: ReactNode;
}) {
  return (
    <div className="detail-row">
      <span>
        {label}
        {scope ? (
          <em className={`detail-scope detail-scope-${scope === "db+xmp" ? "full" : "xmp"}`}>
            {scope === "db+xmp" ? "XMP + DB" : "XMP only"}
          </em>
        ) : null}
      </span>
      <strong>{valueNode ?? (value || " ")}</strong>
    </div>
  );
}

export function ColorLabelValue({ value }: { value: string }) {
  if (!value) {
    return <>None</>;
  }

  return (
    <span className="color-label-value">
      <span className={`color-label-dot color-${value}`} aria-hidden="true" />
      <span>{value}</span>
    </span>
  );
}

export function RatingStars({ rating }: { rating: number }) {
  const clampedRating = Math.max(0, Math.min(5, Math.floor(rating)));

  if (clampedRating === 0) {
    return <span className="rating-stars rating-stars-empty">Unrated</span>;
  }

  return (
    <span className="rating-stars" aria-label={`${clampedRating} out of 5 stars`}>
      <span aria-hidden="true">{"★".repeat(clampedRating)}</span>
      <span className="sr-only">{clampedRating} out of 5 stars</span>
    </span>
  );
}

export function PreviewThumb({ image }: { image: ImageRecord }) {
  const fileSrc = useMemo(
    () => image.sourcePath ? convertFileSrc(image.sourcePath) : "",
    [image.sourcePath],
  );
  const previewable = image.sourcePath
    && /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(image.sourcePath);

  if (previewable && image.sourcePath) {
    return (
      <img
        className="thumb-image"
        src={fileSrc}
        alt={image.filename}
        loading="lazy"
        decoding="async"
      />
    );
  }

  const extension = image.filename.includes(".")
    ? image.filename.split(".").pop()?.toUpperCase() ?? "IMG"
    : "IMG";
  const title = image.title?.trim() || image.filename;

  return (
    <div className="raw-preview-card">
      <div className="raw-preview-top">
        <span className="raw-preview-ext">{extension}</span>
        {image.colorLabel ? (
          <span className={`raw-preview-color color-${image.colorLabel}`} aria-hidden="true" />
        ) : null}
      </div>
      <div className="raw-preview-body">
        <strong>{title}</strong>
        <span>{image.filename}</span>
      </div>
      <div className="raw-preview-footer">
        <span>{renderStars(image.rating)}</span>
        <span>{image.xmpPath ? "XMP linked" : "No XMP"}</span>
      </div>
    </div>
  );
}

function renderStars(rating: number) {
  if (!rating) {
    return "Unrated";
  }
  return "â˜…".repeat(Math.max(0, Math.min(5, rating)));
}
