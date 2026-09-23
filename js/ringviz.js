// ============================================================
// MULTI21 — Ring Visualization
// Renders the circular timing-tower style race view:
// cars as dots around a ring, sector markers, status flashes.
// ============================================================

const RingViz = (() => {

  const RADIUS = 150;
  const CENTER = 200;

  function polarToXY(angleDeg, radius) {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return {
      x: CENTER + radius * Math.cos(rad),
      y: CENTER + radius * Math.sin(rad)
    };
  }

  function render(svgEl, cars, lap, totalLaps, corners, flashSector) {
    svgEl.innerHTML = "";
    svgEl.setAttribute("viewBox", "0 0 400 400");

    // Outer ring track
    const track = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    track.setAttribute("cx", CENTER);
    track.setAttribute("cy", CENTER);
    track.setAttribute("r", RADIUS);
    track.setAttribute("fill", "none");
    track.setAttribute("stroke", "#2A2F3A");
    track.setAttribute("stroke-width", "18");
    svgEl.appendChild(track);

    // Sector/corner tick marks
    for (let i = 0; i < corners; i++) {
      const angle = (360 / corners) * i;
      const p1 = polarToXY(angle, RADIUS - 9);
      const p2 = polarToXY(angle, RADIUS + 9);
      const isFlashed = flashSector !== null && i === flashSector;
      const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
      tick.setAttribute("x1", p1.x); tick.setAttribute("y1", p1.y);
      tick.setAttribute("x2", p2.x); tick.setAttribute("y2", p2.y);
      tick.setAttribute("stroke", isFlashed ? "#E63946" : "#454C5A");
      tick.setAttribute("stroke-width", isFlashed ? "3" : "1.5");
      svgEl.appendChild(tick);
    }

    // Center info
    const centerText1 = document.createElementNS("http://www.w3.org/2000/svg", "text");
    centerText1.setAttribute("x", CENTER);
    centerText1.setAttribute("y", CENTER - 8);
    centerText1.setAttribute("text-anchor", "middle");
    centerText1.setAttribute("class", "ring-center-lap");
    centerText1.textContent = `LAP ${lap}/${totalLaps}`;
    svgEl.appendChild(centerText1);

    const leader = cars.find(c => c.status === "running");
    const centerText2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
    centerText2.setAttribute("x", CENTER);
    centerText2.setAttribute("y", CENTER + 16);
    centerText2.setAttribute("text-anchor", "middle");
    centerText2.setAttribute("class", "ring-center-leader");
    centerText2.textContent = leader ? `P1 ${shortCode(leader.driverName)}` : "";
    svgEl.appendChild(centerText2);

    // Car dots — position around ring based on simulated lap progress
    const running = cars.filter(c => c.status === "running")
      .sort((a, b) => b.raceScore - a.raceScore);

    running.forEach((car, idx) => {
      // Spread cars around the ring based on relative gap, offset by lap progress
      const progressFraction = ((lap % totalLaps) / totalLaps + idx * 0.006) % 1;
      const angle = progressFraction * 360;
      const pos = polarToXY(angle, RADIUS);

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", pos.x);
      dot.setAttribute("cy", pos.y);
      dot.setAttribute("r", car.isPlayer ? "8" : "6");
      dot.setAttribute("fill", car.color);
      dot.setAttribute("stroke", car.isPlayer ? "#FFFFFF" : "#0C0E12");
      dot.setAttribute("stroke-width", car.isPlayer ? "2.5" : "1");
      g.appendChild(dot);

      if (car.isPlayer || idx < 3) {
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        const labelPos = polarToXY(angle, RADIUS + 22);
        label.setAttribute("x", labelPos.x);
        label.setAttribute("y", labelPos.y);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("class", car.isPlayer ? "ring-label-player" : "ring-label");
        label.textContent = shortCode(car.driverName);
        g.appendChild(label);
      }

      svgEl.appendChild(g);
    });
  }

  function shortCode(name) {
    const parts = name.split(" ");
    return parts[parts.length - 1].slice(0, 3).toUpperCase();
  }

  return { render };
})();
