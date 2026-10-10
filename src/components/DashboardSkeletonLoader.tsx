import React from 'react';

interface DashboardSkeletonLoaderProps {
  layoutMode?: 'organic' | 'grid' | 'detailed';
  isAr?: boolean;
}

export const DashboardSkeletonLoader: React.FC<DashboardSkeletonLoaderProps> = ({
  layoutMode = 'organic',
  isAr = true,
}) => {
  return (
    <div
      className="w-full select-none animate-fadeIn transition-opacity duration-300"
      dir={isAr ? 'rtl' : 'ltr'}
      aria-label={isAr ? 'جاري تحميل البطاقات...' : 'Loading cards...'}
    >
      {/* 1. Organic 3D Floating Mode Skeleton */}
      {layoutMode === 'organic' && (
        <div className="relative w-full max-w-md mx-auto min-h-[750px] p-2 flex flex-col space-y-4">
          {/* Subtle Shimmer Background Glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 opacity-60">
            <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-200/20 dark:bg-emerald-950/15 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-1/3 right-0 w-72 h-72 bg-sky-200/20 dark:bg-sky-950/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '200ms' }} />
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-200/20 dark:bg-amber-950/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>

          {/* 3 Rows of 2 Organic 3D Cards */}
          {[1, 2, 3].map((rowIdx) => (
            <div key={`organic-skel-row-${rowIdx}`} className="grid grid-cols-2 gap-3.5">
              {[1, 2].map((colIdx) => {
                const isEven = (rowIdx + colIdx) % 2 === 0;
                return (
                  <div
                    key={`organic-skel-card-${rowIdx}-${colIdx}`}
                    className="relative rounded-[28px] p-3.5 sm:p-4 bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden flex flex-col items-center justify-between min-h-[195px] sm:min-h-[215px]"
                  >
                    {/* Shimmer sweep effect */}
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-slate-200/40 dark:via-slate-750/30 to-transparent" />

                    {/* Top small category badge placeholder */}
                    <div className="w-full flex items-center justify-between z-10 mb-1">
                      <div
                        className={`h-4.5 rounded-full animate-pulse ${
                          isEven
                            ? 'w-16 bg-slate-200/80 dark:bg-slate-800/90'
                            : 'w-20 bg-slate-200/80 dark:bg-slate-800/90'
                        }`}
                      />
                      <div className="w-4 h-4 rounded-full bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
                    </div>

                    {/* 3D Icon Skeleton Circle with Soft Glow */}
                    <div className="relative my-2 w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                      <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-slate-200/90 via-slate-100 to-slate-200/60 dark:from-slate-800 dark:via-slate-850 dark:to-slate-800 border border-slate-300/60 dark:border-slate-700/60 shadow-inner flex items-center justify-center animate-pulse">
                        <div className="w-8 h-8 rounded-2xl bg-slate-300/70 dark:bg-slate-700/80 animate-pulse" />
                      </div>
                    </div>

                    {/* Bottom Title & Subtitle skeleton bars */}
                    <div className="w-full flex flex-col items-center gap-1.5 z-10 mt-1">
                      <div className="h-4.5 w-24 bg-slate-300 dark:bg-slate-700 rounded-lg animate-pulse" />
                      <div className="h-3 w-32 max-w-[90%] bg-slate-200/90 dark:bg-slate-800/90 rounded-md animate-pulse" />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* 2. 3D Grid Mode Skeleton */}
      {layoutMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={`grid-skel-${idx}`}
              className="relative rounded-2xl p-4 bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between min-h-[145px]"
            >
              {/* Shimmer sweep */}
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-slate-200/40 dark:via-slate-750/30 to-transparent" />

              {/* Header Icon + Pill */}
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center">
                  <div className="w-5 h-5 rounded-lg bg-slate-300 dark:bg-slate-700" />
                </div>
                <div className="w-12 h-4 rounded-full bg-slate-200/80 dark:bg-slate-800/80 animate-pulse" />
              </div>

              {/* Text Lines */}
              <div className="space-y-2">
                <div className="h-4 w-24 bg-slate-300 dark:bg-slate-700 rounded-md animate-pulse" />
                <div className="h-3 w-32 max-w-[95%] bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Detailed List Mode Skeleton */}
      {layoutMode === 'detailed' && (
        <div className="space-y-2.5 w-full">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={`detailed-skel-${idx}`}
              className="relative rounded-2xl p-3.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden flex items-center justify-between gap-3"
            >
              {/* Shimmer sweep */}
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-slate-200/40 dark:via-slate-750/30 to-transparent" />

              {/* Leading Icon + Content */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-lg bg-slate-300 dark:bg-slate-700" />
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-4 w-28 bg-slate-300 dark:bg-slate-700 rounded-md animate-pulse" />
                  <div className="h-3 w-48 max-w-[90%] bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
                </div>
              </div>

              {/* Trailing badge / action */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-14 h-5 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="w-6 h-6 rounded-full bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
