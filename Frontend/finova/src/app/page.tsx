"use client";

import Link from "next/link";
import { useSession } from "@/components/providers/SessionProvider";

const featureHighlights = [
  {
    title: "Ontology-driven insights",
    description: "Understand critical data quality gaps through transparent knowledge-graph reasoning.",
  },
  {
    title: "Actionable storytelling",
    description: "Plain-language summaries and recommendations help teams mobilise fast.",
  },
  {
    title: "Trend intelligence",
    description: "Track how scorecards evolve across uploads with instant improvement signals.",
  },
];

export default function HomePage() {
  const { session, loading } = useSession();
  const showRegisterCta = !loading && !session.authenticated;

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-16">
      <div className="grid gap-10 rounded-3xl border border-slate-200 bg-white p-10 shadow-sm md:grid-cols-2">
        <div className="space-y-6">
          <span className="inline-flex items-center rounded-full bg-indigo-100 px-4 py-1 text-sm font-medium text-indigo-700">
            Built for financial data teams
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Diagnose payment and client data quality without exposing sensitive records.
          </h1>
          <p className="text-lg text-slate-600">
            Finova focuses on finance and payments pipelines—think KYC/KYB, onboarding, sanctions, and ledger health. Deterministic profiling plus knowledge-graph reasoning highlights regulatory risks, while GenAI storytelling helps audit and compliance colleagues take action fast.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {showRegisterCta && (
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-500"
              >
                Create account
              </Link>
            )}
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-indigo-200 px-6 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              View dashboard
            </Link>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-4 rounded-2xl bg-slate-900 p-8 text-slate-100">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-wide text-indigo-300">Trend snapshot</p>
            <h2 className="text-3xl font-semibold">83.4% overall DQS</h2>
            <p className="text-sm text-slate-300">+7.0% vs last upload</p>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-slate-800/60 p-4">
              <dt className="text-slate-400">Completeness</dt>
              <dd className="text-xl font-semibold text-white">↑ 0.12</dd>
            </div>
            <div className="rounded-xl bg-slate-800/60 p-4">
              <dt className="text-slate-400">Uniqueness</dt>
              <dd className="text-xl font-semibold text-white">↓ 0.05</dd>
            </div>
            <div className="rounded-xl bg-slate-800/60 p-4">
              <dt className="text-slate-400">Accuracy</dt>
              <dd className="text-xl font-semibold text-white">↑ 0.04</dd>
            </div>
            <div className="rounded-xl bg-slate-800/60 p-4">
              <dt className="text-slate-400">Consistency</dt>
              <dd className="text-xl font-semibold text-white">↑ 0.03</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-400">Synthetic snapshot for demonstration purposes.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {featureHighlights.map((feature) => (
          <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
            <p className="mt-3 text-sm text-slate-600">{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-indigo-50 p-10 shadow-sm">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="flex flex-col items-center text-center">
            <span className="rounded-full bg-indigo-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              How fintech teams use Finova
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">
              From messy ledgers to regulator-ready narratives in three beats
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="relative flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-white p-6 text-left shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white">
                <span className="text-lg font-semibold">01</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Start with a sample file</h3>
              <p className="text-sm text-slate-600">
                Upload a KYB or client risk CSV. Finova spots missing owners, duplicate IDs, and outdated watchlist checks before an auditor does.
              </p>
              <div className="rounded-xl bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
                Try it: load the clean <em>clients_with_fatf_ofac.csv</em> file, then switch to the messy one to watch the score change.
              </div>
            </div>

            <div className="relative flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-white p-6 text-left shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white">
                <span className="text-lg font-semibold">02</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Check sanctions coverage</h3>
              <p className="text-sm text-slate-600">
                The dimension charts show where FATF, OFAC, or sector data is missing. Track the trend view to see whether each upload is closing the gaps.
              </p>
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-700">
                Save a trend screenshot before risk reviews so everyone sees the latest numbers.
              </div>
            </div>

            <div className="relative flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-white p-6 text-left shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white">
                <span className="text-lg font-semibold">03</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Plan fixes with your team</h3>
              <p className="text-sm text-slate-600">
                The Finova assistant turns each finding into clear next steps for ops, payments, and product teams—without exposing raw customer rows.
              </p>
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                Ask the assistant: “How can we improve uniqueness for high-risk merchants without slowing payouts?”
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
