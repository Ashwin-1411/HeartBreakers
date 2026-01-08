"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { analysisApi, HistoryDetailResponse, ReasonedStat } from "@/lib/api";
import { useSession } from "@/components/providers/SessionProvider";

export default function AnalysisDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const analysisId = params?.id;
  const { session, loading } = useSession();
  const [detail, setDetail] = useState<HistoryDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!session.authenticated) {
        router.replace("/login");
      } else if (analysisId) {
        void loadDetail(analysisId);
      }
    }
  }, [loading, session.authenticated, analysisId, router]);

  async function loadDetail(id: string) {
    setIsLoading(true);
    try {
      const response = await analysisApi.historyDetail(id);
      setDetail(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load report");
    } finally {
      setIsLoading(false);
    }
  }

  const sortedDimensions = useMemo(() => {
    if (!detail) return [] as Array<[string, number]>;
    return Object.entries(detail.dimension_scores || {}).sort((a, b) => b[1] - a[1]);
  }, [detail]);

  if (loading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-600">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading analysis…
      </div>
    );
  }

  if (!session.authenticated || !detail) {
    return null;
  }

  const createdAt = new Date(detail.created_at).toLocaleString();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-500">Analysis report</p>
            <h1 className="text-3xl font-semibold text-slate-900">{detail.dataset_name}</h1>
            <p className="mt-1 text-sm text-slate-600">Generated on {createdAt}</p>
          </div>
          <div className="rounded-2xl bg-indigo-50 px-5 py-3 text-indigo-700">
            <p className="text-xs uppercase tracking-wide">Overall DQS</p>
            <p className="text-2xl font-semibold">{(detail.overall_dqs * 100).toFixed(1)}%</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Dimension scores</h2>
            <div className="mt-4 space-y-3">
              {sortedDimensions.map(([dimension, score]) => (
                <div key={dimension} className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span className="font-medium text-slate-900">{dimension}</span>
                    <span className="font-semibold text-indigo-600">{(score * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.min(score * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
              {sortedDimensions.length === 0 && <p className="text-sm text-slate-500">No dimension data available for this run.</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Reasoned observations</h2>
            <div className="mt-4 space-y-3">
              {detail.reasoned_stats.length === 0 && <p className="text-sm text-slate-500">No rule-based findings recorded.</p>}
              {detail.reasoned_stats.map((item, index) => (
                <ReasonedItem key={index} item={item} />
              ))}
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          {detail.genai_summary && (
            <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-6 text-sm text-indigo-700 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-indigo-700">Summary</h2>
              <p>{detail.genai_summary}</p>
            </div>
          )}

          {detail.genai_recommendations.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Recommendations</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {detail.genai_recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-500" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        {recommendation.priority} · {recommendation.dimension}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{recommendation.action}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-600">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">What we store</h2>
            <p className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 text-indigo-500" />
              Only aggregated metrics and explanations are saved. Raw rows and profiling outputs are discarded immediately.
            </p>
          </div>
        </aside>
      </section>

      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 self-start rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
      >
        <ArrowLeft className="h-3 w-3" />
        Back
      </button>
    </div>
  );
}

function ReasonedItem({ item }: { item: ReasonedStat | string }) {
  const payload: ReasonedStat = typeof item === "string" ? { description: item } : item;

  const severity = (payload.severity || "Medium").toString();
  const severityKey = severity.toLowerCase();
  const attribute = payload.attribute || payload.title || "Dataset";
  const issue = payload.issue ? payload.issue.replace(/_/g, " ") : payload.message || "Quality observation";
  const description = payload.description || payload.message || "";
  const dimensions = payload.dimensions && payload.dimensions.length > 0 ? payload.dimensions.join(", ") : undefined;
  const violationRate = typeof payload.violation_rate === "number" ? `${(payload.violation_rate * 100).toFixed(1)}%` : undefined;

  const icon = severityKey === "critical" || severityKey === "high"
    ? <XCircle className="mt-0.5 h-4 w-4 text-red-500" />
    : <Info className="mt-0.5 h-4 w-4 text-indigo-500" />;

  const severityClass = (severityKey === "critical" || severityKey === "high")
    ? "bg-red-100 text-red-700"
    : severityKey === "low"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-amber-100 text-amber-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <div className="flex items-start gap-2">
        {icon}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{attribute}</p>
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${severityClass}`}>{severity}</span>
            {violationRate && (
              <span className="rounded-full bg-slate-200 px-3 py-0.5 text-xs font-medium text-slate-700">
                {violationRate} impacted
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600">{issue}</p>
          {description && <p className="text-sm text-slate-600">{description}</p>}
          {dimensions && (
            <p className="text-xs uppercase tracking-wide text-slate-400">Dimensions: {dimensions}</p>
          )}
        </div>
      </div>
    </div>
  );
}
