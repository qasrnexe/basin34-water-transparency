#!/usr/bin/env python3
"""
ETL: Fetch NHD High Resolution canal/ditch + pipeline flowlines for Basin 34 bbox.

Queries USGS NHD MapServer layer 6 (flowline) for FCODE ranges used by the map's
canal / pipeline toggle layers. Writes public/data/nhd-canals-pipelines.geojson
and updates manifest.json.

FCODE ranges (NHD):
  33600–33699  canal/ditch
  42800–42899  pipeline

Run from project root:
  python3 scripts/etl/fetch_nhd_canals.py
"""

from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

# Same endpoint as the Jun 2026 extract (_source.service), not NHDPlus_HR
SERVER = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer"
FLOWLINE_LAYER = 6
PAGE = 1000
PAGE_SLEEP = 0.4

# Basin 34 / Big Lost envelope (matches prior extract query note)
BASIN_BBOX = {
    "xmin": -114.1,
    "ymin": 43.4,
    "xmax": -112.9,
    "ymax": 44.3,
    "spatialReference": {"wkid": 4326},
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DATA = os.path.join(SCRIPT_DIR, "..", "..", "public", "data")
OUT = os.path.join(PUBLIC_DATA, "nhd-canals-pipelines.geojson")
MANIFEST = os.path.join(PUBLIC_DATA, "manifest.json")


def query(params: dict) -> dict:
    url = f"{SERVER}/{FLOWLINE_LAYER}/query?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Basin34-ETL (public data fetch)"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_all(where: str, label: str) -> list:
    features, offset = [], 0
    base = {
        "where": where,
        "geometry": json.dumps(BASIN_BBOX),
        "geometryType": "esriGeometryEnvelope",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "gnis_name,fcode,ftype,lengthkm,reachcode",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    }
    while True:
        page = query({**base, "resultOffset": str(offset), "resultRecordCount": str(PAGE)})
        feats = page.get("features", [])
        features.extend(feats)
        print(f"  [{label}] offset={offset}: got {len(feats)}")
        if len(feats) < PAGE:
            break
        offset += PAGE
        time.sleep(PAGE_SLEEP)
    return features


def round_coords(coords, nd=5):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], nd), round(coords[1], nd)]
    return [round_coords(c, nd) for c in coords]


def main() -> None:
    print("=== Basin 34 NHD canals + pipelines ETL ===")

    # Two queries so either class can page without mixing filters oddly
    canals = fetch_all("(fcode >= 33600 AND fcode < 33700)", "canal/ditch")
    pipes = fetch_all("(fcode >= 42800 AND fcode < 42900)", "pipeline")
    features = canals + pipes

    for f in features:
        g = f.get("geometry")
        if g and "coordinates" in g:
            g["coordinates"] = round_coords(g["coordinates"])

    now = datetime.now(timezone.utc)
    fc = {
        "type": "FeatureCollection",
        "name": "nhd-canals-pipelines",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
        "_source": {
            "service": SERVER,
            "layer": FLOWLINE_LAYER,
            "fetched": now.isoformat(),
            "note": (
                "NHD HR flowlines with fcode in canal/ditch (336xx) or pipeline (428xx) "
                "ranges, clipped to Basin 34 bbox. Used for map canal + pipeline toggles; "
                "lined canals to newer east/west-of-river ground are a story layer on top, "
                "not a separate NHD class."
            ),
            "counts": {
                "canal_ditch": len(canals),
                "pipeline": len(pipes),
                "total": len(features),
            },
        },
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(fc, fh, ensure_ascii=False)
    print(f"  Wrote {OUT} ({len(features)} features, {os.path.getsize(OUT)/1e6:.1f} MB)")

    manifest = json.load(open(MANIFEST))
    as_of = now.date().isoformat()
    manifest["layers"]["nhd-canals-pipelines"] = {
        "source": (
            f"{SERVER} layer {FLOWLINE_LAYER} "
            "(fcode canal/ditch 336xx + pipeline 428xx, Basin 34 bbox)"
        ),
        "asOf": as_of,
        "count": len(features),
        "description": (
            "NHD canal/ditch and pipeline flowlines in the basin envelope. "
            "Supports Explore toggles and the 'water moved farther' / lined-canal narrative."
        ),
    }
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
    print("  Updated manifest.")


if __name__ == "__main__":
    main()
