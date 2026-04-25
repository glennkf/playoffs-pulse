import { Matchup, TEAMS } from "@/data/playoffs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Prediction = {
  winnerAbbr: string;
  inGames: number;
  confidence: number;
  reasoning: string[];
};

export const MatchupCard = ({ matchup }: { matchup: Matchup }) => {
  const high = TEAMS[matchup.highTeam];
  const low = TEAMS[matchup.lowTeam];
  const [pred, setPred] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.functions.invoke("predict-series", {
        body: {
          mode: "predict",
          matchup: {
            conf: matchup.conf,
            highTeam: high.abbr, highSeed: matchup.highSeed, highRecord: high.record,
            lowTeam: low.abbr, lowSeed: matchup.lowSeed, lowRecord: low.record,
            series: matchup.series,
          },
        },
      });
      if (!alive) return;
      if (error || (data as any)?.error) {
        setError((data as any)?.error ?? error?.message ?? "Failed to load prediction");
      } else {
        setPred(data as Prediction);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [matchup.id]);

  const winner = pred?.winnerAbbr === high.abbr ? high : pred?.winnerAbbr === low.abbr ? low : null;
  const seriesLeader =
    matchup.series.highWins > matchup.series.lowWins ? high :
    matchup.series.lowWins > matchup.series.highWins ? low : null;

  return (
    <Card
      className="group relative overflow-hidden bg-court border-border/60 shadow-card animate-fade-up"
      style={{ ["--team-glow" as any]: `hsl(${high.primary} / 0.35)` }}
    >
      {/* color stripes */}
      <div className="absolute inset-x-0 top-0 h-1 flex">
        <div className="flex-1" style={{ background: `hsl(${high.primary})` }} />
        <div className="flex-1" style={{ background: `hsl(${low.primary})` }} />
      </div>

      <div className="p-5">
        {/* Teams */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamSide team={high} seed={matchup.highSeed} wins={matchup.series.highWins} leading={seriesLeader?.id === high.id} align="left" />
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-3xl text-muted-foreground">VS</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Round 1</span>
          </div>
          <TeamSide team={low} seed={matchup.lowSeed} wins={matchup.series.lowWins} leading={seriesLeader?.id === low.id} align="right" />
        </div>

        {/* Series score bar */}
        <div className="mt-4 mb-5">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">
            <span>{high.abbr} {matchup.series.highWins}</span>
            <span>Series</span>
            <span>{matchup.series.lowWins} {low.abbr}</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 7 }).map((_, i) => {
              const filledHigh = i < matchup.series.highWins;
              const filledLow = i >= 7 - matchup.series.lowWins;
              return (
                <div
                  key={i}
                  className="flex-1 h-1.5 rounded-full bg-muted"
                  style={{
                    background: filledHigh
                      ? `hsl(${high.primary})`
                      : filledLow
                      ? `hsl(${low.primary})`
                      : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Prediction */}
        <div className="rounded-lg bg-secondary/40 border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Series Prediction</span>
          </div>

          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-4/6" />
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {pred && winner && !loading && (
            <>
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="font-display text-2xl leading-none" style={{ color: `hsl(${winner.primary})` }}>
                    {winner.city} {winner.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">in {pred.inGames} games</div>
                </div>
                <ConfidencePill value={pred.confidence} />
              </div>
              <ul className="space-y-1.5">
                {pred.reasoning.map((r, i) => (
                  <li key={i} className="text-xs text-foreground/80 flex gap-2">
                    <span className="text-primary shrink-0">▸</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

const TeamSide = ({
  team, seed, wins, leading, align,
}: { team: typeof TEAMS[string]; seed: number; wins: number; leading: boolean; align: "left" | "right" }) => (
  <div className={`flex flex-col ${align === "right" ? "items-end text-right" : "items-start text-left"}`}>
    <div className="flex items-center gap-2">
      {align === "left" && <SeedBadge seed={seed} color={team.primary} />}
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{team.city}</span>
      {align === "right" && <SeedBadge seed={seed} color={team.primary} />}
    </div>
    <div
      className="font-display text-2xl md:text-3xl leading-tight"
      style={{ color: leading ? `hsl(${team.primary})` : undefined }}
    >
      {team.name}
    </div>
    <div className="text-[11px] text-muted-foreground mt-0.5">{team.record}</div>
  </div>
);

const SeedBadge = ({ seed, color }: { seed: number; color: string }) => (
  <span
    className="inline-flex h-5 min-w-5 px-1.5 items-center justify-center rounded text-[10px] font-bold"
    style={{ background: `hsl(${color} / 0.15)`, color: `hsl(${color})`, border: `1px solid hsl(${color} / 0.4)` }}
  >
    {seed}
  </span>
);

const ConfidencePill = ({ value }: { value: number }) => {
  const tone = value >= 80 ? "primary" : value >= 65 ? "accent" : "muted";
  const colorVar = tone === "primary" ? "var(--primary)" : tone === "accent" ? "var(--accent)" : "var(--muted-foreground)";
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        <TrendingUp className="h-3 w-3" />
        Confidence
      </div>
      <div className="font-display text-3xl leading-none" style={{ color: `hsl(${colorVar})` }}>
        {value}%
      </div>
    </div>
  );
};

export { type Prediction };
