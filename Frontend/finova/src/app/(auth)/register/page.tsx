"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail, UserPlus } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";

export default function RegisterPage() {
  const router = useRouter();
  const { register, loading, session, error, clearError } = useSession();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username || !password) {
      setFormError("Username and password are required");
      return;
    }
    if (password !== confirm) {
      setFormError("Passwords do not match");
      return;
    }
    setFormError(null);
    clearError();
    setSubmitting(true);
    try {
      await register(username, password, email || undefined);
      router.replace("/dashboard");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Registration failed");
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
        <h1 className="text-2xl font-semibold text-slate-900">Create an account</h1>
        <p className="text-sm text-slate-600">Set up secure, session-based access to your data quality results.</p>
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
            <UserPlus className="h-4 w-4 text-slate-400" />
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="flex-1 border-none bg-transparent text-sm text-slate-900 outline-none"
              placeholder="finova_builder"
              autoComplete="username"
            />
          </div>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span>Email (optional)</span>
          <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
            <Mail className="h-4 w-4 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="flex-1 border-none bg-transparent text-sm text-slate-900 outline-none"
              placeholder="you@example.com"
              autoComplete="email"
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
              autoComplete="new-password"
            />
          </div>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span>Confirm password</span>
          <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
            <Lock className="h-4 w-4 text-slate-400" />
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="flex-1 border-none bg-transparent text-sm text-slate-900 outline-none"
              placeholder="••••••••"
              autoComplete="new-password"
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
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600">
        Already registered? {" "}
        <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Sign in
        </Link>
      </p>
    </div>
  );
}
