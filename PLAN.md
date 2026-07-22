# Basin 34 Water Transparency — Plan

**Repo:** `qasrnexe/basin34-water-transparency`  
**Live:** https://water.bnm.farm (private — same family Caddy login as farm.bnm.farm)  
**Deploy:** `~/projects/tv-remote/homelab/scripts/deploy-water.sh` on the media box  

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

---

## Current state (2026-07-21)

- [x] Live at water.bnm.farm; media-box is canonical git home
- [x] Phase 1: satellite default, Story/Explore shell, presets, data-as-of
- [x] **A+B:** staged first load + dry-reach seniors table/CSV
- [x] **C:** guided Story steps (7 geography-only steps)
- [x] **D:** mobile bottom-sheet + tap targets
- [ ] Later: curtailment / live USGS / fresher ETL (E)

---

## Build order (adjusted — follow this)

```text
A. Performance (staged load + loading UI)     ← DONE
B. Accountability outputs (dry-reach list + CSV) ← DONE
C. Guided Story steps (short, geography-only) ← DONE
D. Mobile polish                              ← DONE
E. Later: WD34 curtailment/accounting join    ← NEXT when ready
```

Do **not** add more Explore chrome until A+B feel usable (they should now).

---

### A — First-load performance

**Goals:** Interactive map + Story chrome in a few seconds; heavy layers stream in after.

1. Stage 1: satellite + boundary + mainstem + sinks + gages (+ reaches)
2. Stage 2: PODs + wells (points) — analysis presets that need rights light up
3. Stage 3: POU polygons last (biggest file)
4. Defer canals + NWI riparian until after stage 2 (or first Explore open)
5. Loading overlay with stage labels
6. Gzip for `/data/*.geojson` via Caddy `encode gzip` (already on water.bnm.farm)

**Done when**

- [x] First paint usable without waiting for POU
- [x] Full layers available when stages finish
- [x] Deployed

---

### B — Accountability outputs (“personal DOGE” shape)

**Lens name:** **Downstream seniors on a dry reach**  
(Not “stolen” / “illegal.”)

**Rules (document in UI):**

- Surface / Big Lost River–like source (not far-off springs unless on corridor)
- Priority year **&lt; 1950** (tunable)
- POD on corridor (`corridorDistKm ≤ 3 km`) **and** at/below Moore split (south of Moore diversion / `below-moore` geography)
- Caveat: proxy from public IDWR + NHD + USGS — not a legal determination

**Ship:**

1. Story + Explore button: open ranked table (WR, owner, year, cfs, lat/lon)
2. **Download CSV** of that table
3. Zoom-to-right from each row
4. Methodology blurb above the table

**Done when**

- [x] Table + CSV work on live site
- [x] Deployed

---

### C — Guided Story ← DONE

6–7 steps, geography only: overview → then/now → river shrink → seniors → GW boom → transfers → Arco/lower river.  
No private surnames in captions or presets.

**Done when**

- [x] Next / Back + step dots in Story mode
- [x] Each step updates caption, map view, era / highlight, and optional panel
- [x] Share link restores story step (`#…&s=N`)
- [x] Deployed

---

### D — Mobile polish ← DONE

Bottom-sheet story, tap targets, chart lightbox on small screens.

**Done when**

- [x] Map-first layout with collapsible bottom sheet (Story peek / Explore expand)
- [x] Larger tap targets; modal near-fullscreen; charts scale to viewport
- [x] Leaflet controls / timeline clear the sheet; map invalidates on sheet toggle
- [x] Deployed

---

### E — Later (highest evidence value)

- WD34 curtailment / accounting (“who shut off when”)
- Live USGS instantaneous values
- Data ETL refresh + fresher `manifest.json`

---

## Working loop

1. Talk to **media-box** agent  
2. Agent builds, `git push` `qasrnexe/basin34-water-transparency`  
3. `deploy-water.sh` → https://water.bnm.farm  

---

## Success criteria

In under five minutes **on a phone**, a new visitor can:

1. See the basin on satellite without a long freeze (Story starts with river/gages — not 7k stars)
2. See the lower river dry in the modern record
3. Open a **ranked list + CSV** of downstream seniors on that dry-reach proxy
4. Share a link that restores the view  

When that works on a phone in a county meeting, the tool is doing its job.

### Phone UX notes (2026-07-21)

- Story steps 1–3: **no POD/well markers** (channel + gages + diversions only)
- Analysis steps: show **matching rights only** (~391 seniors vs ~7k all), harder clustering
- Wells / POU / NWI deferred until needed; charts/tables open via explicit buttons (not auto-modals)
- Throttled mobile test: interactive overlay ~2–3s; step 4 paints ~391 PODs / ~80 cluster icons
