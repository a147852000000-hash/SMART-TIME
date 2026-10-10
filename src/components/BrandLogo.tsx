import React from 'react';
import { Clock } from 'lucide-react';
import { Language } from '../types';

interface BrandLogoProps {
  language?: Language;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  showText?: boolean;
  onClick?: () => void;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  language = 'ar',
  size = 'md',
  showSubtitle = false,
  showText = false,
  onClick,
  className = '',
}) => {
  const isSmall = size === 'sm';
  const isLarge = size === 'lg';
  const isXLarge = size === 'xl';

  const containerSizes = isSmall
    ? 'w-8 h-8'
    : isLarge
    ? 'w-12 h-12'
    : isXLarge
    ? 'w-16 h-16 sm:w-20 sm:h-20'
    : 'w-9 h-9 sm:w-10 sm:h-10';

  const titleSizes = isSmall
    ? 'text-sm'
    : isLarge
    ? 'text-xl sm:text-2xl'
    : isXLarge
    ? 'text-2xl sm:text-3xl'
    : 'text-base sm:text-lg';

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 sm:gap-3 select-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
      id="brand-logo-component"
    >
      {/* SMART TIME Ocean emblem — no gold/black logo treatment */}
      <div
        className={`${containerSizes} rounded-2xl bg-gradient-to-br from-accent-400 via-accent-500 to-accent-700 border border-accent-300/60 p-1 shadow-lg shadow-accent-500/20 group-hover:scale-105 transition-all shrink-0 flex items-center justify-center text-white`}
      >
        <div className="w-full h-full rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
          <Clock className={`${isSmall ? 'w-4 h-4' : 'w-5 h-5'} font-bold`} />
        </div>
      </div>

      {/* Brand Typography (Only if showText is explicitly true) */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`font-black tracking-tight ${titleSizes} text-slate-900 dark:text-white group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors font-sans`}
            >
              SMART TIME
            </span>
          </div>

          {showSubtitle && (
            <span className="text-[11px] sm:text-xs font-bold text-accent-700 dark:text-accent-400/90 tracking-wide mt-0.5">
              {language === 'ar' ? 'الواجهة الشخصية' : 'Personal Cockpit'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

