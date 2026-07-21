#!/usr/bin/env python3
"""
ETL script: Fetch the real Big Lost River channel geometry from the USGS NHD
(high resolution) plus the terminal sinks/playa polygons near Howe, so the app
can draw the actual river — including the reach below Arco that historically
carried water to the Big Lost River sinks and is now usually dry.

- Mainstem: NHD flowlines where gnis_name = 'Big Lost River' (layer 6,
  Flowline - Large Scale). Each segment is tagged with a derived `reach`
  property: 'below-moore' for the main valley south of the Moore diversion
  (USGS 13132100) plus the eastern limb toward the sinks, otherwise
  'above-moore'. This split powers the "then vs now" styling — recent surface
  flow commonly ends near Moore, not Arco.
- Sinks: NHD waterbody polygons (layer 12) in the lower basin with fcode
  36100 (playa) or 46600 (swamp/marsh) — the terminal sinks complex.
- Writes public/data/nhd-mainstem.geojson and public/data/nhd-sinks.geojson,
  and updates manifest.json in place.

Run from project root or etl dir:
  python3 scripts/etl/fetch_nhd_mainstem.py

Source (always cite): https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer
"""

import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

SERVER = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer"
FLOWLINE_LAYER = 6   # Flowline - Large Scale (high resolution)
WATERBODY_LAYER = 12 # Waterbody - Large Scale

BASIN_BBOX = {"xmin": -114.3, "ymin": 43.4, "xmax": -112.85, "ymax": 44.2,
              "spatialReference": {"wkid": 4326}}
LOWER_BBOX = {"xmin": -113.35, "ymin": 43.4, "xmax": -112.85, "ymax": 43.9,
              "spatialReference": {"wkid": 4326}}

# USGS 13132100 (Big Lost River below Moore diversion) — the WD34 accounting
# point where surface flow commonly ends in recent decades. The "then vs now"
# styling treats the main valley below this gage plus the eastern sinks limb as
# usually dry today; historically the whole channel ran to the sinks.
MOORE_DIV_LAT = 43.7843611
MOORE_DIV_LON = -113.3608889
SINKS_LIMB_LON = -113.26  # river turns east toward Howe/sinks east of here


def tag_reach(lon: float, lat: float) -> str:
    """Return 'below-moore' for the lower valley + sinks limb, else 'above-moore'."""
    if lon > SINKS_LIMB_LON:
        return "below-moore"  # eastern reach toward the sinks
    if lat < MOORE_DIV_LAT and lon > -113.55:
        return "below-moore"  # main stem south of Moore diversion
    return "above-moore"

PAGE = 2000
PAGE_SLEEP = 0.5

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DATA = os.path.join(SCRIPT_DIR, "..", "..", "public", "data")
MAINSTEM_OUT = os.path.join(PUBLIC_DATA, "nhd-mainstem.geojson")
SINKS_OUT = os.path.join(PUBLIC_DATA, "nhd-sinks.geojson")
MANIFEST = os.path.join(PUBLIC_DATA, "manifest.json")


def query(layer: int, params: dict) -> dict:
    base = {
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    }
    base.update(params)
    url = f"{SERVER}/{layer}/query?{urllib.parse.urlencode(base)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Basin34-ETL (public data fetch)"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_all(layer: int, params: dict, label: str) -> list:
    features, offset = [], 0
    while True:
        page = query(layer, {**params, "resultOffset": str(offset), "resultRecordCount": str(PAGE)})
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


def line_midpoint(geom: dict):
    coords = geom["coordinates"]
    if geom["type"] == "MultiLineString":
        coords = coords[0]
    return coords[len(coords) // 2]


def write_fc(features: list, path: str, name: str, note: str) -> None:
    fc = {
        "type": "FeatureCollection",
        "name": name,
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
        "_source": {
            "service": SERVER,
            "fetched": datetime.now(timezone.utc).isoformat(),
            "note": note,
        },
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(fc, fh, ensure_ascii=False)
    print(f"  Wrote {path} ({len(features)} features, {os.path.getsize(path)/1e6:.1f} MB)")


def main() -> None:
    print("=== Basin 34 NHD mainstem + sinks ETL ===")

    print("\nFetching Big Lost River mainstem flowlines...")
    mainstem = fetch_all(FLOWLINE_LAYER, {
        "where": "gnis_name='Big Lost River'",
        "geometry": json.dumps(BASIN_BBOX),
        "geometryType": "esriGeometryEnvelope",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "gnis_name,fcode,lengthkm,reachcode",
    }, "mainstem")
    below = 0
    for f in mainstem:
        g = f.get("geometry")
        if not g:
            continue
        g["coordinates"] = round_coords(g["coordinates"])
        lon, lat = line_midpoint(g)
        reach = tag_reach(lon, lat)
        f.setdefault("properties", {})["reach"] = reach
        if reach == "below-moore":
            below += 1
    print(f"  segments: {len(mainstem)} total, {below} below Moore diversion")
    write_fc(mainstem, MAINSTEM_OUT, "nhd-mainstem",
             "NHD HR flowlines named 'Big Lost River'. Derived 'reach' property: 'below-moore' = "
             "main valley south of USGS 13132100 (Moore diversion) plus the eastern sinks limb; "
             "'above-moore' = upstream. Used for the then-vs-now styling (recent flow commonly "
             "ends near Moore, not Arco). No other derived values.")

    print("\nFetching sinks/playa polygons (lower basin)...")
    sinks = fetch_all(WATERBODY_LAYER, {
        "where": "FCODE IN (36100, 46600)",  # playa, swamp/marsh
        "geometry": json.dumps(LOWER_BBOX),
        "geometryType": "esriGeometryEnvelope",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "GNIS_NAME,FCODE,FTYPE,AREASQKM",
    }, "sinks")
    for f in sinks:
        if f.get("geometry"):
            f["geometry"]["coordinates"] = round_coords(f["geometry"]["coordinates"])
    write_fc(sinks, SINKS_OUT, "nhd-sinks",
             "NHD HR waterbody polygons, fcode 36100 (playa) / 46600 (swamp-marsh), lower Big Lost "
             "basin — the terminal sinks complex near Howe where the river historically ended.")

    now = datetime.now(timezone.utc).date().isoformat()
    manifest = json.load(open(MANIFEST))
    manifest["layers"]["nhd-mainstem"] = {
        "source": f"{SERVER} layer {FLOWLINE_LAYER} (gnis_name='Big Lost River'; derived reach split at Moore diversion USGS 13132100)",
        "asOf": now,
        "count": len(mainstem),
        "description": "Real NHD channel geometry of the Big Lost River, tagged above/below Moore diversion for the historical-vs-recent flow visualization.",
    }
    manifest["layers"]["nhd-sinks"] = {
        "source": f"{SERVER} layer {WATERBODY_LAYER} (fcode 36100 playa / 46600 swamp-marsh, lower basin bbox)",
        "asOf": now,
        "count": len(sinks),
        "description": "Big Lost River sinks complex near Howe (NHD playa/marsh polygons) — the river's historic terminus.",
    }
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
    print("  Updated manifest.")


if __name__ == "__main__":
    main()
