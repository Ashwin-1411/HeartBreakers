"use client";

import { useState } from "react";
import { Upload, Database, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);

    // mock backend response (replace with API)
    setTimeout(() => {
      setAnalysis({
        overview: "Dataset contains 12,450 rows and 18 columns.",
        issues: [
          "Missing values detected in 3 columns",
          "Outliers present in numerical fields",
        ],
        explanation:
          "The dataset is generally usable but would benefit from basic cleaning and normalization before modeling.",
      });
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="relative min-h-screen bg-white dark:bg-zinc-950 px-6 py-20">
      
      {/* Background Glow */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl">
        <div className="relative left-1/2 aspect-[1155/678] w-[40rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-indigo-500 to-purple-400 opacity-20" />
      </div>

      {/* Page Header */}
      <div className="max-w-7xl mx-auto mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white">
          Dataset Dashboard
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Upload or generate a dataset and get AI-powered insights instantly.
        </p>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* SECTION 1 — DATA INPUT */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-8"
        >
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
            <Database className="text-indigo-600" />
            Dataset Input
          </h2>

          {/* File Upload */}
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Upload CSV or Excel
          </label>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full mb-6 file:mr-4 file:rounded-full file:border-0
                       file:bg-indigo-600 file:px-4 file:py-2
                       file:text-sm file:font-semibold file:text-white
                       hover:file:bg-indigo-500"
          />

          {/* Synthetic Dataset */}
          <button className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 py-3 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition">
            <Sparkles className="h-4 w-4" />
            Use Synthetic Dataset
          </button>

          {/* Analyze */}
          <button
            onClick={handleAnalyze}
            disabled={!file || loading}
            className="mt-6 w-full rounded-full bg-indigo-600 px-6 py-3 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Analyze Dataset"}
          </button>
        </motion.div>

        {/* SECTION 2 — ANALYSIS SUMMARY */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-8"
        >
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-6">
            Analysis Summary
          </h2>

          {!analysis && (
            <p className="text-zinc-500 dark:text-zinc-400">
              Upload a dataset and run analysis to see insights here.
            </p>
          )}

          {analysis && (
            <div className="space-y-6">
              <SummaryBlock title="Overview">
                {analysis.overview}
              </SummaryBlock>

              <SummaryBlock title="Data Quality Issues">
                <ul className="list-disc ml-5">
                  {analysis.issues.map((issue: string, i: number) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </SummaryBlock>

              <SummaryBlock title="Plain-language Explanation">
                {analysis.explanation}
              </SummaryBlock>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function SummaryBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
        {title}
      </h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {children}
      </p>
    </div>
  );
}
