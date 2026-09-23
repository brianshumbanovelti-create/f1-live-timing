// ============================================================
// MULTI21 — Game State
// Career state, persistence (localStorage), email/event generation
// ============================================================

const GameState = (() => {

  const SAVE_KEY = "multi21_save_v1";

  function newGame(teamId) {
    const team = STARTING_TEAMS[teamId];
    const engineers = {};
    ENGINEER_DEPARTMENTS.forEach(dep => {
      // start with a random baseline hire per department (value tier)
      const pair = generateEngineerPair(dep);
      engineers[dep] = { ...pair[0], hired: true };
    });

    return {
      teamId,
      season: 1,
      round: 1,
      day: 0,
      budget: team.budget,
      reputation: 55,
      boardConfidence: 60,
      standings: buildInitialStandings(),
      engineers,
      sponsors: [],
      emails: generateOpeningEmails(team),
      pendingOffers: [],
      history: [],
      raceInProgress: null,
      jobOffers: [],
      driverContracts: team.drivers.map(d => ({ name: d.name, yearsLeft: d.contractYears }))
    };
  }

  function buildInitialStandings() {
    const table = {};
    Object.values(STARTING_TEAMS).forEach(t => { table[t.id] = { points: 0, name: t.name }; });
    AI_TEAMS.forEach(t => { table[t.id] = { points: 0, name: t.name }; });
    return table;
  }

  function generateOpeningEmails(team) {
    return [
      {
        id: cryptoId(), type: "flavor", from: "Board of Directors",
        subject: `Welcome to ${team.name}`,
        body: `${team.blurb} The board expects steady progress this season. Good luck.`,
        read: false, day: 0
      },
      {
        id: cryptoId(), type: "actionable", from: "Recruitment",
        subject: "Engineering staff review",
        body: "Review your department heads in the Garage. You can upgrade any department if the budget allows.",
        read: false, day: 0, action: "garage"
      }
    ];
  }

  function cryptoId() {
    return Math.random().toString(36).slice(2, 10);
  }

  function save(state) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  function load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  function exportSave(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `multi21-save-round${state.round}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importSave(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const state = JSON.parse(e.target.result);
        callback(state);
      } catch (err) {
        callback(null);
      }
    };
    reader.readAsText(file);
  }

  // Generate a random inter-race email (actionable or flavor)
  function generateRandomEmail(state) {
    const roll = Math.random();
    const team = STARTING_TEAMS[state.teamId];

    if (roll < 0.25) {
      const sponsor = SPONSOR_POOL[Math.floor(Math.random() * SPONSOR_POOL.length)];
      return {
        id: cryptoId(), type: "actionable", from: sponsor.name,
        subject: `Sponsorship proposal — ${sponsor.tier} partner`,
        body: `${sponsor.name} is offering a ${sponsor.tier} sponsorship deal: $${(sponsor.baseValue / 1e6).toFixed(1)}M base plus performance bonuses. Deal expires in 5 days.`,
        read: false, day: state.day, action: "sponsor", payload: sponsor,
        deadline: state.day + 5
      };
    } else if (roll < 0.45) {
      const dep = ENGINEER_DEPARTMENTS[Math.floor(Math.random() * ENGINEER_DEPARTMENTS.length)];
      const pair = generateEngineerPair(dep);
      return {
        id: cryptoId(), type: "actionable", from: "Recruitment",
        subject: `Engineer candidates — ${dep}`,
        body: `Two candidates available for ${dep}: ${pair[0].name} (value, skill ${pair[0].skill}, $${(pair[0].cost / 1e6).toFixed(1)}M) or ${pair[1].name} (premium, skill ${pair[1].skill}, $${(pair[1].cost / 1e6).toFixed(1)}M). Offer expires in 4 days.`,
        read: false, day: state.day, action: "engineer", payload: { department: dep, candidates: pair },
        deadline: state.day + 4
      };
    } else if (roll < 0.65) {
      const flavors = [
        `Paddock chatter suggests a rival is struggling with reliability this week.`,
        `Fans have taken notice of ${team.name}'s recent form on social media.`,
        `A technical journalist has published a piece analyzing your car's floor design.`,
        `The FIA has issued a routine technical directive ahead of the next round.`
      ];
      return {
        id: cryptoId(), type: "flavor", from: "Paddock News",
        subject: "Paddock update",
        body: flavors[Math.floor(Math.random() * flavors.length)],
        read: false, day: state.day
      };
    } else {
      const moods = [
        "pleased with recent progress, though there is no room for complacency.",
        "concerned about the pace of development compared to rivals.",
        "satisfied with the current trajectory of the team.",
        "watching results closely ahead of the next board review."
      ];
      return {
        id: cryptoId(), type: "flavor", from: "Board of Directors",
        subject: "Board sentiment",
        body: `The board is ${moods[Math.floor(Math.random() * moods.length)]}`,
        read: false, day: state.day
      };
    }
  }

  // Expire actionable emails past their deadline with a real cost
  function expireOverdueEmails(state) {
    const stillActive = [];
    state.emails.forEach(email => {
      if (email.type === "actionable" && !email.resolved && email.deadline && state.day > email.deadline) {
        applyExpiryPenalty(state, email);
        email.resolved = true;
        email.expired = true;
      }
      stillActive.push(email);
    });
    state.emails = stillActive;
  }

  function applyExpiryPenalty(state, email) {
    if (email.action === "sponsor") {
      state.reputation = Math.max(0, state.reputation - 3);
      state.history.push({ day: state.day, text: `Missed sponsorship deadline with ${email.from} — deal withdrawn, minor reputation hit.` });
    } else if (email.action === "engineer") {
      state.reputation = Math.max(0, state.reputation - 2);
      state.history.push({ day: state.day, text: `Failed to respond to engineer candidates in time — both candidates joined a rival team.` });
    }
  }

  return {
    newGame, save, load, clearSave, exportSave, importSave,
    generateRandomEmail, expireOverdueEmails, cryptoId
  };
})();
