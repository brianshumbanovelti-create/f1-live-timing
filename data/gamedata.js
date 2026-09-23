// ============================================================
// MULTI21 — Game Data
// Starting baseline: 2025 F1 final constructors' standings
// ============================================================

const STARTING_TEAMS = {
  williams: {
    id: "williams",
    name: "Williams",
    fullName: "Atlassian Williams Racing",
    color: "#00A3E0",
    colorDark: "#00567A",
    startingPos: 5,
    basePace: 74, // 0-100 relative car performance scale
    budget: 135000000,
    drivers: [
      { name: "Alex Albon", skill: 82, consistency: 78, morale: 80, contractYears: 2 },
      { name: "Carlos Sainz", skill: 85, consistency: 81, morale: 75, contractYears: 1 }
    ],
    blurb: "Best of the rest in 2025. A genuine step forward — the pressure now is to prove it wasn't a one-off."
  },
  astonmartin: {
    id: "astonmartin",
    name: "Aston Martin",
    fullName: "Aston Martin Aramco F1 Team",
    color: "#00594F",
    colorDark: "#003D37",
    startingPos: 7,
    basePace: 68,
    budget: 140000000,
    drivers: [
      { name: "Fernando Alonso", skill: 88, consistency: 84, morale: 70, contractYears: 1 },
      { name: "Lance Stroll", skill: 68, consistency: 65, morale: 72, contractYears: 3 }
    ],
    blurb: "Heavy investment, Adrian Newey's designs landing, but 2025 results didn't match the hype. Patience is thinning."
  },
  haas: {
    id: "haas",
    name: "Haas",
    fullName: "MoneyGram Haas F1 Team",
    color: "#B6BABD",
    colorDark: "#6B6E70",
    startingPos: 8,
    basePace: 66,
    budget: 128000000,
    drivers: [
      { name: "Oliver Bearman", skill: 76, consistency: 72, morale: 78, contractYears: 2 },
      { name: "Esteban Ocon", skill: 79, consistency: 77, morale: 74, contractYears: 1 }
    ],
    blurb: "A lean operation punching above its weight relative to budget. Every point is earned the hard way."
  },
  cadillac: {
    id: "cadillac",
    name: "Cadillac",
    fullName: "Cadillac F1 Team",
    color: "#B8965A",
    colorDark: "#7A6438",
    startingPos: 11,
    basePace: 58,
    budget: 130000000,
    drivers: [
      { name: "Sergio Perez", skill: 80, consistency: 75, morale: 68, contractYears: 1 },
      { name: "Valtteri Bottas", skill: 78, consistency: 80, morale: 70, contractYears: 1 }
    ],
    blurb: "F1's newest team. No history, no data, no excuses. Everything here is being built from zero."
  }
};

// Reference-only baseline for the other seven grid teams (AI-controlled)
const AI_TEAMS = [
  { id: "mclaren", name: "McLaren", color: "#FF8000", basePace: 96 },
  { id: "mercedes", name: "Mercedes", color: "#27F4D2", basePace: 92 },
  { id: "redbull", name: "Red Bull", color: "#3671C6", basePace: 90 },
  { id: "ferrari", name: "Ferrari", color: "#E8002D", basePace: 88 },
  { id: "racingbulls", name: "Racing Bulls", color: "#6692FF", basePace: 71 },
  { id: "sauber", name: "Sauber", color: "#52E252", basePace: 65 },
  { id: "alpine", name: "Alpine", color: "#0090FF", basePace: 60 }
];

// Engineer candidate pool — generated per department, cheap vs expensive archetypes
const ENGINEER_DEPARTMENTS = ["chassis", "engine", "aero", "pitwall", "pitcrew"];

const ENGINEER_NAME_POOL = [
  "Marcus Webb", "Priya Desai", "Hendrik Voss", "Lucia Marchetti", "Tomasz Nowak",
  "Aiko Tanaka", "Daniel Osei", "Freya Lindqvist", "Rui Costa", "Nadia Khoury",
  "Sam Whitfield", "Elena Popescu", "Kwame Asante", "Ingrid Solberg", "Théo Lambert"
];

function generateEngineerPair(department) {
  const names = [...ENGINEER_NAME_POOL].sort(() => Math.random() - 0.5);
  const cheapSkill = 55 + Math.floor(Math.random() * 15); // 55-70
  const expSkill = 78 + Math.floor(Math.random() * 18); // 78-96
  return [
    {
      name: names[0],
      department,
      skill: cheapSkill,
      cost: 1800000 + Math.floor(Math.random() * 900000),
      tier: "value",
      trust: 60
    },
    {
      name: names[1],
      department,
      skill: expSkill,
      cost: 5200000 + Math.floor(Math.random() * 3800000),
      tier: "premium",
      trust: 60
    }
  ];
}

// 2026-shaped 24-round calendar (round order/venues; names generic where needed)
const CALENDAR = [
  { round: 1, name: "Australian Grand Prix", location: "Melbourne", laps: 58, corners: 14 },
  { round: 2, name: "Chinese Grand Prix", location: "Shanghai", laps: 56, corners: 16 },
  { round: 3, name: "Japanese Grand Prix", location: "Suzuka", laps: 53, corners: 18 },
  { round: 4, name: "Bahrain Grand Prix", location: "Sakhir", laps: 57, corners: 15 },
  { round: 5, name: "Saudi Arabian Grand Prix", location: "Jeddah", laps: 50, corners: 27 },
  { round: 6, name: "Miami Grand Prix", location: "Miami", laps: 57, corners: 19 },
  { round: 7, name: "Canadian Grand Prix", location: "Montreal", laps: 70, corners: 14 },
  { round: 8, name: "Monaco Grand Prix", location: "Monte Carlo", laps: 78, corners: 19 },
  { round: 9, name: "Spanish Grand Prix", location: "Madrid", laps: 66, corners: 20 },
  { round: 10, name: "Austrian Grand Prix", location: "Spielberg", laps: 71, corners: 10 },
  { round: 11, name: "British Grand Prix", location: "Silverstone", laps: 52, corners: 18 },
  { round: 12, name: "Belgian Grand Prix", location: "Spa-Francorchamps", laps: 44, corners: 19 },
  { round: 13, name: "Hungarian Grand Prix", location: "Budapest", laps: 70, corners: 14 },
  { round: 14, name: "Dutch Grand Prix", location: "Zandvoort", laps: 72, corners: 14 },
  { round: 15, name: "Italian Grand Prix", location: "Monza", laps: 53, corners: 11 },
  { round: 16, name: "Azerbaijan Grand Prix", location: "Baku", laps: 51, corners: 20 },
  { round: 17, name: "Singapore Grand Prix", location: "Marina Bay", laps: 62, corners: 19 },
  { round: 18, name: "United States Grand Prix", location: "Austin", laps: 56, corners: 20 },
  { round: 19, name: "Mexico City Grand Prix", location: "Mexico City", laps: 71, corners: 17 },
  { round: 20, name: "São Paulo Grand Prix", location: "Interlagos", laps: 71, corners: 15 },
  { round: 21, name: "Las Vegas Grand Prix", location: "Las Vegas", laps: 50, corners: 17 },
  { round: 22, name: "Qatar Grand Prix", location: "Lusail", laps: 57, corners: 16 },
  { round: 23, name: "Abu Dhabi Grand Prix", location: "Yas Marina", laps: 58, corners: 16 }
];

// Sponsor pool for email-driven offers
const SPONSOR_POOL = [
  { name: "Zenor Systems", tier: "title", baseValue: 12000000, bonusPerPoint: 45000 },
  { name: "Halcyon Bank", tier: "major", baseValue: 6000000, bonusPerPoint: 22000 },
  { name: "Ferro Steel", tier: "major", baseValue: 5000000, bonusPerPoint: 18000 },
  { name: "Vantage Insurance", tier: "minor", baseValue: 2200000, bonusPerPoint: 9000 },
  { name: "Coastal Airlines", tier: "minor", baseValue: 1800000, bonusPerPoint: 7000 },
  { name: "Northwind Energy", tier: "minor", baseValue: 2500000, bonusPerPoint: 11000 }
];
