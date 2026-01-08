"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Loader2 } from "lucide-react";
import { analysisApi, HistoryItem } from "@/lib/api";
import { useSession } from "@/components/providers/SessionProvider";

export default function HistoryPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!session.authenticated) {
        router.replace("/login");
      } else {
        void loadHistory();
      }
    }
  }, [session.authenticated, loading, router]);

  async function loadHistory() {
    setIsLoading(true);
    try {
      const { results } = await analysisApi.history();
      setHistory(results);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch history");
    } finally {
      setIsLoading(false);
    }
  }

  const averageScore = useMemo(() => {
    if (history.length === 0) return undefined;
    const total = history.reduce((sum, item) => sum + item.overall_dqs, 0);
    return total / history.length;
  }, [history]);

  if (loading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-600">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading history…
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
            <h1 className="text-3xl font-semibold text-slate-900">Analysis history</h1>
            <p className="mt-1 text-sm text-slate-600">Only metadata and knowledge-layer outputs are retained.</p>
          </div>
          {averageScore !== undefined && (
            <div className="rounded-2xl bg-indigo-50 px-4 py-2 text-sm text-indigo-700">
              Average score {(averageScore * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3">Dataset</th>
              <th className="px-6 py-3">Uploaded</th>
              <th className="px-6 py-3">Overall DQS</th>
              <th className="px-6 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
            {history.map((item) => (
              <tr key={item.id} className="transition hover:bg-indigo-50/70">
                <td className="px-6 py-4 font-medium text-slate-900">{item.dataset_name}</td>
                <td className="px-6 py-4 text-slate-500">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 font-semibold text-indigo-600">{(item.overall_dqs * 100).toFixed(1)}%</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => router.push(`/analysis/${item.id}`)}
                    className="inline-flex items-center gap-1 rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
                  >
                    View report
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500">
                  No analyses yet—run your first dataset from the dashboard.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
