import React, { useState, useRef } from 'react';
import {
  X,
  Info,
  Palette,
  MessageSquare,
  ShieldCheck,
  Users,
  AlertTriangle,
  Camera,
  Upload,
  Pin,
  Link,
  Copy,
  Check,
  Crown,
  Clock,
  Trash2,
  Lock,
  Download,
  LogOut,
  SlidersHorizontal,
  CheckCircle2,
  UserPlus,
  Search,
} from 'lucide-react';
import {
  ChatRoom,
  ChatMember,
  ChatRoomSettings,
  ChatRoomPermissions,
  Language,
} from '../types';

interface ChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: ChatRoom;
  isRoomOwner: boolean;
  language?: Language;
  isDark?: boolean;
  onSave: (updatedRoom: Partial<ChatRoom>) => void;
  onClearHistory?: () => void;
  onExportChat?: () => void;
  onLeaveRoom?: () => void;
  onDeleteRoom?: () => void;
}

export const ChatSettingsModal: React.FC<ChatSettingsModalProps> = ({
  isOpen,
  onClose,
  room,
  isRoomOwner,
  language = 'ar',
  isDark = true,
  onSave,
  onClearHistory,
  onExportChat,
  onLeaveRoom,
  onDeleteRoom,
}) => {
  const isAr = language === 'ar';

  // Tabs
  const [activeTab, setActiveTab] = useState<
    'general' | 'appearance' | 'rules' | 'permissions' | 'members' | 'danger'
  >('general');

  // Form states
  const [title, setTitle] = useState(room.title || room.name || '');
  const [description, setDescription] = useState(room.description || '');
  const [avatar, setAvatar] = useState(room.avatar || '');
  const [isPinned, setIsPinned] = useState(!!room.pinned);
  const [copiedLink, setCopiedLink] = useState(false);

  // Settings
  const [prefs, setPrefs] = useState<ChatRoomSettings>(() => ({
    disappearing: room.settings?.disappearing || 'off',
    muted: !!room.settings?.muted,
    readReceipts: room.settings?.readReceipts ?? true,
    typingIndicator: room.settings?.typingIndicator ?? true,
    linkPreviews: room.settings?.linkPreviews ?? true,
    mediaAutoSave: room.settings?.mediaAutoSave ?? false,
    enterToSend: room.settings?.enterToSend ?? true,
    slowModeSeconds: room.settings?.slowModeSeconds ?? 0,
    approvalRequired: room.settings?.approvalRequired ?? false,
  }));

  // Background
  const [background, setBackground] = useState<string>(room.background || '');
  const [backgroundUrl, setBackgroundUrl] = useState<string>(room.backgroundUrl || '');

  // Permissions
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<'admin' | 'moderator' | 'member'>('member');
  const [memberPermissions, setMemberPermissions] = useState<ChatRoomPermissions>(() => ({
    sendMessages: room.permissions?.sendMessages ?? true,
    sendMedia: room.permissions?.sendMedia ?? true,
    addMembers: room.permissions?.addMembers ?? true,
    pinMessages: room.permissions?.pinMessages ?? false,
    editRoom: room.permissions?.editRoom ?? false,
    deleteMessages: room.permissions?.deleteMessages ?? false,
    startCalls: room.permissions?.startCalls ?? true,
    mentionEveryone: room.permissions?.mentionEveryone ?? false,
  }));

  const [adminPermissions, setAdminPermissions] = useState<ChatRoomPermissions>(() => ({
    sendMessages: true,
    sendMedia: true,
    addMembers: true,
    pinMessages: true,
    editRoom: true,
    deleteMessages: true,
    startCalls: true,
    mentionEveryone: true,
    ...(room.adminPermissions || {}),
  }));

  const [moderatorPermissions, setModeratorPermissions] = useState<ChatRoomPermissions>(() => ({
    sendMessages: true,
    sendMedia: true,
    addMembers: true,
    pinMessages: true,
    editRoom: false,
    deleteMessages: true,
    startCalls: true,
    mentionEveryone: true,
    ...(room.moderatorPermissions || {}),
  }));

  // Members
  const [membersList, setMembersList] = useState<ChatMember[]>(() => room.members || []);
  const [memberSearch, setMemberSearch] = useState('');
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');

  // Refs
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bgInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleCopyInviteLink = () => {
    const invite = room.inviteLink || `https://smarttime.app/join/${room.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(invite);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleAvatarFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleBgFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBackground('');
      setBackgroundUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const togglePref = (key: keyof ChatRoomSettings) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getActivePerms = () => {
    if (selectedRoleForPerms === 'admin') return adminPermissions;
    if (selectedRoleForPerms === 'moderator') return moderatorPermissions;
    return memberPermissions;
  };

  const togglePermission = (key: keyof ChatRoomPermissions) => {
    if (selectedRoleForPerms === 'admin') {
      setAdminPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    } else if (selectedRoleForPerms === 'moderator') {
      setModeratorPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    } else {
      setMemberPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const handleRoleChange = (memberId: string, newRole: ChatMember['role']) => {
    setMembersList((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
  };

  const handleRemoveMember = (memberId: string) => {
    setMembersList((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleAddCustomMember = () => {
    if (!newMemberName.trim()) return;
    const newMember: ChatMember = {
      id: 'usr_' + Date.now(),
      name: newMemberName.trim(),
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80`,
      role: 'member',
      isOnline: true,
      joinedAt: new Date().toISOString(),
    };
    setMembersList((prev) => [...prev, newMember]);
    setNewMemberName('');
    setShowAddMemberDialog(false);
  };

  const handleSaveAll = () => {
    onSave({
      title,
      name: title,
      description,
      avatar,
      pinned: isPinned,
      settings: prefs,
      background,
      backgroundUrl,
      permissions: memberPermissions,
      adminPermissions,
      moderatorPermissions,
      members: membersList,
    });
    onClose();
  };

  const navItems = [
    { id: 'general', label: isAr ? 'معلومات الغرفة' : 'General & Info', icon: Info },
    { id: 'appearance', label: isAr ? 'المظهر والخلفية' : 'Appearance', icon: Palette },
    { id: 'rules', label: isAr ? 'قواعد الدردشة' : 'Chat Rules', icon: MessageSquare },
    { id: 'permissions', label: isAr ? 'الصلاحيات والأدوار' : 'Permissions', icon: ShieldCheck },
    { id: 'members', label: isAr ? 'الأعضاء' : 'Members', icon: Users },
    { id: 'danger', label: isAr ? 'إجراءات متقدمة' : 'Advanced Actions', icon: SlidersHorizontal },
  ];

  // Theme-adaptive classes
  const modalBg = isDark ? 'bg-[#111827] border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900';
  const headerFooterBg = isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200';
  const navSidebarBg = isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/70 border-slate-200';
  const cardBg = isDark ? 'bg-slate-900/70 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900';
  const inputBg = isDark ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-sky-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-sky-500';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      id="chat-settings-modal-redesigned"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden border shadow-2xl ${modalBg}`}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${headerFooterBg}`}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={avatar || room.avatar}
                alt=""
                className="w-12 h-12 rounded-2xl object-cover border-2 border-sky-500/40 shadow-xs"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -end-1 p-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-md transition"
                title={isAr ? 'تغيير الصورة' : 'Change avatar'}
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarFile(e.target.files?.[0])}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">{title || room.title || room.name}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                  {room.type === 'group' ? (isAr ? 'مجموعة' : 'Group') : room.type === 'public' ? (isAr ? 'قناة عامة' : 'Public') : (isAr ? 'محادثة خاصة' : 'Direct')}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                  <Lock className="w-2.5 h-2.5" />
                  <span>E2EE</span>
                </span>
              </div>
              <p className={`text-xs ${mutedText}`}>
                {membersList.length} {isAr ? 'عضو في الغرفة' : 'members in room'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (Navigation Tabs + Content) */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Navigation Bar */}
          <div
            className={`w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-e p-2.5 space-y-1 overflow-x-auto md:overflow-y-auto flex md:flex-col ${navSidebarBg}`}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 md:w-full ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* 1. GENERAL & INFO */}
            {activeTab === 'general' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    {isAr ? 'اسم الغرفة *' : 'Room Title *'}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={isAr ? 'اكتب اسم الغرفة...' : 'Enter room name...'}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none ${inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    {isAr ? 'وصف الغرفة وأهدافها' : 'Room Description'}
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={isAr ? 'اكتب نبذة توضيحية عن هذه الغرفة...' : 'Describe this room...'}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none resize-none ${inputBg}`}
                  />
                </div>

                {/* Pin Room */}
                <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${cardBg}`}>
                  <div className="flex items-center gap-3">
                    <Pin className={`w-4 h-4 ${isPinned ? 'text-sky-500' : 'text-slate-400'}`} />
                    <div>
                      <b className="text-xs block">{isAr ? 'تثبيت الغرفة في الأعلى' : 'Pin Room'}</b>
                      <span className={`text-[10px] ${mutedText}`}>
                        {isAr ? 'تظهر الغرفة دائماً في أول قائمة المحادثات' : 'Keep room at top of chat list'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPinned(!isPinned)}
                    className={`w-11 h-6 rounded-full p-1 transition ${
                      isPinned ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition ${
                        isPinned ? (isAr ? '-translate-x-5' : 'translate-x-5') : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Invite Link */}
                <div className={`p-3.5 rounded-2xl border space-y-2 ${cardBg}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-2">
                      <Link className="w-3.5 h-3.5 text-sky-500" />
                      {isAr ? 'رابط دعوة الأعضاء' : 'Invite Link'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyInviteLink}
                      className="px-3 py-1 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500/25 text-xs font-bold flex items-center gap-1 transition"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? (isAr ? 'تم النسخ!' : 'Copied!') : isAr ? 'نسخ الرابط' : 'Copy Link'}</span>
                    </button>
                  </div>
                  <div className={`p-2 rounded-xl text-[11px] font-mono select-all truncate ${isDark ? 'bg-black/40 text-slate-300' : 'bg-white border border-slate-200 text-slate-700'}`}>
                    {room.inviteLink || `https://smarttime.app/join/${room.id}`}
                  </div>
                </div>
              </div>
            )}

            {/* 2. APPEARANCE & WALLPAPERS */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold mb-1">
                    {isAr ? 'خلفيات المحادثة الجاهزة' : 'Wallpaper Presets'}
                  </h3>
                  <p className={`text-[11px] ${mutedText} mb-3`}>
                    {isAr ? 'اختر نمط الخلفية المفضل لهذه الغرفة:' : 'Select your preferred wallpaper theme:'}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { name: isAr ? 'الوضع الليلي الكلاسيكي' : 'Classic Dark', bg: 'linear-gradient(135deg, #0f172a, #020617)' },
                      { name: isAr ? 'أزرق المحيط SMART TIME' : 'Ocean Blue', bg: 'linear-gradient(135deg, #0c2b3d, #081923)' },
                      { name: isAr ? 'الذهب الملكي' : 'Royal Gold', bg: 'linear-gradient(135deg, #2b2208, #131005)' },
                      { name: isAr ? 'زمردي هادئ' : 'Emerald Calm', bg: 'linear-gradient(135deg, #062b1e, #02120d)' },
                      { name: isAr ? 'بنفسجي نيون' : 'Neon Purple', bg: 'linear-gradient(135deg, #28103c, #100619)' },
                      { name: isAr ? 'شبكة هندسية' : 'Grid Mesh', bg: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px) 0 0/16px 16px' },
                      { name: isAr ? 'نقاط ناعمة' : 'Soft Dots', bg: 'radial-gradient(circle at 2px 2px, #334155 1px, transparent 1px) 0 0/12px 12px' },
                      { name: isAr ? 'رمادي محايد نقي' : 'Clean Neutral', bg: 'linear-gradient(135deg, #18181b, #09090b)' },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setBackground(item.bg);
                          setBackgroundUrl('');
                        }}
                        className={`h-20 rounded-2xl border-2 text-start p-2.5 flex flex-col justify-end transition-all relative overflow-hidden group ${
                          background === item.bg && !backgroundUrl
                            ? 'border-sky-500 shadow-md shadow-sky-500/20'
                            : isDark ? 'border-slate-800 hover:border-slate-700' : 'border-slate-200 hover:border-slate-400'
                        }`}
                        style={{ background: item.bg }}
                      >
                        <span className="text-[10px] font-bold text-white drop-shadow-md z-10">{item.name}</span>
                        {background === item.bg && !backgroundUrl && (
                          <div className="absolute top-2 end-2 w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => bgInputRef.current?.click()}
                    className={`p-4 rounded-2xl border border-dashed text-start transition flex items-center gap-3 ${
                      isDark ? 'border-slate-700 bg-slate-900/40 hover:bg-slate-900 hover:border-sky-500' : 'border-slate-300 bg-slate-50 hover:bg-white hover:border-sky-500'
                    }`}
                  >
                    <Upload className="w-5 h-5 text-sky-500" />
                    <div>
                      <b className="text-xs block">{isAr ? 'رفع صورة من الجهاز' : 'Upload Image'}</b>
                      <span className={`text-[10px] ${mutedText}`}>{isAr ? 'تعيين كخلفية مخصصة' : 'Set custom image'}</span>
                    </div>
                  </button>
                  <input
                    ref={bgInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleBgFile(e.target.files?.[0])}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setBackground('');
                      setBackgroundUrl('');
                    }}
                    className={`p-4 rounded-2xl border text-start transition flex items-center gap-3 ${
                      isDark ? 'border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-rose-500' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-rose-500'
                    }`}
                  >
                    <Trash2 className="w-5 h-5 text-rose-500" />
                    <div>
                      <b className="text-xs block">{isAr ? 'الخلفية الافتراضية' : 'Default Wallpaper'}</b>
                      <span className={`text-[10px] ${mutedText}`}>{isAr ? 'إزالة الخلفية المخصصة' : 'Reset to default'}</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* 3. CHAT RULES & MESSAGES */}
            {activeTab === 'rules' && (
              <div className="space-y-4 max-w-xl">
                {/* Disappearing Messages */}
                <div className={`p-3.5 rounded-2xl border space-y-2 ${cardBg}`}>
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Clock className="w-4 h-4 text-sky-500" />
                    <span>{isAr ? 'الرسائل ذاتية الاختفاء' : 'Disappearing Messages'}</span>
                  </div>
                  <p className={`text-[10px] ${mutedText}`}>
                    {isAr
                      ? 'حذف الرسائل تلقائياً بعد فترة زمنية محددة لحماية الخصوصية.'
                      : 'Automatically clear messages after specified duration.'}
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {[
                      { id: 'off', label: isAr ? 'معطل' : 'Off' },
                      { id: '24h', label: isAr ? '24 ساعة' : '24h' },
                      { id: '7d', label: isAr ? '7 أيام' : '7d' },
                      { id: '90d', label: isAr ? '90 يوماً' : '90d' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPrefs((prev) => ({ ...prev, disappearing: opt.id as any }))}
                        className={`py-1.5 rounded-xl text-xs font-bold transition ${
                          prefs.disappearing === opt.id
                            ? 'bg-sky-600 text-white shadow-xs'
                            : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slow Mode */}
                <div className={`p-3.5 rounded-2xl border space-y-2 ${cardBg}`}>
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <SlidersHorizontal className="w-4 h-4 text-sky-500" />
                    <span>{isAr ? 'الوضع البطيء (Slow Mode)' : 'Slow Mode'}</span>
                  </div>
                  <p className={`text-[10px] ${mutedText}`}>
                    {isAr
                      ? 'يفرض فاصلاً زمنياً بين كل رسالة يرسلها العضو لتجنب الإغراق.'
                      : 'Limits message frequency to prevent spam.'}
                  </p>
                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    {[
                      { val: 0, label: isAr ? 'إيقاف' : 'Off' },
                      { val: 10, label: isAr ? '10ث' : '10s' },
                      { val: 30, label: isAr ? '30ث' : '30s' },
                      { val: 60, label: isAr ? '1د' : '1m' },
                      { val: 300, label: isAr ? '5د' : '5m' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setPrefs((prev) => ({ ...prev, slowModeSeconds: opt.val as any }))}
                        className={`py-1.5 rounded-xl text-xs font-bold transition ${
                          prefs.slowModeSeconds === opt.val
                            ? 'bg-sky-600 text-white shadow-xs'
                            : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feature Toggles */}
                <div className="space-y-2">
                  {[
                    {
                      key: 'readReceipts',
                      label: isAr ? 'إيصالات القراءة (علامتي الصح ✔✔)' : 'Read Receipts',
                      desc: isAr ? 'إظهار حالة استلام وقراءة الرسائل' : 'Show message read receipts',
                    },
                    {
                      key: 'typingIndicator',
                      label: isAr ? 'مؤشر جاري الكتابة...' : 'Typing Indicator',
                      desc: isAr ? 'إظهار عندما يقوم أحد الأعضاء بكتابة رسالة' : 'Show when someone is typing',
                    },
                    {
                      key: 'linkPreviews',
                      label: isAr ? 'معاينة الروابط والصفحات' : 'Link Previews',
                      desc: isAr ? 'توليد بطاقة معاينة مصغرة للروابط المشتركة' : 'Generate preview cards for URLs',
                    },
                    {
                      key: 'mediaAutoSave',
                      label: isAr ? 'حفظ الوسائط تلقائياً' : 'Auto-save Media',
                      desc: isAr ? 'تنزيل الصور ومقاطع الفيديو مباشرة' : 'Automatically save photos to device',
                    },
                    {
                      key: 'enterToSend',
                      label: isAr ? 'زر Enter يرسل الرسالة فوراً' : 'Press Enter to Send',
                      desc: isAr ? 'استخدم Shift+Enter لسطر جديد' : 'Shift+Enter inserts a new line',
                    },
                    {
                      key: 'muted',
                      label: isAr ? 'كتم إشعارات الغرفة' : 'Mute Notifications',
                      desc: isAr ? 'تعطيل نغمات ورسائل التنبيه لهذه الغرفة' : 'Mute sound alerts for this room',
                    },
                  ].map((item) => {
                    const isEnabled = !!prefs[item.key as keyof ChatRoomSettings];
                    return (
                      <div
                        key={item.key}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border ${cardBg}`}
                      >
                        <div>
                          <b className="text-xs block">{item.label}</b>
                          <span className={`text-[10px] ${mutedText}`}>{item.desc}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => togglePref(item.key as keyof ChatRoomSettings)}
                          className={`w-11 h-6 rounded-full p-1 transition ${
                            isEnabled ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition ${
                              isEnabled ? (isAr ? '-translate-x-5' : 'translate-x-5') : ''
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. PERMISSIONS & SECURITY */}
            {activeTab === 'permissions' && (
              <div className="space-y-4 max-w-xl">
                {/* Role Switcher */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold">{isAr ? 'صلاحيات الأدوار' : 'Role Permissions'}</h3>
                    <p className={`text-[10px] ${mutedText}`}>
                      {isAr ? 'اختر الدور لتعديل الصلاحيات الممنوحة له:' : 'Select role to configure permissions:'}
                    </p>
                  </div>
                  <div className={`flex gap-1 p-1 rounded-xl ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-slate-100 border border-slate-200'}`}>
                    {[
                      { id: 'member', label: isAr ? 'الأعضاء' : 'Members' },
                      { id: 'moderator', label: isAr ? 'المشرفون' : 'Moderators' },
                      { id: 'admin', label: isAr ? 'المديرون' : 'Admins' },
                    ].map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setSelectedRoleForPerms(role.id as any)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                          selectedRoleForPerms === role.id
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { key: 'sendMessages', label: isAr ? 'إرسال الرسائل النصية' : 'Send Messages' },
                    { key: 'sendMedia', label: isAr ? 'إرسال الصور والفيديوهات والمستندات' : 'Send Media & Docs' },
                    { key: 'startCalls', label: isAr ? 'بدء المكالمات الصوتية والمرئية' : 'Start Audio / Video Calls' },
                    { key: 'pinMessages', label: isAr ? 'تثبيت الرسائل الهامة' : 'Pin Messages' },
                    { key: 'addMembers', label: isAr ? 'إضافة أعضاء جدد للغرفة' : 'Add New Members' },
                    { key: 'mentionEveryone', label: isAr ? 'إرسال منشن للجميع @all' : 'Mention @everyone' },
                    { key: 'editRoom', label: isAr ? 'تعديل اسم ووصف الغرفة' : 'Edit Room Info' },
                    { key: 'deleteMessages', label: isAr ? 'حذف رسائل الأعضاء الآخرين' : 'Delete Other Messages' },
                  ].map((perm) => {
                    const isEnabled = !!getActivePerms()[perm.key as keyof ChatRoomPermissions];
                    return (
                      <div
                        key={perm.key}
                        className={`flex items-center justify-between p-3 rounded-xl border ${cardBg}`}
                      >
                        <span className="text-xs font-semibold">{perm.label}</span>
                        <button
                          type="button"
                          disabled={!isRoomOwner && selectedRoleForPerms === 'admin'}
                          onClick={() => togglePermission(perm.key as keyof ChatRoomPermissions)}
                          className={`w-10 h-5 rounded-full p-0.5 transition ${
                            isEnabled ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition ${
                              isEnabled ? (isAr ? '-translate-x-5' : 'translate-x-5') : ''
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. MEMBERS & ROLES */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder={isAr ? 'بحث في الأعضاء...' : 'Search members...'}
                      className={`w-full ps-9 pe-3 py-2 rounded-xl text-xs ${inputBg}`}
                    />
                  </div>
                  {isRoomOwner && (
                    <button
                      type="button"
                      onClick={() => setShowAddMemberDialog(true)}
                      className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{isAr ? 'إضافة عضو' : 'Add member'}</span>
                    </button>
                  )}
                </div>

                {/* Add member dialog */}
                {showAddMemberDialog && (
                  <div className="p-3.5 rounded-2xl border border-sky-500/40 bg-sky-500/10 space-y-2">
                    <b className="text-xs block text-sky-600 dark:text-sky-400">{isAr ? 'إضافة عضو جديد إلى الغرفة' : 'Add New Member'}</b>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder={isAr ? 'اسم العضو الجديد...' : 'Member name...'}
                        className={`flex-1 px-3 py-1.5 rounded-xl text-xs ${inputBg}`}
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomMember}
                        className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-xs"
                      >
                        {isAr ? 'إضافة' : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddMemberDialog(false)}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs"
                      >
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Members list */}
                <div className={`divide-y rounded-2xl overflow-hidden border ${isDark ? 'divide-slate-800 border-slate-800 bg-slate-900/40' : 'divide-slate-200 border-slate-200 bg-white'}`}>
                  {membersList
                    .filter((m) => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                    .map((m) => (
                      <div key={m.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={m.avatar} alt="" className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold truncate">{m.name}</span>
                              {m.role === 'owner' && <Crown className="w-3 h-3 text-amber-500 fill-current" />}
                            </div>
                            <span className={`text-[10px] ${mutedText} block`}>
                              {m.role === 'owner'
                                ? isAr ? 'مالك الغرفة' : 'Owner'
                                : m.role === 'admin'
                                ? isAr ? 'مدير' : 'Admin'
                                : m.role === 'moderator'
                                ? isAr ? 'مشرف' : 'Moderator'
                                : isAr ? 'عضو' : 'Member'}
                            </span>
                          </div>
                        </div>

                        {/* Owner Controls for roles */}
                        {isRoomOwner && m.role !== 'owner' && (
                          <div className="flex items-center gap-2">
                            <select
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.id, e.target.value as any)}
                              className={`px-2 py-1 rounded-lg border text-xs ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                            >
                              <option value="member">{isAr ? 'عضو' : 'Member'}</option>
                              <option value="moderator">{isAr ? 'مشرف' : 'Moderator'}</option>
                              <option value="admin">{isAr ? 'مدير' : 'Admin'}</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                              title={isAr ? 'إزالة' : 'Remove'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 6. ADVANCED & DANGER ZONE */}
            {activeTab === 'danger' && (
              <div className="space-y-4 max-w-xl">
                {/* Export Chat */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${cardBg}`}>
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5 text-sky-500" />
                    <div>
                      <b className="text-xs block">{isAr ? 'تصدير سجل المحادثة' : 'Export Chat History'}</b>
                      <span className={`text-[10px] ${mutedText}`}>
                        {isAr ? 'تحميل سجل الرسائل كملف نصي آمن' : 'Download chat messages as a text file'}
                      </span>
                    </div>
                  </div>
                  {onExportChat && (
                    <button
                      type="button"
                      onClick={onExportChat}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                        isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                      }`}
                    >
                      {isAr ? 'تصدير' : 'Export'}
                    </button>
                  )}
                </div>

                {/* Clear Chat Messages */}
                <div className={`p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-5 h-5 text-amber-500" />
                    <div>
                      <b className="text-xs block">{isAr ? 'مسح رسائل الغرفة' : 'Clear Room Messages'}</b>
                      <span className={`text-[10px] ${mutedText}`}>
                        {isAr ? 'حذف جميع الرسائل السابقة مع الاحتفاظ بالغرفة' : 'Clear all messages while keeping the room'}
                      </span>
                    </div>
                  </div>
                  {onClearHistory && (
                    <button
                      type="button"
                      onClick={onClearHistory}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 text-xs font-bold transition"
                    >
                      {isAr ? 'مسح الرسائل' : 'Clear'}
                    </button>
                  )}
                </div>

                {/* Leave Room */}
                <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5 text-rose-500" />
                    <div>
                      <b className="text-xs block">{isAr ? 'مغادرة الغرفة' : 'Leave Room'}</b>
                      <span className={`text-[10px] ${mutedText}`}>
                        {isAr ? 'الخروج من هذه المحادثة وإلغاء الاشتراك بها' : 'Exit this chat room'}
                      </span>
                    </div>
                  </div>
                  {onLeaveRoom && (
                    <button
                      type="button"
                      onClick={onLeaveRoom}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/30 text-xs font-bold transition"
                    >
                      {isAr ? 'مغادرة' : 'Leave'}
                    </button>
                  )}
                </div>

                {/* Delete Room (Owner only) */}
                {isRoomOwner && onDeleteRoom && (
                  <div className="p-4 rounded-2xl border border-rose-600 bg-rose-950/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-500" />
                      <div>
                        <b className="text-xs block text-rose-500 dark:text-rose-400">{isAr ? 'حذف الغرفة نهائياً' : 'Delete Room Permanently'}</b>
                        <span className="text-[10px] text-rose-400/80">
                          {isAr ? 'إزالة الغرفة وجميع محتوياتها من النظام نهائياً' : 'Completely erase room and data'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onDeleteRoom}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-xs transition"
                    >
                      {isAr ? 'حذف الغرفة' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t flex items-center justify-between ${headerFooterBg}`}>
          <span className={`text-[10px] ${mutedText} flex items-center gap-1.5`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
            <span>{isAr ? 'يتم تطبيق التغييرات فور الحفظ' : 'Changes apply immediately upon saving'}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs shadow-md transition active:scale-95"
            >
              {isAr ? 'حفظ التغييرات' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
