// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const BDL_BASE = "https://api.balldontlie.io/v1";

// In-memory cache (per edge function instance) for team rosters.
// Key: team abbreviation (e.g. "BOS"). TTL: 15 minutes.
type RosterCache = { players: string[]; fetchedAt: number };
const ROSTER_TTL_MS = 15 * 60 * 1000;
const rosterCache = new Map<string, RosterCache>();
let teamIdCache: Map<string, number> | null = null;

async function getTeamIds(): Promise<Map<string, number>> {
  if (teamIdCache) return teamIdCache;
  const resp = await fetch(`${BDL_BASE}/teams`);
  if (!resp.ok) throw new Error(`BallDontLie teams fetch failed: ${resp.status}`);
  const data = await resp.json();
  const map = new Map<string, number>();
  for (const t of data.data ?? []) {
    if (t.abbreviation && typeof t.id === "number") map.set(t.abbreviation, t.id);
  }
  teamIdCache = map;
  return map;
}

async function getRoster(teamAbbr: string): Promise<string[]> {
  const cached = rosterCache.get(teamAbbr);
  if (cached && Date.now() - cached.fetchedAt < ROSTER_TTL_MS) {
    return cached.players;
  }
  try {
    const ids = await getTeamIds();
    const teamId = ids.get(teamAbbr);
    if (!teamId) return [];

    // Free tier: /players supports team_ids[] filter, returns active roster.
    const url = `${BDL_BASE}/players?team_ids[]=${teamId}&per_page=100`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`Roster fetch failed for ${teamAbbr}: ${resp.status}`);
      return cached?.players ?? [];
    }
    const data = await resp.json();
    const players: string[] = (data.data ?? [])
      .map((p: any) => {
        const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
        const pos = p.position ? ` (${p.position})` : "";
        return name ? `${name}${pos}` : null;
      })
      .filter(Boolean) as string[];

    rosterCache.set(teamAbbr, { players, fetchedAt: Date.now() });
    return players;
  } catch (e) {
    console.warn(`Roster lookup error for ${teamAbbr}:`, e);
    return cached?.players ?? [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const mode: "predict" | "rebut" = body.mode;

    let messages: any[] = [];
    let tools: any[] | undefined;
    let tool_choice: any | undefined;

    if (mode === "predict") {
      const { matchup } = body as {
        matchup: {
          conf: string;
          highTeam: string; highSeed: number; highRecord: string;
          lowTeam: string;  lowSeed: number;  lowRecord: string;
          series: { highWins: number; lowWins: number };
        };
      };

      // Fetch live rosters in parallel from BallDontLie (cached per instance).
      const [highRoster, lowRoster] = await Promise.all([
        getRoster(matchup.highTeam),
        getRoster(matchup.lowTeam),
      ]);
      const fmtRoster = (abbr: string, players: string[]) =>
        players.length
          ? `${abbr} active roster: ${players.slice(0, 18).join(", ")}.`
          : `${abbr} roster: unavailable — rely on general knowledge.`;

      messages = [
        {
          role: "system",
          content:
            "You are a sharp, opinionated NBA analyst. Predict 1st-round series outcomes given current series score and team context. Be decisive. Use real basketball reasoning (matchups, depth, coaching, momentum). ONLY reference players that appear in the rosters provided in the user message — do not invent or use outdated rosters. Each reasoning bullet MUST be a complete, grammatically correct sentence ending with a period. Bullets should be 8-18 words each. Never truncate or leave a bullet as a sentence fragment.",
        },
        {
          role: "user",
          content:
            `2026 NBA Playoffs ${matchup.conf}ern Conference 1st Round.\n` +
            `(${matchup.highSeed}) ${matchup.highTeam} [${matchup.highRecord}] vs ` +
            `(${matchup.lowSeed}) ${matchup.lowTeam} [${matchup.lowRecord}].\n` +
            `Current series: ${matchup.highTeam} ${matchup.series.highWins}-${matchup.series.lowWins} ${matchup.lowTeam}.\n\n` +
            `CURRENT ROSTERS (from BallDontLie API):\n` +
            `${fmtRoster(matchup.highTeam, highRoster)}\n` +
            `${fmtRoster(matchup.lowTeam, lowRoster)}\n` +
            `Note: Injury data not available — assume listed players are healthy unless widely known otherwise.\n\n` +
            `Predict the series winner, in how many games, with confidence % (50-99) and exactly 3 reasoning bullets. Each bullet MUST be a complete sentence ending with a period. Reference only players from the rosters above.`,
        },
      ];

      tools = [{
        type: "function",
        function: {
          name: "submit_prediction",
          description: "Return a structured series prediction.",
          parameters: {
            type: "object",
            properties: {
              winnerAbbr: { type: "string", description: "3-letter team abbreviation of predicted winner" },
              inGames: { type: "integer", minimum: 4, maximum: 7 },
              confidence: { type: "integer", minimum: 50, maximum: 99 },
              reasoning: {
                type: "array",
                minItems: 3, maxItems: 3,
                items: { type: "string" },
              },
            },
            required: ["winnerAbbr", "inGames", "confidence", "reasoning"],
            additionalProperties: false,
          },
        },
      }];
      tool_choice = { type: "function", function: { name: "submit_prediction" } };
    } else if (mode === "rebut") {
      const { matchup, userTake } = body;
      messages = [
        {
          role: "system",
          content:
            "You are a witty NBA analyst who debates fan takes respectfully but firmly. Counter the user's prediction with a sharp 2-3 sentence rebuttal grounded in basketball logic. Then give your own pick. Tone: confident, smart, a little spicy. No emojis.",
        },
        {
          role: "user",
          content:
            `Series: (${matchup.highSeed}) ${matchup.highTeam} vs (${matchup.lowSeed}) ${matchup.lowTeam}, ` +
            `currently ${matchup.series.highWins}-${matchup.series.lowWins}.\n\n` +
            `User's take: "${userTake}"\n\nWrite a rebuttal.`,
        },
      ];
      tools = [{
        type: "function",
        function: {
          name: "submit_rebuttal",
          parameters: {
            type: "object",
            properties: {
              rebuttal: { type: "string" },
              counterPickAbbr: { type: "string" },
              counterInGames: { type: "integer", minimum: 4, maximum: 7 },
            },
            required: ["rebuttal", "counterPickAbbr", "counterInGames"],
            additionalProperties: false,
          },
        },
      }];
      tool_choice = { type: "function", function: { name: "submit_rebuttal" } };
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isCompleteSentence = (s: unknown): s is string => {
      if (typeof s !== "string") return false;
      const trimmed = s.trim();
      if (trimmed.length < 20) return false;
      // Must end with terminal punctuation
      if (!/[.!?]$/.test(trimmed)) return false;
      // Reject obvious fragments / trailing conjunctions
      if (/\b(and|but|or|because|with|to|of|the|a|an|for|in|on)[.!?]$/i.test(trimmed)) return false;
      // Must contain at least one space (i.e., multiple words)
      if (!/\s/.test(trimmed)) return false;
      // Must start with a capital letter
      if (!/^[A-Z"']/.test(trimmed)) return false;
      return true;
    };

    const isValidPrediction = (args: any): boolean => {
      if (!args || typeof args !== "object") return false;
      if (typeof args.winnerAbbr !== "string" || args.winnerAbbr.length < 2) return false;
      if (typeof args.inGames !== "number" || args.inGames < 4 || args.inGames > 7) return false;
      if (typeof args.confidence !== "number") return false;
      if (!Array.isArray(args.reasoning) || args.reasoning.length !== 3) return false;
      return args.reasoning.every(isCompleteSentence);
    };

    const callGateway = async () => {
      return await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          tools,
          tool_choice,
          temperature: 0.7,
        }),
      });
    };

    const maxValidationRetries = mode === "predict" ? 3 : 1;
    let lastArgs: any = null;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < maxValidationRetries; attempt++) {
      const resp = await callGateway();

      if (!resp.ok) {
        const t = await resp.text();
        console.error("Gateway error", resp.status, t);
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit hit. Try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (resp.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Lovable workspace settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: `AI gateway error: ${resp.status}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      const call = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!call) {
        console.error("No tool call in response", JSON.stringify(data));
        lastError = "No tool call in response";
        continue;
      }

      let args: any;
      try {
        args = JSON.parse(call.function.arguments);
      } catch (parseErr) {
        console.error("Failed to parse tool args", parseErr);
        lastError = "Invalid AI response format";
        continue;
      }

      lastArgs = args;

      if (mode === "predict") {
        if (isValidPrediction(args)) {
          return new Response(JSON.stringify(args), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.warn(
          `Validation failed (attempt ${attempt + 1}/${maxValidationRetries}):`,
          JSON.stringify(args.reasoning),
        );
        lastError = "Incomplete prediction bullets";
        // Nudge the model on retry
        messages.push({
          role: "user",
          content:
            "Your previous response had incomplete or fragmented bullets. Regenerate with EXACTLY 3 reasoning bullets, each a complete sentence (10-18 words) ending in a period.",
        });
        continue;
      }

      // rebut mode — return as-is
      return new Response(JSON.stringify(args), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("Exhausted validation retries", lastError, JSON.stringify(lastArgs));
    return new Response(
      JSON.stringify({ error: lastError ?? "Could not generate a complete prediction. Please retry." }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("predict-series error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
