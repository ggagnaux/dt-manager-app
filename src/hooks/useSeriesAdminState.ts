import { useEffect, useMemo, useState } from "react";
import { listSeriesAdminState, saveSeriesAdminState } from "../api";
import type { LibrarySeriesRecord, PersistedLocalSeries, SeriesAdminState } from "../types";

type PersistedSeriesMetadata = {
  description?: string;
  coverFilename?: string;
  status?: "active" | "archived";
  displayLabel?: string;
};

export function useSeriesAdminState(series: LibrarySeriesRecord[]) {
  const [seriesOrder, setSeriesOrder] = useState<string[]>([]);
  const [seriesMetadata, setSeriesMetadata] = useState<Record<string, PersistedSeriesMetadata>>({});
  const [localSeries, setLocalSeries] = useState<PersistedLocalSeries[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [hasLoadedState, setHasLoadedState] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    void listSeriesAdminState().then((response) => {
      if (isCancelled) {
        return;
      }
      if (response.ok && response.data) {
        setSeriesOrder(Array.isArray(response.data.order) ? response.data.order : []);
        setSeriesMetadata(response.data.metadata ?? {});
        setLocalSeries(Array.isArray(response.data.localSeries) ? response.data.localSeries : []);
      }
      setHasLoadedState(true);
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedState) {
      return;
    }
    const state: SeriesAdminState = {
        order: seriesOrder,
        metadata: seriesMetadata,
        localSeries,
      };
    void saveSeriesAdminState(state);
  }, [hasLoadedState, localSeries, seriesMetadata, seriesOrder]);

  const adminSeries = useMemo(() => {
    const orderMap = new Map(seriesOrder.map((key, index) => [key, index]));
    const derivedSeries = series
      .map((item) => {
        const metadata = seriesMetadata[item.key] ?? {};
        return {
          ...item,
          order: (orderMap.get(item.key) ?? series.length + item.order) + 1,
          status: metadata.status ?? item.status,
          displayLabel: metadata.displayLabel ?? item.displayLabel,
          description: metadata.description ?? item.description,
          coverFilename: metadata.coverFilename ?? item.coverFilename,
        };
      })
      .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
    const localRecords: LibrarySeriesRecord[] = localSeries.map((item, index) => ({
      key: item.key,
      label: item.label,
      count: 0,
      tagPath: item.tagPath,
      order: (orderMap.get(item.key) ?? derivedSeries.length + index) + 1,
      status: item.status,
      sourceKind: "local",
      displayLabel: item.displayLabel,
      description: item.description,
      coverFilename: item.coverFilename,
      imageFilenames: [],
    }));
    return [...derivedSeries, ...localRecords]
      .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
  }, [localSeries, series, seriesMetadata, seriesOrder]);

  function setSeriesField(
    seriesKey: string,
    field: keyof PersistedSeriesMetadata,
    value: string | "active" | "archived",
  ) {
    const target = adminSeries.find((item) => item.key === seriesKey);
    if (target?.sourceKind === "local") {
      setLocalSeries((current) => current.map((item) => (
        item.key === seriesKey
          ? { ...item, [field]: value }
          : item
      )));
      setStatusMessage("Series details saved locally for this workspace.");
      return;
    }

    setSeriesMetadata((current) => ({
      ...current,
      [seriesKey]: {
        ...current[seriesKey],
        [field]: value,
      },
    }));
    setStatusMessage("Series details saved locally for this workspace.");
  }

  function moveSeries(seriesKey: string, direction: -1 | 1) {
    setSeriesOrder((current) => {
      const orderedKeys = adminSeries.map((item) => item.key);
      const source = current.length > 0
        ? [...current.filter((key) => orderedKeys.includes(key)), ...orderedKeys.filter((key) => !current.includes(key))]
        : orderedKeys;
      const index = source.indexOf(seriesKey);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= source.length) {
        return source;
      }
      const next = [...source];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setStatusMessage(direction < 0 ? "Series moved up." : "Series moved down.");
  }

  function toggleSeriesStatus(seriesKey: string) {
    const currentStatus = adminSeries.find((item) => item.key === seriesKey)?.status ?? "active";
    const nextStatus = currentStatus === "active" ? "archived" : "active";
    if (adminSeries.find((item) => item.key === seriesKey)?.sourceKind === "local") {
      setLocalSeries((current) => current.map((item) => (
        item.key === seriesKey
          ? { ...item, status: nextStatus }
          : item
      )));
    } else {
      setSeriesField(seriesKey, "status", nextStatus);
    }
    setStatusMessage(nextStatus === "archived" ? "Series archived in the app workspace." : "Series restored to active.");
  }

  function createSeries(name: string, description: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setStatusMessage("Enter a series name before creating a local series.");
      return null;
    }

    const key = `local-series:${trimmedName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}:${Date.now()}`;
    const nextSeries: PersistedLocalSeries = {
      key,
      label: trimmedName,
      tagPath: trimmedName,
      description: description.trim() || "Locally managed series entry.",
      coverFilename: "No cover selected",
      status: "active",
      displayLabel: trimmedName,
    };
    setLocalSeries((current) => [...current, nextSeries]);
    setSeriesOrder((current) => [...current, key]);
    setStatusMessage("Local series created in DT Manager.");
    return key;
  }

  function deleteSeries(seriesKey: string) {
    const target = adminSeries.find((item) => item.key === seriesKey);
    if (!target) {
      return;
    }

    if (target.sourceKind === "local") {
      setLocalSeries((current) => current.filter((item) => item.key !== seriesKey));
      setSeriesOrder((current) => current.filter((key) => key !== seriesKey));
      setStatusMessage("Local series removed from DT Manager.");
      return;
    }

    setSeriesMetadata((current) => {
      const next = { ...current };
      delete next[seriesKey];
      return next;
    });
    setSeriesOrder((current) => current.filter((key) => key !== seriesKey));
    setStatusMessage("Local overrides removed. The derived series remains available from Library tags.");
  }

  return {
    adminSeries,
    statusMessage,
    setSeriesField,
    moveSeries,
    toggleSeriesStatus,
    createSeries,
    deleteSeries,
  };
}
