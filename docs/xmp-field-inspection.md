# XMP Field Inspection

## Samples inspected

- `dt-export-meta/test-scratch/xmp-parser/HEX-404.jpg.xmp`
- `dt-export-meta/scratch-source-xmp/source.jpg.xmp`
- user-provided Darktable sidecar sample from the active library
- second user-provided Darktable sidecar sample with notes metadata

## Confirmed fields

- `dc:title`
- `dc:description`
- `dc:creator`
- `dc:rights`
- `dc:subject`
- `lr:hierarchicalSubject`
- `xmp:Rating` as an attribute on `rdf:Description`
- `darktable:colorlabels`
- `exif:DateTimeOriginal`
- Darktable metadata attributes such as `import_timestamp`, `change_timestamp`, and `export_timestamp`

## Notes field status

The second real sidecar exposes notes as:

- `acdsee:notes` attribute on `rdf:Description`

Additional fallback candidates still worth tolerating during reads:

- `xmpRights:UsageTerms`
- `xmpRights:WebStatement`
- `photoshop:Instructions`
- `photoshop:Headline`
- `xmp:Label`

## Working mapping strategy

Based on the real Darktable sample, these mappings are now the working defaults:

- title: `dc:title/rdf:Alt/rdf:li`
- description: `dc:description/rdf:Alt/rdf:li`
- creator: `dc:creator/rdf:Seq/rdf:li`
- rights: `dc:rights/rdf:Alt/rdf:li`
- flat tags: `dc:subject/rdf:Bag/rdf:li`
- hierarchical tags: `lr:hierarchicalSubject/rdf:Bag/rdf:li`
- rating: `xmp:Rating` attribute on `rdf:Description`
- color labels: `darktable:colorlabels/rdf:Seq/rdf:li`
- capture date: `exif:DateTimeOriginal` attribute on `rdf:Description`
- notes: `acdsee:notes` attribute on `rdf:Description`, with read fallbacks for `xmp:Label`, `photoshop:Instructions`, and `photoshop:Headline`

## Next validation step

The core user-facing metadata mapping is now grounded enough to implement the JSON schema and XMP writer behavior.
