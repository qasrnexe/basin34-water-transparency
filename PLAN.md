# Basin 34 Water Transparency — Story & UX Plan

**Repo:** `qasrnexe/basin34-water-transparency`  
**Live:** https://water.bnm.farm  
**Deploy:** `~/projects/tv-remote/homelab/scripts/deploy-water.sh` on the media box  

**Purpose of this file:** Single source of truth for what we’re building and in what order. Open it in Cursor (phone or laptop), say “do the next phase,” and continue without needing `/plan` or `/goal`.

---

## North star

Build a **public transparency tool** that is a **delight to use on first visit**, and that makes one story unmistakable from public data:

> Senior surface water rights and lower-basin users near Arco (including the Huggins family’s rights near the Quist pump area) sit below a river that routinely goes dry — while upstream and off-corridor development expanded. The channel, gages, rights, and wells should make that pattern legible without requiring a water lawyer.

**Personal anchor (example, not exclusive):** Charles Huggins (deceased) — family rights near Quist / lower Arco. Grandma’s well ran dry recently; City of Arco deepened a well ~500 ft. Use family rights as a clear worked example inside a basin-wide tool.

**Tone:** Neutral, sourced, careful. Describe structure and evidence (priority, location, dry reaches, GW expansion). Do **not** assert illegal conduct. Label analysis lenses as geometric / priority / gage-based proxies, not court findings.

---

## Current state (baseline)

- Static Vite + TypeScript + Leaflet app; ~26MB GeoJSON in `public/data/`.
- Powerful analysis views already exist (senior downstream, transfers, conflicts, conjunctive, river shrink, timeline, permalinks).
- UX problem: **sidebar is dense**; first visit doesn’t lead with the story.
- Basemap defaults to OSM (`osm`), not satellite.
- Data snapshot in `manifest.json`: **2026-06-09**.
- Known data anchors already in extracts:
  - Huggins rights (e.g. Big Lost River **34-13725** and others)
  - Quist Pump diversions
  - Large Telford / related development footprint in Basin 34

---

## Product principles

1. **Story first, Explore second** — new visitors land in Story mode; power users can open Explore.
2. **One question per screen** — each story step changes map + caption; don’t dump every control.
3. **Evidence over accusation** — every strong claim links to a gage, layer, or IDWR field.
4. **Fast enough to feel alive** — first meaningful map paint before all POU data finishes loading.
5. **Shareable** — every story step and preset has a permalink (already partly built).
6. **Mobile-usable** — phone is a first-class target (local politics + family sharing).

---

## Information architecture

### Modes

| Mode | Audience | Chrome |
|---|---|---|
| **Story** (default) | First visit, officials, neighbors, press | Guided steps, short captions, few buttons |
| **Explore** | Researchers / repeat users | Today’s full sidebar (cleaned) |

### Primary URLs

- `https://water.bnm.farm/` — Story default
- Permalink hash — restores story step or explore state (extend existing `permalink.ts`)

### Presets (one-click)

1. Downstream seniors on a dry reach (Arco / Quist area)
2. River shrink: Mackay → Moore → Arco
3. GW boom vs senior surface
4. Potential new-ground transfers
5. Owner example: **Huggins**
6. Whole-basin explore

---

## Phased plan of attack

### Phase 0 — Repo hygiene & working agreement (short)

**Goals**

- This `PLAN.md` committed on `main`.
- Agree: implement on laptop *or* media-box agent; always `git push` then `deploy-water.sh` (or ask media-box agent to deploy).

**Done when**

- [ ] `PLAN.md` is on GitHub `main`
- [ ] Deploy path verified once after a trivial change

---

### Phase 1 — Quick wins (high impact / low risk)

**Goals:** First impression stops being “dense GIS tool.”

1. **Default basemap → satellite** (and Hybrid optional). Update `main.ts` / permalink defaults.
2. **Story / Explore toggle** in the header (persist in permalink + `localStorage`).
3. **Collapse Explore controls** behind the toggle; Story mode shows only:
   - Step rail (or Next/Back)
   - Caption card
   - Preset chips
   - Share + About
4. **About copy** — one paragraph on purpose + sources + “not legal advice” + link to IDWR/WD34.
5. **Visible “Data as of …”** from `manifest.json` in the chrome.

**Done when**

- [ ] Cold load on phone shows satellite + Story chrome (not full sidebar)
- [ ] Explore still exposes prior filters/layers
- [ ] Share link restores mode + basemap
- [ ] Deployed to `water.bnm.farm`

---

### Phase 2 — Guided story (the core product)

**Goals:** A 6–8 step narrative anyone can finish in a few minutes.

Suggested steps (refine copy while building):

| # | Step ID | Map / analysis focus | Caption intent |
|---|---|---|---|
| 1 | `overview` | Basin boundary, mainstem, sinks; satellite | Where we are; Big Lost ends in sinks near Howe |
| 2 | `then-now` | Flow era then vs now (Moore split) | Surface flow often dies near Moore in recent years |
| 3 | `river-shrink` | Open river-shrink lightbox (Mackay→Moore→Arco) | Measured decline / zero-flow years at Arco |
| 4 | `senior-downstream` | Analysis: senior downstream | Oldest surface rights sit downstream on the system |
| 5 | `gw-boom` | Analysis: conjunctive / junior GW | Later GW & development pressure upstream / basin-wide |
| 6 | `new-ground` | Analysis: transfers + new-ground | Water authorized onto ground far from corridor |
| 7 | `arco-quist` | Zoom Quist / Arco lower river; highlight downstream seniors | Lower basin: dry channel vs paper rights |
| 8 | `huggins-example` | Owner highlight Huggins + key WRs (e.g. 34-13725) | Worked example: family rights in this setting |

**UX details**

- Persistent caption card: title, 2–4 sentences, “Sources” links, Next / Back.
- Progress dots; skip to Explore anytime.
- Each step writes permalink (`storyStep=arco-quist`, etc.).
- Optional “Replay story” from About / header.

**Done when**

- [ ] A new user can complete the story without opening Explore
- [ ] Huggins / Quist / Arco step is accurate to the data (spot-check WRs)
- [ ] Captions reviewed for tone (neutral + clear)
- [ ] Deployed

---

### Phase 3 — “Injured / exposed rights” lens (careful naming)

**Goals:** Make the injury pattern queryable without overclaiming.

**Proposed name:** **“Downstream seniors on a dry reach”**  
(Avoid “stolen” / “illegal” in UI.)

**Draft rules (implement as documented, tunable constants):**

- Source: Big Lost River (surface) — not random springs far off-corridor unless explicitly included
- Priority: senior threshold (reuse existing pre-1950 / pre-1970 conventions; pick one and document)
- Location: POD at/below Moore diversion split **or** within X km of Arco/Quist focus area
- Optional emphasis: rights whose POU/POD sits where “now” channel styling is dry

**UI**

- Preset chip + Explore analysis option
- Details panel: count, total cfs, list with zoom links
- Caveat text always visible: proxy based on priority + geography + gage/channel layers

**Huggins shortcut**

- Preset “Example: Huggins rights” → owner highlight + zoom to cluster near Quist/Arco
- List WR numbers in the caption with links to IDWR reports where available

**Done when**

- [ ] Rules documented in-app and in README
- [ ] Huggins example lands correctly
- [ ] Spot-check: known Quist/Telford features behave as expected in neighboring views
- [ ] Deployed

---

### Phase 4 — First-load performance (delight depends on this)

**Goals:** Meaningful map in seconds, not after 26MB.

1. Split load: boundary + mainstem + sinks + gages → PODs/wells → POU last.
2. Loading UI with stage labels (“River & gages…”, “Water rights…”, “Places of use…”).
3. Compress GeoJSON (gzip static files in Caddy) and/or simplify POU for basin zoom.
4. Defer non-critical layers (NWI, canals) until after first interaction or Story step that needs them.

**Done when**

- [ ] On home Wi‑Fi / phone LTE: interactive map & Story step 1 in a few seconds
- [ ] Full data still available by end of load / Explore
- [ ] Deployed

---

### Phase 5 — Mobile UX pass

**Goals:** Usable in a county meeting from a phone.

- Story caption as bottom sheet (thumb-friendly)
- Larger tap targets; simplify cluster popups
- Lightbox charts scroll/zoom safely on small screens
- Test iOS Safari + Android Chrome on `water.bnm.farm`

**Done when**

- [ ] Full story completable on a phone without horizontal chaos
- [ ] Share link opens correctly on phone

---

### Phase 6 — Credibility & local-politics usefulness

**Goals:** Useful beyond the family example.

1. Export filtered table (CSV) for current preset / story step.
2. Stronger citation block (“Data as of”, IDWR/USGS links, methodology blurb).
3. Optional one-pager print/PDF view of a preset (later).
4. Re-run ETL; bump manifest; note Arco municipal well / domestic drought only as *context in About* if we lack citable public GIS — don’t invent layers.

**Roadmap (after UX solid):**

- WD34 curtailment / accounting join (“who was shut off when”) — highest-value evidence layer for injury-over-time
- Live USGS instantaneous values (secondary)

---

## Suggested build order (when you say “start”)

```text
Phase 1 (satellite + Story/Explore) 
  → Phase 2 (guided story, include Huggins/Quist/Arco)
  → Phase 3 (dry-reach seniors lens)
  → Phase 4 (perf)
  → Phase 5 (mobile polish)
  → Phase 6 (export/citations)
```

Do **not** wait for curtailment data to ship Phases 1–3. Those alone change how the tool feels and what it communicates.

---

## Working loop (laptop ↔ media box ↔ phone)

1. Implement on whichever Cursor agent has the repo.
2. `git push` to `qasrnexe/basin34-water-transparency` (`main`).
3. On media box: `~/projects/tv-remote/homelab/scripts/deploy-water.sh`  
   (or tell the **media-box** agent: “deploy water”).
4. Check https://water.bnm.farm/ and mark checkboxes in this file.

**Phone tip:** You don’t need `/plan`. Open this repo (or `tv-remote`) on My Machines → media-box (or laptop) and say:  
“Read `PLAN.md` and implement Phase N.”

---

## Open decisions (resolve while building Phase 2–3)

1. Senior year cutoff for the dry-reach lens: **pre-1950** vs **pre-1970**?
2. Story length: **6 steps** vs **8 steps**?
3. How prominent is the Huggins name on the default story — **worked example** (recommended) vs quieter “owner preset only”?
4. Should Explore remain 100% of today’s controls, or do we permanently retire low-value toggles?

---

## Success criteria (overall)

A neighbor or county official who has never seen the app can, in under five minutes:

1. Understand the basin geography on satellite
2. See that the lower river goes dry in the modern record
3. See senior downstream surface rights in that setting
4. See later/upstream/off-corridor development pressure in the same dataset
5. Optionally open the Huggins example and recognize a concrete local case
6. Share a link that restores that view

When that works on a phone, the tool is doing its job.
