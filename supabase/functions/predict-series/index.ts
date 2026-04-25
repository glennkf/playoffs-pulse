// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

      messages = [
        {
          role: "system",
          content:
            "You are a sharp, opinionated NBA analyst. Predict 1st-round series outcomes given current series score and team context. Be decisive. Use real basketball reasoning (matchups, depth, coaching, momentum). Keep bullets punchy (max 18 words each).",
        },
        {
          role: "user",
          content:
            `2026 NBA Playoffs ${matchup.conf}ern Conference 1st Round.\n` +
            `(${matchup.highSeed}) ${matchup.highTeam} [${matchup.highRecord}] vs ` +
            `(${matchup.lowSeed}) ${matchup.lowTeam} [${matchup.lowRecord}].\n` +
            `Current series: ${matchup.highTeam} ${matchup.series.highWins}-${matchup.series.lowWins} ${matchup.lowTeam}.\n` +
            `Predict the series winner, in how many games, with confidence % (50-99) and exactly 3 reasoning bullets.`,
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

    const resp = await fetch(GATEWAY_URL, {
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
      }),
    });

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
      throw new Error("No tool call in response");
    }
    const args = JSON.parse(call.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("predict-series error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
