// NBA team data: colors, abbreviations, conference, current records.
// Records are illustrative for the 2026 season context.
export type Team = {
  id: string;
  name: string;
  city: string;
  abbr: string;
  conf: "East" | "West";
  primary: string; // hsl values without hsl()
  secondary: string;
  record: string; // regular season W-L
};

export const TEAMS: Record<string, Team> = {
  DET: { id: "DET", name: "Pistons", city: "Detroit", abbr: "DET", conf: "East", primary: "350 85% 50%", secondary: "210 100% 35%", record: "58-24" },
  ORL: { id: "ORL", name: "Magic", city: "Orlando", abbr: "ORL", conf: "East", primary: "215 95% 45%", secondary: "0 0% 60%", record: "44-38" },
  BOS: { id: "BOS", name: "Celtics", city: "Boston", abbr: "BOS", conf: "East", primary: "145 60% 32%", secondary: "42 60% 55%", record: "55-27" },
  PHI: { id: "PHI", name: "76ers", city: "Philadelphia", abbr: "PHI", conf: "East", primary: "210 90% 40%", secondary: "0 80% 50%", record: "47-35" },
  NYK: { id: "NYK", name: "Knicks", city: "New York", abbr: "NYK", conf: "East", primary: "215 90% 45%", secondary: "22 95% 55%", record: "52-30" },
  ATL: { id: "ATL", name: "Hawks", city: "Atlanta", abbr: "ATL", conf: "East", primary: "0 80% 48%", secondary: "30 95% 55%", record: "46-36" },
  CLE: { id: "CLE", name: "Cavaliers", city: "Cleveland", abbr: "CLE", conf: "East", primary: "350 70% 32%", secondary: "45 80% 50%", record: "50-32" },
  TOR: { id: "TOR", name: "Raptors", city: "Toronto", abbr: "TOR", conf: "East", primary: "0 80% 50%", secondary: "0 0% 15%", record: "45-37" },

  OKC: { id: "OKC", name: "Thunder", city: "Oklahoma City", abbr: "OKC", conf: "West", primary: "210 95% 50%", secondary: "20 95% 55%", record: "62-20" },
  PHX: { id: "PHX", name: "Suns", city: "Phoenix", abbr: "PHX", conf: "West", primary: "275 55% 35%", secondary: "25 95% 55%", record: "42-40" },
  SAS: { id: "SAS", name: "Spurs", city: "San Antonio", abbr: "SAS", conf: "West", primary: "0 0% 75%", secondary: "0 0% 10%", record: "54-28" },
  POR: { id: "POR", name: "Trail Blazers", city: "Portland", abbr: "POR", conf: "West", primary: "0 80% 50%", secondary: "0 0% 10%", record: "44-38" },
  DEN: { id: "DEN", name: "Nuggets", city: "Denver", abbr: "DEN", conf: "West", primary: "215 75% 25%", secondary: "40 90% 55%", record: "51-31" },
  MIN: { id: "MIN", name: "Timberwolves", city: "Minnesota", abbr: "MIN", conf: "West", primary: "215 80% 25%", secondary: "145 50% 40%", record: "47-35" },
  LAL: { id: "LAL", name: "Lakers", city: "Los Angeles", abbr: "LAL", conf: "West", primary: "275 60% 45%", secondary: "45 90% 55%", record: "50-32" },
  HOU: { id: "HOU", name: "Rockets", city: "Houston", abbr: "HOU", conf: "West", primary: "0 80% 45%", secondary: "0 0% 10%", record: "46-36" },
};

export type Matchup = {
  id: string;
  conf: "East" | "West";
  highSeed: number;
  lowSeed: number;
  highTeam: string;
  lowTeam: string;
  series: { highWins: number; lowWins: number };
};

export const MATCHUPS: Matchup[] = [
  { id: "E1", conf: "East", highSeed: 1, lowSeed: 8, highTeam: "DET", lowTeam: "ORL", series: { highWins: 1, lowWins: 1 } },
  { id: "E2", conf: "East", highSeed: 2, lowSeed: 7, highTeam: "BOS", lowTeam: "PHI", series: { highWins: 2, lowWins: 1 } },
  { id: "E3", conf: "East", highSeed: 3, lowSeed: 6, highTeam: "NYK", lowTeam: "ATL", series: { highWins: 1, lowWins: 2 } },
  { id: "E4", conf: "East", highSeed: 4, lowSeed: 5, highTeam: "CLE", lowTeam: "TOR", series: { highWins: 2, lowWins: 1 } },
  { id: "W1", conf: "West", highSeed: 1, lowSeed: 8, highTeam: "OKC", lowTeam: "PHX", series: { highWins: 2, lowWins: 0 } },
  { id: "W2", conf: "West", highSeed: 2, lowSeed: 7, highTeam: "SAS", lowTeam: "POR", series: { highWins: 2, lowWins: 1 } },
  { id: "W3", conf: "West", highSeed: 3, lowSeed: 6, highTeam: "DEN", lowTeam: "MIN", series: { highWins: 1, lowWins: 2 } },
  { id: "W4", conf: "West", highSeed: 4, lowSeed: 5, highTeam: "LAL", lowTeam: "HOU", series: { highWins: 3, lowWins: 0 } },
];
