# ETL / Data Processing for Basin 34 Water Transparency (Phase 0)

This folder contains scripts and instructions to produce the versioned, basin-filtered GeoJSON files committed to `public/data/`.

**Core principle (per approved plan):** Pre-process once (or periodically). Commit clean WGS84 GeoJSON + manifest. Client is fast and self-contained. All steps documented for reproducibility and auditability. Always surface "as of" dates and direct source links.

## Key Data Sources (public, no login)

- IDWR feature services (primary for PODs, Wells):
  - WaterRightPods: https://gis.idwr.idaho.gov/hosting/rest/services/Allocation/WaterRightPods/FeatureServer/0
    - Filter: `WaterDistrictNumber='34' OR BasinNumber=34`
  - Wells: https://gis.idwr.idaho.gov/hosting/rest/services/Groundwater/Wells/FeatureServer/0
    - Filter: `BasinNumber=34 OR CountyName IN ('Butte','Custer')`
  - Hub downloads: https://data-idwr.hub.arcgis.com/ (search "points of diversion", "WaterRightPods", "wells")

- USGS NWIS (gages + historical for flow extent):
  - 13127000 (below Mackay Res) – primary context
  - 13132500 (near Arco) – **critical for downstream extent proxy** (record since 1946; large drop in flow reaching this gage post-1980)
  - 13132565 (above Big Lost River Sinks near Howe)
  - 13132535 (Lincoln Blvd near Atomic City)
  - Others: 13120000, 13130300, etc.
  - NWIS: https://waterdata.usgs.gov/ (daily values, statistics pages)
  - API examples: https://waterservices.usgs.gov/nwis/dv/?format=json&sites=13132500&startDT=2000-01-01&endDT=2025-01-01&parameterCd=00060

- NHD / WBD: USGS National Map Downloader, HUC 17040218 (Big Lost). IDWR 2016 update for Big Lost subbasin (canals/ditches).

- Supporting for future / context:
  - WD34 accounting: https://idwr.idaho.gov/wr-administration/water-rights-accounting/wd34/
  - Big Lost project page ZIPs (ditch rider logs 2015-2018, BLRID storage 2015-2019): https://idwr.idaho.gov/hydrologic-projects/big-lost-river-basin/
  - USGS SIR 2021-5078 series + IDWR 2024 groundwater update (gage table, seepage, budgets).

**Coordinate note:** Most IDWR data is IDTM83 (EPSG:8826). Always reproject to 4326 (WGS84) for web.

## Recommended Workflow (MVP)

1. **Acquire** (manual or scripted):
   - Use QGIS + "Add ArcGIS REST Server" or browser "query" on the feature services (add `?where=WaterDistrictNumber='34'&outFields=*&f=geojson` or use pagination).
   - Or hub "Download" as shapefile/GeoJSON, then filter.
   - For NHD: National Map Downloader (select WBD + NHD Flowlines for HUC 17040218).
   - For gage summaries (flow extent): Visit individual NWIS pages (e.g. 13132500 statistics) or use the dv API for selected periods; compute simple presence (days > 0 or >5 cfs) per water year or era. Or use published tables from IDWR 2024 update PDF (Table 1 has periods of record + notes on flow at Arco).

2. **Filter & process** (Python preferred for GIS):
   - geopandas + fiona + pyproj + shapely (or requests + manual pagination for services).
   - Filter to WD34/Basin (attr first, spatial clip fallback to HUC or rough bbox ~ -114.3 to -113.0, 43.4 to 44.2).
   - Reproject 4326.
   - Drop heavy fields; keep key ones listed in plan (WaterRightNumber, Source, PriorityDate, site_no, etc.).
   - Simplify lines (0.0001 deg tolerance typical).
   - For flow extent: Create or augment a small `flow-extent-indicators.geojson` (or augment nhd-flowlines) with `era`, `proxy_description`, `bounding_gages: ["13132500", ...]`, `source` fields. Use NHD mainstem clipped to relevant segments.

3. **Validate & manifest**:
   - Run basic checks (bbox, row counts, required fields present, sample properties).
   - Update `public/data/manifest.json` with counts, asOf dates, source URLs, notes.
   - Commit the resulting GeoJSONs.

4. **Update app**:
   - Layers are loaded via `fetch('/data/xxx.geojson')` in `src/data.ts` (PODs, wells, POU, reaches, mainstem + riparian for the new-ground proxy) and `src/map/staticLayers.ts` (boundary, riparian, canals, gages, mainstem + sinks, reaches).

## Commands

All scripts are pure stdlib (urllib + json) — no venv/pip/geopandas required (they directly query the public services, write the extracts and update the manifest).

```bash
cd /path/to/basin34-water-transparency
python3 scripts/etl/fetch_idwr_pods_wells.py   # PODs, wells, POU (IDWR)
python3 scripts/etl/fetch_nwi_riparian.py      # FWS NWI riparian polygons
python3 scripts/etl/fetch_nhd_mainstem.py      # Big Lost mainstem + sinks (NHD)
```

`fetch_nhd_mainstem.py` fetches the NHD HR flowlines named "Big Lost River" and tags each segment `above-arco` / `below-arco` (split at the USGS Arco gage, 13132500 — the only derived field, used for the "then vs now" styling), plus the terminal sinks playa/marsh polygons (waterbody fcodes 36100/46600) near Howe.

Note: the FWS NWI *Riparian* dataset was never mapped along the lower channel (Arco → sinks: zero polygons) — a real coverage gap, not an ETL bug. The NHD mainstem layer carries the corridor story through that stretch.

Current committed extracts: `wd34-pods.geojson` (7,066), `wd34-wells.geojson` (4,304), `wd34-pou.geojson` (5,786), `nwi-riparian.geojson` (1,128), `nhd-mainstem.geojson` (348), `nhd-sinks.geojson` (50), plus separately produced `nhd-canals-pipelines.geojson` (718), `wd34-admin-reaches.geojson` (6), `basin-boundary.geojson`, `gages.geojson` (5) and `flow-extent-indicators.geojson` (2, kept only as a fallback for the mainstem layer).

For other layers (NHD, custom reaches, gage summaries) or future accounting data (WD34 accounting XLSX/PDFs + ditch rider logs — the deferred Phase 1 curtailment work), add scripts following the same pattern. Re-run the main script when you want fresh public extracts.

Keep this README + the root README in sync with actual steps and data vintage.

**Neutrality note:** All processing must preserve source attribution. Never add interpretive fields. "as of" and direct links are mandatory in manifest + UI.
