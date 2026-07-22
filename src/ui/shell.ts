/** Static app shell. Control wiring lives in sidebar.ts / story.ts (Guide). */
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
        <button type="button" id="guide-start-btn" class="header-btn" title="Walk the three receipts on the map">Walk the receipts</button>
        <button id="share-btn" class="header-btn" title="Copy a link to the current view">Share view</button>
        <button id="info-btn" class="header-btn">About</button>
      </div>
    </header>

    <main>
      <aside id="sidebar">
        <button type="button" id="sheet-handle" class="sheet-handle" aria-expanded="false" aria-controls="sidebar" title="Expand or collapse panel">
          <span class="sheet-handle-bar" aria-hidden="true"></span>
          <span class="sheet-handle-label">Tools</span>
        </button>

        <section id="explore-panel" class="mode-panel">
          <div id="guide-coach" class="guide-coach hidden" aria-live="polite">
            <div class="guide-coach-top">
              <p class="story-kicker" id="guide-kicker">Step 1</p>
              <button type="button" id="guide-dismiss" class="guide-dismiss" title="Dismiss guide">✕</button>
            </div>
            <h2 class="story-title" id="guide-title">Guide</h2>
            <p class="story-body" id="guide-body"></p>
            <div class="story-nav">
              <button type="button" id="guide-prev" class="story-nav-btn" disabled>← Back</button>
              <span id="guide-step-counter" class="story-step-counter">1 / 5</span>
              <button type="button" id="guide-next" class="story-nav-btn">Next →</button>
            </div>
            <button type="button" id="guide-receipt-btn" class="story-panel-btn hidden">Open receipt</button>
            <div id="guide-dots" class="story-dots" aria-label="Guide steps"></div>
          </div>

          <p class="explore-hint">Tap a ★ anytime for purple diversion↔field lines.</p>

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

          <h2>Basemap</h2>
          <div class="flex gap-1 mb-1" id="basemap-switcher">
            <button type="button" class="basemap-btn" data-basemap="osm">Map</button>
            <button type="button" class="basemap-btn active" data-basemap="satellite">Satellite</button>
            <button type="button" class="basemap-btn" data-basemap="hybrid">Hybrid</button>
          </div>

          <h2>Layers</h2>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-pods" checked /> <span>PODs / water rights ★</span></label></div>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-wells" checked /> <span>Wells ●</span></label></div>
          <div class="ml-4 -mt-1 mb-1 text-[10px] leading-tight">
            <label class="block"><input type="checkbox" id="well-hide-domestic" checked> Hide domestic &amp; unlabeled</label>
            <label class="block"><input type="checkbox" id="well-focus-irrigation"> Irrigation / commercial only</label>
          </div>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-flowExtent" checked /> <span>River channel &amp; sinks (NHD)</span></label></div>
          <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-hydro" checked /> <span>Canals &amp; pipelines (NHD)</span></label></div>

          <h2>Insight receipts</h2>
          <div class="insight-grid">
            <button type="button" id="dry-reach-btn" class="insight-btn">Downstream seniors + CSV</button>
            <button type="button" id="moved-farther-btn" class="insight-btn">Water moved farther + CSV</button>
            <button type="button" id="river-shrink-btn" class="insight-btn">River shrink chart</button>
          </div>
          <label class="block text-xs mt-2 mb-0.5">Map emphasis</label>
          <select id="highlight-mode" class="w-full text-xs border border-[var(--border)] rounded px-1 py-0.5 mb-1">
            <optgroup label="Primary">
              <option value="none">None — show everything</option>
              <option value="senior-downstream">Senior rights downstream (pre-1950)</option>
              <option value="transfers">Water moved farther (POD far from POU)</option>
              <option value="conjunctive">Conjunctive: GW boom vs. senior surface</option>
            </optgroup>
            <optgroup label="Advanced analyses">
              <option value="junior-dev">Junior development (post-1980, high rate)</option>
              <option value="conflict">Potential conflicts (senior down vs. new up)</option>
              <option value="high-rate">High diversion rates</option>
            </optgroup>
          </select>
          <div id="mode-hint" class="text-[10px] text-[var(--text-muted)] leading-tight mb-1"></div>

          <h2>Legend</h2>
          <div id="main-legend" class="text-xs p-2 border border-[var(--border)] rounded bg-[var(--panel)] mb-2 min-h-[48px]"></div>

          <details id="explore-advanced" class="explore-advanced">
            <summary>Advanced</summary>
            <div class="explore-advanced-body">
              <button type="button" id="conjunctive-btn" class="insight-btn" style="width:100%;margin-bottom:0.35rem">GW boom vs seniors</button>
              <div class="text-xs mb-1">
                High-rate threshold:
                <input type="number" id="high-rate-threshold" value="5" style="width:44px;font-size:0.7rem"> cfs
              </div>
              <label class="block text-xs mb-1">Focus by reach (at/downstream):</label>
              <select id="reach-select" class="text-xs w-full mb-1 border border-[var(--border)] rounded px-1 py-0.5">
                <option value="">— Whole basin —</option>
              </select>
              <label class="block text-xs"><input type="checkbox" id="place-of-use-mode" checked> Show all Place of Use fills</label>
              <div class="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5 mb-2">
                Click a POD ★ anytime for purple field outlines + dashed diversion lines (works even if this is off).
              </div>

              <button id="appropriation-btn" class="text-xs px-2 py-1 mt-1 w-full border border-[var(--border)] rounded hover:bg-[var(--border)]">
                Appropriation vs. supply over time
              </button>
              <button id="timeline-btn" class="text-xs px-2 py-1 mt-1 w-full border border-[var(--border)] rounded hover:bg-[var(--border)]">
                Development through time
              </button>

              <h3 class="adv-h">More layers</h3>
              <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-boundary" checked /> <span>Basin boundary</span></label></div>
              <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-riparian" checked /> <span>Riparian areas (FWS NWI)</span></label></div>
              <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-diversions" checked /> <span>Named diversions ◆ (≥5 cfs)</span></label></div>
              <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-gages" checked /> <span>Stream gages</span></label></div>
              <div class="layer-item"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="layer-reaches" checked /> <span>Admin reaches</span></label></div>

              <h3 class="adv-h">POD filters</h3>
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

              <h3 class="adv-h">Then vs now: where the river ends</h3>
              <div class="text-xs filter-group">
                <label class="flex items-center gap-1"><input type="radio" name="era" value="historical" checked /> Then — river reached the sinks near Howe</label>
                <label class="flex items-center gap-1"><input type="radio" name="era" value="recent" /> Now — usually dry below Moore</label>
              </div>
              <div class="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
                Split at the Moore diversion (USGS 13132100). Click gages for live CFS + full records.
              </div>

              <button id="reset-all" class="text-xs px-2 py-1 mt-2 w-full border border-[var(--border)] rounded hover:bg-[var(--border)]">Reset all filters &amp; highlights</button>
            </div>
          </details>

          <div class="disclaimer mt-2 text-[9px]">
            Neutral public data view (IDWR + USGS). Not legal advice — use official sources for decisions.
          </div>
        </section>
      </aside>

      <div id="map-wrap">
        <div id="map"></div>
        <div id="map-hint" class="map-hint">
          <strong>Start here:</strong> zoom in, then tap a ★ water-right point.
          Purple lines connect that diversion to its fields.
        </div>
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
        <div class="details-header">
          <span id="details-heading" class="details-heading">Inspector</span>
          <button id="close-details" class="text-xs" type="button">✕ Close</button>
        </div>
        <div id="details-content">
          <p class="text-[var(--text-muted)]">Click a POD ★, well ●, field (POU polygon), gage or reach for details and source links.</p>
        </div>
      </aside>
    </main>

    <div class="disclaimer">
      Sources: IDWR (PODs / Wells / POU), USGS NWIS, NHD, FWS NWI. Neutral public-data view only. Not legal advice.
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
