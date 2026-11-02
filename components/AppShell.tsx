"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, DataProvider, fmt, teacherSlug, useData } from "@/components/data";
import { IconBoard, IconChevron, IconClose, IconLogout, IconRefresh, IconSearch, IconSend, IconUsers } from "@/components/icons";

const NAV = [
  { href: "/", label: "Bugun", Icon: IconBoard },
  { href: "/teachers", label: "O'qituvchilar", Icon: IconUsers },
  { href: "/bot", label: "Bot", Icon: IconSend },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <DataProvider>
      <a className="skip-link" href="#main">Asosiy qismga o&apos;tish</a>
      <TopBar onSearch={() => setPaletteOpen(true)} />
      <main id="main" className="page">
        <DataGate>{children}</DataGate>
      </main>
      <TabBar />
      {paletteOpen && <Palette onClose={() => setPaletteOpen(false)} />}
      <Toasts />
    </DataProvider>
  );
}

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function TopBar({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  const { refreshing, reload, data } = useData();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand" aria-label="EMU jadval, bosh sahifa">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span className="brand-name">EMU jadval</span>
        </Link>

        <nav className="nav" aria-label="Bo'limlar">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="nav-link" aria-current={isActive(pathname, n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>

        <button className="search-trigger" onClick={onSearch} aria-label="O'qituvchini topish">
          <IconSearch />
          <span className="search-trigger-text">O&apos;qituvchini topish</span>
          <kbd>⌘K</kbd>
        </button>

        <div className="topbar-actions">
          <button className="icon-btn" onClick={() => reload(true)} disabled={refreshing || !data} title="Jadvalni edupage'dan yangilash" aria-label="Jadvalni yangilash">
            <IconRefresh className={refreshing ? "spin" : ""} />
          </button>
          <button
            className="icon-btn"
            title="Chiqish"
            aria-label="Chiqish"
            onClick={async () => { await fetch("/api/logout", { method: "POST" }); location.href = "/login"; }}
          >
            <IconLogout />
          </button>
        </div>
      </div>
    </header>
  );
}

// Mobil: pastki tab bar (ilova kabi)
function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Bo'limlar">
      {NAV.map(({ href, label, Icon }) => (
        <Link key={href} href={href} className="tab" aria-current={isActive(pathname, href) ? "page" : undefined}>
          <Icon />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

// Istalgan o'qituvchiga tez o'tish: desktop'da markazda, mobil'da to'liq ekran
function Palette({ onClose }: { onClose: () => void }) {
  const { data, linked } = useData();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    input.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const results = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return [...data.teachers].filter((t) => t.count > 0).sort((a, b) => Number(linked.has(b.id)) - Number(linked.has(a.id)) || b.count - a.count).slice(0, 8);
    return data.teachers.filter((t) => t.name.toLowerCase().includes(needle)).slice(0, 30);
  }, [q, data, linked]);

  useEffect(() => {
    list.current?.querySelector(`[data-i="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function go(id: string) {
    onClose();
    router.push(`/teachers/${teacherSlug(id)}`);
  }

  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="O'qituvchini topish">
        <div className="palette-input">
          <IconSearch />
          <input
            ref={input}
            type="search"
            placeholder="Ism yoki familiya"
            aria-label="Ism yoki familiya"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="palette-results"
            autoComplete="off"
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === "Enter" && results[cursor]) go(results[cursor].id);
              if (e.key === "Escape") onClose();
            }}
          />
          <button className="icon-btn" onClick={onClose} aria-label="Yopish"><IconClose /></button>
        </div>
        <p className="palette-hint">{q.trim() ? `${results.length} ta natija` : "Ko'p dars beradigan va Telegram'ga ulanganlar"}</p>
        <ul className="palette-results" id="palette-results" role="listbox" ref={list}>
          {results.map((t, i) => (
            <li key={t.id} role="option" aria-selected={i === cursor} data-i={i}>
              <button onClick={() => go(t.id)} onMouseEnter={() => setCursor(i)}>
                <Avatar name={t.name} color={t.color} size="sm" />
                <span className="palette-name">{t.name}</span>
                {linked.has(t.id) && <span className="tg-flag">TG</span>}
                <span className="palette-count">{fmt(t.count)} dars</span>
                <IconChevron className="palette-chevron" />
              </button>
            </li>
          ))}
          {q.trim() && results.length === 0 && <li className="palette-empty">Bunday o&apos;qituvchi topilmadi.</li>}
        </ul>
      </div>
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
      <div className="sk sk-hero" />
      <div className="sk-chips">{Array.from({ length: 6 }, (_, i) => <div key={i} className="sk sk-chip" />)}</div>
      {Array.from({ length: 5 }, (_, i) => <div key={i} className="sk sk-row" />)}
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
