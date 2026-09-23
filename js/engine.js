// ============================================================
// MULTI21 — Race Engine
// Handles qualifying resolution, full race simulation with
// tyre wear, pit windows, incidents, and pitwall decision points.
// ============================================================

const Engine = (() => {

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // Build the full 22-car grid (11 teams x 2, matching the 2026-era grid with Cadillac):
  // player's team + 2 drivers, AI teams + 2 drivers each
  function buildGrid(state) {
    const grid = [];
    const playerTeam = STARTING_TEAMS[state.teamId];
    const teamPaceMod = getTeamPaceModifier(state);

    playerTeam.drivers.forEach((d, i) => {
      grid.push({
        id: `player_${i}`,
        driverName: d.name,
        teamId: playerTeam.id,
        teamName: playerTeam.name,
        color: playerTeam.color,
        isPlayer: true,
        pace: playerTeam.basePace + teamPaceMod,
        driverSkill: d.skill,
        consistency: d.consistency
      });
    });

    AI_TEAMS.forEach(team => {
      for (let i = 0; i < 2; i++) {
        grid.push({
          id: `${team.id}_${i}`,
          driverName: generateAIDriverName(),
          teamId: team.id,
          teamName: team.name,
          color: team.color,
          isPlayer: false,
          pace: team.basePace + rand(-2, 2),
          driverSkill: 65 + Math.random() * 30,
          consistency: 60 + Math.random() * 30
        });
      }
    });

    // Fill remaining grid slots with the other three "human-eligible" teams as AI
    Object.values(STARTING_TEAMS).forEach(team => {
      if (team.id === state.teamId) return;
      team.drivers.forEach((d, i) => {
        grid.push({
          id: `${team.id}_${i}`,
          driverName: d.name,
          teamId: team.id,
          teamName: team.name,
          color: team.color,
          isPlayer: false,
          pace: team.basePace,
          driverSkill: d.skill,
          consistency: d.consistency
        });
      });
    });

    return grid;
  }

  const AI_FIRST = ["Liam", "Noah", "Mateo", "Felix", "Jonas", "Viktor", "Enzo", "Kai", "Marco", "Ryo", "Diego", "Nikolai"];
  const AI_LAST = ["Rousseau", "Brandt", "Silva", "Kowalski", "Reyes", "Moreau", "Larsson", "Ito", "Fontaine", "Haas", "Weber", "Costa"];
  function generateAIDriverName() {
    return `${AI_FIRST[Math.floor(Math.random() * AI_FIRST.length)]} ${AI_LAST[Math.floor(Math.random() * AI_LAST.length)]}`;
  }

  function getTeamPaceModifier(state) {
    // Aero + engine + chassis engineers shift car pace
    const eng = state.engineers;
    let mod = 0;
    if (eng.chassis) mod += (eng.chassis.skill - 65) * 0.06;
    if (eng.engine) mod += (eng.engine.skill - 65) * 0.06;
    if (eng.aero) mod += (eng.aero.skill - 65) * 0.06;
    return mod;
  }

  // ---------------- QUALIFYING ----------------

  function runQualifying(grid) {
    const laps = grid.map(car => {
      const variance = rand(-1.4, 1.4);
      const skillFactor = (car.driverSkill - 75) * 0.035;
      const lapScore = car.pace + skillFactor + variance;
      return { ...car, qualyScore: lapScore };
    });

    laps.sort((a, b) => b.qualyScore - a.qualyScore);

    // Simple knockout flavor, scaled to grid size: bottom third out in Q1,
    // next third out in Q2, top 10 go to Q3
    const gridSize = laps.length;
    const q3 = laps.slice(0, 10).map(c => c.id);
    const q2Out = laps.slice(10, Math.round((gridSize + 10) / 2)).map(c => c.id);
    const q1Out = laps.slice(Math.round((gridSize + 10) / 2), gridSize).map(c => c.id);

    return {
      grid: laps.map((c, i) => ({ ...c, gridPos: i + 1 })),
      q1Out, q2Out, q3
    };
  }

  // ---------------- RACE SIMULATION ----------------
  // Produces a full event log ahead of time (ticker replays it),
  // with designated decision points for the player's pitwall.

  function simulateRace(qualyGrid, raceInfo, state) {
    const totalLaps = raceInfo.laps;
    const cars = qualyGrid.map(c => ({
      ...c,
      position: c.gridPos,
      raceScore: 0,
      tyreWear: 0,
      pitted: false,
      pitLap: null,
      gapToLeader: 0,
      status: "running"
    }));

    const events = [];
    const decisionPoints = [];

    // Determine a pit window and a possible safety car / weather event
    const pitWindowLap = Math.floor(totalLaps * rand(0.42, 0.58));
    const safetyCarLap = Math.random() < 0.55 ? Math.floor(totalLaps * rand(0.25, 0.7)) : null;
    const rainLap = Math.random() < 0.2 ? Math.floor(totalLaps * rand(0.3, 0.6)) : null;

    events.push({ lap: 1, type: "start", text: `Lights out at ${raceInfo.name}.` });

    for (let lap = 1; lap <= totalLaps; lap++) {
      // progress cars
      cars.forEach(car => {
        if (car.status !== "running") return;
        car.tyreWear += rand(0.8, 1.6) - (state.engineers?.chassis ? (state.engineers.chassis.skill - 65) * 0.01 : 0);
        const paceThisLap = car.pace
          - car.tyreWear * 0.045
          + (car.driverSkill - 75) * 0.02
          + rand(-0.6, 0.6);
        car.raceScore += paceThisLap;

        // reliability / incident chance, worse with wear and lower consistency
        const incidentChance = 0.0015 + (100 - car.consistency) * 0.00004 + Math.max(0, car.tyreWear - 70) * 0.0006;
        if (Math.random() < incidentChance) {
          car.status = "out";
          events.push({
            lap, type: "incident",
            text: `${car.driverName} (${car.teamName}) is out! ${Math.random() < 0.5 ? "Mechanical failure" : "Spun off and beached"}.`
          });
        }
      });

      // Safety car event
      if (safetyCarLap === lap) {
        events.push({ lap, type: "safetycar", text: `Safety Car deployed — the field bunches up.` });
        if (isPlayerCarRunning(cars)) {
          decisionPoints.push(makeDecision(lap, "safetycar", cars, state));
        }
      }

      // Rain event
      if (rainLap === lap) {
        events.push({ lap, type: "weather", text: `Rain begins to fall — track conditions worsening.` });
        if (isPlayerCarRunning(cars)) {
          decisionPoints.push(makeDecision(lap, "weather", cars, state));
        }
      }

      // Pit window
      if (lap === pitWindowLap) {
        events.push({ lap, type: "pitwindow", text: `Pit window opens — tyre degradation reaching the danger zone.` });
        if (isPlayerCarRunning(cars)) {
          decisionPoints.push(makeDecision(lap, "pitwindow", cars, state));
        }
        // AI cars pit automatically around this window
        cars.forEach(car => {
          if (!car.isPlayer && car.status === "running" && !car.pitted && Math.random() < 0.7) {
            resolvePitStop(car, lap, state, events, false);
          }
        });
      }

      // Late tyre cliff prompt if player hasn't pitted and wear is high
      if (lap === Math.min(totalLaps - 3, pitWindowLap + 8)) {
        cars.forEach(car => {
          if (car.isPlayer && car.status === "running" && !car.pitted && car.tyreWear > 55) {
            decisionPoints.push(makeDecision(lap, "tyrecliff", cars, state));
          }
        });
      }
    }

    // Any remaining un-pitted AI cars pit near the end
    cars.forEach(car => {
      if (!car.isPlayer && car.status === "running" && !car.pitted) {
        resolvePitStop(car, totalLaps - 2, state, events, false);
      }
    });

    events.push({ lap: totalLaps, type: "finish", text: `Chequered flag at ${raceInfo.name}.` });

    return { cars, events, decisionPoints, pitWindowLap, safetyCarLap, rainLap, totalLaps };
  }

  function isPlayerCarRunning(cars) {
    return cars.some(c => c.isPlayer && c.status === "running");
  }

  function makeDecision(lap, type, cars, state) {
    const pitwallSkill = state.engineers?.pitwall?.skill ?? 60;
    const templates = {
      pitwindow: {
        title: "Pit window open",
        detail: "Tyres are degrading. The pitwall recommends box this lap for fresh rubber.",
        recommendation: "pit",
        options: [
          { id: "pit", label: "Box this lap", desc: "Take the recommended stop now." },
          { id: "extend", label: "Extend the stint", desc: "Stay out, risk more wear for track position." },
          { id: "override_compound", label: "Box, but change tyre choice", desc: "Pit now on a different compound than recommended." }
        ]
      },
      safetycar: {
        title: "Safety Car deployed",
        detail: "The pitwall sees a free pit stop opportunity under the safety car.",
        recommendation: "pit",
        options: [
          { id: "pit", label: "Pit under the safety car", desc: "Cheap stop, minimal time loss." },
          { id: "stay", label: "Stay out", desc: "Keep track position, risk it on old tyres at the restart." }
        ]
      },
      weather: {
        title: "Rain starting",
        detail: "The pitwall recommends switching to intermediate tyres.",
        recommendation: "inters",
        options: [
          { id: "inters", label: "Box for intermediates", desc: "Follow the call." },
          { id: "stay", label: "Stay out on slicks", desc: "Gamble that the rain stays light." }
        ]
      },
      tyrecliff: {
        title: "Tyres falling off a cliff",
        detail: "Degradation is critical. The pitwall is urging an immediate stop.",
        recommendation: "pit",
        options: [
          { id: "pit", label: "Box immediately", desc: "Cut your losses, fresh tyres." },
          { id: "stay", label: "Push on", desc: "Try to make it to the flag — high risk." }
        ]
      }
    };
    const t = templates[type];
    return {
      lap, type, pitwallSkill,
      title: t.title, detail: t.detail,
      recommendation: t.recommendation, options: t.options,
      resolved: false
    };
  }

  function resolvePitStop(car, lap, state, events, isPlayerChoice) {
    const crewSkill = state.engineers?.pitcrew?.skill ?? 60;
    const stopTime = isPlayerChoice
      ? clamp(3.2 - (crewSkill - 65) * 0.01 + rand(-0.3, 0.3), 2.1, 5.5)
      : clamp(2.4 + rand(-0.2, 0.6), 2.1, 4.5);
    car.pitted = true;
    car.pitLap = lap;
    car.tyreWear = 0;
    car.raceScore -= stopTime * 4; // time loss modeled into score
    if (isPlayerChoice) {
      events.push({ lap, type: "pitstop", text: `${car.driverName} pits — ${stopTime.toFixed(1)}s stop.` });
    }
  }

  // Apply a resolved decision (player's choice or auto-decline) into the race
  function applyDecision(decision, choiceId, cars, events, state) {
    const playerCar = cars.find(c => c.isPlayer && c.status === "running");
    if (!playerCar) return;

    if (decision.type === "pitwindow" || decision.type === "tyrecliff") {
      if (choiceId === "pit" || choiceId === "override_compound") {
        resolvePitStop(playerCar, decision.lap, state, events, true);
      } else {
        playerCar.raceScore += rand(0.3, 1.2); // track position gain from staying out
        events.push({ lap: decision.lap, type: "strategy", text: `${playerCar.driverName} stays out, extending the stint.` });
      }
    } else if (decision.type === "safetycar") {
      if (choiceId === "pit") {
        resolvePitStop(playerCar, decision.lap, state, events, true);
        playerCar.raceScore += 3; // SC stop is cheap
      } else {
        events.push({ lap: decision.lap, type: "strategy", text: `${playerCar.driverName} stays out under the Safety Car — track position held.` });
      }
    } else if (decision.type === "weather") {
      if (choiceId === "inters") {
        resolvePitStop(playerCar, decision.lap, state, events, true);
        events.push({ lap: decision.lap, type: "strategy", text: `${playerCar.driverName} switches to intermediates.` });
      } else {
        const gamble = Math.random();
        if (gamble < 0.4) {
          playerCar.raceScore += 4; // rain stayed light, gamble paid off
          events.push({ lap: decision.lap, type: "strategy", text: `The rain stays light — staying on slicks paid off for ${playerCar.driverName}.` });
        } else {
          playerCar.raceScore -= 6;
          events.push({ lap: decision.lap, type: "strategy", text: `The rain intensifies — ${playerCar.driverName} is sliding around on slicks.` });
        }
      }
    }
  }

  // Whether the choice matches what the pitwall recommended
  function isOverride(decision, choiceId) {
    if (decision.recommendation === "pit") return choiceId !== "pit" && choiceId !== "inters";
    return choiceId !== decision.recommendation;
  }

  function finalizeResults(cars) {
    const classified = cars.filter(c => c.status === "running").sort((a, b) => b.raceScore - a.raceScore);
    const retired = cars.filter(c => c.status !== "running");
    const results = [...classified, ...retired].map((c, i) => ({
      ...c,
      finishPos: i < classified.length ? i + 1 : null
    }));
    return results;
  }

  const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  function pointsForPosition(pos) {
    if (!pos || pos < 1 || pos > 10) return 0;
    return POINTS[pos - 1];
  }

  return {
    buildGrid, runQualifying, simulateRace, applyDecision,
    isOverride, finalizeResults, pointsForPosition, makeDecision
  };
})();
