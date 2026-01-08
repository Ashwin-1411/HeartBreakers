"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = [
    { label: "Home", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
  ];

  return (
    <motion.header
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 inset-x-0 z-50"
    >
      <div
        className={`mx-auto mt-4 w-[95%] max-w-7xl rounded-2xl px-6 py-3 flex items-center justify-between transition-all
          ${
            scrolled
              ? "backdrop-blur-lg bg-white/70 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 shadow-md"
              : "bg-transparent"
          }`}
      >
        {/* Logo */}
        <Link href="/" className="text-lg font-bold text-zinc-900 dark:text-white">
          Fin<span className="text-indigo-600">ova</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition
                  ${
                    active
                      ? "bg-indigo-600 text-white shadow"
                      : "text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-zinc-800"
                  }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-zinc-700 dark:text-zinc-300"
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden mx-auto mt-2 w-[95%] max-w-7xl rounded-2xl backdrop-blur-lg bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 p-4 space-y-2 shadow-lg"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`block px-4 py-2 rounded-xl font-semibold
                ${
                  pathname === item.href
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-zinc-800"
                }`}
            >
              {item.label}
            </Link>
          ))}
        </motion.div>
      )}
    </motion.header>
  );
}
