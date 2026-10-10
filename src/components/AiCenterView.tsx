import React, { useEffect, useRef, useState } from 'react';
import { Bot, Check, Copy, Mic, RotateCcw, Send, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react';
import { SmartVoiceDnaPanel } from './SmartVoiceDnaPanel';
import { SmartAiVoiceConversationModal } from './SmartAiVoiceConversationModal';
import { AiMessage, AiModelType, Language } from '../types';
import { ChatRepository } from '../services';
import { askSmartAi, buildSmartAiContext, SmartAiAction } from '../services/aiService';
import { loadSmartAiVoiceId, saveSmartAiVoiceId, speakSmartAi, stopSmartAiVoice, SMART_AI_VOICE_PROFILES } from '../services/smartAiVoiceService';
import { listVoiceDnaProfiles, readVoiceDnaSample, type SmartVoiceDnaProfile } from '../services/smartVoiceDnaService';
import { getVoiceDnaStatus, synthesizeVoiceDna } from '../services/smartVoiceDnaClient';
import type { SmartAiVoiceId } from '../types';
import { StorageAdapter } from '../services/storageAdapter';

interface AiCenterViewProps {
  language: Language;
  onOpenVoiceSearch: () => void;
  initialInputText?: string;
  appContext: Parameters<typeof buildSmartAiContext>[0];
}

export const AiCenterView: React.FC<AiCenterViewProps> = ({
  language,
  onOpenVoiceSearch,
  initialInputText,
  appContext,
}) => {
  const selectedModel: AiModelType = 'smart-time-core';
  const smartLanguage: 'ar' | 'en' = language === 'en' ? 'en' : 'ar';
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<SmartAiAction>(null);
  const [pendingMessage, setPendingMessage] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<SmartAiVoiceId>(() => loadSmartAiVoiceId());
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [voiceDnaProfiles, setVoiceDnaProfiles] = useState<SmartVoiceDnaProfile[]>([]);
  const [selectedVoiceDnaId, setSelectedVoiceDnaId] = useState<string | null>(null);
  const [isVoiceDnaOpen, setIsVoiceDnaOpen] = useState(false);
  const [voicePlaybackBusy, setVoicePlaybackBusy] = useState(false);
  const [voiceDnaProviderReady, setVoiceDnaProviderReady] = useState(false);
  const [isVoiceConversationOpen, setIsVoiceConversationOpen] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void refreshVoiceDnaProfiles();
    void refreshVoiceDnaProviderStatus();
  }, []);

  const refreshVoiceDnaProviderStatus = async () => {
    try {
      const status = await getVoiceDnaStatus();
      setVoiceDnaProviderReady(status.configured && status.healthy);
    } catch {
      setVoiceDnaProviderReady(false);
    }
  };

  useEffect(() => {
    if (!isVoiceDnaOpen) {
      void refreshVoiceDnaProfiles();
      void refreshVoiceDnaProviderStatus();
    }
  }, [isVoiceDnaOpen]);

  useEffect(() => {
    if (initialInputText?.trim()) setInputText(initialInputText.trim());
  }, [initialInputText]);

  useEffect(() => {
    const saved = ChatRepository.getAiChatHistory();
    if (saved?.length) {
      setMessages(saved);
      return;
    }
    const welcome: AiMessage = {
      id: 'msg_welcome',
      sender: 'ai',
      text:
        language === 'ar'
          ? 'مرحبًا بك في SMART AI. أقدر أقرأ بيانات المصاريف والدخل والرحلات والسيارات والطلاب والتذكيرات، وأساعدك في التحليل أو تجهيز عملية واضحة للتنفيذ.'
          : 'Welcome to SMART AI. I can analyze your SMART TIME data and prepare clear actions for you to confirm.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),

      provider: 'smart-ai',
    };
    setMessages([welcome]);
    ChatRepository.saveAiChatHistory([welcome]);
  }, [language, selectedModel]);

  const refreshVoiceDnaProfiles = async () => {
    try {
      const profiles = await listVoiceDnaProfiles();
      setVoiceDnaProfiles(profiles);
      let saved: string | null = null;
      try { saved = localStorage.getItem("smart-time-selected-voice-dna"); } catch {}
      const preferred = saved && profiles.some((profile) => profile.id === saved)
        ? saved
        : profiles.find((profile) => profile.isDefault)?.id || profiles[0]?.id || null;
      setSelectedVoiceDnaId(preferred);
    } catch {
      setVoiceDnaProfiles([]);
      setSelectedVoiceDnaId(null);
    }
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, pendingAction]);

  useEffect(() => () => {
    stopSmartAiVoice();
  }, []);

  const selectedVoiceDnaProfile = voiceDnaProfiles.find((profile) => profile.id === selectedVoiceDnaId) || null;

  const speakWithSelectedVoice = async (text: string): Promise<boolean> => {
    if (!text.trim()) return false;

    if (!selectedVoiceDnaProfile) {
      return speakSmartAi(text, smartLanguage, selectedVoice);
    }

    setVoicePlaybackBusy(true);
    try {
      const sample = await readVoiceDnaSample(selectedVoiceDnaProfile.id);
      if (!sample) throw new Error(language === 'ar' ? 'العينة الصوتية المحلية غير موجودة.' : 'Local Voice DNA sample not found.');

      const serverProfileId = selectedVoiceDnaProfile.id.startsWith('shared_')
        ? selectedVoiceDnaProfile.id.slice('shared_'.length)
        : selectedVoiceDnaProfile.id;

      const canUseVoice = selectedVoiceDnaProfile.ownerConfirmed &&
        (selectedVoiceDnaProfile.relationship !== 'son' && selectedVoiceDnaProfile.relationship !== 'daughter'
          ? true
          : selectedVoiceDnaProfile.guardianConfirmed);

      if (!canUseVoice) throw new Error(language === 'ar' ? 'موافقة استخدام الصوت غير مكتملة.' : 'Voice consent is incomplete.');

      const audioBlob = await synthesizeVoiceDna({
        profileId: serverProfileId,
        text,
        speakingStyle: selectedVoiceDnaProfile.speakingStyle,
        consentConfirmed: true,
        referenceText: selectedVoiceDnaProfile.language === 'ar'
          ? 'أنا صاحب الصوت، وأوافق على إنشاء ملف صوتي خاص بي داخل SMART TIME.'
          : 'I am the voice owner, and I consent to creating my private SMART TIME voice profile.',
        referenceAudio: sample,
      });

      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          URL.revokeObjectURL(url);
          setVoicePlaybackBusy(false);
          resolve();
        };
        audio.onended = done;
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setVoicePlaybackBusy(false);
          reject(new Error(language === 'ar' ? 'تعذر تشغيل ملف الصوت.' : 'Generated audio could not be played.'));
        };
        void audio.play().catch((error) => {
          URL.revokeObjectURL(url);
          setVoicePlaybackBusy(false);
          reject(error);
        });
      });
      return true;
    } catch (error: any) {
      setVoicePlaybackBusy(false);
      console.error('SMART VOICE DNA playback failed:', error);
      return false;
    }
  };

  const quickPrompts = [
    { ar: '📊 قارن مصاريف هذا الشهر بالشهر الماضي', en: 'Compare this month expenses to last month' },
    { ar: '💰 ما هو صافي دخلي هذا الشهر؟', en: 'What is my net income this month?' },
    { ar: '🚗 سجّل تموين السيارة', en: 'Record a fuel fill-up' },
    { ar: '🎓 أضف مصروفًا لطالب', en: 'Add an education expense' },
  ];

  const handleSendMessage = async (customText?: string, forceVoiceReply = false): Promise<string | null> => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isLoading) return null;

    const userMessage: AiMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),

      provider: 'smart-ai',
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInputText('');
    setIsLoading(true);
    setPendingAction(null);
    setActionStatus('');

    try {
      const data = await askSmartAi({
        message: textToSend,
        language: smartLanguage,

        conversationHistory: nextMessages.slice(-8).map((m) => ({
          sender: m.sender === 'user' ? 'user' : 'model',
          text: m.text,
        })),
        appContext: buildSmartAiContext(appContext),
      });

      if ((isVoiceEnabled || forceVoiceReply) && data.reply) {
        const usedDna = await speakWithSelectedVoice(data.reply);
        if (!usedDna && selectedVoiceDnaProfile) {
          speakSmartAi(data.reply, smartLanguage, selectedVoice);
        }
      }

      const aiMessage: AiMessage = {
        id: 'msg_ai_' + Date.now(),
        sender: 'ai',
        text: data.reply || (language === 'ar' ? 'تعذر الحصول على رد واضح.' : 'No clear response was returned.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: (data.model as AiModelType) || selectedModel,
        provider: (data.provider as any) || 'smart-ai',
      };

      const finalMessages = [...nextMessages, aiMessage];
      setMessages(finalMessages);
      ChatRepository.saveAiChatHistory(finalMessages);
      setPendingAction(data.action || null);
      setPendingMessage(data.action ? textToSend : '');
      setActionStatus(data.actionSummary || '');
      return data.reply || null;
    } catch (error) {
      console.error('SMART AI chat failed:', error);
      const fallback: AiMessage = {
        id: 'msg_ai_error_' + Date.now(),
        sender: 'ai',
        text:
          language === 'ar'
            ? 'تعذر تشغيل SMART AI الآن. لم يتم تعديل أي بيانات.'
            : 'SMART AI is unavailable right now. No app data was changed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),

        provider: 'smart-ai',
      };
      setMessages([...nextMessages, fallback]);
      ChatRepository.saveAiChatHistory([...nextMessages, fallback]);
      if (forceVoiceReply) return fallback.text;
      return fallback.text;
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (index: number, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleClearChat = () => {
    setMessages([]);
    setPendingAction(null);
    setPendingMessage('');
    setActionStatus('');
    ChatRepository.clearAiChatHistory();
  };

  const handleConfirmAction = async () => {
    if (!pendingAction || !pendingMessage || isLoading) return;
    setIsLoading(true);
    setActionStatus(language === 'ar' ? 'جارٍ تنفيذ العملية والتحقق منها على الخادم...' : 'Executing and verifying the operation on the server...');
    try {
      const data = await askSmartAi({
        message: pendingMessage,
        language: smartLanguage,
        confirmed: true,
        conversationHistory: messages.slice(-8).map((m) => ({
          sender: m.sender === 'user' ? 'user' : 'model',
          text: m.text,
        })),
        appContext: buildSmartAiContext(appContext),
      });

      if (data.reply) {
        const aiMessage: AiMessage = {
          id: 'msg_ai_exec_' + Date.now(),
          sender: 'ai',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: (data.model as AiModelType) || selectedModel,
          provider: (data.provider as any) || 'smart-ai',
        };
        const finalMessages = [...messages, aiMessage];
        setMessages(finalMessages);
        ChatRepository.saveAiChatHistory(finalMessages);
        if (isVoiceEnabled) void speakWithSelectedVoice(data.reply);
      }

      setActionStatus(data.actionSummary || data.reply || (language === 'ar' ? 'تم تنفيذ العملية.' : 'Operation completed.'));
      setPendingAction(null);
      setPendingMessage('');
    } catch (error: any) {
      setActionStatus(error?.message || (language === 'ar' ? 'تعذر تنفيذ الإجراء.' : 'Could not execute the operation.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] min-h-[580px] flex flex-col space-y-4" id="ai-center-module">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span>SMART AI</span>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-extrabold">
                Core
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {language === 'ar'
                ? 'يفهم بيانات SMART TIME ويمكنه تجهيز إجراءات قابلة للتنفيذ'
                : 'Understands SMART TIME data and can prepare actionable requests'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {voiceDnaProfiles.length > 0 ? (
              <select value={selectedVoiceDnaId || ''} onChange={(event) => { const id = event.target.value || null; setSelectedVoiceDnaId(id); try { if (id) StorageAdapter.setItem("smart-time-selected-voice-dna", id); else localStorage.removeItem("smart-time-selected-voice-dna"); } catch {} }} className="max-w-[180px px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-xs font-bold text-purple-700 dark:text-purple-200 border border-purple-200 dark:border-purple-800/60 outline-none">
                <option value="">{language === 'ar' ? 'صوت SMART AI العادي' : 'SMART AI browser voice'}</option>
                {voiceDnaProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.displayName}{profile.origin === 'shared' ? (language === 'ar' ? ' · مشترك' : ' · shared') : ''}
                  </option>
                ))}
              </select>
            ) : (
              <select value={selectedVoice} onChange={(event) => {
                const id = event.target.value as SmartAiVoiceId;
                setSelectedVoice(id);
                saveSmartAiVoiceId(id);
              }} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 border-0 outline-none">
                {SMART_AI_VOICE_PROFILES.map((voice) => (
                  <option key={voice.id} value={voice.id}>{language === 'ar' ? voice.labelAr : voice.labelEn}</option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => {
              if (isVoiceEnabled) {
                stopSmartAiVoice();
                setIsVoiceEnabled(false);
              } else {
                const starter = smartLanguage === 'ar' ? 'أهلًا بك في SMART TIME.' : 'Welcome to SMART TIME.';
                void speakWithSelectedVoice(starter).then((started) => setIsVoiceEnabled(started));
              }
            }} className="p-2 text-slate-500 hover:text-purple-600 rounded-xl" title={language === 'ar' ? 'صوت SMART AI' : 'SMART AI voice'}>
              {voicePlaybackBusy ? <Volume2 className="w-4 h-4 animate-pulse" /> : isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
              ✨ SMART TIME AI
            </span>
            <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold ${voiceDnaProviderReady ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}">
              ${voiceDnaProviderReady ? (language === 'ar' ? 'Voice DNA محلي جاهز' : 'Local Voice DNA ready') : (language === 'ar' ? 'Voice DNA غير موصل' : 'Voice DNA offline')}
            </span>
            <button
              type="button"
              onClick={() => setIsVoiceDnaOpen((open) => !open)}
              className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800/60"
              title="Voice DNA"
            >
              Voice DNA
            </button>
          </div>
          <button
            type="button"
            onClick={handleClearChat}
            className="p-2 text-slate-400 hover:text-rose-500 rounded-xl"
            title="مسح المحادثة"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isVoiceDnaOpen && (
        <SmartVoiceDnaPanel language={language} onClose={() => setIsVoiceDnaOpen(false)} />
      )}

      <div className="flex-1 bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 overflow-y-auto space-y-4">
        {messages.map((msg, index) => {
          const isAi = msg.sender !== 'user';
          return (
            <div
              key={msg.id || index}
              className={'flex items-start gap-3 ' + (isAi ? 'justify-start' : 'justify-end flex-row-reverse')}
            >
              <div
                className={
                  'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ' +
                  (isAi ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white' : 'bg-slate-800 text-white')
                }
              >
                {isAi ? <Sparkles className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={
                  'max-w-2xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-sm ' +
                  (isAi
                    ? 'bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800'
                    : 'bg-purple-600 text-white')
                }
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div className="flex items-center justify-between gap-4 pt-2 text-[10px] opacity-70">
                  <span>{msg.timestamp}</span>
                  {isAi && (
                    <>
                      <button type="button" onClick={() => { void speakWithSelectedVoice(msg.text); }} className="flex items-center gap-1 hover:opacity-100" title={language === 'ar' ? 'استماع' : 'Listen'}>
                        <Volume2 className="w-3 h-3" />
                        <span>{language === 'ar' ? 'استماع' : 'Listen'}</span>
                      </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(index, msg.text)}
                      className="flex items-center gap-1 hover:opacity-100"
                    >
                      {copiedIndex === index ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedIndex === index ? 'تم النسخ' : 'نسخ'}</span>
                    </button>
                      </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="w-4 h-4 animate-pulse text-purple-500" />
            <span>{language === 'ar' ? 'SMART AI يفكر...' : 'SMART AI is thinking...'}</span>
          </div>
        )}

        {pendingAction && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 p-3.5">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
              <Zap className="w-4 h-4" />
              <span>إجراء جاهز للتنفيذ</span>
            </div>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80 mt-1.5 leading-relaxed">
              {actionStatus || 'راجعه ثم اختر تنفيذ لإضافته إلى بيانات SMART TIME.'}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleConfirmAction}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700"
              >
                تنفيذ
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingAction(null);
                  setActionStatus('تم إلغاء التنفيذ.');
                }}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {actionStatus && !pendingAction && (
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{actionStatus}</div>
        )}

        <div ref={chatBottomRef} />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt.ar}
            type="button"
            onClick={() => handleSendMessage(language === 'ar' ? prompt.ar : prompt.en)}
            className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 text-xs font-semibold shrink-0"
          >
            {language === 'ar' ? prompt.ar : prompt.en}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSendMessage();
        }}
        className="flex items-center gap-2 bg-white dark:bg-slate-850 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0"
      >
        <button
          type="button"
          onClick={onOpenVoiceSearch}
          className="relative p-2.5 text-purple-600 hover:text-white rounded-xl bg-purple-50 hover:bg-gradient-to-r hover:from-purple-600 hover:to-indigo-600 dark:bg-purple-950/40 transition-all active:scale-95"
          title={language === 'ar' ? 'إرسال صوت للشات' : 'Send voice to chat'}
          aria-label={language === 'ar' ? 'إرسال صوت للشات' : 'Send voice to chat'}
        >
          <Mic className="w-5 h-5" />
          <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-850" />
        </button>

        <SmartAiVoiceConversationModal
          inline
          isOpen={isVoiceConversationOpen}
          language={language}
          onOpen={() => setIsVoiceConversationOpen(true)}
          onClose={() => {
            setIsVoiceConversationOpen(false);
            stopSmartAiVoice();
          }}
          onTurn={async (transcript) => {
            await handleSendMessage(transcript, true);
          }}
        />

        <input
          type="text"
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder={
            language === 'ar'
              ? 'اكتب سؤالك أو اطلب إضافة مصروف أو تموين أو تذكير...'
              : 'Ask a question or request an expense, fuel record, or reminder...'
          }
          className="flex-1 px-3 py-2 text-xs sm:text-sm bg-transparent text-slate-900 dark:text-white focus:outline-none"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-md shadow-purple-500/25 disabled:opacity-50 transition-all active:scale-95"
        >
          <Send className="w-4 h-4 rtl:rotate-180" />
        </button>
      </form>
    </div>
  );
};
