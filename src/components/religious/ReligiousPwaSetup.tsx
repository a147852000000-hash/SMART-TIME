import React, { useEffect, useState } from 'react';

const THEME_KEY = 'smart-time-religious-theme';

export default function ReligiousPwaSetup() {
  const [lightMode, setLightMode] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === 'light'; } catch { return false; }
  });

  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"][data-religious-manifest]');
    if (!manifest) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      link.setAttribute('data-religious-manifest', 'true');
      document.head.appendChild(link);
    }
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-religious-theme]');
    if (!themeColor) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#0f172a';
      meta.setAttribute('data-religious-theme', 'true');
      document.head.appendChild(meta);
    }

    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch((error) => {
        console.warn('Religious PWA service worker registration failed:', error);
      });
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('religious-light-mode', lightMode);
    try { localStorage.setItem(THEME_KEY, lightMode ? 'light' : 'dark'); } catch { /* تفضيل المظهر اختياري */ }
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-religious-theme]');
    if (themeColor) themeColor.content = lightMode ? '#f8fafc' : '#0f172a';
  }, [lightMode]);

  return (
    <>
      <style>{`
        .religious-shell { transition: background-color .2s ease, color .2s ease; }
        html.religious-light-mode .religious-shell { background-color: #f8fafc !important; color: #0f172a !important; }
        html.religious-light-mode .religious-shell [class*="bg-slate-950"],
        html.religious-light-mode .religious-shell [class*="bg-slate-900"] { background-color: #f8fafc !important; }
        html.religious-light-mode .religious-shell [class*="bg-white/"] { background-color: #ffffff !important; }
        html.religious-light-mode .religious-shell [class*="text-slate-100"],
        html.religious-light-mode .religious-shell [class*="text-slate-200"],
        html.religious-light-mode .religious-shell [class*="text-slate-300"],
        html.religious-light-mode .religious-shell [class*="text-slate-400"] { color: #334155 !important; }
        html.religious-light-mode .religious-shell [class*="border-white/"] { border-color: #cbd5e1 !important; }
        html.religious-light-mode .religious-shell input,
        html.religious-light-mode .religious-shell select,
        html.religious-light-mode .religious-shell textarea { background-color: #ffffff !important; color: #0f172a !important; border-color: #cbd5e1 !important; }
        html.religious-light-mode .religious-shell option { background-color: #ffffff; color: #0f172a; }
        .religious-theme-toggle { position: fixed; z-index: 1000; top: 12px; left: 12px; display: inline-flex; align-items: center; gap: 7px; border: 1px solid rgba(148,163,184,.35); border-radius: 999px; background: rgba(15,23,42,.92); color: #f8fafc; padding: 9px 13px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 5px 18px rgba(0,0,0,.15); backdrop-filter: blur(10px); }
        html.religious-light-mode .religious-theme-toggle { background: rgba(255,255,255,.95); color: #0f172a; }
        @media (max-width: 480px) { .religious-theme-toggle { top: 8px; left: 8px; padding: 8px 10px; font-size: 11px; } }
      `}</style>
      <button type="button" className="religious-theme-toggle" onClick={() => setLightMode((current) => !current)} aria-label={lightMode ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح'} aria-pressed={lightMode}>
        <span aria-hidden="true">{lightMode ? '🌙' : '☀️'}</span>
        {lightMode ? 'الوضع الداكن' : 'الوضع الفاتح'}
      </button>
    </>
  );
}
