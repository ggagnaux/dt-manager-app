import { useState } from "react";
import {
  listTags,
  searchImages,
} from "../api";
import type {
  ImageRecord,
  SearchFilters,
} from "../types";

const initialSearchFilters: SearchFilters = {
  text: "",
  folder: "",
  dateFrom: "",
  dateTo: "",
  rating: null,
  colorLabel: "",
  tags: [],
  limit: 120,
};

export function useLibrarySearchState({
  initialImages,
  onImagesLoaded,
  onResetSelection,
}: {
  initialImages: ImageRecord[];
  onImagesLoaded: (images: ImageRecord[]) => void;
  onResetSelection: () => void;
}) {
  const [images, setImages] = useState<ImageRecord[]>(initialImages);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(initialSearchFilters);

  async function refreshLibraryData(libraryDbPath: string, dataDbPath: string) {
    const [tagResponse, imageResponse] = await Promise.all([
      listTags(libraryDbPath, dataDbPath),
      searchImages(libraryDbPath, dataDbPath, filters),
    ]);

    if (tagResponse.ok && tagResponse.data) {
      setAvailableTags(tagResponse.data);
    }

    if (imageResponse.ok && imageResponse.data) {
      setImages(imageResponse.data);
      onImagesLoaded(imageResponse.data);
    }
  }

  async function handleRefreshResults(connection: { libraryDbPath: string; dataDbPath: string }) {
    if (!connection.libraryDbPath) {
      return;
    }
    await refreshLibraryData(connection.libraryDbPath, connection.dataDbPath);
  }

  function handleResetFilters() {
    setFilters(initialSearchFilters);
    setImages([]);
    onResetSelection();
  }

  function resetSearchState() {
    setImages([]);
    setAvailableTags([]);
    setFilters(initialSearchFilters);
    onResetSelection();
  }

  return {
    images,
    setImages,
    availableTags,
    filters,
    setFilters,
    refreshLibraryData,
    handleRefreshResults,
    handleResetFilters,
    resetSearchState,
  };
}
