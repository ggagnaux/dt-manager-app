export type AppView = "library" | "series" | "tags" | "export-presets" | "settings";

export const APP_VIEWS: Array<{ id: AppView; label: string; description: string }> = [
  {
    id: "library",
    label: "Library",
    description: "Primary browsing, selection, metadata editing, and export workspace.",
  },
  {
    id: "series",
    label: "Series",
    description: "Dedicated series management screen planned for the next phase of the refactor.",
  },
  {
    id: "tags",
    label: "Tags",
    description: "Dedicated tag management screen planned to replace the current modal workflow.",
  },
  {
    id: "export-presets",
    label: "Export Presets",
    description: "Reusable export recipe management will move here in a later phase.",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Connection setup and application configuration will move here after the Library shell is stabilized.",
  },
];
