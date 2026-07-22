# Basin 34 Water Transparency — Plan

**Repo:** `qasrnexe/basin34-water-transparency`  
**Live:** https://water.bnm.farm (private — same family Caddy login as farm.bnm.farm)  
**Deploy:** rebuild `dist/` only on the media box (`npm run build`). See `tv-remote/homelab/AGENT_COORDINATION.md`.

**Purpose:** Single source of truth. On the media-box agent say: “read PLAN.md and do the next build slice.”

---

## North star

A **public accountability / transparency tool** for Water District 34 (Big Lost River) that is:

1. **Fast enough to use** in a meeting (not a 26MB stutter-fest)
2. **Clear enough** that a neighbor can see: lower river goes dry; senior surface rights sit there; later development expanded upstream / off-corridor
3. **Exportable** — ranked tables + CSV, not only a map
4. **Careful** — evidence and methodology, no accusations; **do not feature private families as the default “example”** in Story captions/presets. Owner names from IDWR stay in the data, search, tables, and CSV.

> Think “receipts + rankings + map,” not “heavy GIS for its own sake.”

**Tone:** Neutral, sourced. Geometric / priority / gage proxies — not court findings.

**Product rule:** at most **three primary insight receipts**:

1. River shrinks / goes dry below Moore  
2. Downstream seniors on that dry reach (CSV)  
3. Water authorized far from / off the corridor — “moved farther” (CSV)

Everything else is Advanced or Story color — not a peer lens. **Do not add a seventh exclusive `HighlightMode`.**

---

## Current state (2026-07-22)

- [x] Live at water.bnm.farm; POD-first Explore; calm stars; dry-reach CSV; mobile sheet
- [x] F0 data refresh (`asOf` 2026-07-22)
- [x] F1 — Water moved farther rename + CSV + honest copy; Advanced optgroup; canals auto-show
- [x] F2 — Explore nested: hint / owner / basemap / short layers / insight receipts / Advanced collapsed
- [x] F3 — Story trimmed to 5 steps (three receipts)
- [x] F4 — Evidence research: no clean public east/west designation polygons; claim stays narrative + satellite (see below)
- [x] F5 — Live USGS instantaneous CFS on gage click (annual history retained)

---

## Build order

```text
F0. Data refresh                                      ← DONE
F1. Consolidate Explore + honest “moved farther”      ← DONE
F2. Sidebar IA (insight-first, Advanced nested)       ← DONE
F3. Story trim 7 → 5                                  ← DONE
F4. Evidence for recent lined canals                  ← researched; no new UI layer
F5. Live USGS instantaneous on gages                  ← DONE (chose live USGS over curtailment)
```

---

### F0 — Data freshness

Re-run IDWR + NHD canals/mainstem/sinks + NWI; `scripts/etl/fetch_nhd_canals.py`; bump manifest.  
**Caveat:** GIS lags dirt work. Always show **data as of**.

---

### F1 — Consolidate + honest “moved farther”

- Renamed user-facing “Potential transfers” → **Water moved farther** (mode id stays `transfers`)
- Ranked table + owner filter + CSV (`src/movedFarther.ts`) matching dry-reach pattern
- Honest copy: satellite for lined canals / east–west new ground; GIS = POD↔POU distance + off-corridor geometry — **not** “built since ~2010”
- Auto-show NHD canals when this lens is on
- Demoted `junior-dev` / `conflict` / `high-rate` under Advanced analyses optgroup

---

### F2 — Sidebar IA

Explore cold-open:

- Hint + owner search + basemap + short layers (POD / wells / channel / canals)
- Insight receipt buttons + primary map-emphasis select
- **Advanced** `<details>`: rate/reach/POU fills, appropriation & timeline, extra layers, POD filters, then/now, reset

---

### F3 — Story trim

Five steps: overview → then/now → river shrink → dry-reach seniors → water moved farther.  
GW boom / Arco standalone steps folded into Explore / dry-reach framing.

---

### F4 — Evidence for *recent* lined canals (research note)

**Finding (2026-07-22):** No clean public IDWR / WD34 **east-side / west-side of the river** designation polygons turned up for ETL. Available signals:

| Source | What it is | Enough for UI? |
|---|---|---|
| NHD canals/pipelines | Geometry only; no “lined” | Already loaded — not a liner inventory |
| Geometric “off corridor” | ~282 rights; **mostly pre-1950 priority** | Useful proxy; **must not** mean “last 10–15 years” |
| BLR Ground Water District division map | Divisions 1–7 (not east/west of river) | Skip for this claim |
| IDWR Open Data / water districts hub | Admin layers exist generally; no WD34 E/W designation layer found | Revisit if IDWR publishes one |

**Decision:** Ship **no new F4 map layer**. Keep local reality in Story/panel copy (lined canals on satellite). Re-open only if a sourced polygon or transfer-filing table appears.

**Parked (old F3 toys):** NHD pond polygons, NAIP swipe, fake change detection — only if a meeting need appears.

---

### F5 — Harder receipts: live USGS

Chose **live / fresher USGS instantaneous discharge** on gage click (`fetchInstantaneousCfs` in `src/usgs.ts`) over curtailment/accounting for this pass — same gage story, higher evidence, no new fashion layers.

**Still later:** WD34 curtailment / “who shut off when” (hardest data).

---

## Working loop

1. Stay in `basin34-water-transparency`; rebuild `dist/` only  
2. Do not checkout other branches in `tv-remote` or recreate Caddy from a stale tree  
3. After each slice: commit, push, `npm run build`

## Success bar

In &lt;5 minutes on a phone: tap ★ → purple links; see dry channel below Moore; download dry-reach CSV; open moved-farther CSV with honest methodology; see live CFS on a reporting gage; see data-as-of chip.
