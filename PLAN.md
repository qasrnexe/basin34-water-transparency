# Basin 34 Water Transparency — Plan

**Repo:** `qasrnexe/basin34-water-transparency`  
**Live:** https://water.bnm.farm  
**Deploy:** `~/projects/tv-remote/homelab/scripts/deploy-water.sh` on the media box  

**Purpose:** Single source of truth. On the media-box agent say: “read PLAN.md and do the next build slice.”

---

## North star

A **public accountability / transparency tool** for Water District 34 (Big Lost River) that is:

1. **Fast enough to use** in a meeting (not a 26MB stutter-fest)
2. **Clear enough** that a neighbor can see: lower river goes dry; senior surface rights sit there; later development expanded upstream / off-corridor
3. **Exportable** — ranked tables + CSV, not only a map
4. **Careful** — evidence and methodology, no accusations, **no named private families as featured examples**

> Think “receipts + rankings + map,” not “heavy GIS for its own sake.”

**Tone:** Neutral, sourced. Geometric / priority / gage proxies — not court findings.

---

## Current state (2026-07-21)

- [x] Live at water.bnm.farm; media-box is canonical git home
- [x] Phase 1: satellite default, Story/Explore shell, presets, data-as-of
- [x] **A+B:** staged first load + dry-reach seniors table/CSV
- [x] **C:** guided Story steps (7 geography-only steps)
- [ ] Mobile polish (D)

---

## Build order (adjusted — follow this)

```text
A. Performance (staged load + loading UI)     ← DONE
B. Accountability outputs (dry-reach list + CSV) ← DONE
C. Guided Story steps (short, geography-only) ← DONE
D. Mobile polish                              ← NEXT
E. Later: WD34 curtailment/accounting join
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

### D — Mobile polish ← NEXT

Bottom-sheet story, tap targets, chart lightbox on small screens.

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

In under five minutes, a new visitor can:

1. See the basin on satellite without a long freeze  
2. See the lower river dry in the modern record  
3. Open a **ranked list + CSV** of downstream seniors on that dry-reach proxy  
4. Share a link that restores the view  

When that works on a phone in a county meeting, the tool is doing its job.
