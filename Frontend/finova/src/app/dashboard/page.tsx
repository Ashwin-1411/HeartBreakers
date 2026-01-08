"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Bot, FileDown, Gauge, Loader2, Send, Upload } from "lucide-react";
import { analysisApi, AnalysisPayload, HistoryItem, TrendResponse } from "@/lib/api";
import { useSession } from "@/components/providers/SessionProvider";

export default function DashboardPage() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);

  useEffect(() => {
    if (!sessionLoading) {
      if (!session.authenticated) {
        router.replace("/login");
      } else {
        void refreshOverview();
      }
    }
  }, [sessionLoading, session.authenticated, router]);

  async function refreshOverview() {
    try {
      const [historyResponse, trendResponse] = await Promise.all([
        analysisApi.history(),
        analysisApi.trend(),
      ]);
      setHistory(historyResponse.results);
      setTrend(trendResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview");
    }
  }

  async function handleAnalyze() {
    if (!file) return;
    setError(null);
    setAnalyzing(true);
    try {
      const result = await analysisApi.analyze(file);
      setAnalysis(result);
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSampleDataset(type: "perfect" | "messy") {
    const filename = type === "perfect" ? "clients_with_fatf_ofac.csv" : "messy_clients_with_fatf_ofac.csv";
    setSampleLoading(true);
    setError(null);
    setFile(null);
    setAnalysis(null);
    try {
      const response = await fetch(`/examples/${filename}`);
      if (!response.ok) {
        throw new Error(`Sample dataset ${type} unavailable`);
      }
      const blob = await response.blob();
      const sampleFile = new File([blob], filename, { type: "text/csv" });
      setFile(sampleFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sample dataset");
    } finally {
      setSampleLoading(false);
    }
  }

  const latestScore = useMemo(() => {
    if (analysis) return analysis.overall_dqs;
    return history.length > 0 ? history[0].overall_dqs : undefined;
  }, [analysis, history]);

  if (sessionLoading || !session.authenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-600">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Welcome back{session.user ? `, ${session.user.username}` : ""}</h1>
            <p className="mt-2 text-sm text-slate-600">
              Upload a CSV to evaluate data quality with ontology guidance, then explore history and trends.
            </p>
          </div>
          {latestScore !== undefined && (
            <div className="flex items-center gap-3 rounded-2xl bg-indigo-50 px-5 py-3 text-indigo-700">
              <Gauge className="h-6 w-6" />
              <div>
                <p className="text-xs uppercase tracking-wide">Latest overall DQS</p>
                <p className="text-2xl font-semibold">{(latestScore * 100).toFixed(1)}%</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Upload dataset</h2>
          <p className="mt-1 text-sm text-slate-600">CSV files stay in memory only—Finova stores aggregated metrics and explanations.</p>

          <div className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 p-6 text-center text-indigo-700">
              <Upload className="mx-auto h-8 w-8" />
              <span className="mt-3 text-sm font-medium">Choose a CSV file</span>
              <span className="text-xs text-indigo-500">Drop a file or click to browse</span>
              <input
                type="file"
                accept=".csv"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null;
                  setFile(nextFile);
                  setAnalysis(null);
                }}
                className="hidden"
              />
            </label>

            {file && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                Selected: {file.name}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!file || analyzing}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  Run analysis
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Need a quick demo?</p>
              <p className="mt-1 text-xs text-slate-500">
                Load a sample CSV to compare a spotless dataset against a messy one.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSampleDataset("perfect")}
                  disabled={sampleLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <FileDown className="h-4 w-4" />
                  Low-risk sample (clients_with_fatf_ofac.csv)
                </button>
                <button
                  type="button"
                  onClick={() => void handleSampleDataset("messy")}
                  disabled={sampleLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
                >
                  <FileDown className="h-4 w-4" />
                  High-risk sample (messy_clients_with_fatf_ofac.csv)
                </button>
              </div>
            </div>
          </div>

          {analysis && (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-base font-semibold text-slate-800">Latest run</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InfoBlock label="Overall DQS">{(analysis.overall_dqs * 100).toFixed(1)}%</InfoBlock>
                <InfoBlock label="Rows">{analysis.dataset.rows}</InfoBlock>
                <InfoBlock label="Columns">{analysis.dataset.columns}</InfoBlock>
                <InfoBlock label="Reasoned issues">{analysis.reasoned_stats.length}</InfoBlock>
              </div>
              {analysis.genai_summary && (
                <div className="mt-6 rounded-xl bg-white p-4 text-sm text-slate-700">
                  {analysis.genai_summary}
                </div>
              )}
              <button
                onClick={() => router.push(`/analysis/${analysis.analysis_id}`)}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
              >
                View full report
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <AssistantPanel analysisId={analysis?.analysis_id} context={analysis?.context_bundle} />
        </section>

        <aside className="flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Recent analyses</h2>
            <p className="mt-1 text-xs text-slate-500">Latest uploads for your account</p>
            <div className="mt-4 space-y-3">
              {history.length === 0 && <p className="text-sm text-slate-500">No analyses yet—upload your first dataset.</p>}
              {history.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(`/analysis/${item.id}`)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{item.dataset_name}</span>
                    <span className="text-indigo-600">{(item.overall_dqs * 100).toFixed(1)}%</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
            <button
              onClick={() => router.push("/history")}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              View history
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {trend && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Trend snapshot</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${trend.overall_trend === "improving" ? "bg-emerald-100 text-emerald-700" : trend.overall_trend === "degrading" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}>
                  {trend.overall_trend}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Δ Overall: {(trend.delta * 100).toFixed(1)}%
              </p>
              <div className="mt-4 space-y-2">
                {Object.entries(trend.dimension_trends).map(([dimension, direction]) => (
                  <TrendPill key={dimension} dimension={dimension} direction={direction} />
                ))}
              </div>
              <button
                onClick={() => router.push("/trend")}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Explore trends
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{children}</p>
    </div>
  );
}

function TrendPill({
  dimension,
  direction,
}: {
  dimension: string;
  direction: "up" | "down" | "same";
}) {
  const labelMap: Record<typeof direction, string> = {
    up: "Improving",
    down: "Declining",
    same: "Stable",
  };
  const colorMap: Record<typeof direction, string> = {
    up: "bg-emerald-100 text-emerald-700",
    down: "bg-red-100 text-red-600",
    same: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
      <span className="font-medium text-slate-800">{dimension}</span>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colorMap[direction]}`}>
        {labelMap[direction]}
      </span>
    </div>
  );
}

type AssistantMessage = { role: "user" | "assistant"; content: string };

function AssistantPanel({
  analysisId,
  context,
}: {
  analysisId?: number;
  context?: Record<string, unknown>;
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [analysisId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    try {
      const response = await analysisApi.chat(trimmed, context ? { analysis: context } : undefined);
      setMessages((prev) => [...prev, { role: "assistant", content: response.response }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to reach assistant";
      setError(message);
    } finally {
      setSending(false);
    }
  }

  const hasContext = Boolean(context);

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <Bot className="h-4 w-4" />
          </div>
          <h3 className="text-base font-semibold">Finova assistant</h3>
        </div>
        {sending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Ask follow-up questions about the latest analysis. Responses use stored summaries only—raw rows never leave your browser session.
      </p>

      <div className="mt-4 max-h-64 space-y-3 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">
            Run an analysis, then ask for clarifications or remediation ideas. The assistant grounds replies in ontology-driven outputs.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  message.role === "assistant"
                    ? "bg-white text-slate-700"
                    : "bg-indigo-600 text-white"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={hasContext ? "Ask about this run" : "Upload a dataset to enable chat"}
          className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
          disabled={!hasContext || sending}
        />
        <button
          type="submit"
          disabled={!hasContext || sending || !input.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          Send
          <Send className="h-4 w-4" />
        </button>
      </form>

      {!hasContext && (
        <p className="mt-2 text-xs text-slate-500">
          Upload a CSV to generate context before chatting. We only keep aggregate metrics, never individual rows.
        </p>
      )}

      {error && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}
    </div>
  );
}
