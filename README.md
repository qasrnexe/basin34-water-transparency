# Basin 34 Water Transparency

Interactive public web map for Water District 34 (Big Lost River Basin / Basin 34), Idaho.

**Goal:** Make existing high-quality public IDWR + USGS data more accessible and understandable — water rights points of diversion (PODs), places of use (POU), wells, stream gages, river reaches/hydro, and the historical vs. recent surface flow extent of the Big Lost River.

The tool is strictly neutral and data-driven. All visualizations cite public sources and "as of" dates. It complements (does not replace) official IDWR viewers and WD34 accounting reports.

## Quick Start

```bash
npm install
npm run dev      # local dev server
npm run build    # static production build to dist/
npm run preview  # serve the production build locally
```

## Using the tool

### Analysis views (the headline feature)

One exclusive analysis view at a time (sidebar, top). Matching features are emphasized with a distinct color identity; everything else is dimmed but never hidden:

- **Senior rights downstream (pre-1950)** — glowing yellow ★ where the oldest rights divert at/below the focus reach; the rights most exposed to upstream depletion.
- **Junior development (post-1980, high rate)** — orange ★/● for large later-priority rights and wells; where significant new development occurred.
- **Potential transfers** — purple ★ for rights whose POD sits more than 8 km from their authorized place of use, with dashed POD ↔ POU connector lines. The distance is adjusted for polygon size, so a POD inside a large district service area is not false-flagged. Transfer POUs that sit more than **1.5 km outside the river's natural corridor** (nearest NHD mainstem vertex or NWI riparian centroid, `NEW_GROUND_KM`) are additionally classified **"new ground"** and fill solid orange in this view — water moved onto previously dry bench/desert ground. This is a purely geometric proxy, not a land-use history finding; the transfers overview shows the count and per-right off-corridor distances.
- **Potential conflicts** — senior (pre-1970) downstream in yellow vs. newer (post-1980) upstream in orange, but **only for PODs within 3 km of the NHD Big Lost mainstem + NWI riparian corridor** (`CONFLICT_CORRIDOR_KM`). This filters mountain springs and tributary diversions (e.g. rights sourced from springs 25+ km west of the valley) that share a basin number but are not on the connected river path. Rights like **34-13725** (Big Lost River, ~0 km from channel) remain flagged; opens a ranked overview panel sorted by diversion rate.
- **Conjunctive: GW boom vs. senior surface** — post-1950 groundwater rights and irrigation wells in violet vs. senior (pre-1950) surface rights downstream in yellow; opens a panel pairing cumulative groundwater development with the measured flow record at Arco.
- **High diversion rates** — red ★ above the configurable cfs threshold.

Combine any view with the **reach focus** dropdown (or click a reach on the map) to restrict to PODs at/downstream of a WD34 admin reach.

Selecting **Potential transfers** also opens a ranked list of the largest POD↔POU separations in the details panel (with zoom links). Note: IDWR serves only the *current* authorized POU geometry — original (pre-transfer) places of use require the IDWR transfer records linked from each right's official report.

### Overappropriation charts (live USGS data)

Chart-heavy panels (gage history, appropriation, conjunctive, river shrink) open in a **lightbox modal** with large charts; every chart supports **hover** (crosshair + per-year value readout), dependency-free SVG.

- **Click any stream gage** → lightbox fetches the gage's full annual-statistics record from USGS NWIS (CORS, no key needed) and charts annual mean flow for the entire period of record, with early-period vs recent-period mean reference lines and a headline % change. Two honesty features: **zero-flow years** (annual mean ≤ 0.5 cfs) render as red dots on the baseline with a callout — at Arco (13132500) the record runs to the present and the river recorded **0.0 cfs annual mean in 2021, 2022 and 2025**, which otherwise looks like a rendering bug — and records whose last year is stale are labeled **"record ends YYYY — gage discontinued"** (13132565 and 13132535 below Arco both end in 2018) so a short chart is never mistaken for missing data. Partial years are deliberately excluded from NWIS stats (`missingData=on` not used) so annual means aren't computed from only wet or only dry months.
- **"📈 Appropriation vs. supply over time"** (sidebar) → cumulative authorized maximum diversion rate of all dated Basin 34 rights by priority year (total / surface / groundwater step chart), with the long-term mean flow at the Arco gage (USGS 13132500) charted below it and the paper-rights-to-measured-supply ratio called out.
- **"📉 River shrink: Mackay → Moore → Arco"** (sidebar) → lightbox joins the live annual records of three main-stem gages (13127000 below Mackay, 13132100 below Moore diversion, 13132500 near Arco): a three-line chart, a year-by-year table for the Moore gage era (2020+), segment-loss charts (Mackay−Moore vs Moore−Arco), and the full-record Mackay−Arco loss. Red dots mark zero-flow years at Arco. Zoom buttons jump to each gage on the map.
- **"▶ Development through time"** (sidebar) → a timeline bar over the map: scrub or play 1880 → 2026 and watch rights (priority year) and wells (construction year) accumulate, with a running rights / cfs / irrigation-well counter and a context chart showing both cumulative authorized cfs (blue) and the cumulative irrigation-well count (brown, scaled) — the post-1950 groundwater boom is visible at a glance while scrubbing. POU polygon redraws are suspended during playback for smooth animation.

### Exploring rights and places of use

- **Click a field (POU polygon)** → details panel lists every water right sharing that polygon (sorted senior-first, with priority badges and transfer distance), the polygon gets a purple outline, and dashed lines connect it to each POD. A selection banner appears at the top of the map.
- **District / service-area POUs** — a handful of rights (e.g. nine Big Lost River Irrigation District storage rights, ~234 km²; federal NPS rights, ~215 km²) have an authorized place of use covering most of the valley. These render as teal dashed **outlines only** (≥ 20 km², `DISTRICT_POU_KM2`): no fill means no valley-wide tint and no stolen clicks, so the individual fields inside stay visible and clickable. Polygons are painted largest-first, so smaller fields always win the click. Click the outline itself to see the district's rights.
- **Click a POD ★** → see the right's priority year, owner, rate, transfer badge, and its place of use highlighted with connector lines. "Zoom to right" fits the map to the POD + POU together.
- Clear the selection via the banner's ✕, the Esc key, or clicking the map background.

### Other controls

- **Owner search** — type a partial name, click a match to highlight that owner's rights (amber) with an aggregate summary (count, total cfs, by source, priority range).
- **POD filters** — color by source (GW violet / surface blue) or by priority year; filter by source class, era buckets (<1950 / 1950–2000 / >2000), and a year range. The same time filters apply to well construction years.
- **Wells** — colored by use (irrigation teal, domestic gray, stock burnt-orange, …), sized by production rate, with "hide domestic & unlabeled" on by default. Rendered as SVG in a pane above the POU polygons so a well dot always wins the click over the field it sits in (click just beside the dot to select the field instead).
- **Riparian areas (FWS NWI)** — 1,128 National Wetlands Inventory riparian polygons (forested dark green, scrub-shrub olive): the river's natural green corridor. Drawn beneath all interactive layers (never steals clicks); hover for type and acreage. Styled to read as a green band at basin zoom, stronger in the "then" era and dimmed in the "now" era. **Coverage note:** NWI riparian was simply not mapped along the lower channel — Arco to the Howe sinks has zero polygons (and decades of dry channel mean little riparian vegetation remains to map, which is itself part of the story); the NHD river-channel layer carries the corridor through that stretch.
- **Canals & pipelines (NHD)** — real USGS National Hydrography Dataset geometry for the basin: 718 canal/ditch segments (dashed blue) and pipelines (dotted slate), named on hover (Moore Canal, Burnett Ditch, Telford Pipe, …).
- **Named diversions ◆** — orange diamonds aggregating IDWR POD `DiversionName` for surface rights into delivery systems (≥5 cfs total). Labels appear at zoom ≥ 11; click one for every right it serves, total authorized cfs, and earliest priority.
- **River channel & sinks (NHD) — "Then vs now: where the river ends"** — the real Big Lost River channel (348 NHD segments) plus the terminal sinks complex near Howe (50 playa/marsh polygons). Each segment is tagged `above-moore` / `below-moore` at the **Moore diversion** (USGS 13132100) during ETL — because WD34 accounting and field observations show surface flow commonly ends near Moore in recent years, long before Arco or the sinks. In the **"Then"** era the whole channel runs vivid blue to the sinks; in the **"Now"** era everything below Moore (including the reach to Arco and the eastern sinks limb) renders **dashed brown**. Gage coordinates are from the USGS NWIS site service (13132565 is on the sinks limb near Howe, not near Arco). Orange gage dots mark Moore; red marks Arco and downstream extent gages.
- **Basemap & layer toggles** — Map / Satellite / Hybrid basemaps; per-layer checkboxes for PODs, wells, basin boundary, canals & pipelines, named diversions, gages, flow extent, and admin reaches.
- **🔗 Share view (permalinks)** — the URL hash mirrors the full app state (analysis view, filters, owner, selection, flow era, basemap, map position; only non-default values, so URLs stay short). The header button copies the link; opening it restores the exact view, including any auto-opened analysis panel.
- **Legend** — always visible, swatch-based, and generated from the same color tables the map uses, so it always matches what is drawn.

## Architecture (src/)

The app is a static Vite + TypeScript + Leaflet build, organized as small modules around one explicit state object:

```
src/
  types.ts          Domain types (PodRecord, AppState, HighlightMode, …)
  state.ts          Single mutable AppState + defaults/reset
  data.ts           GeoJSON loading + derived records & indexes (built once):
                    priority years (incl. negative-epoch pre-1970 dates),
                    podsByWR / pousByWR, shared-polygon grouping, POU centers
                    and areas, size-adjusted transfer distances, "new ground"
                    classification (distance to the NHD/NWI natural corridor)
  filters.ts        Pure visibility predicates (pods / wells)
  emphasis.ts       Pure per-feature emphasis resolution
                    (selected > owner > analysis view > normal/subdued)
  symbology.ts      Color tables, sizes, cached star icon factory
  usgs.ts           Live USGS NWIS annual-statistics fetch + RDB parsing (cached)
  permalink.ts      URL-hash encode/decode of AppState + map view (share links)
  map/
    createMap.ts    Map + pane z-order (defined once; no bringToFront juggling)
    podLayer.ts     Clustered POD stars; full rebuild only on filter changes,
                    in-place restyle for selection changes
    wellLayer.ts    SVG circle markers in a pane above POU (dot wins the click)
    pouLayer.ts     One SVG GeoJSON layer for POU polygons (painted largest-
                    first; district-scale areas outline-only) + selection
                    overlay + non-interactive connector lines on dedicated panes
    diversionLayer.ts Named diversions aggregated from POD DiversionName
    staticLayers.ts Boundary, NWI riparian, NHD canals/pipelines, gages,
                    NHD mainstem + sinks (era-styled "then vs now"), reaches
  ui/
    shell.ts        Static HTML shell
    sidebar.ts      Control wiring (state mutations + refresh callbacks)
    legend.ts       Swatch legend + analysis-view hints
    details.ts      Details panel renderers (POD / well / POU group / gage
                    flow chart / diversion / transfers list / appropriation /
                    conjunctive / river shrink)
    chart.ts        Dependency-free SVG line/area/step charts + hover
                    crosshair/value readout (enhanceCharts)
    modal.ts        Lightbox for chart-heavy panels (gage / analyses)
    timeline.ts     "Development through time" slider/animation bar
    ownerSearch.ts  Debounced owner search + summary
  main.ts           Bootstrap + render orchestration (refreshData / setSelection)
```

Key invariants:

- **Filtering, emphasis, and symbology are pure functions** of `(record, state, store)` — easy to test and to extend with new analysis views (add an enum value, a predicate, and a color entry).
- **Selection never rebuilds the world.** Clicking a POD/POU restyles only the affected markers and redraws the small selection overlay; the 7k-marker cluster and 5.8k-polygon POU layer rebuild only when filters change.
- **Z-order lives in panes** (`createMap.ts`), set once: overlays (400) < POU base (450) < wells (470) < gages (480) < markers (600) < selection outline (650) < connector lines (660). Every interactive layer is SVG, so only the drawn shapes capture clicks — a well/gage dot wins over the POU under it, and a click beside the dot falls through to the field.

## Data & ETL

- `public/data/` — committed GeoJSON extracts (WGS84) + `manifest.json` with provenance and counts: `wd34-pods` (7,066), `wd34-wells` (4,304), `wd34-pou` (5,786), `nhd-canals-pipelines` (718), `nwi-riparian` (1,128), `nhd-mainstem` (348), `nhd-sinks` (50), `wd34-admin-reaches` (6), `basin-boundary`, `gages` (5), `flow-extent-indicators` (2, fallback only).
- `scripts/etl/fetch_idwr_pods_wells.py` — reproducible extraction from IDWR public feature services (PODs, wells, POU; Basin 34 / WD34 filtered). Re-run periodically and commit updated extracts + manifest.
- `scripts/etl/fetch_nwi_riparian.py` — FWS National Wetlands Inventory riparian polygons for the basin (bbox query, centroid-clipped to the WBD boundary).
- `scripts/etl/fetch_nhd_mainstem.py` — Big Lost River mainstem flowlines from the NHD HR MapServer, each segment tagged `above-arco` / `below-arco` at the USGS Arco gage (13132500), plus the terminal sinks playa/marsh polygons (NHD waterbody fcodes 36100/46600) near Howe.
- Note on dates: IDWR serves `PriorityDate` / `ConstructionDate` as epoch **milliseconds**, and pre-1970 dates are **negative** — ~86% of Basin 34 rights. The data layer handles this.

Primary public sources (all open, no login):

- IDWR: https://data-idwr.hub.arcgis.com/ + feature services (WaterRightPods, Wells, POU)
- USGS NWIS gages, historical daily values, and the annual statistics service (13132500 is the key lower-basin extent gage); fetched live by the app for flow charts
- NHD High Resolution flowlines (canal/ditch/pipeline fcodes) via https://hydro.nationalmap.gov — `public/data/nhd-canals-pipelines.geojson`; Big Lost River mainstem + sinks waterbodies — `public/data/nhd-mainstem.geojson`, `public/data/nhd-sinks.geojson`
- USFWS National Wetlands Inventory (Riparian MapServer) — `public/data/nwi-riparian.geojson`
- WBD/NHD for HUC 17040218
- WD34 accounting page + USGS SIR reports for context

## Roadmap

- Live USGS gage values (NWIS iv), export of filtered features.
- Phase 1: parse WD34 accounting (XLSX/PDFs + ditch rider logs) for **curtailment history** ("who got shut off when"), join to reaches/gages for conveyance visualization, time correlations, storage balances.

## License & Attribution

Code: MIT. Data: public government sources — always attribute IDWR and USGS prominently (already in UI/footer).

**This is a community / transparency tool only. For water rights, administration, or legal matters, use official IDWR and Water District 34 resources.**
