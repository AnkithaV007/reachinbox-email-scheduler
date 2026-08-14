import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { AuthError } from "next-auth";
import { Calendar, ShieldCheck, BarChart3, Lock, AlertCircle } from "lucide-react";

interface LoginPageProps {
  searchParams?: {
    error?: string;
  };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session) redirect("/dashboard");

  const hasError = !!searchParams?.error;

  async function handleCredentialsLogin(formData: FormData) {
    "use server";
    const email = formData.get("email")?.toString()?.trim();
    const password = formData.get("password")?.toString();

    if (!email || !password) {
      redirect("/login?error=InvalidCredentials");
    }

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: "/dashboard",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect("/login?error=InvalidCredentials");
      }
      throw error;
    }
  }

  return (
    <main className="min-h-screen w-full bg-slate-50 flex flex-col lg:flex-row text-slate-900 selection:bg-indigo-500 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* ────────────────────────────────────────────────────────── */}
      {/* LEFT SECTION: Brand & Product Introduction (58% width on lg) */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="hidden lg:flex lg:w-[58%] xl:w-[60%] flex-col justify-between border-r border-slate-200/90 bg-white p-10 xl:p-16 2xl:p-20 relative">
        {/* Subtle geometric grid background */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#0f172a 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
          aria-hidden="true"
        />

        {/* Top Branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 font-extrabold text-white text-lg shadow-sm">
              R
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">ReachInbox</span>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-100">
                  Email Scheduler
                </span>
              </div>
            </div>
          </div>

          {/* Center-left Headline & Copy */}
          <div className="mt-16 xl:mt-20 max-w-xl">
            <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
              Schedule. Send.<br />
              <span className="text-indigo-600">Deliver with Confidence.</span>
            </h1>
            <p className="mt-5 text-sm xl:text-base text-slate-600 leading-relaxed font-normal">
              Schedule outbound emails, manage delivery queues, and track campaign performance from one workspace.
            </p>
          </div>

          {/* 3 Compact Product Benefits */}
          <div className="mt-12 xl:mt-14 space-y-6 max-w-lg">
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/80">
                <Calendar className="h-5 w-5 stroke-[2]" />
              </div>
              <div className="pt-0.5">
                <h2 className="text-sm font-bold text-slate-900">Schedule Emails</h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                  Send campaigns at exactly the right time.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/80">
                <ShieldCheck className="h-5 w-5 stroke-[2]" />
              </div>
              <div className="pt-0.5">
                <h2 className="text-sm font-bold text-slate-900">Reliable Delivery</h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                  Rate limits, controlled delays and reliable queue processing.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/80">
                <BarChart3 className="h-5 w-5 stroke-[2]" />
              </div>
              <div className="pt-0.5">
                <h2 className="text-sm font-bold text-slate-900">Track Results</h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                  Monitor scheduled and delivered emails in real time.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Left Footer */}
        <div className="relative z-10 pt-10 border-t border-slate-100 mt-12 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-800">Reliable Email Scheduling</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Built for controlled delivery, scheduling and tracking.
            </p>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Lock className="h-3 w-3" />
            <span>256-bit Encrypted</span>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* RIGHT SECTION: SaaS Authentication Card (42% width on lg)  */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="w-full lg:w-[42%] xl:w-[40%] flex flex-col justify-between p-6 sm:p-10 lg:p-12 bg-[#F8FAFC] min-h-screen">
        {/* Mobile Header Branding (visible only on small screens) */}
        <div className="lg:hidden flex items-center gap-3 mb-6">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 font-extrabold text-white text-base shadow-xs">
            R
          </span>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900">ReachInbox</span>
            <span className="ml-2 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-100">
              Scheduler
            </span>
          </div>
        </div>

        {/* Centered Auth Card Container */}
        <div className="my-auto mx-auto w-full max-w-[440px]">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-9 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_24px_rgba(0,0,0,0.04)]">
            {/* Small R Logo */}
            <div className="flex justify-center">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 font-extrabold text-white text-base shadow-sm">
                R
              </span>
            </div>

            {/* Header Text */}
            <div className="mt-4 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Welcome back
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Sign in to manage your scheduled email campaigns.
              </p>
            </div>

            {/* Error Banner */}
            {hasError && (
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200/80 px-3.5 py-2.5 text-xs text-rose-700 font-medium animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>Invalid email or password.</span>
              </div>
            )}

            {/* Google Authentication Button */}
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/dashboard" });
              }}
              className="mt-6"
            >
              <button
                id="google-login-btn"
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-emerald-600 px-4 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 cursor-pointer"
              >
                <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200/90" />
              <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                or continue with email
              </span>
              <div className="h-px flex-1 bg-slate-200/90" />
            </div>

            {/* Email / Password Form */}
            <form action={handleCredentialsLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  required
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              {/* Green Sign In Button */}
              <button
                id="email-login-btn"
                type="submit"
                className="w-full rounded-xl bg-emerald-600 py-2.5 px-4 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.99] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 cursor-pointer mt-1"
              >
                Sign in
              </button>
            </form>

            {/* Subtle Security Notice */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Protected by secure enterprise-grade authentication.</span>
            </div>
          </div>
        </div>

        {/* Minimal Bottom Footer */}
        <footer className="mt-8 text-center text-[11px] text-slate-400">
          <p>© 2026 ReachInbox. All rights reserved.</p>
        </footer>
      </section>
    </main>
  );
}
