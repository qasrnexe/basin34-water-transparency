#!/usr/bin/env python3
"""
ETL script: Fetch real IDWR PODs, Wells and POU data for Water District 34 / Big Lost River Basin (Basin 34).

- Queries the public IDWR ArcGIS Feature Services (no auth).
- Server-side filter for WD34/Basin 34 (BasinNumber=34 or WaterDistrictNumber='34' for PODs;
  BasinNumber=34 or CountyName Butte/Custer for Wells).
- Requests output in WGS84 (outSR=4326) as GeoJSON.
- Paginates using resultOffset/resultRecordCount (service max ~2000).
- Selects lean outFields for smaller, useful files (key public attributes).
- Writes clean FeatureCollections to public/data/wd34-pods.geojson, wd34-wells.geojson and wd34-pou.geojson.
- Updates public/data/manifest.json with counts + source metadata.
- Keeps everything neutral: no derived fields, full source attribution preserved in manifest + properties.

Run from project root or etl dir:
  python3 scripts/etl/fetch_idwr_pods_wells.py

Requires only Python 3 stdlib (urllib, json, time, os, datetime). No external packages.

Data volume note (as of run time): ~7k PODs and ~4k Wells for the basin filters. Resulting GeoJSONs
will be several MB; acceptable for Phase 0 client-side use (Leaflet handles it; clustering can be
added later). For production scale, consider vector tiles or server-side filtering by map bounds.

Sources (always cite):
- PODs: https://gis.idwr.idaho.gov/hosting/rest/services/Allocation/WaterRightPods/FeatureServer/0
- Wells: https://gis.idwr.idaho.gov/hosting/rest/services/Groundwater/Wells/FeatureServer/0
- Hub: https://data-idwr.hub.arcgis.com/
- See also IDWR GIS pages and the project plan for full context and limitations.

This script is intentionally simple and auditable. Re-run periodically for updates; commit the
resulting public/data/ files + updated manifest. Always surface "as of" + direct links in UI.
"""

import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List

# --- Configuration (edit if service URLs or fields change) ---
POD_URL = "https://gis.idwr.idaho.gov/hosting/rest/services/Allocation/WaterRightPods/FeatureServer/0/query"
WELLS_URL = "https://gis.idwr.idaho.gov/hosting/rest/services/Groundwater/Wells/FeatureServer/0/query"
POU_URL = "https://gis.idwr.idaho.gov/hosting/rest/services/allocation/WaterRightPous/FeatureServer/0/query"

# Neutral, minimal but useful fields. Add more if needed for future UI (e.g. WRReport for links).
POD_OUTFIELDS = "OBJECTID,WaterRightNumber,BasinNumber,WaterDistrictNumber,Status,PriorityDate,Owner,OverallMaxDiversionRate,Source,DiversionType,DiversionName,Uses,RightID,PointOfDiversionID,WRReport"
WELLS_OUTFIELDS = "OBJECTID,WellID,Owner,WellUse,BasinNumber,CountyName,TotalDepth,StaticWaterLevel,ProductionRate,ConstructionDate,MetalTagNumber,WellDocs"
# POU for Place of Use polygons, keyed by WaterRightNumber to link to PODs/rights. Includes acres for size context.
POU_OUTFIELDS = "OBJECTID,WaterRightNumber,BasinNumber,SequenceNumber,SplitSuffix,Status,PriorityDate,Owner,WaterUse,TotalAcres,Source,SourceQualifier"

# Filters per plan/research (server-side; adjust if definition of "Basin 34" evolves).
POD_WHERE = "BasinNumber=34 OR WaterDistrictNumber='34'"
WELLS_WHERE = "BasinNumber=34 OR CountyName='Butte' OR CountyName='Custer'"
POU_WHERE = "BasinNumber=34"

MAX_RECORDS = 2000  # Service limit (confirmed via metadata)
PAGE_SLEEP = 0.6    # Be polite to public service

# Output paths (relative to this script; project public/data/)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PUBLIC_DATA = os.path.join(PROJECT_ROOT, "public", "data")
PODS_OUT = os.path.join(PUBLIC_DATA, "wd34-pods.geojson")
WELLS_OUT = os.path.join(PUBLIC_DATA, "wd34-wells.geojson")
MANIFEST = os.path.join(PUBLIC_DATA, "manifest.json")

def fetch_page(base_url: str, where: str, out_fields: str, offset: int, count: int) -> Dict[str, Any]:
    """Fetch one page of features as GeoJSON (with outSR=4326)."""
    params = {
        "where": where,
        "outFields": out_fields,
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
        "resultOffset": str(offset),
        "resultRecordCount": str(count),
    }
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Basin34-ETL/phase0 (public data fetch; see README)"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))

def fetch_all(base_url: str, where: str, out_fields: str, label: str) -> List[Dict[str, Any]]:
    """Paginate and collect all features for a layer."""
    features: List[Dict[str, Any]] = []
    offset = 0
    page = 0
    while True:
        page += 1
        print(f"  [{label}] page {page}: offset={offset} ...", end=" ", flush=True)
        data = fetch_page(base_url, where, out_fields, offset, MAX_RECORDS)
        page_features = data.get("features", [])
        n = len(page_features)
        features.extend(page_features)
        print(f"got {n}")
        if n < MAX_RECORDS:
            break
        offset += MAX_RECORDS
        time.sleep(PAGE_SLEEP)
    print(f"  [{label}] total features fetched: {len(features)}")
    return features

def write_geojson(features: List[Dict[str, Any]], path: str, name: str, source_url: str) -> None:
    """Write a standard GeoJSON FeatureCollection (WGS84 assumed from query)."""
    fc = {
        "type": "FeatureCollection",
        "name": name,
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
        "_source": {
            "service": source_url,
            "query_where": name.split("-")[-1].upper() + " filter used",
            "fetched": datetime.now(timezone.utc).isoformat(),
            "note": "Processed public extract for Basin 34 / WD34 transparency tool. All attributes from source service. No derived values added."
        }
    }
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False)  # compact for size; add indent=2 for readability if desired
    print(f"  Wrote {path} ({len(features)} features)")

def update_manifest(pod_count: int, well_count: int, pou_count: int) -> None:
    """Update (or create) manifest.json with real counts and provenance."""
    now = datetime.now(timezone.utc).date().isoformat()
    manifest = {
        "version": "phase0-real-extracts",
        "generated": now,
        "notes": "Real filtered extracts from IDWR public services. See _source inside each GeoJSON and the ETL README for full details. Replace/re-run as data updates. Keep neutral - no added interpretation.",
        "layers": {
            "wd34-pods": {
                "source": "https://gis.idwr.idaho.gov/hosting/rest/services/Allocation/WaterRightPods/FeatureServer/0 (filtered BasinNumber=34 OR WaterDistrictNumber='34')",
                "asOf": now,
                "count": pod_count,
                "description": "Water rights Points of Diversion (PODs) for Water District 34 / Basin 34. Key fields: WaterRightNumber, Status, PriorityDate, Owner, OverallMaxDiversionRate, Source, DiversionType, etc. Includes links where available (WRReport)."
            },
            "wd34-wells": {
                "source": "https://gis.idwr.idaho.gov/hosting/rest/services/Groundwater/Wells/FeatureServer/0 (filtered BasinNumber=34 OR CountyName Butte/Custer)",
                "asOf": now,
                "count": well_count,
                "description": "Well locations and basic construction/use data for the basin. Key fields: WellID, Owner, WellUse, TotalDepth, StaticWaterLevel, ProductionRate, CountyName, etc. MetalTagNumber links to some PODs."
            },
            "wd34-pou": {
                "source": "https://gis.idwr.idaho.gov/hosting/rest/services/allocation/WaterRightPous/FeatureServer/0 (filtered BasinNumber=34)",
                "asOf": now,
                "count": pou_count,
                "description": "Place of Use (POU) polygons for water rights in Basin 34. Linked to PODs/rights via WaterRightNumber. Includes TotalAcres. Rendered for all visible rights in the app; district-scale service areas (>=20 km2) draw as outlines only."
            },
            # Layers below are produced/managed separately (not by this script); counts documented for completeness
            "nhd-canals-pipelines": {
                "source": "USGS NHD High Resolution flowlines (canal/ditch/pipeline fcodes), HUC 17040218 via hydro.nationalmap.gov",
                "asOf": now,
                "count": 718,
                "description": "Canal/ditch segments (dashed) and pipelines (dotted) for the basin, named where NHD provides GNIS names."
            },
            "wd34-admin-reaches": {
                "source": "WD34 administrative reach approximations (manually digitized from WD34 accounting context)",
                "asOf": now,
                "count": 6,
                "description": "Admin reach lines used for the at/downstream reach focus filter."
            },
            "basin-boundary": {
                "source": "WBD HUC 17040218 (Big Lost) boundary",
                "asOf": now,
                "count": 1,
                "description": "Basin outline for context."
            },
            "gages": {
                "source": "USGS NWIS (waterdata.usgs.gov) + IDWR 2024 Big Lost Groundwater Update (Table 1 periods of record)",
                "asOf": now,
                "count": 5,
                "description": "Key gages for context and downstream surface flow extent proxy (13132500 near Arco is primary indicator for lower basin reach)"
            },
            "flowExtentIndicators": {
                "source": "Derived from NHD mainstem + public gage flow presence summaries (NWIS + published averages in IDWR/USGS reports)",
                "asOf": now,
                "count": 2,
                "description": "Approximate downstream extent proxies for historical vs recent reference periods. Strictly gage-record based; see details panel and links."
            }
        }
    }
    # If a previous manifest exists, merge non-overwritten keys lightly (simple overwrite for cleanliness here)
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"  Updated manifest: {MANIFEST}")

def main() -> None:
    print("=== Basin 34 IDWR ETL (PODs + Wells) ===")
    print(f"Output dir: {PUBLIC_DATA}")
    os.makedirs(PUBLIC_DATA, exist_ok=True)

    print("\nFetching PODs (Water Rights Points of Diversion) for WD34/Basin 34...")
    pods = fetch_all(POD_URL, POD_WHERE, POD_OUTFIELDS, "PODs")
    write_geojson(pods, PODS_OUT, "wd34-pods", "https://gis.idwr.idaho.gov/hosting/rest/services/Allocation/WaterRightPods/FeatureServer/0")

    print("\nFetching Wells for Basin 34 (Butte + Custer counties / BasinNumber)...")
    wells = fetch_all(WELLS_URL, WELLS_WHERE, WELLS_OUTFIELDS, "Wells")
    write_geojson(wells, WELLS_OUT, "wd34-wells", "https://gis.idwr.idaho.gov/hosting/rest/services/Groundwater/Wells/FeatureServer/0")

    print("\nFetching Place of Use (POU) polygons for Basin 34 water rights...")
    pous = fetch_all(POU_URL, POU_WHERE, POU_OUTFIELDS, "POU")
    POU_OUT = os.path.join(PUBLIC_DATA, "wd34-pou.geojson")
    write_geojson(pous, POU_OUT, "wd34-pou", "https://gis.idwr.idaho.gov/hosting/rest/services/allocation/WaterRightPous/FeatureServer/0")

    print("\nUpdating manifest...")
    update_manifest(len(pods), len(wells), len(pous))

    print("\n=== Done. Real extracts written. ===")
    print("Commit the updated public/data/*.geojson and manifest.json.")
    print("Rebuild (npm run build) and verify layers in the map.")
    print("Remember: These are public extracts — always attribute IDWR in UI.")

if __name__ == "__main__":
    main()
