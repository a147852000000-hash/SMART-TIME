import React, { useEffect, useState } from 'react';
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { Language } from '../types';
import { fetchLiveNews, LiveNewsArticle } from '../services/liveDataService';

interface LiveNewsPanelProps { language: Language; compact?: boolean; }

export const LiveNewsPanel: React.FC<LiveNewsPanelProps> = ({ language, compact = false }) => {
  const isAr = language === 'ar';
  const [articles, setArticles] = useState<LiveNewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = async () => {
    setLoading(true);
    const data = await fetchLiveNews(language);
    if (data.length) { setArticles(data); setUpdatedAt(new Date()); }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 300_000);
    return () => window.clearInterval(timer);
  }, [language]);

  return (
    <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500"><Newspaper className="w-5 h-5" /></span>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">{isAr ? 'آخر الأخبار' : 'Latest News'}</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{updatedAt ? (isAr ? `آخر تحديث ${updatedAt.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}` : `Updated ${updatedAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`) : (isAr ? 'متصل بالإنترنت' : 'Internet feed')}</p>
          </div>
        </div>
        <button onClick={refresh} disabled={loading} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title={isAr ? 'تحديث' : 'Refresh'}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {(compact ? articles.slice(0,4) : articles.slice(0,10)).map((article, i) => (
          <a key={`${article.url}-${i}`} href={article.url} target="_blank" rel="noreferrer" className="block p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold leading-6 text-slate-900 dark:text-white">{article.title}</h4>
                <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span>{article.source?.name || 'News'}</span>
                  {article.publishedAt && <span>• {new Date(article.publishedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US', {hour:'2-digit',minute:'2-digit'})}</span>}
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            </div>
          </a>
        ))}
        {!loading && articles.length === 0 && <div className="p-5 text-xs text-slate-500">{isAr ? 'تعذر جلب الأخبار الآن. سيتم إعادة المحاولة تلقائيًا.' : 'News is temporarily unavailable. Retrying automatically.'}</div>}
      </div>
    </section>
  );
};
