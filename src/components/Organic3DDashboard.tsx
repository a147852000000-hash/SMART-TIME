import React from 'react';
import { AppView } from '../types';
import { ArrowUpRight } from 'lucide-react';

interface OrganicCardItem {
  id: AppView;
  titleAr: string;
  subtitleAr: string;
  category: string;
  themeColor: {
    bgLight: string;
    border: string;
    glow: string;
    text: string;
    badge: string;
    blobPath: string;
    cardGradient: string;
    accentGlow: string;
  };
  render3DIcon: () => React.ReactNode;
}

interface Organic3DDashboardProps {
  onNavigate: (view: AppView) => void;
  isAr?: boolean;
}

export const Organic3DDashboard: React.FC<Organic3DDashboardProps> = ({
  onNavigate,
  isAr = true,
}) => {
  const cards: OrganicCardItem[] = [
    // 1. المصروفات (Top-Left in visual LTR, Right/Left based on composition)
    {
      id: 'expenses',
      titleAr: 'المصروفات',
      subtitleAr: 'تتبع وإدارة مصروفاتك وحساباتك',
      category: 'مالية وحسابات',
      themeColor: {
        bgLight: 'bg-emerald-50/80 dark:bg-emerald-950/40',
        border: 'border-emerald-200/90 dark:border-emerald-700/60',
        glow: 'rgba(16, 185, 129, 0.25)',
        text: 'text-emerald-950 dark:text-emerald-100',
        badge: 'bg-emerald-100/90 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
        cardGradient: 'from-emerald-100/60 via-teal-50/40 to-white/90 dark:from-emerald-950/50 dark:via-slate-900/60 dark:to-slate-950/80',
        accentGlow: 'from-emerald-400/30 to-teal-300/10',
        blobPath: 'M 18,35 C 10,65 25,120 75,130 C 125,140 180,120 185,75 C 190,30 145,10 95,12 C 45,14 26,5 18,35 Z',
      },
      render3DIcon: () => (
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center filter drop-shadow-md">
          {/* Subtle soft organic aura */}
          <div className="absolute inset-2 bg-gradient-to-tr from-emerald-400/25 via-amber-300/30 to-emerald-200/10 rounded-full blur-lg animate-pulse" />
          {/* 3D Money Bag SVG */}
          <svg viewBox="0 0 160 160" className="w-full h-full relative z-10">
            <defs>
              <linearGradient id="goldBagGrad" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="35%" stopColor="#eab308" />
                <stop offset="85%" stopColor="#ca8a04" />
                <stop offset="100%" stopColor="#a16207" />
              </linearGradient>
              <linearGradient id="goldCoinGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef9c3" />
                <stop offset="40%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <linearGradient id="bagRopeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#78350f" />
                <stop offset="50%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
              <filter id="soft3DShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#0f766e" floodOpacity="0.3" />
              </filter>
            </defs>

            {/* Background Coins */}
            <g transform="translate(18, 95)" filter="url(#soft3DShadow)">
              <ellipse cx="22" cy="18" rx="16" ry="9" fill="url(#goldCoinGrad)" stroke="#ca8a04" strokeWidth="1.5" />
              <ellipse cx="22" cy="14" rx="16" ry="9" fill="url(#goldCoinGrad)" stroke="#fef08a" strokeWidth="1" />
              <text x="22" y="17" fontSize="10" fontWeight="bold" fill="#854d0e" textAnchor="middle">$</text>
            </g>

            {/* Main Money Bag Body */}
            <g filter="url(#soft3DShadow)">
              {/* Bag ruffle top */}
              <path
                d="M 62,38 C 55,22 68,16 80,18 C 92,16 105,22 98,38 Z"
                fill="url(#goldBagGrad)"
                stroke="#a16207"
                strokeWidth="1.5"
              />
              {/* Rope tie */}
              <rect x="61" y="38" width="38" height="6" rx="3" fill="url(#bagRopeGrad)" stroke="#451a03" strokeWidth="1" />
              <circle cx="80" cy="41" r="3" fill="#fbbf24" />
              
              {/* Main Sack */}
              <path
                d="M 64,44 C 44,48 30,75 32,105 C 34,132 55,146 80,146 C 105,146 126,132 128,105 C 130,75 116,48 96,44 Z"
                fill="url(#goldBagGrad)"
                stroke="#a16207"
                strokeWidth="1.5"
              />
              {/* Embossed Dollar Badge */}
              <ellipse cx="80" cy="98" rx="21" ry="24" fill="#ca8a04" opacity="0.3" />
              <text
                x="80"
                y="108"
                fontSize="32"
                fontFamily="system-ui, sans-serif"
                fontWeight="900"
                fill="#fef08a"
                stroke="#78350f"
                strokeWidth="1.2"
                textAnchor="middle"
                filter="drop-shadow(0 2px 2px rgba(0,0,0,0.25))"
              >
                $
              </text>

              {/* Front Right Stack of Coins */}
              <g transform="translate(102, 108)">
                <ellipse cx="14" cy="18" rx="14" ry="7" fill="url(#goldCoinGrad)" stroke="#ca8a04" strokeWidth="1" />
                <ellipse cx="14" cy="13" rx="14" ry="7" fill="url(#goldCoinGrad)" stroke="#fef08a" strokeWidth="1" />
                <ellipse cx="14" cy="8" rx="14" ry="7" fill="url(#goldCoinGrad)" stroke="#ca8a04" strokeWidth="1" />
                <text x="14" y="10" fontSize="8" fontWeight="bold" fill="#854d0e" textAnchor="middle">$</text>
              </g>
            </g>
          </svg>
        </div>
      ),
    },

    // 2. المحادثات (Top-Right)
    {
      id: 'chat',
      titleAr: 'المحادثات',
      subtitleAr: 'رسائلك ومحادثاتك الخاصة',
      category: 'تواصل فوري',
      themeColor: {
        bgLight: 'bg-sky-50/80 dark:bg-sky-950/40',
        border: 'border-sky-200/90 dark:border-sky-700/60',
        glow: 'rgba(56, 189, 248, 0.25)',
        text: 'text-sky-950 dark:text-sky-100',
        badge: 'bg-sky-100/90 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
        cardGradient: 'from-sky-100/60 via-blue-50/40 to-white/90 dark:from-sky-950/50 dark:via-slate-900/60 dark:to-slate-950/80',
        accentGlow: 'from-sky-400/30 to-indigo-300/10',
        blobPath: 'M 20,40 C 30,10 110,8 150,30 C 180,50 175,115 135,135 C 95,150 40,140 20,105 C 5,75 10,55 20,40 Z',
      },
      render3DIcon: () => (
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center filter drop-shadow-md">
          <div className="absolute inset-2 bg-gradient-to-tr from-sky-300/30 via-indigo-300/20 to-blue-200/10 rounded-full blur-lg" />
          <svg viewBox="0 0 160 160" className="w-full h-full relative z-10">
            <defs>
              <linearGradient id="chatBubbleGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#bae6fd" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="chatSmallBubble" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e0f2fe" />
                <stop offset="100%" stopColor="#7dd3fc" />
              </linearGradient>
            </defs>

            {/* Back Glass Droplets */}
            <circle cx="125" cy="40" r="14" fill="url(#chatSmallBubble)" opacity="0.6" stroke="#38bdf8" strokeWidth="1" />
            <circle cx="35" cy="115" r="10" fill="url(#chatSmallBubble)" opacity="0.5" stroke="#38bdf8" strokeWidth="1" />

            {/* Radio Signal Waves */}
            <path d="M 115,25 A 25,25 0 0,1 135,45" fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
            <path d="M 122,18 A 36,36 0 0,1 148,45" fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" opacity="0.5" />

            {/* Main 3D Frosted Speech Bubble */}
            <g transform="translate(15, 20)">
              <path
                d="M 25,15 C 65,-2 105,4 118,35 C 128,60 115,92 88,102 C 78,105 70,116 65,124 C 60,118 56,105 48,102 C 18,94 4,68 12,38 C 16,24 20,18 25,15 Z"
                fill="url(#chatBubbleGrad)"
                stroke="#e0f2fe"
                strokeWidth="2.5"
                filter="drop-shadow(0 6px 12px rgba(2, 132, 199, 0.35))"
              />
              {/* Glass Glare */}
              <ellipse cx="60" cy="30" rx="34" ry="12" fill="#ffffff" opacity="0.45" />

              {/* Typing Dots inside bubble */}
              <circle cx="45" cy="62" r="6.5" fill="#ffffff" filter="drop-shadow(0 2px 2px rgba(0,0,0,0.15))" />
              <circle cx="65" cy="62" r="6.5" fill="#ffffff" filter="drop-shadow(0 2px 2px rgba(0,0,0,0.15))" />
              <circle cx="85" cy="62" r="6.5" fill="#ffffff" filter="drop-shadow(0 2px 2px rgba(0,0,0,0.15))" />
            </g>
          </svg>
        </div>
      ),
    },

    // 3. الطعام (Center-Right)
    {
      id: 'food',
      titleAr: 'الطعام',
      subtitleAr: 'استكشف وصفاتك ومطاعمك',
      category: 'المطبخ والوصفات',
      themeColor: {
        bgLight: 'bg-rose-50/80 dark:bg-rose-950/40',
        border: 'border-rose-200/90 dark:border-rose-700/60',
        glow: 'rgba(244, 63, 94, 0.25)',
        text: 'text-rose-950 dark:text-rose-100',
        badge: 'bg-rose-100/90 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
        cardGradient: 'from-rose-100/60 via-orange-50/40 to-white/90 dark:from-rose-950/50 dark:via-slate-900/60 dark:to-slate-950/80',
        accentGlow: 'from-rose-400/30 to-orange-300/10',
        blobPath: 'M 30,30 C 70,12 125,20 150,55 C 170,85 160,125 125,140 C 85,152 30,135 15,100 C 5,70 12,40 30,30 Z',
      },
      render3DIcon: () => (
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center filter drop-shadow-md">
          <div className="absolute inset-2 bg-gradient-to-tr from-rose-300/30 via-orange-200/30 to-amber-200/20 rounded-full blur-lg" />
          <svg viewBox="0 0 160 160" className="w-full h-full relative z-10">
            <defs>
              <linearGradient id="clocheDomeGrad" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#ffe4e6" />
                <stop offset="30%" stopColor="#f43f5e" />
                <stop offset="70%" stopColor="#e11d48" />
                <stop offset="100%" stopColor="#9f1239" />
              </linearGradient>
              <linearGradient id="silverPlateGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#fed7aa" />
                <stop offset="100%" stopColor="#fb923c" />
              </linearGradient>
            </defs>

            {/* Layered Organic Serving Platter */}
            <ellipse cx="80" cy="120" rx="64" ry="24" fill="#fed7aa" opacity="0.65" />
            <ellipse cx="80" cy="115" rx="58" ry="20" fill="url(#silverPlateGrad)" stroke="#f97316" strokeWidth="1.5" />

            {/* 3D Cloche Dome */}
            <g transform="translate(0, -6)">
              {/* Knob */}
              <circle cx="80" cy="46" r="8" fill="#fda4af" stroke="#be123c" strokeWidth="1.5" />
              <rect x="77" y="52" width="6" height="5" fill="#be123c" />

              {/* Dome */}
              <path
                d="M 32,100 C 32,60 52,56 80,56 C 108,56 128,60 128,100 Z"
                fill="url(#clocheDomeGrad)"
                stroke="#ffe4e6"
                strokeWidth="1.5"
                filter="drop-shadow(0 4px 6px rgba(159, 18, 57, 0.3))"
              />
              {/* Specular Highlight */}
              <path d="M 45,95 C 45,72 58,66 75,64" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />

              {/* Rim */}
              <ellipse cx="80" cy="100" rx="49" ry="9" fill="#e11d48" stroke="#ffe4e6" strokeWidth="1.5" />
            </g>

            {/* Crossed Fork and Knife */}
            <g transform="translate(80, 85) rotate(-35) scale(0.65)">
              {/* Knife */}
              <path d="M -4,-35 L 4,-35 L 4,10 L 1,35 L -1,35 L -4,10 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
            </g>
            <g transform="translate(80, 85) rotate(35) scale(0.65)">
              {/* Fork */}
              <path d="M -6,-35 L -6,-15 L -2,-15 L -2,35 L 2,35 L 2,-15 L 6,-15 L 6,-35 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
            </g>
          </svg>
        </div>
      ),
    },

    // 4. الرحلات (Middle-Left)
    {
      id: 'trips',
      titleAr: 'الرحلات',
      subtitleAr: 'خطط لمغامرتك القادمة',
      category: 'الملاحة والخرائط',
      themeColor: {
        bgLight: 'bg-blue-50/80 dark:bg-blue-950/40',
        border: 'border-blue-200/90 dark:border-blue-700/60',
        glow: 'rgba(37, 99, 235, 0.25)',
        text: 'text-blue-950 dark:text-blue-100',
        badge: 'bg-blue-100/90 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
        cardGradient: 'from-blue-100/60 via-indigo-50/40 to-white/90 dark:from-blue-950/50 dark:via-slate-900/60 dark:to-slate-950/80',
        accentGlow: 'from-blue-400/30 to-cyan-300/10',
        blobPath: 'M 25,35 C 10,70 15,120 55,140 C 95,155 145,135 155,95 C 165,55 130,15 90,12 C 55,10 32,15 25,35 Z',
      },
      render3DIcon: () => (
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center filter drop-shadow-md">
          <div className="absolute inset-2 bg-gradient-to-tr from-blue-300/30 via-indigo-300/20 to-cyan-200/20 rounded-full blur-lg" />
          <svg viewBox="0 0 160 160" className="w-full h-full relative z-10">
            <defs>
              <linearGradient id="compassRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="40%" stopColor="#94a3b8" />
                <stop offset="80%" stopColor="#475569" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
              <linearGradient id="compassFace" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="100%" stopColor="#172554" />
              </linearGradient>
              <linearGradient id="mapGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e0f2fe" />
                <stop offset="100%" stopColor="#bae6fd" />
              </linearGradient>
            </defs>

            {/* Folded Map at bottom-left */}
            <g transform="translate(12, 85) rotate(-8)">
              <polygon points="5,25 25,12 45,25 65,12 65,55 45,68 25,55 5,68" fill="url(#mapGradient)" stroke="#38bdf8" strokeWidth="1.2" />
              <path d="M 25,12 L 25,55 M 45,25 L 45,68" stroke="#0284c7" strokeWidth="1" strokeDasharray="2,2" opacity="0.7" />
              <circle cx="35" cy="38" r="3" fill="#ef4444" />
            </g>

            {/* Main 3D Compass */}
            <g transform="translate(58, 24)">
              {/* Outer Casing Ring & Loop */}
              <ellipse cx="44" cy="48" rx="42" ry="42" fill="url(#compassRing)" stroke="#cbd5e1" strokeWidth="2" filter="drop-shadow(0 6px 10px rgba(15,23,42,0.4))" />
              <circle cx="44" cy="6" r="6" fill="none" stroke="#94a3b8" strokeWidth="2.5" />

              {/* Inner Face */}
              <circle cx="44" cy="48" r="34" fill="url(#compassFace)" stroke="#60a5fa" strokeWidth="1.5" />
              
              {/* Compass Marks */}
              <circle cx="44" cy="48" r="30" fill="none" stroke="#93c5fd" strokeWidth="0.8" strokeDasharray="2,6" />
              
              {/* Cardinal Letters */}
              <text x="44" y="27" fontSize="9" fontWeight="bold" fill="#f8fafc" textAnchor="middle">N</text>
              <text x="44" y="75" fontSize="8" fontWeight="bold" fill="#93c5fd" textAnchor="middle">S</text>
              <text x="68" y="51" fontSize="8" fontWeight="bold" fill="#93c5fd" textAnchor="middle">E</text>
              <text x="20" y="51" fontSize="8" fontWeight="bold" fill="#93c5fd" textAnchor="middle">W</text>

              {/* Compass Needle (Red & Blue) */}
              <polygon points="44,22 49,48 44,45 39,48" fill="#ef4444" stroke="#fca5a5" strokeWidth="0.5" />
              <polygon points="44,74 49,48 44,45 39,48" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
              <circle cx="44" cy="48" r="4" fill="#fbbf24" stroke="#78350f" strokeWidth="1" />
            </g>

            {/* Location Pin */}
            <g transform="translate(48, 14)">
              <path d="M 12,0 C 5,0 0,5 0,12 C 0,20 12,32 12,32 C 12,32 24,20 24,12 C 24,5 19,0 12,0 Z" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
              <circle cx="12" cy="11" r="4.5" fill="#ffffff" />
            </g>
          </svg>
        </div>
      ),
    },

    // 5. الملاحظات (Middle-Right)
    {
      id: 'notes',
      titleAr: 'الملاحظات',
      subtitleAr: 'سجل أفكارك ومهامك اليومية',
      category: 'المفكرة والمهام',
      themeColor: {
        bgLight: 'bg-teal-50/80 dark:bg-teal-950/40',
        border: 'border-teal-200/90 dark:border-teal-700/60',
        glow: 'rgba(20, 184, 166, 0.25)',
        text: 'text-teal-950 dark:text-teal-100',
        badge: 'bg-teal-100/90 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200',
        cardGradient: 'from-teal-100/60 via-cyan-50/40 to-white/90 dark:from-teal-950/50 dark:via-slate-900/60 dark:to-slate-950/80',
        accentGlow: 'from-teal-400/30 to-emerald-300/10',
        blobPath: 'M 20,30 C 55,10 120,15 145,45 C 165,75 160,115 130,135 C 95,150 45,145 25,115 C 5,85 10,45 20,30 Z',
      },
      render3DIcon: () => (
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center filter drop-shadow-md">
          <div className="absolute inset-2 bg-gradient-to-tr from-teal-300/30 via-emerald-200/20 to-cyan-200/20 rounded-full blur-lg" />
          <svg viewBox="0 0 160 160" className="w-full h-full relative z-10">
            <defs>
              <linearGradient id="bookCoverGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#b45309" />
                <stop offset="50%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
              <linearGradient id="penGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="50%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
            </defs>

            {/* 3D Open Notebook */}
            <g transform="translate(25, 30) rotate(-6)">
              {/* Back Leather Cover */}
              <rect x="0" y="0" width="105" height="85" rx="6" fill="url(#bookCoverGrad)" stroke="#78350f" strokeWidth="2" filter="drop-shadow(0 6px 10px rgba(0,0,0,0.25))" />

              {/* Left Page (White/Cream) */}
              <rect x="4" y="4" width="46" height="77" rx="3" fill="#fefce8" stroke="#cbd5e1" strokeWidth="1" />
              {/* Right Page (White/Cream) */}
              <rect x="55" y="4" width="46" height="77" rx="3" fill="#fefce8" stroke="#cbd5e1" strokeWidth="1" />
              
              {/* Center Spine Crease */}
              <rect x="50" y="4" width="5" height="77" fill="#e2e8f0" />

              {/* Lined Pages on Left */}
              <line x1="10" y1="18" x2="44" y2="18" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="10" y1="28" x2="44" y2="28" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="10" y1="38" x2="36" y2="38" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="10" y1="48" x2="42" y2="48" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="10" y1="58" x2="38" y2="58" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />

              {/* Checkboxes / Lines on Right */}
              <rect x="62" y="16" width="6" height="6" rx="1.5" fill="#3b82f6" />
              <line x1="72" y1="20" x2="94" y2="20" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
              <rect x="62" y="28" width="6" height="6" rx="1.5" fill="#10b981" />
              <line x1="72" y1="32" x2="94" y2="32" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
              <rect x="62" y="40" width="6" height="6" rx="1.5" fill="#f59e0b" />
              <line x1="72" y1="44" x2="94" y2="44" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
            </g>

            {/* Stylus / Fountain Pen resting on notebook */}
            <g transform="translate(108, 38) rotate(32)">
              <rect x="-3" y="-30" width="6" height="48" rx="2" fill="url(#penGrad)" stroke="#1e293b" strokeWidth="1" />
              {/* Gold nib */}
              <polygon points="-3,18 3,18 0,28" fill="#fbbf24" stroke="#b45309" strokeWidth="0.8" />
              <circle cx="0" cy="22" r="0.8" fill="#1e293b" />
              {/* Pen clip */}
              <rect x="3" y="-28" width="2" height="18" rx="1" fill="#fbbf24" />
            </g>
          </svg>
        </div>
      ),
    },

    // 6. الرياضة (Bottom-Center)
    {
      id: 'sports',
      titleAr: 'الرياضة',
      subtitleAr: 'تتبع إنجازاتك الرياضية',
      category: 'اللياقة والبطولات',
      themeColor: {
        bgLight: 'bg-amber-50/80 dark:bg-amber-950/40',
        border: 'border-amber-200/90 dark:border-amber-700/60',
        glow: 'rgba(245, 158, 11, 0.25)',
        text: 'text-amber-950 dark:text-amber-100',
        badge: 'bg-amber-100/90 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
        cardGradient: 'from-amber-100/60 via-yellow-50/40 to-white/90 dark:from-amber-950/50 dark:via-slate-900/60 dark:to-slate-950/80',
        accentGlow: 'from-amber-400/30 to-yellow-300/10',
        blobPath: 'M 25,40 C 15,15 135,10 150,45 C 165,80 145,130 95,140 C 45,148 10,120 20,80 C 25,60 15,48 25,40 Z',
      },
      render3DIcon: () => (
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center filter drop-shadow-md">
          <div className="absolute inset-2 bg-gradient-to-tr from-amber-300/30 via-yellow-200/30 to-orange-200/20 rounded-full blur-lg" />
          <svg viewBox="0 0 160 160" className="w-full h-full relative z-10">
            <defs>
              <linearGradient id="goldTrophyGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="35%" stopColor="#eab308" />
                <stop offset="70%" stopColor="#ca8a04" />
                <stop offset="100%" stopColor="#854d0e" />
              </linearGradient>
              <linearGradient id="marblePedestal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
            </defs>

            {/* Pedestal Base */}
            <rect x="52" y="124" width="56" height="14" rx="3" fill="url(#marblePedestal)" stroke="#64748b" strokeWidth="1.5" />
            <rect x="62" y="112" width="36" height="12" rx="2" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
            {/* Gold Plaque */}
            <rect x="64" y="126" width="32" height="8" rx="1.5" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.8" />
            <line x1="68" y1="130" x2="92" y2="130" stroke="#854d0e" strokeWidth="1" strokeLinecap="round" />

            {/* Trophy Stem */}
            <path d="M 74,96 L 86,96 L 84,112 L 76,112 Z" fill="url(#goldTrophyGrad)" stroke="#a16207" strokeWidth="1" />

            {/* Trophy Handles */}
            <path d="M 44,42 C 26,42 26,74 48,76 L 52,70 C 38,68 38,48 52,48 Z" fill="url(#goldTrophyGrad)" stroke="#a16207" strokeWidth="1" />
            <path d="M 116,42 C 134,42 134,74 112,76 L 108,70 C 122,68 122,48 108,48 Z" fill="url(#goldTrophyGrad)" stroke="#a16207" strokeWidth="1" />

            {/* Main Cup Body */}
            <path
              d="M 46,32 L 114,32 C 114,64 100,96 80,96 C 60,96 46,64 46,32 Z"
              fill="url(#goldTrophyGrad)"
              stroke="#fef08a"
              strokeWidth="1.5"
              filter="drop-shadow(0 6px 8px rgba(161, 98, 7, 0.35))"
            />
            {/* Top Rim */}
            <ellipse cx="80" cy="32" rx="34" ry="7" fill="#fde047" stroke="#ca8a04" strokeWidth="1" />

            {/* Specular Glare */}
            <path d="M 56,40 C 56,60 64,80 72,86" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.6" />

            {/* Star on Cup */}
            <polygon points="80,50 82,56 88,56 83,60 85,66 80,62 75,66 77,60 72,56 78,56" fill="#fefce8" stroke="#ca8a04" strokeWidth="0.8" />

            {/* Hanging Ribbon Medal on the side */}
            <g transform="translate(100, 68)">
              <polygon points="4,0 12,0 14,24 8,18 2,24" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.8" />
              <circle cx="8" cy="22" r="8" fill="#fde047" stroke="#b45309" strokeWidth="1" />
              <text x="8" y="25" fontSize="7" fontWeight="black" fill="#78350f" textAnchor="middle">1</text>
            </g>
          </svg>
        </div>
      ),
    },
  ];

  return (
    <div
      className="relative w-full max-w-md mx-auto min-h-[850px] p-4 flex flex-col justify-between overflow-hidden select-none"
      dir="rtl"
    >
      {/* Light, Soft Ambient Background with Gentle Luminous Waves and Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        {/* Soft pastel light gradients */}
        <div className="absolute top-0 left-0 w-80 h-80 bg-emerald-200/25 dark:bg-emerald-950/20 rounded-full blur-3xl" />
        <div className="absolute top-10 right-0 w-80 h-80 bg-sky-200/30 dark:bg-sky-950/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-4 w-72 h-72 bg-rose-200/25 dark:bg-rose-950/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-4 w-80 h-80 bg-blue-200/25 dark:bg-blue-950/20 rounded-full blur-3xl" />
        <div className="absolute bottom-16 right-6 w-80 h-80 bg-teal-200/25 dark:bg-teal-950/20 rounded-full blur-3xl" />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-200/30 dark:bg-amber-950/20 rounded-full blur-3xl" />

        {/* Delicate Connecting Luminous Wave Trails (SVG) */}
        <svg className="w-full h-full absolute inset-0 opacity-40 dark:opacity-20" viewBox="0 0 400 850" fill="none">
          <path
            d="M 100,120 C 180,100 240,180 290,140 S 330,280 280,340 S 80,380 110,480 S 260,540 280,620 S 230,720 200,740"
            stroke="url(#ambientTrailGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="4,6"
          />
          <path
            d="M 120,150 C 200,220 250,260 260,320 S 140,420 120,470 S 160,600 210,720"
            stroke="url(#ambientTrailGrad2)"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.6"
          />
          <defs>
            <linearGradient id="ambientTrailGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="20%" stopColor="#0284c7" />
              <stop offset="45%" stopColor="#f43f5e" />
              <stop offset="65%" stopColor="#3b82f6" />
              <stop offset="85%" stopColor="#0d9488" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="ambientTrailGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Interactive 3D Organic Cards Layout (Strictly Matching the 6 Positions) */}
      <div className="flex flex-col space-y-4 pt-1 pb-2">
        {/* ROW 1: [المصروفات] (يمين/يسار) + [المحادثات] */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* 1. المصروفات */}
          <OrganicCardButton
            card={cards[0]}
            onClick={() => onNavigate(cards[0].id)}
            align="right"
          />

          {/* 2. المحادثات */}
          <OrganicCardButton
            card={cards[1]}
            onClick={() => onNavigate(cards[1].id)}
            align="left"
          />
        </div>

        {/* ROW 2: [الطعام] (بارز يميناً بانسيابية مميزة) */}
        <div className="flex justify-end pr-1 sm:pr-4">
          <div className="w-full sm:w-[85%]">
            <OrganicCardButton
              card={cards[2]}
              onClick={() => onNavigate(cards[2].id)}
              align="full"
              isProminent
            />
          </div>
        </div>

        {/* ROW 3: [الرحلات] (يساراً) + [الملاحظات] (يميناً) */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* 4. الرحلات */}
          <OrganicCardButton
            card={cards[3]}
            onClick={() => onNavigate(cards[3].id)}
            align="right"
          />

          {/* 5. الملاحظات */}
          <OrganicCardButton
            card={cards[4]}
            onClick={() => onNavigate(cards[4].id)}
            align="left"
          />
        </div>

        {/* ROW 4: [الرياضة] (أسفل المنتصف) */}
        <div className="flex justify-center pt-1 pb-4">
          <div className="w-full sm:w-[85%]">
            <OrganicCardButton
              card={cards[5]}
              onClick={() => onNavigate(cards[5].id)}
              align="center"
              isProminent
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Sub-component for individual tactile 3D organic card button
interface OrganicCardButtonProps {
  card: OrganicCardItem;
  onClick: () => void;
  align?: 'right' | 'left' | 'center' | 'full';
  isProminent?: boolean;
}

const OrganicCardButton: React.FC<OrganicCardButtonProps> = ({
  card,
  onClick,
  align = 'right',
  isProminent = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full text-right transition-all duration-300 active:scale-[0.97] hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-amber-400/50 rounded-3xl ${
        isProminent ? 'py-3' : 'py-2.5'
      }`}
    >
      {/* Organic Glassmorphic Card Container with Soft Light Gradient */}
      <div
        className={`relative w-full rounded-3xl p-3 sm:p-4 border shadow-sm hover:shadow-md transition-all backdrop-blur-md overflow-hidden ${card.themeColor.bgLight} ${card.themeColor.border}`}
        style={{
          boxShadow: `0 8px 24px -6px ${card.themeColor.glow}, 0 2px 8px -2px rgba(0,0,0,0.04)`,
        }}
      >
        {/* Soft Ambient Light Gradient within card */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${card.themeColor.cardGradient} opacity-90 -z-10`}
        />

        {/* Card Header & Content */}
        <div
          className={`flex ${
            align === 'center'
              ? 'flex-col items-center text-center'
              : align === 'full'
              ? 'flex-row-reverse items-center justify-between gap-3'
              : 'flex-col items-center text-center'
          }`}
        >
          {/* 3D Rendered Asset */}
          <div className="relative transform group-hover:scale-105 group-hover:rotate-1 transition-transform duration-300">
            {card.render3DIcon()}
          </div>

          {/* Texts (Arabic Title + Exact Subtitle) */}
          <div className={`mt-2 ${align === 'full' ? 'flex-1 text-right' : 'w-full'}`}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <h3 className={`text-base sm:text-lg font-black tracking-tight ${card.themeColor.text}`}>
                {card.titleAr}
              </h3>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>

            <p className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 leading-snug px-1">
              {card.subtitleAr}
            </p>
          </div>
        </div>

        {/* Subtle touch indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-slate-400/20 group-hover:bg-amber-400/60 transition-colors" />
      </div>
    </button>
  );
};
