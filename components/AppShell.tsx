"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DataProvider, teacherSlug, useData } from "@/components/data";

const NAV = [
  { href: "/", label: "Bugun" },
  { href: "/teachers", label: "O'qituvchilar" },
  { href: "/bot", label: "Bot" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <a className="skip-link" href="#main">Asosiy qismga o&apos;tish</a>
      <TopBar />
      <main id="main" className="page">
        <DataGate>{children}</DataGate>
      </main>
      <Toasts />
    </DataProvider>
  );
}

function TopBar() {
  const pathname = usePathname();
  const { refreshing, reload, data } = useData();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand" aria-label="EMU jadval, bosh sahifa">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span className="brand-name">EMU jadval</span>
        </Link>

        <nav className="nav" aria-label="Bo'limlar">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="nav-link" aria-current={active(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>

        <TeacherSearch />

        <div className="topbar-actions">
          <button
            className="icon-btn"
            onClick={() => reload(true)}
            disabled={refreshing || !data}
            title="Jadvalni edupage'dan qayta yuklash"
            aria-label="Jadvalni yangilash"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className={refreshing ? "spin" : ""}>
              <path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.3h-3.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            className="icon-btn"
            title="Chiqish"
            aria-label="Chiqish"
            onClick={async () => { await fetch("/api/logout", { method: "POST" }); location.href = "/login"; }}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M12.5 13.5 16 10l-3.5-3.5M16 10H8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

// ⌘K / Ctrl+K: istalgan o'qituvchiga tez o'tish
function TeacherSearch() {
  const { data, linked } = useData();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || !data) return [];
    return data.teachers.filter((t) => t.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [q, data]);

  function go(id: string) {
    setQ("");
    setOpen(false);
    input.current?.blur();
    router.push(`/teachers/${teacherSlug(id)}`);
  }

  return (
    <div className="search" role="search">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="search-icon">
        <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="m13.2 13.2 3.3 3.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        ref={input}
        type="search"
        placeholder="O'qituvchini topish"
        aria-label="O'qituvchini topish"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="search-results"
        autoComplete="off"
        value={q}
        onChange={(e) => { setQ(e.target.value); setCursor(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
          if (e.key === "Enter" && results[cursor]) go(results[cursor].id);
          if (e.key === "Escape") { setQ(""); input.current?.blur(); }
        }}
      />
      <kbd className="search-kbd" aria-hidden="true">⌘K</kbd>
      {open && results.length > 0 && (
        <ul className="search-results" id="search-results" role="listbox">
          {results.map((t, i) => (
            <li key={t.id} role="option" aria-selected={i === cursor}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => go(t.id)} onMouseEnter={() => setCursor(i)}>
                <span className="swatch" style={{ ["--c" as string]: t.color }} />
                <span className="search-name">{t.name}</span>
                {linked.has(t.id) && <span className="tg-flag">TG</span>}
                <span className="search-count">{t.count} dars</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Jadval kelguncha skelet, xato bo'lsa tushunarli xabar
function DataGate({ children }: { children: React.ReactNode }) {
  const { data, error, reload } = useData();
  if (data) return <>{children}</>;
  if (error) {
    return (
      <div className="empty-state">
        <h1>Jadvalni yuklab bo&apos;lmadi</h1>
        <p>{error}</p>
        <p>Tarmoq holatini <a href="/api/check" target="_blank" rel="noreferrer">/api/check</a> sahifasida ko&apos;ring.</p>
        <button className="btn btn-ink" onClick={() => reload()}>Qayta urinish</button>
      </div>
    );
  }
  return (
    <div className="skeleton-page" aria-busy="true" aria-label="Jadval yuklanmoqda">
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="sk-rail">{Array.from({ length: 6 }, (_, i) => <div key={i} className="sk sk-stop" />)}</div>
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="sk sk-row" />)}
    </div>
  );
}

function Toasts() {
  const { toasts } = useData();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={"toast " + t.tone}>{t.text}</div>
      ))}
    </div>
  );
}
