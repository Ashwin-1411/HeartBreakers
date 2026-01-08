import Link from "next/link";

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
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-16">
      <div className="grid gap-10 rounded-3xl border border-slate-200 bg-white p-10 shadow-sm md:grid-cols-2">
        <div className="space-y-6">
          <span className="inline-flex items-center rounded-full bg-indigo-100 px-4 py-1 text-sm font-medium text-indigo-700">
            Ontology-first data quality
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            See data quality in context, explain it to humans, and ship better decisions faster.
          </h1>
          <p className="text-lg text-slate-600">
            Finova combines deterministic profiling, knowledge-graph reasoning, and GenAI explanations so you can diagnose issues without exposing raw data. Perfect for hackathon judges on desktop or mobile.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-500"
            >
              Create account
            </Link>
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
    </section>
  );
}
