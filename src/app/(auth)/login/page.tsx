"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { routeByRole } from "@/lib/roleRouting";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(
        error.message.includes("Invalid login credentials")
          ? "Wrong email or password — please try again"
: error.message.includes("Email not confirmed")
            ? "Your email isn't confirmed yet — check your inbox for the verification link"
: error.message
      );
      setLoading(false);
      return;
    }
    const dest = await routeByRole();
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={48} />
            <span className="text-sm font-bold tracking-tight">RakshaSetu</span>
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
          >
            Register
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">
            Log in to your role&apos;s console
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8"
        >
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text": "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password": "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-foreground"
              >
                {showPassword ? "Hide": "Show"}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-[var(--color-primary)]">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? "Signing in...": "Sign In"}
          </Button>

          <p className="text-center text-sm text-muted">
            No account?{" "}
            <Link href="/register" className="font-medium text-[var(--color-accent)]">
              Register
            </Link>
          </p>
        </form>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted">
          In an emergency and can&apos;t log in?{" "}
          <Link href="/report" className="font-semibold underline">
            Report without an account
          </Link>
        </p>
      </main>
    </div>
  );
}
