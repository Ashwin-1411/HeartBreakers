"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, Menu, UserCircle, X } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";

interface NavItem {
  label: string;
  href: string;
  authOnly?: boolean;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = useMemo<NavItem[]>(
    () => [
      { label: "Home", href: "/" },
      { label: "Dashboard", href: "/dashboard", authOnly: true },
      { label: "History", href: "/history", authOnly: true },
      { label: "Trend", href: "/trend", authOnly: true },
    ],
    [],
  );

  const filteredNav = navItems.filter((item) => (item.authOnly ? session.authenticated : true));

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <motion.header
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 inset-x-0 z-50"
    >
      <div
        className={`mx-auto mt-4 w-[95%] max-w-6xl rounded-2xl px-6 py-3 flex items-center justify-between transition-all backdrop-blur
          ${
            scrolled
              ? "bg-white/80 border border-slate-200 shadow-md"
              : "bg-white border border-slate-200/0"
          }`}
      >
        <Link href="/" className="text-lg font-semibold text-indigo-600">
          Finova
        </Link>

        <nav className="hidden md:flex items-center gap-2">
          {filteredNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors
                  ${
                    active
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-600 hover:bg-indigo-50"
                  }`}
              >
                {item.label}
              </Link>
            );
          })}

          {session.authenticated ? (
            <button
              onClick={handleLogout}
              className="ml-3 inline-flex items-center gap-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${pathname === "/login" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-indigo-50"}`}
              >
                Login
              </Link>
              <Link
                href="/register"
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${pathname === "/register" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-indigo-50"}`}
              >
                Register
              </Link>
            </div>
          )}

          {session.authenticated && session.user && (
            <div className="ml-4 flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">
              <UserCircle className="h-4 w-4" />
              {session.user.username}
            </div>
          )}
        </nav>

        <button
          onClick={() => setMobileOpen((value) => !value)}
          className="md:hidden text-slate-600"
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden mx-auto mt-2 w-[95%] max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg"
        >
          <div className="flex flex-col gap-2">
            {filteredNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${pathname === item.href ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-indigo-50"}`}
              >
                {item.label}
              </Link>
            ))}

            {session.authenticated ? (
              <button
                onClick={() => {
                  void handleLogout();
                  setMobileOpen(false);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${pathname === "/login" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-indigo-50"}`}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${pathname === "/register" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-indigo-50"}`}
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
