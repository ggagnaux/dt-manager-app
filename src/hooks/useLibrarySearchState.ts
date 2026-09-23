import { useEffect, useState } from "react";
import {
  listTags,
  searchImages,
} from "../api";
import type {
  ImageRecord,
  SearchFilters,
} from "../types";

function createInitialSearchFilters(limit: number): SearchFilters {
  return {
    text: "",
    folder: "",
    dateFrom: "",
    dateTo: "",
    rating: null,
    colorLabel: "",
    tags: [],
    limit,
  };
}

export function useLibrarySearchState({
  resultLimit,
  initialImages,
  onImagesLoaded,
  onResetSelection,
}: {
  resultLimit: number;
  initialImages: ImageRecord[];
  onImagesLoaded: (images: ImageRecord[], preserveSelection: boolean) => void;
  onResetSelection: () => void;
}) {
  const [images, setImages] = useState<ImageRecord[]>(initialImages);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(() => createInitialSearchFilters(resultLimit));
  const [queryInProgress, setQueryInProgress] = useState(false);
  const [queryProgressMessage, setQueryProgressMessage] = useState("");

  useEffect(() => {
    setFilters((current) => ({ ...current, limit: resultLimit }));
  }, [resultLimit]);

  async function refreshLibraryMetadata(libraryDbPath: string, dataDbPath: string) {
    const tagResponse = await listTags(libraryDbPath, dataDbPath);

    if (tagResponse.ok && tagResponse.data) {
      setAvailableTags(tagResponse.data);
    }
  }

  async function refreshLibraryData(libraryDbPath: string, dataDbPath: string, preserveSelection = false) {
    setQueryInProgress(true);
    setQueryProgressMessage("Searching the Darktable library...");

    try {
      const [tagResponse, imageResponse] = await Promise.all([
        listTags(libraryDbPath, dataDbPath),
        searchImages(libraryDbPath, dataDbPath, filters),
      ]);

      if (tagResponse.ok && tagResponse.data) {
        setAvailableTags(tagResponse.data);
      }

      if (imageResponse.ok && imageResponse.data) {
        setQueryProgressMessage(`Loaded ${imageResponse.data.length} images.`);
        setImages(imageResponse.data);
        onImagesLoaded(imageResponse.data, preserveSelection);
      }
    } finally {
      setQueryInProgress(false);
    }
  }

  async function handleRefreshResults(connection: { libraryDbPath: string; dataDbPath: string }) {
    if (!connection.libraryDbPath) {
      return;
    }
    await refreshLibraryData(connection.libraryDbPath, connection.dataDbPath);
  }

  function handleResetFilters() {
    setFilters(createInitialSearchFilters(resultLimit));
    setImages([]);
    onResetSelection();
  }

  function resetSearchState() {
    setImages([]);
    setAvailableTags([]);
    setFilters(createInitialSearchFilters(resultLimit));
    onResetSelection();
  }

  return {
    images,
    setImages,
    availableTags,
    filters,
    setFilters,
    queryInProgress,
    queryProgressMessage,
    refreshLibraryMetadata,
    refreshLibraryData,
    handleRefreshResults,
    handleResetFilters,
    resetSearchState,
  };
}
