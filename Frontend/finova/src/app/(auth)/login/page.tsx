"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, User } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";

export default function LoginPage() {
  const router = useRouter();
  const { login, loading, session, error, clearError } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username || !password) {
      setFormError("Enter both username and password");
      return;
    }
    setFormError(null);
    clearError();
    setSubmitting(true);
    try {
      await login(username, password);
      router.replace("/dashboard");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!loading && session.authenticated) {
      router.replace("/dashboard");
    }
  }, [loading, session.authenticated, router]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
        <p className="text-sm text-slate-600">Sign in to continue analysing datasets.</p>
      </div>

      {(formError || error) && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {formError || error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          <span>Username</span>
          <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
            <User className="h-4 w-4 text-slate-400" />
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="flex-1 border-none bg-transparent text-sm text-slate-900 outline-none"
              placeholder="hackathon_team"
              autoComplete="username"
            />
          </div>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span>Password</span>
          <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
            <Lock className="h-4 w-4 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="flex-1 border-none bg-transparent text-sm text-slate-900 outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600">
        Need an account? {" "}
        <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Register
        </Link>
      </p>
    </div>
  );
}
