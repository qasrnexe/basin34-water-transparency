/** Static app shell. Control wiring lives in sidebar.ts. */
export function renderShell() {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <header>
      <div>
        <h1>Basin 34 Water Transparency</h1>
        <div class="subtitle">Big Lost River Basin (Water District 34) • Idaho • Public Data Viewer</div>
        <div id="data-as-of" class="data-as-of">Loading data date…</div>
      </div>
      <div class="header-actions">
        <div id="mode-toggle" class="mode-toggle" role="group" aria-label="App mode">
          <button type="button" id="mode-story" class="mode-btn active" data-mode="story">Story</button>
          <button type="button" id="mode-explore" class="mode-btn" data-mode="explore">Explore</button>
        </div>
        <button id="share-btn" class="header-btn" title="Copy a link to the current view">Share view</button>
        <button id="info-btn" class="header-btn">About</button>
      </div>
    </header>

    <main>
      <aside id="sidebar">
        <section id="story-panel" class="mode-panel">
          <div class="story-card">
            <p class="story-kicker">Why this map</p>
            <h2 class="story-title">A river that runs dry — and rights that remain</h2>
            <p class="story-body">
              This public viewer shows Water District 34 data so anyone can see how priority,
              place, and measured flow fit together on the Big Lost River — especially on the
              lower river near Arco, where the channel often goes dry while paper rights remain.
            </p>
            <p class="story-body story-muted">
              Guided steps (Then vs now → river shrink → seniors → development) are next.
              For now, use the presets below or switch to <strong>Explore</strong> for full controls.
            </p>
          </div>

          <h2>Start here</h2>
          <div class="preset-grid">
            <button type="button" class="preset-btn" data-preset="dry-reach">Dry-reach seniors + CSV</button>
            <button type="button" class="preset-btn" data-preset="river-shrink">River shrink</button>
            <button type="button" class="preset-btn" data-preset="senior">Senior downstream</button>
            <button type="button" class="preset-btn" data-preset="conjunctive">GW boom vs seniors</button>
            <button type="button" class="preset-btn" data-preset="transfers">Potential transfers</button>
            <button type="button" class="preset-btn" data-preset="arco">Lower river / Arco</button>
            <button type="button" class="preset-btn" data-preset="then-now">Then vs now</button>
          </div>

          <h2>Then vs now</h2>
          <div class="preset-grid era-presets">
            <button type="button" class="preset-btn era-btn active" data-era="historical">Then — to the sinks</button>
            <button type="button" class="preset-btn era-btn" data-era="recent">Now — dry below Moore</button>
          </div>

          <h2>Basemap</h2>
          <div class="flex gap-1 mb-1" id="basemap-switcher-story">
            <button type="button" class="basemap-btn" data-basemap="osm">Map</button>
            <button type="button" class="basemap-btn active" data-basemap="satellite">Satellite</button>
            <button type="button" class="basemap-btn" data-basemap="hybrid">Hybrid</button>
          </div>

          <button type="button" id="open-explore-btn" class="text-xs px-2 py-1 mt-2 w-full border border-[var(--border)] rounded hover:bg-[var(--border)]">
            Open full Explore controls →
          </button>
        </section>

        <section id="explore-panel" class="mode-panel hidden">
          <h2>Analysis view</h2>
          <select id="highlight-mode" class="w-full text-xs border border-[var(--border)] rounded px-1 py-0.5 mb-1">
            <option value="none">None — show everything</option>
            <option value="senior-downstream">Senior rights downstream (pre-1950)</option>
            <option value="junior-dev">Junior development (post-1980, high rate)</option>
            <option value="transfers">Potential transfers (POD far from POU)</option>
            <option value="conflict">Potential conflicts (senior down vs. new up)</option>
            <option value="conjunctive">Conjunctive: GW boom vs. senior surface</option>
            <option value="high-rate">High diversion rates</option>
          </select>
          <div id="mode-hint" class="text-[10px] text-[var(--text-muted)] leading-tight mb-1"></div>
          <div class="text-xs mb-1">
            High-rate threshold:
            <input type="number" id="high-rate-threshold" value="5" style="width:44px;font-size:0.7rem"> cfs
          </div>
          <label class="block text-xs mb-1">Focus by reach (at/downstream):</label>
          <select id="reach-select" class="text-xs w-full mb-1 border border-[var(--border)] rounded px-1 py-0.5">
            <option value="">— Whole basin —</option>
          </select>
          <label class="block text-xs"><input type="checkbox" id="place-of-use-mode" checked> Show Place of Use polygons</label>
          <div class="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
            Click a field (POU), POD ★, or gage for details. Esc or map background clears selection.
          </div>
          <button id="dry-reach-btn" class="text-xs px-2 py-1 mt-1 w-full border border-[var(--border)] rounded hover:bg-[var(--border)]">
            Downstream seniors on a dry reach + CSV
          </button>
          <button id="appropriation-btn" class="text-xs px-2 py-1 mt-1 w-full border border-[var(--border)] rounded hover:bg-[var(--border)]">
            Appropriation vs. supply over time
          </button>
          <button id="river-shrink-btn" class="text-xs px-2 py-1 mt-1 w-full border border-[var(--border)] rounded hover:bg-[var(--border)]">
            River shrink: Mackay → Moore → Arco
          </button>
          <button id="timeline-btn" class="text-xs px-2 py-1 mt-1 w-full border border-[var(--border)] rounded hover:bg-[var(--border)]">
            Development through time
          </button>

          <h2>Owner search</h2>
          <input id="search" type="text" placeholder="Owner name (partial match)…"
            class="w-full border border-[var(--border)] rounded px-2 py-0.5 text-xs mb-0.5" />
          <div id="owner-search-results" class="text-[10px] max-h-24 overflow-auto border border-[var(--border)] rounded p-0.5 mb-0.5 hidden bg-[var(--panel)]"></div>
          <div id="owner-summary" class="mt-0.5 p-1 bg-[var(--panel)] border border-[var(--border)] rounded text-[10px] hidden">
            <div class="flex justify-between items-center mb-0.5">
              <strong id="owner-name" class="truncate text-xs"></strong>
              <button id="clear-owner-highlight" class="text-[var(--accent)] text-[9px] underline">Clear</button>
            </div>
            <div id="owner-stats" class="text-[9px] leading-tight"></div>
          </div>

          <h2>Legend</h2>
          <div id="main-legend" class="text-xs p-2 border border-[var(--border)] rounded bg-[var(--panel)] mb-2 min-h-[48px]"></div>

          <h2>Layers</h2>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-pods" checked /> <span>PODs / water rights ★</span></label></div>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-wells" checked /> <span>Wells ●</span></label></div>
          <div class="ml-4 -mt-1 mb-1 text-[10px] leading-tight">
            <label class="block"><input type="checkbox" id="well-hide-domestic" checked> Hide domestic &amp; unlabeled</label>
            <label class="block"><input type="checkbox" id="well-focus-irrigation"> Irrigation / commercial only</label>
          </div>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-boundary" checked /> <span>Basin boundary</span></label></div>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-riparian" checked /> <span>Riparian areas (FWS NWI)</span></label></div>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-hydro" checked /> <span>Canals &amp; pipelines (NHD)</span></label></div>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-diversions" checked /> <span>Named diversions ◆ (≥5 cfs)</span></label></div>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-gages" checked /> <span>Stream gages</span></label></div>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-flowExtent" checked /> <span>River channel &amp; sinks (NHD)</span></label></div>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-reaches" checked /> <span>Admin reaches</span></label></div>

          <h2>POD filters</h2>
          <div class="text-xs" style="line-height:1.4">
            <label>Color by:
              <select id="pod-color-mode" class="text-xs border border-[var(--border)] rounded">
                <option value="source">Source (GW / surface)</option>
                <option value="priority">Priority year (seniority)</option>
              </select>
            </label><br>
            <label><input type="checkbox" id="pod-filter-gw" checked> Groundwater</label>
            <label class="ml-2"><input type="checkbox" id="pod-filter-surf" checked> Surface</label><br>
            <span class="font-medium">Eras:</span>
            <label class="ml-1"><input type="checkbox" id="era-pre1950" checked> &lt;1950</label>
            <label class="ml-1"><input type="checkbox" id="era-mid" checked> 1950–2000</label>
            <label class="ml-1"><input type="checkbox" id="era-post2000" checked> &gt;2000</label><br>
            Years: <input type="number" id="pod-min-year" value="1800" style="width:52px;font-size:0.7rem"> –
            <input type="number" id="pod-max-year" value="2026" style="width:52px;font-size:0.7rem">
          </div>

          <h2>Then vs now: where the river ends</h2>
          <div class="text-xs filter-group">
            <label class="flex items-center gap-1"><input type="radio" name="era" value="historical" checked /> Then — river reached the sinks near Howe</label>
            <label class="flex items-center gap-1"><input type="radio" name="era" value="recent" /> Now — usually dry below Moore</label>
          </div>
          <div class="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
            Split at the Moore diversion (USGS 13132100). Click gages for full flow records.
          </div>

          <h2>Basemap</h2>
          <div class="flex gap-1 mb-1" id="basemap-switcher">
            <button type="button" class="basemap-btn" data-basemap="osm">Map</button>
            <button type="button" class="basemap-btn active" data-basemap="satellite">Satellite</button>
            <button type="button" class="basemap-btn" data-basemap="hybrid">Hybrid</button>
          </div>

          <button id="reset-all" class="text-xs px-2 py-1 mt-2 w-full border border-[var(--border)] rounded hover:bg-[var(--border)]">Reset all filters &amp; highlights</button>

          <div class="disclaimer mt-2 text-[9px]">
            Neutral public data view (IDWR + USGS). Not legal advice — use official sources for decisions.
          </div>
        </section>
      </aside>

      <div id="map-wrap">
        <div id="map"></div>
        <div id="selection-banner" class="hidden">
          <span id="selection-text"></span>
          <button id="selection-clear" title="Clear selection (Esc)">✕ clear</button>
        </div>
        <div id="timeline-bar" class="hidden">
          <div id="timeline-chart-wrap"></div>
          <div class="timeline-controls">
            <button id="timeline-play" title="Play / pause">▶</button>
            <input type="range" id="timeline-slider" min="1880" max="2026" value="2026" step="1">
            <div id="timeline-year">2026</div>
            <div id="timeline-stats"></div>
            <button id="timeline-close" title="Close timeline">✕</button>
          </div>
          <div class="timeline-hint">Rights by priority year + wells by construction year, accumulating through time.</div>
        </div>
      </div>

      <aside id="details">
        <button id="close-details" class="text-xs float-right">✕ Close</button>
        <div id="details-content">
          <p class="text-[var(--text-muted)]">Click a POD ★, well ●, field (POU polygon), gage or reach for details and source links.</p>
        </div>
      </aside>
    </main>

    <div class="disclaimer">
      Sources: IDWR (PODs / Wells / POU), USGS NWIS, NHD, FWS NWI. Neutral public-data view only. Not legal advice.
    </div>

    <div id="modal-backdrop" class="hidden">
      <div id="modal" role="dialog" aria-modal="true">
        <button id="modal-close" title="Close (Esc)">✕</button>
        <div id="modal-content"></div>
      </div>
    </div>

    <div id="load-overlay">
      <div class="load-card">
        <div class="load-title">Basin 34</div>
        <div id="load-status">Starting…</div>
        <div class="load-bar"><div id="load-bar-fill"></div></div>
      </div>
    </div>
  `
}
