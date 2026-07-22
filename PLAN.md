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
4. **Careful** — evidence and methodology, no accusations; **do not feature private families as the default “example”** in Guide captions. Owner names from IDWR stay in the data, search, tables, and CSV.

> Think “receipts + rankings + map,” not “heavy GIS for its own sake.”

**Tone:** Neutral, sourced. Geometric / priority / gage proxies — not court findings.

---

## UX law (do not break)

1. **One workspace:** Explore is always on. No Story | Explore mode toggle.
2. **Thin Guide:** “Walk the receipts” is a dismissible coach that flies the map and opens inspector receipts — not a second control panel (no duplicate basemap / then-now / jump grid).
3. **Map + inspector only:** Feature detail and receipts (tables, charts, gages) open in `#details`. **No full-screen lightbox** for product flows.
4. **Three primary receipts:** Downstream seniors · Water moved farther · River shrink. Everything else is Advanced.
5. **Zoom completes the sacred path:** CSV/table Zoom selects the right, paints purple POD↔POU lines, keeps the map visible, offers **← Back to list**.
6. **Close model:** Esc and ✕ always close the inspector. Map click clears selection but does not dismiss a pinned receipt.

**Product rule:** at most **three primary insight receipts**. Do not add a seventh exclusive `HighlightMode`.

---

## Current state (2026-07-22)

- [x] F0 data refresh (`asOf` 2026-07-22)
- [x] F1–F5 receipts roadmap (moved farther CSV, sidebar nest, story trim → now Guide, live USGS CFS)
- [x] Guide not dual-mode + inspector unification (this pass)
- [ ] Curtailment / “who shut off when” (hardest data — later)

---

## Build order (recent)

```text
F0–F5 …                                          ← DONE
G1. Drop Story mode; thin Guide + inspector UX   ← DONE
```

---

### Guide (replaces Story mode)

- Header: **Walk the receipts** starts the coach  
- Five steps: ★ → then/now → river shrink → dry-reach → moved farther  
- Coach pinned in Explore (sheet peek on mobile when active)  
- Receipts open in the wide/tall inspector — map stays visible  

### Inspector

- Wide desktop rail for tables/charts; taller bottom sheet on mobile for receipts  
- Sticky header with Close  
- Live USGS CFS + annual chart for gages (inspector, not modal)  

### F4 evidence note (unchanged)

No clean public east/west designation polygons — lined-canal claim stays Guide/satellite narrative. Geometric off-corridor ≠ “last 10–15 years.”

---

## Working loop

1. Stay in `basin34-water-transparency`; rebuild `dist/` only  
2. Do not checkout other branches in `tv-remote` or recreate Caddy from a stale tree  
3. After each slice: commit, push, `npm run build`

## Success bar

In &lt;5 minutes on a phone: Walk the receipts → tap ★ → purple links; see dry channel; open seniors CSV and moved-farther CSV in the inspector with the map still visible; Esc closes the inspector; see data-as-of chip.
