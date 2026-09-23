// ============================================================
// MULTI21 — App Controller
// ============================================================

let state = null;
let currentTab = "dashboard";
let raceCtx = null; // holds live race sim data during a race weekend

const root = document.getElementById("root");

function init() {
  const saved = GameState.load();
  if (saved) {
    state = saved;
    renderShell();
  } else {
    renderTeamSelect();
  }
}

// ---------------- TEAM SELECT ----------------

function renderTeamSelect() {
  const teams = Object.values(STARTING_TEAMS);
  root.innerHTML = `
    <div class="select-screen">
      <div class="select-header">
        <div class="select-eyebrow">Season 1 · Round 1</div>
        <h1>MULTI21</h1>
        <p>Take charge of a Formula 1 team from the back of the grid. Four teams open their doors to a new principal.</p>
      </div>
      <div class="team-grid">
        ${teams.map(t => `
          <button class="team-card" data-team="${t.id}" style="--team-color:${t.color}">
            <div class="team-card-pos">P${t.startingPos}</div>
            <div class="team-card-name">${t.name}</div>
            <div class="team-card-full">${t.fullName}</div>
            <div class="team-card-blurb">${t.blurb}</div>
            <div class="team-card-drivers">
              ${t.drivers.map(d => `<span>${d.name}</span>`).join("")}
            </div>
            <div class="team-card-budget">Budget: $${(t.budget / 1e6).toFixed(0)}M</div>
          </button>
        `).join("")}
      </div>
    </div>
  `;
  root.querySelectorAll(".team-card").forEach(btn => {
    btn.addEventListener("click", () => {
      state = GameState.newGame(btn.dataset.team);
      GameState.save(state);
      renderShell();
    });
  });
}

// ---------------- SHELL / TABS ----------------

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "raceweekend", label: "Race Weekend" },
  { id: "emails", label: "Emails" },
  { id: "garage", label: "Garage" },
  { id: "standings", label: "Standings" },
  { id: "finances", label: "Finances" },
  { id: "career", label: "Career" }
];

function renderShell() {
  const team = STARTING_TEAMS[state.teamId];
  const race = CALENDAR[state.round - 1];
  const pendingCount = state.emails.filter(e => !e.read && !e.resolved).length;

  root.innerHTML = `
    <div class="shell" style="--team-color:${team.color}">
      <div class="topstrip">
        <div class="topstrip-team">
          <span class="topstrip-dot"></span>
          <span>${team.name}</span>
        </div>
        <div class="topstrip-mid">Season ${state.season} · Round ${state.round}/23 · ${race.name}</div>
        <div class="topstrip-right">
          <span>$${(state.budget / 1e6).toFixed(1)}M</span>
          <span class="topstrip-sep">·</span>
          <span>Rep ${state.reputation}</span>
        </div>
      </div>
      <div class="shell-body">
        <div class="tabrail">
          ${TABS.map(t => `
            <button class="tabbtn ${t.id === currentTab ? "active" : ""}" data-tab="${t.id}">
              ${t.label}
              ${t.id === "emails" && pendingCount > 0 ? `<span class="badge">${pendingCount}</span>` : ""}
            </button>
          `).join("")}
        </div>
        <div class="tabcontent" id="tabcontent"></div>
      </div>
    </div>
  `;

  root.querySelectorAll(".tabbtn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentTab = btn.dataset.tab;
      renderShell();
    });
  });

  renderTabContent();
}

function renderTabContent() {
  const el = document.getElementById("tabcontent");
  switch (currentTab) {
    case "dashboard": return renderDashboard(el);
    case "raceweekend": return renderRaceWeekendTab(el);
    case "emails": return renderEmails(el);
    case "garage": return renderGarage(el);
    case "standings": return renderStandings(el);
    case "finances": return renderFinances(el);
    case "career": return renderCareer(el);
  }
}

// ---------------- DASHBOARD ----------------

function renderDashboard(el) {
  const race = CALENDAR[state.round - 1];
  const pending = state.emails.filter(e => !e.read && !e.resolved);
  const recentHistory = state.history.slice(-4).reverse();

  el.innerHTML = `
    <div class="dash-grid">
      <div class="card card-next-race">
        <div class="card-label">Next race</div>
        <div class="card-big">${race.name}</div>
        <div class="card-sub">${race.location} · ${race.laps} laps</div>
        <button class="btn-primary" id="btn-advance">Advance</button>
      </div>
      <div class="card">
        <div class="card-label">Pending decisions</div>
        <div class="card-big">${pending.length}</div>
        <div class="card-sub">${pending.length ? "Check your inbox" : "All clear"}</div>
      </div>
      <div class="card">
        <div class="card-label">Board confidence</div>
        <div class="card-big">${state.boardConfidence}<span class="card-unit">/100</span></div>
        <div class="meter"><div class="meter-fill" style="width:${state.boardConfidence}%"></div></div>
      </div>
      <div class="card card-wide">
        <div class="card-label">Recent activity</div>
        <ul class="activity-list">
          ${recentHistory.length ? recentHistory.map(h => `<li>${h.text}</li>`).join("") : `<li class="muted">Nothing yet this season.</li>`}
        </ul>
      </div>
    </div>
  `;

  document.getElementById("btn-advance").addEventListener("click", advanceTime);
}

function advanceTime() {
  // If a race is due, jump straight into race weekend
  state.day += 1;

  // roll for an email event
  if (Math.random() < 0.6) {
    state.emails.unshift(GameState.generateRandomEmail(state));
  }
  GameState.expireOverdueEmails(state);

  // every ~4-6 advances, trigger the race
  if (state.day % 5 === 0 || state.day === 3) {
    GameState.save(state);
    currentTab = "raceweekend";
    renderShell();
    return;
  }

  GameState.save(state);
  renderShell();
}

// ---------------- EMAILS ----------------

function renderEmails(el) {
  const sorted = [...state.emails].sort((a, b) => (a.resolved === b.resolved) ? 0 : a.resolved ? 1 : -1);
  el.innerHTML = `
    <div class="email-list">
      ${sorted.length === 0 ? `<div class="empty">No emails yet.</div>` : sorted.map(email => `
        <div class="email ${email.read ? "read" : "unread"} ${email.resolved ? "resolved" : ""}" data-id="${email.id}">
          <div class="email-top">
            <span class="email-from">${email.from}</span>
            ${email.type === "actionable" && !email.resolved ? `<span class="tag tag-action">Action needed</span>` : ""}
            ${email.expired ? `<span class="tag tag-expired">Expired</span>` : ""}
          </div>
          <div class="email-subject">${email.subject}</div>
          <div class="email-body">${email.body}</div>
          ${renderEmailActions(email)}
        </div>
      `).join("")}
    </div>
  `;

  el.querySelectorAll(".email").forEach(div => {
    div.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const email = state.emails.find(x => x.id === div.dataset.id);
      email.read = true;
      GameState.save(state);
      renderShell();
    });
  });

  el.querySelectorAll("[data-accept]").forEach(btn => {
    btn.addEventListener("click", () => handleEmailAction(btn.dataset.accept, true));
  });
  el.querySelectorAll("[data-decline]").forEach(btn => {
    btn.addEventListener("click", () => handleEmailAction(btn.dataset.decline, false));
  });
  el.querySelectorAll("[data-hire]").forEach(btn => {
    btn.addEventListener("click", () => handleEngineerHire(btn.dataset.hire, btn.dataset.tier));
  });
}

function renderEmailActions(email) {
  if (email.resolved || email.type !== "actionable") return "";
  if (email.action === "sponsor") {
    return `
      <div class="email-actions">
        <button class="btn-small btn-accept" data-accept="${email.id}">Accept deal</button>
        <button class="btn-small btn-decline" data-decline="${email.id}">Decline</button>
      </div>
    `;
  }
  if (email.action === "engineer") {
    const [cheap, premium] = email.payload.candidates;
    return `
      <div class="email-actions">
        <button class="btn-small" data-hire="${email.id}" data-tier="value">Hire ${cheap.name} — $${(cheap.cost / 1e6).toFixed(1)}M</button>
        <button class="btn-small" data-hire="${email.id}" data-tier="premium">Hire ${premium.name} — $${(premium.cost / 1e6).toFixed(1)}M</button>
        <button class="btn-small btn-decline" data-decline="${email.id}">Pass</button>
      </div>
    `;
  }
  if (email.action === "garage") {
    return `<div class="email-actions"><button class="btn-small" onclick="currentTab='garage'; renderShell();">Go to Garage</button></div>`;
  }
  return "";
}

function handleEmailAction(id, accepted) {
  const email = state.emails.find(x => x.id === id);
  if (!email) return;
  email.resolved = true;
  email.read = true;

  if (email.action === "sponsor" && accepted) {
    state.sponsors.push(email.payload);
    state.budget += email.payload.baseValue;
    state.history.push({ day: state.day, text: `Signed a ${email.payload.tier} sponsorship deal with ${email.payload.name}.` });
  } else if (email.action === "sponsor" && !accepted) {
    state.history.push({ day: state.day, text: `Declined sponsorship offer from ${email.from}.` });
  } else if (email.action === "engineer" && !accepted) {
    state.history.push({ day: state.day, text: `Passed on both engineer candidates for ${email.payload.department}.` });
  }

  GameState.save(state);
  renderShell();
}

function handleEngineerHire(emailId, tier) {
  const email = state.emails.find(x => x.id === emailId);
  if (!email) return;
  const candidate = email.payload.candidates.find(c => c.tier === tier);
  if (state.budget < candidate.cost) {
    alert("Not enough budget for this hire.");
    return;
  }
  state.budget -= candidate.cost;
  state.engineers[email.payload.department] = { ...candidate, hired: true, trust: 60 };
  email.resolved = true;
  email.read = true;
  state.history.push({ day: state.day, text: `Hired ${candidate.name} as ${email.payload.department} engineer.` });
  GameState.save(state);
  renderShell();
}

// ---------------- GARAGE ----------------

function renderGarage(el) {
  const team = STARTING_TEAMS[state.teamId];
  el.innerHTML = `
    <div class="garage">
      <div class="garage-section">
        <div class="section-title">Drivers</div>
        <div class="driver-cards">
          ${team.drivers.map(d => `
            <div class="driver-card">
              <div class="driver-name">${d.name}</div>
              <div class="stat-row"><span>Skill</span><div class="meter"><div class="meter-fill" style="width:${d.skill}%"></div></div></div>
              <div class="stat-row"><span>Consistency</span><div class="meter"><div class="meter-fill" style="width:${d.consistency}%"></div></div></div>
              <div class="stat-row"><span>Morale</span><div class="meter"><div class="meter-fill" style="width:${d.morale}%"></div></div></div>
              <div class="driver-contract">Contract: ${d.contractYears} yr(s) remaining</div>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="garage-section">
        <div class="section-title">Engineering departments</div>
        <div class="engineer-cards">
          ${ENGINEER_DEPARTMENTS.map(dep => {
            const eng = state.engineers[dep];
            return `
              <div class="engineer-card">
                <div class="engineer-dept">${dep}</div>
                <div class="engineer-name">${eng.name}</div>
                <div class="stat-row"><span>Skill</span><div class="meter"><div class="meter-fill" style="width:${eng.skill}%"></div></div></div>
                <div class="stat-row"><span>Trust</span><div class="meter"><div class="meter-fill" style="width:${eng.trust}%"></div></div></div>
                <div class="engineer-tier tier-${eng.tier}">${eng.tier === "premium" ? "Premium" : "Value"}</div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;
}

// ---------------- STANDINGS ----------------

function renderStandings(el) {
  const rows = Object.entries(state.standings)
    .sort((a, b) => b[1].points - a[1].points)
    .map(([id, s], i) => `
      <tr class="${id === state.teamId ? "highlight" : ""}">
        <td>${i + 1}</td><td>${s.name}</td><td>${s.points}</td>
      </tr>
    `).join("");

  el.innerHTML = `
    <div class="standings">
      <div class="section-title">Constructors' Championship</div>
      <table class="standings-table">
        <thead><tr><th>Pos</th><th>Team</th><th>Points</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="section-title" style="margin-top:24px">Calendar</div>
      <table class="standings-table">
        <thead><tr><th>Rd</th><th>Race</th><th>Location</th></tr></thead>
        <tbody>
          ${CALENDAR.map(r => `
            <tr class="${r.round === state.round ? "highlight" : ""} ${r.round < state.round ? "muted" : ""}">
              <td>${r.round}</td><td>${r.name}</td><td>${r.location}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ---------------- FINANCES ----------------

function renderFinances(el) {
  el.innerHTML = `
    <div class="finances">
      <div class="card">
        <div class="card-label">Available budget</div>
        <div class="card-big">$${(state.budget / 1e6).toFixed(1)}M</div>
      </div>
      <div class="garage-section">
        <div class="section-title">Sponsors</div>
        ${state.sponsors.length === 0 ? `<div class="empty">No sponsors signed yet.</div>` : `
          <table class="standings-table">
            <thead><tr><th>Sponsor</th><th>Tier</th><th>Base value</th><th>Bonus/point</th></tr></thead>
            <tbody>
              ${state.sponsors.map(s => `
                <tr><td>${s.name}</td><td>${s.tier}</td><td>$${(s.baseValue / 1e6).toFixed(1)}M</td><td>$${s.bonusPerPoint.toLocaleString()}</td></tr>
              `).join("")}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;
}

// ---------------- CAREER ----------------

function renderCareer(el) {
  el.innerHTML = `
    <div class="career">
      <div class="card">
        <div class="card-label">Board confidence</div>
        <div class="card-big">${state.boardConfidence}<span class="card-unit">/100</span></div>
        <div class="meter"><div class="meter-fill" style="width:${state.boardConfidence}%"></div></div>
      </div>
      <div class="card">
        <div class="card-label">Reputation</div>
        <div class="card-big">${state.reputation}<span class="card-unit">/100</span></div>
        <div class="meter"><div class="meter-fill" style="width:${state.reputation}%"></div></div>
      </div>
      <div class="garage-section">
        <div class="section-title">Job offers</div>
        <div class="empty">No offers yet — build your reputation to attract interest from other teams.</div>
      </div>
      <div class="garage-section">
        <div class="section-title">Save data</div>
        <button class="btn-small" id="btn-export">Export save</button>
        <label class="btn-small" style="cursor:pointer">
          Import save
          <input type="file" id="import-file" accept="application/json" style="display:none">
        </label>
      </div>
    </div>
  `;
  document.getElementById("btn-export").addEventListener("click", () => GameState.exportSave(state));
  document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    GameState.importSave(file, (loaded) => {
      if (loaded) {
        state = loaded;
        GameState.save(state);
        renderShell();
      } else {
        alert("Could not read that save file.");
      }
    });
  });
}

// ---------------- RACE WEEKEND ----------------

function renderRaceWeekendTab(el) {
  const race = CALENDAR[state.round - 1];

  if (!raceCtx) {
    raceCtx = { phase: "preview" };
  }

  if (raceCtx.phase === "preview") return renderRacePreview(el, race);
  if (raceCtx.phase === "precomment") return renderComment(el, "pre");
  if (raceCtx.phase === "qualifying") return renderQualifying(el, race);
  if (raceCtx.phase === "race") return renderRaceTicker(el, race);
  if (raceCtx.phase === "postcomment") return renderComment(el, "post");
  if (raceCtx.phase === "results") return renderRaceResults(el, race);
}

function renderRacePreview(el, race) {
  const team = STARTING_TEAMS[state.teamId];
  el.innerHTML = `
    <div class="race-preview">
      <div class="section-title">${race.name}</div>
      <div class="card-sub">${race.location} · ${race.laps} laps · ${race.corners} corners</div>
      <p class="muted" style="margin-top:16px">Your drivers, ${team.drivers.map(d => d.name).join(" and ")}, head into this weekend for ${team.name}.</p>
      <button class="btn-primary" id="btn-start-weekend">Begin race weekend</button>
    </div>
  `;
  document.getElementById("btn-start-weekend").addEventListener("click", () => {
    raceCtx.phase = "precomment";
    renderShell();
  });
}

const PRE_COMMENTS = [
  { id: "confident", label: "Confident", text: "\"We've prepared well. I think we can score points this weekend.\"" },
  { id: "cautious", label: "Cautious", text: "\"It's a tough track for us. We'll aim to bring the car home in one piece.\"" },
  { id: "aggressive", label: "Aggressive", text: "\"We're here to fight. Anything less than a strong result is a missed opportunity.\"" }
];
const POST_COMMENTS = [
  { id: "gracious", label: "Gracious", text: "\"The team gave everything today. Proud of the effort.\"" },
  { id: "blunt", label: "Blunt", text: "\"That result wasn't good enough. We need to be honest about where we fell short.\"" },
  { id: "measured", label: "Measured", text: "\"There were positives and negatives — we'll review everything properly.\"" }
];

function renderComment(el, when) {
  const options = when === "pre" ? PRE_COMMENTS : POST_COMMENTS;
  el.innerHTML = `
    <div class="comment-screen">
      <div class="section-title">${when === "pre" ? "Pre-race comment" : "Post-race comment"}</div>
      <p class="muted">Choose how you address the media.</p>
      <div class="comment-options">
        ${options.map(o => `
          <button class="comment-btn" data-id="${o.id}">
            <div class="comment-label">${o.label}</div>
            <div class="comment-text">${o.text}</div>
          </button>
        `).join("")}
      </div>
    </div>
  `;
  el.querySelectorAll(".comment-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (when === "pre") {
        raceCtx.phase = "qualifying";
      } else {
        raceCtx.phase = "results";
      }
      renderShell();
    });
  });
}

function renderQualifying(el, race) {
  if (!raceCtx.qualy) {
    const grid = Engine.buildGrid(state);
    raceCtx.qualy = Engine.runQualifying(grid);
  }
  const q = raceCtx.qualy;
  el.innerHTML = `
    <div class="qualifying">
      <div class="section-title">Qualifying — ${race.name}</div>
      <table class="standings-table">
        <thead><tr><th>Pos</th><th>Driver</th><th>Team</th></tr></thead>
        <tbody>
          ${q.grid.map(c => `
            <tr class="${c.isPlayer ? "highlight" : ""}">
              <td>${c.gridPos}</td><td>${c.driverName}</td><td>${c.teamName}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <button class="btn-primary" id="btn-start-race">Start race</button>
    </div>
  `;
  document.getElementById("btn-start-race").addEventListener("click", () => {
    raceCtx.phase = "race";
    renderShell();
  });
}

function renderRaceTicker(el, race) {
  if (!raceCtx.race) {
    raceCtx.race = Engine.simulateRace(raceCtx.qualy.grid, race, state);
    raceCtx.lap = 1;
    raceCtx.eventIdx = 0;
    raceCtx.playing = false;
    raceCtx.speed = 1;
    raceCtx.pendingDecision = null;
    raceCtx.tickerLog = [];
  }

  el.innerHTML = `
    <div class="race-live">
      <div class="ring-wrap">
        <svg id="ring-svg" class="ring-svg"></svg>
      </div>
      <div class="race-side">
        <div class="speed-controls">
          <button class="speed-btn" data-speed="0">Pause</button>
          <button class="speed-btn" data-speed="1">1x</button>
          <button class="speed-btn" data-speed="3">3x</button>
          <button class="speed-btn" data-speed="skip">Skip to next decision</button>
        </div>
        <div class="ticker" id="ticker-log"></div>
      </div>
    </div>
    <div id="decision-modal"></div>
  `;

  RingViz.render(document.getElementById("ring-svg"), raceCtx.race.cars, raceCtx.lap, raceCtx.race.totalLaps, race.corners, null);
  renderTicker();

  el.querySelectorAll(".speed-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = btn.dataset.speed;
      if (s === "skip") { skipToNextDecision(); return; }
      raceCtx.speed = parseInt(s);
      raceCtx.playing = raceCtx.speed > 0;
      if (raceCtx.playing) runTicker();
    });
  });
}

function renderTicker() {
  const log = document.getElementById("ticker-log");
  if (!log) return;
  log.innerHTML = raceCtx.tickerLog.slice(-14).reverse().map(e =>
    `<div class="ticker-line ticker-${e.type}"><span class="ticker-lap">L${e.lap}</span> ${e.text}</div>`
  ).join("");
}

function runTicker() {
  if (!raceCtx.playing) return;
  const race = raceCtx.race;

  const stepDelay = 220 / raceCtx.speed;

  const tick = () => {
    if (!raceCtx.playing) return;

    // advance through events up to current lap
    while (raceCtx.eventIdx < race.events.length && race.events[raceCtx.eventIdx].lap <= raceCtx.lap) {
      raceCtx.tickerLog.push(race.events[raceCtx.eventIdx]);
      raceCtx.eventIdx++;
    }

    // check for a decision point at this lap
    const decision = race.decisionPoints.find(d => d.lap === raceCtx.lap && !d.resolved);
    if (decision) {
      raceCtx.playing = false;
      raceCtx.pendingDecision = decision;
      showDecisionModal(decision);
      renderTicker();
      const svg = document.getElementById("ring-svg");
      if (svg) RingViz.render(svg, race.cars, raceCtx.lap, race.totalLaps, CALENDAR[state.round - 1].corners, null);
      return;
    }

    const svg = document.getElementById("ring-svg");
    if (svg) RingViz.render(svg, race.cars, raceCtx.lap, race.totalLaps, CALENDAR[state.round - 1].corners, null);
    renderTicker();

    if (raceCtx.lap >= race.totalLaps) {
      raceCtx.playing = false;
      finishRace();
      return;
    }

    raceCtx.lap++;
    setTimeout(tick, stepDelay);
  };
  tick();
}

function skipToNextDecision() {
  const race = raceCtx.race;
  const next = race.decisionPoints.find(d => d.lap >= raceCtx.lap && !d.resolved);
  const targetLap = next ? next.lap : race.totalLaps;

  while (raceCtx.lap < targetLap) {
    while (raceCtx.eventIdx < race.events.length && race.events[raceCtx.eventIdx].lap <= raceCtx.lap) {
      raceCtx.tickerLog.push(race.events[raceCtx.eventIdx]);
      raceCtx.eventIdx++;
    }
    raceCtx.lap++;
  }
  while (raceCtx.eventIdx < race.events.length && race.events[raceCtx.eventIdx].lap <= raceCtx.lap) {
    raceCtx.tickerLog.push(race.events[raceCtx.eventIdx]);
    raceCtx.eventIdx++;
  }

  renderTicker();
  const svg = document.getElementById("ring-svg");
  if (svg) RingViz.render(svg, race.cars, raceCtx.lap, race.totalLaps, CALENDAR[state.round - 1].corners, null);

  if (next) {
    raceCtx.pendingDecision = next;
    showDecisionModal(next);
  } else if (raceCtx.lap >= race.totalLaps) {
    finishRace();
  }
}

function showDecisionModal(decision) {
  const modal = document.getElementById("decision-modal");
  const eng = state.engineers.pitwall;
  modal.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-title">${decision.title}</div>
        <div class="modal-detail">${decision.detail}</div>
        <div class="modal-pitwall">Pitwall (${eng.name}, skill ${eng.skill}) recommends: <strong>${decision.options.find(o => o.id === decision.recommendation)?.label ?? decision.recommendation}</strong></div>
        <div class="modal-options">
          ${decision.options.map(o => `
            <button class="modal-option" data-id="${o.id}">
              <div class="modal-option-label">${o.label}</div>
              <div class="modal-option-desc">${o.desc}</div>
            </button>
          `).join("")}
        </div>
      </div>
    </div>
  `;
  modal.querySelectorAll(".modal-option").forEach(btn => {
    btn.addEventListener("click", () => resolveDecision(decision, btn.dataset.id));
  });
}

function resolveDecision(decision, choiceId) {
  decision.resolved = true;
  const override = Engine.isOverride(decision, choiceId);
  const eng = state.engineers.pitwall;

  if (override) {
    eng.trust = Math.max(0, eng.trust - 8);
  } else {
    eng.trust = Math.min(100, eng.trust + 3);
  }

  Engine.applyDecision(decision, choiceId, raceCtx.race.cars, raceCtx.tickerLog, state);
  document.getElementById("decision-modal").innerHTML = "";
  raceCtx.pendingDecision = null;
  raceCtx.playing = true;
  raceCtx.lap++;
  runTicker();
}

function finishRace() {
  const results = Engine.finalizeResults(raceCtx.race.cars);
  raceCtx.results = results;

  // Update standings & budget
  results.forEach(car => {
    const pts = Engine.pointsForPosition(car.finishPos);
    if (state.standings[car.teamId]) {
      state.standings[car.teamId].points += pts;
    }
    if (car.isPlayer && pts > 0) {
      state.sponsors.forEach(sp => { state.budget += pts * sp.bonusPerPoint; });
    }
  });

  const playerResults = results.filter(c => c.isPlayer);
  const bestFinish = playerResults.reduce((best, c) => (c.finishPos && (!best || c.finishPos < best)) ? c.finishPos : best, null);
  state.history.push({
    day: state.day,
    text: `${CALENDAR[state.round - 1].name}: best finish P${bestFinish ?? "DNF"}.`
  });

  raceCtx.phase = "postcomment";
  renderShell();
}

function renderRaceResults(el, race) {
  const results = raceCtx.results;
  el.innerHTML = `
    <div class="race-results">
      <div class="section-title">Result — ${race.name}</div>
      <table class="standings-table">
        <thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Pts</th></tr></thead>
        <tbody>
          ${results.map(c => `
            <tr class="${c.isPlayer ? "highlight" : ""}">
              <td>${c.finishPos ?? "DNF"}</td><td>${c.driverName}</td><td>${c.teamName}</td>
              <td>${Engine.pointsForPosition(c.finishPos)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <button class="btn-primary" id="btn-continue">Continue</button>
    </div>
  `;
  document.getElementById("btn-continue").addEventListener("click", () => {
    state.round = Math.min(state.round + 1, CALENDAR.length);
    state.day += 1;
    raceCtx = null;
    currentTab = "dashboard";
    GameState.save(state);
    renderShell();
  });
}

init();
