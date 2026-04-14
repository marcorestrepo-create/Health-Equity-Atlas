import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Baby, Truck, Languages, HeartPulse, MonitorSmartphone, Users,
  Activity, ExternalLink, ChevronRight, BookOpen, DollarSign, Target, MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { INTERVENTION_COLORS } from "@/lib/constants";

const iconMap: Record<string, any> = {
  Baby, Truck, Languages, HeartPulse, MonitorSmartphone, Users
};

export default function InterventionDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/interventions/${slug}`],
    enabled: !!slug,
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-48 w-full mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const { intervention, topCounties } = data;
  const IconComp = iconMap[intervention.icon] || Activity;
  const color = INTERVENTION_COLORS[intervention.slug] || "#888";
  let sources: { name: string; url: string }[] = [];
  try {
    sources = JSON.parse(intervention.sourcesCited || "[]");
  } catch {}

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1 text-xs" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" /> Atlas
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "18" }}>
              <IconComp className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <h1 className="text-base font-semibold">{intervention.name}</h1>
              <Badge variant={intervention.evidenceStrength === "Strong" ? "default" : "secondary"} className="text-[10px] h-4">
                {intervention.evidenceStrength} Evidence
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        {/* Description */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm">{intervention.description}</p>
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Gap addressed:</span> {intervention.gapAddressed}
            </div>
          </CardContent>
        </Card>

        {/* Key metric + cost-effectiveness */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs flex items-center gap-2">
                <Target className="w-4 h-4" style={{ color }} /> Key Impact Metric
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-sm font-medium">{intervention.keyMetric}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs flex items-center gap-2">
                <DollarSign className="w-4 h-4" style={{ color }} /> Cost-Effectiveness
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-sm">{intervention.costEffectiveness || "Data not available"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Evidence summary */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs flex items-center gap-2">
              <BookOpen className="w-4 h-4" style={{ color }} /> Evidence Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-xs leading-relaxed">{intervention.evidenceSummary}</p>
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Priority populations:</span> {intervention.priorityPopulations}
            </div>
          </CardContent>
        </Card>

        {/* Sources */}
        {sources.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs">Sources & Citations</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-1.5">
              {sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-primary hover:underline"
                  data-testid={`source-link-${i}`}
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  {s.name}
                </a>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Top counties where this intervention is #1 priority */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color }} />
              Counties Where This Is the Top Priority ({topCounties?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1">
              {topCounties?.slice(0, 30).map((tc: any, i: number) => (
                <button
                  key={tc.countyFips}
                  onClick={() => navigate(`/county/${tc.countyFips}`)}
                  className="w-full flex items-center gap-2 p-2 rounded hover:bg-secondary text-xs text-left"
                  data-testid={`top-county-${tc.countyFips}`}
                >
                  <span className="text-muted-foreground w-5 text-right font-mono">{i + 1}</span>
                  <div className="flex-1">
                    <span className="font-medium">{tc.county?.name}</span>
                    <span className="text-muted-foreground ml-1">{tc.county?.stateAbbr}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={tc.gapScore} className="h-1.5 w-16" />
                    <span className="font-mono w-8 text-right">{tc.gapScore?.toFixed(1)}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
