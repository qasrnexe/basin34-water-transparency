#!/usr/bin/env python3
"""
ETL script: Fetch USFWS National Wetlands Inventory RIPARIAN polygons for the
Big Lost River Basin (Basin 34 / HUC 17040218), including the corridor all the
way down to the Howe sinks.

- Queries the public FWS NWI "Riparian" MapServer (no auth) with the basin
  bounding box, then keeps only polygons whose centroid falls inside the
  committed basin boundary (public/data/basin-boundary.geojson).
- Keeps lean attributes: ATTRIBUTE (Cowardin-style code), WETLAND_TYPE, ACRES.
- Rounds coordinates to 5 decimals (~1 m) to keep the file small.
- Writes public/data/nwi-riparian.geojson and updates manifest.json in place.

Run from project root or etl dir:
  python3 scripts/etl/fetch_nwi_riparian.py

Source (always cite):
- https://fwsprimary.wim.usgs.gov/server/rest/services/Riparian/MapServer/0
- NWI program: https://www.fws.gov/program/national-wetlands-inventory
"""

import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

SERVICE = "https://fwsprimary.wim.usgs.gov/server/rest/services/Riparian/MapServer/0/query"
BBOX = {"xmin": -114.3, "ymin": 43.4, "xmax": -113.0, "ymax": 44.2,
        "spatialReference": {"wkid": 4326}}
PAGE = 1000
PAGE_SLEEP = 0.5

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DATA = os.path.join(SCRIPT_DIR, "..", "..", "public", "data")
OUT = os.path.join(PUBLIC_DATA, "nwi-riparian.geojson")
MANIFEST = os.path.join(PUBLIC_DATA, "manifest.json")
BOUNDARY = os.path.join(PUBLIC_DATA, "basin-boundary.geojson")


def fetch_page(offset: int) -> dict:
    params = {
        "where": "1=1",
        "geometry": json.dumps(BBOX),
        "geometryType": "esriGeometryEnvelope",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "ATTRIBUTE,WETLAND_TYPE,ACRES",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
        "resultOffset": str(offset),
        "resultRecordCount": str(PAGE),
    }
    url = f"{SERVICE}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Basin34-ETL (public data fetch)"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def boundary_rings() -> list:
    """All outer rings of the basin boundary polygon(s)."""
    gj = json.load(open(BOUNDARY))
    rings = []
    for f in gj.get("features", []):
        g = f.get("geometry") or {}
        if g.get("type") == "Polygon":
            rings.append(g["coordinates"][0])
        elif g.get("type") == "MultiPolygon":
            rings.extend(p[0] for p in g["coordinates"])
    return rings


def point_in_ring(lon: float, lat: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def centroid(geom: dict):
    pts = []
    if geom["type"] == "Polygon":
        pts = geom["coordinates"][0]
    elif geom["type"] == "MultiPolygon":
        pts = geom["coordinates"][0][0]
    if not pts:
        return None
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def round_coords(coords, nd=5):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], nd), round(coords[1], nd)]
    return [round_coords(c, nd) for c in coords]


def main() -> None:
    print("=== Basin 34 NWI Riparian ETL ===")
    features, offset = [], 0
    while True:
        data = fetch_page(offset)
        page = data.get("features", [])
        features.extend(page)
        print(f"  offset={offset}: got {len(page)}")
        if len(page) < PAGE:
            break
        offset += PAGE
        time.sleep(PAGE_SLEEP)

    rings = boundary_rings()
    kept = []
    for f in features:
        g = f.get("geometry")
        if not g:
            continue
        c = centroid(g)
        if not c or not any(point_in_ring(c[0], c[1], r) for r in rings):
            continue
        g["coordinates"] = round_coords(g["coordinates"])
        kept.append(f)
    print(f"  total fetched: {len(features)}; inside basin boundary: {len(kept)}")

    fc = {
        "type": "FeatureCollection",
        "name": "nwi-riparian",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": kept,
        "_source": {
            "service": SERVICE.rsplit("/", 1)[0],
            "fetched": datetime.now(timezone.utc).isoformat(),
            "note": "FWS National Wetlands Inventory Riparian polygons, basin-bbox query, centroid-clipped to the WBD basin boundary. No derived values added.",
        },
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(fc, fh, ensure_ascii=False)
    size_mb = os.path.getsize(OUT) / 1e6
    print(f"  Wrote {OUT} ({len(kept)} features, {size_mb:.1f} MB)")

    manifest = json.load(open(MANIFEST))
    manifest["layers"]["nwi-riparian"] = {
        "source": "https://fwsprimary.wim.usgs.gov/server/rest/services/Riparian/MapServer/0 (basin bbox, centroid-clipped to WBD boundary)",
        "asOf": datetime.now(timezone.utc).date().isoformat(),
        "count": len(kept),
        "description": "USFWS National Wetlands Inventory riparian polygons (forested / scrub-shrub / emergent) — the natural riparian corridor of the Big Lost River down to the sinks near Howe.",
    }
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
    print("  Updated manifest.")


if __name__ == "__main__":
    main()
