"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LineChart, Loader2 } from "lucide-react";
import { analysisApi, TrendResponse } from "@/lib/api";
import { useSession } from "@/components/providers/SessionProvider";

export default function TrendPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!session.authenticated) {
        router.replace("/login");
      } else {
        void loadTrend();
      }
    }
  }, [loading, session.authenticated, router]);

  async function loadTrend() {
    setIsLoading(true);
    try {
      const response = await analysisApi.trend();
      setTrend(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load trend data");
    } finally {
      setIsLoading(false);
    }
  }

  if (loading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-600">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading trend insights…
      </div>
    );
  }

  if (!session.authenticated) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-500">Trend analysis</p>
            <h1 className="text-3xl font-semibold text-slate-900">Score evolution</h1>
            <p className="mt-1 text-sm text-slate-600">Comparison based on the latest uploads for this account.</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to dashboard
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {trend && (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${trend.overall_trend === "improving" ? "bg-emerald-100 text-emerald-700" : trend.overall_trend === "degrading" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}>
                {trend.overall_trend}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">Overall Δ {(trend.delta * 100).toFixed(1)}%</p>

            <div className="mt-6 space-y-4">
              {trend.timeline.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{item.dataset_name}</p>
                      <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Overall DQS</p>
                      <p className="text-lg font-semibold text-indigo-600">{(item.overall_dqs * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  {index < trend.timeline.length - 1 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <ArrowRight className="h-3 w-3" />
                      Compared with next upload
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Dimension movement</h2>
              <div className="space-y-2">
                {Object.entries(trend.dimension_trends).map(([dimension, direction]) => (
                  <DimensionTrend key={dimension} dimension={dimension} direction={direction} />
                ))}
                {Object.keys(trend.dimension_trends).length === 0 && (
                  <p className="text-sm text-slate-500">Add more analyses to generate dimension-level trends.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-6 text-sm text-indigo-700 shadow-sm">
              <div className="flex items-start gap-3">
                <LineChart className="mt-1 h-5 w-5" />
                <p>
                  Trends are computed deterministically across the most recent uploads. Only aggregated scores are compared—raw datasets never touch disk.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function DimensionTrend({
  dimension,
  direction,
}: {
  dimension: string;
  direction: "up" | "down" | "same";
}) {
  const map: Record<typeof direction, { label: string; className: string }> = {
    up: { label: "Improving", className: "bg-emerald-100 text-emerald-700" },
    down: { label: "Declining", className: "bg-red-100 text-red-600" },
    same: { label: "Stable", className: "bg-slate-100 text-slate-600" },
  };
  const variant = map[direction];
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
      <span className="font-semibold text-slate-800">{dimension}</span>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${variant.className}`}>{variant.label}</span>
    </div>
  );
}
