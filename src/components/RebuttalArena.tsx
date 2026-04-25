import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MATCHUPS, TEAMS } from "@/data/playoffs";
import { supabase } from "@/integrations/supabase/client";
import { Swords, Loader2, AlertCircle } from "lucide-react";

type Rebuttal = { rebuttal: string; counterPickAbbr: string; counterInGames: number };

export const RebuttalArena = () => {
  const [matchupId, setMatchupId] = useState(MATCHUPS[0].id);
  const [take, setTake] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Rebuttal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const matchup = useMemo(() => MATCHUPS.find((m) => m.id === matchupId)!, [matchupId]);
  const high = TEAMS[matchup.highTeam];
  const low = TEAMS[matchup.lowTeam];

  const submit = async () => {
    if (take.trim().length < 8) {
      setError("Give us a real take — at least a sentence.");
      return;
    }
    setLoading(true); setError(null); setResult(null);
    const { data, error } = await supabase.functions.invoke("predict-series", {
      body: {
        mode: "rebut",
        matchup: {
          highTeam: high.abbr, highSeed: matchup.highSeed,
          lowTeam: low.abbr, lowSeed: matchup.lowSeed,
          series: matchup.series,
        },
        userTake: take.trim().slice(0, 600),
      },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      setError((data as any)?.error ?? error?.message ?? "Failed");
      return;
    }
    setResult(data as Rebuttal);
  };

  const counter = result ? TEAMS[result.counterPickAbbr] : null;

  return (
    <Card className="bg-court border-border/60 shadow-card overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-70" />
      <div className="p-6 md:p-8">
        <div className="flex items-center gap-2 mb-1">
          <Swords className="h-4 w-4 text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Hot Take Arena</span>
        </div>
        <h2 className="font-display text-3xl md:text-4xl">Got a take? Defend it.</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Drop your prediction below. Our AI analyst will respectfully (or not) tell you why you're wrong.
        </p>

        <div className="grid md:grid-cols-[280px_1fr] gap-4 mt-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Series</label>
            <Select value={matchupId} onValueChange={setMatchupId}>
              <SelectTrigger className="bg-secondary/60 border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCHUPS.map((m) => {
                  const h = TEAMS[m.highTeam]; const l = TEAMS[m.lowTeam];
                  return (
                    <SelectItem key={m.id} value={m.id}>
                      ({m.highSeed}) {h.abbr} vs ({m.lowSeed}) {l.abbr} · {m.conf}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <div className="rounded-md bg-secondary/40 border border-border/60 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{high.city} {high.name}</span> vs{" "}
              <span className="font-semibold text-foreground">{low.city} {low.name}</span>
              <div className="mt-1">Series: {high.abbr} {matchup.series.highWins}–{matchup.series.lowWins} {low.abbr}</div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Your Prediction</label>
            <Textarea
              value={take}
              onChange={(e) => setTake(e.target.value)}
              placeholder={`e.g., "${low.name} steal it in 7 — their bench is deeper and they get every 50/50 ball at home."`}
              className="bg-secondary/60 border-border/60 min-h-[120px] resize-none"
              maxLength={600}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{take.length}/600</span>
              <Button onClick={submit} disabled={loading} variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Cooking up a rebuttal…</> : "Get Rebuttal"}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {result && counter && (
          <div className="mt-6 rounded-lg border border-border/60 bg-secondary/30 p-5 animate-fade-up">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">AI Counterpunch</div>
            <p className="text-foreground/90 leading-relaxed">{result.rebuttal}</p>
            <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-muted-foreground">My pick:</div>
              <div className="font-display text-2xl" style={{ color: `hsl(${counter.primary})` }}>
                {counter.city} {counter.name} <span className="text-muted-foreground text-base">in {result.counterInGames}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
