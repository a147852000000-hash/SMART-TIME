import React, { useState, useRef } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Crown,
  ShieldCheck,
  Shield,
  User,
  AtSign,
  Phone,
  Video,
  MoreVertical,
  X,
  UserMinus,
  Ban,
  Contact,
  Radio,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ChatMember } from '../types';

interface ChatMembersSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  members: ChatMember[];
  isRoomOwner: boolean;
  isAr?: boolean;
  isDark?: boolean;
  onAddMember?: () => void;
  onTagMember?: (member: ChatMember) => void;
  onStartCall?: (kind: 'voice' | 'video', member: ChatMember) => void;
  onChangeRole?: (id: string, role: ChatMember['role']) => void;
  onRemoveMember?: (id: string) => void;
  onBanMember?: (id: string) => void;
  onSaveContact?: (member: ChatMember) => void;
}

export const ChatMembersSidebar: React.FC<ChatMembersSidebarProps> = ({
  isOpen,
  onClose,
  members,
  isRoomOwner,
  isAr = true,
  isDark = true,
  onAddMember,
  onTagMember,
  onStartCall,
  onChangeRole,
  onRemoveMember,
  onBanMember,
  onSaveContact,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);
  const [showOfflineSection, setShowOfflineSection] = useState(true);

  // Long press handling for mobile touch & desktop click-and-hold
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressActiveRef = useRef(false);

  if (!isOpen) return null;

  // Sorting function: earliest joined first
  const sortByEarliestJoined = (a: ChatMember, b: ChatMember) => {
    // Owner always at top
    if (a.role === 'owner' && b.role !== 'owner') return -1;
    if (b.role === 'owner' && a.role !== 'owner') return 1;

    // Earliest joined first
    const aTime = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
    const bTime = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
    if (aTime !== bTime && aTime > 0 && bTime > 0) return aTime - bTime;
    return a.name.localeCompare(b.name, isAr ? 'ar' : 'en');
  };

  // Active online members
  const onlineMembers = members
    .filter((m) => !m.banned && (m.isOnline ?? true))
    .sort(sortByEarliestJoined);

  // Offline members
  const offlineMembers = members
    .filter((m) => !m.banned && !(m.isOnline ?? true))
    .sort(sortByEarliestJoined);

  // Filter based on search query
  const query = searchQuery.trim().toLowerCase();
  const filteredOnline = onlineMembers.filter((m) =>
    query ? m.name.toLowerCase().includes(query) : true
  );
  const filteredOffline = offlineMembers.filter((m) =>
    query ? m.name.toLowerCase().includes(query) : true
  );

  const getRoleBadge = (role: ChatMember['role']) => {
    switch (role) {
      case 'owner':
        return {
          label: isAr ? 'المالك' : 'Owner',
          icon: Crown,
          className:
            'bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/30',
        };
      case 'admin':
        return {
          label: isAr ? 'مدير' : 'Admin',
          icon: ShieldCheck,
          className:
            'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
        };
      case 'moderator':
        return {
          label: isAr ? 'مشرف' : 'Moderator',
          icon: Shield,
          className:
            'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
        };
      default:
        return {
          label: isAr ? 'عضو' : 'Member',
          icon: User,
          className:
            'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
        };
    }
  };

  const handleTouchStart = (memberId: string) => {
    isLongPressActiveRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setActiveMenuMemberId(memberId);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch {}
      }
    }, 550);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const renderMemberCard = (member: ChatMember, isOnline: boolean) => {
    const badge = getRoleBadge(member.role);
    const BadgeIcon = badge.icon;
    const isMenuOpen = activeMenuMemberId === member.id;
    const isOwner = member.role === 'owner';

    return (
      <div
        key={member.id}
        className="relative group select-none"
        onTouchStart={() => handleTouchStart(member.id)}
        onTouchEnd={handleTouchEnd}
        onMouseDown={() => handleTouchStart(member.id)}
        onMouseUp={handleTouchEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          setActiveMenuMemberId(isMenuOpen ? null : member.id);
        }}
      >
        <div
          className={`flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer ${
            isDark
              ? 'hover:bg-slate-800/80 active:bg-slate-800 text-slate-100'
              : 'hover:bg-sky-50 active:bg-sky-100 text-slate-800'
          } ${isMenuOpen ? (isDark ? 'bg-slate-800 ring-1 ring-sky-500/40' : 'bg-sky-50 ring-1 ring-sky-400/40') : ''}`}
        >
          {/* Avatar with status indicator & owner crown */}
          <div className="relative shrink-0">
            <img
              src={member.avatar}
              alt={member.name}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover shadow-xs border ${
                isOwner
                  ? 'border-amber-400 ring-2 ring-amber-400/30'
                  : isDark
                  ? 'border-slate-700'
                  : 'border-slate-200'
              }`}
            />
            {isOwner && (
              <span
                className="absolute -top-1 -start-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs text-[9px]"
                title={isAr ? 'صاحب الغرفة / المالك' : 'Room Owner'}
              >
                <Crown className="w-2.5 h-2.5 fill-current" />
              </span>
            )}
            <span
              className={`absolute -bottom-0.5 -end-0.5 w-3 h-3 rounded-full border-2 ${
                isDark ? 'border-slate-900' : 'border-white'
              } ${
                isOnline
                  ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                  : 'bg-slate-400 dark:bg-slate-600'
              }`}
              title={
                isOnline
                  ? isAr
                    ? 'متصل الآن'
                    : 'Online'
                  : isAr
                  ? 'غير متصل'
                  : 'Offline'
              }
            />
          </div>

          {/* Member Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold truncate text-slate-900 dark:text-slate-100">
                {member.name}
              </span>
              {isOwner && (
                <span
                  className="px-1.5 py-0.2 rounded-md bg-amber-500/15 border border-amber-500/30 text-[9px] font-extrabold text-amber-600 dark:text-amber-400 shrink-0 flex items-center gap-0.5"
                >
                  <Crown className="w-2.5 h-2.5 fill-current" />
                  <span>{isAr ? 'المالك' : 'Owner'}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              {!isOwner && (
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold border ${badge.className}`}
                >
                  <BadgeIcon className="w-2.5 h-2.5" />
                  <span>{badge.label}</span>
                </span>
              )}
              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {isOnline
                  ? isAr
                    ? 'نشط الآن'
                    : 'Online'
                  : isAr
                  ? 'غير متصل'
                  : 'Offline'}
              </span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-0.5 shrink-0">
            {onTagMember && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTagMember(member);
                }}
                className="p-1 rounded-lg hover:bg-sky-500/15 text-slate-400 hover:text-sky-500 transition"
                title={isAr ? 'إشارة للعضو @' : 'Tag @'}
              >
                <AtSign className="w-3.5 h-3.5" />
              </button>
            )}

            {onStartCall && isOnline && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartCall('voice', member);
                }}
                className="p-1 rounded-lg hover:bg-emerald-500/15 text-slate-400 hover:text-emerald-500 transition"
                title={isAr ? 'اتصال صوتي' : 'Call'}
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuMemberId(isMenuOpen ? null : member.id);
              }}
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              title={isAr ? 'خيارات العضو' : 'Options'}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Member Action Menu Modal / Popup */}
        {isMenuOpen && (
          <div
            className={`absolute end-2 top-full mt-1 w-52 rounded-2xl border shadow-xl p-1.5 z-50 text-xs animate-scaleUp ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-black/60'
                : 'bg-white border-slate-200 text-slate-800 shadow-slate-300'
            }`}
          >
            {/* Header info inside menu */}
            <div className="px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-800 mb-1 flex items-center justify-between">
              <span className="font-extrabold text-[11px] truncate">{member.name}</span>
              <button
                type="button"
                onClick={() => setActiveMenuMemberId(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-100"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {onTagMember && (
              <button
                type="button"
                onClick={() => {
                  onTagMember(member);
                  setActiveMenuMemberId(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-sky-500/10 hover:text-sky-500 text-start transition"
              >
                <AtSign className="w-3.5 h-3.5 text-sky-500" />
                <span>{isAr ? 'إشارة للعضو بالرسائل' : 'Mention in chat'}</span>
              </button>
            )}

            {onStartCall && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onStartCall('voice', member);
                    setActiveMenuMemberId(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 text-start transition"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{isAr ? 'بدء مكالمة صوتية' : 'Voice call'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStartCall('video', member);
                    setActiveMenuMemberId(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 text-start transition"
                >
                  <Video className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{isAr ? 'بدء مكالمة فيديو' : 'Video call'}</span>
                </button>
              </>
            )}

            {onSaveContact && (
              <button
                type="button"
                onClick={() => {
                  onSaveContact(member);
                  setActiveMenuMemberId(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-sky-500/10 hover:text-sky-500 text-start transition"
              >
                <Contact className="w-3.5 h-3.5 text-sky-500" />
                <span>{isAr ? 'حفظ بجهات الاتصال' : 'Save contact'}</span>
              </button>
            )}

            {/* Role & Admin Actions (Only for Room Owner and non-owner target) */}
            {isRoomOwner && member.role !== 'owner' && (
              <>
                <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
                <div className="px-2 py-0.5 text-[9px] font-bold text-slate-400">
                  {isAr ? 'صلاحيات وإدارة العضو' : 'Member Management'}
                </div>

                {member.role !== 'admin' && onChangeRole && (
                  <button
                    type="button"
                    onClick={() => {
                      onChangeRole(member.id, 'admin');
                      setActiveMenuMemberId(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-sky-500/10 text-sky-500 text-start transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تعيين كـ Admin' : 'Make Admin'}</span>
                  </button>
                )}

                {member.role !== 'moderator' && onChangeRole && (
                  <button
                    type="button"
                    onClick={() => {
                      onChangeRole(member.id, 'moderator');
                      setActiveMenuMemberId(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-teal-500/10 text-teal-500 text-start transition"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تعيين كـ Moderator' : 'Make Moderator'}</span>
                  </button>
                )}

                {member.role !== 'member' && onChangeRole && (
                  <button
                    type="button"
                    onClick={() => {
                      onChangeRole(member.id, 'member');
                      setActiveMenuMemberId(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-500/10 text-slate-500 dark:text-slate-400 text-start transition"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تحويله إلى Member' : 'Set as Member'}</span>
                  </button>
                )}

                <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />

                {onBanMember && (
                  <button
                    type="button"
                    onClick={() => {
                      onBanMember(member.id);
                      setActiveMenuMemberId(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-start transition"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{isAr ? 'حظر العضو من الغرفة' : 'Ban Member'}</span>
                  </button>
                )}

                {onRemoveMember && (
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveMember(member.id);
                      setActiveMenuMemberId(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 text-start transition"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>{isAr ? 'إزالة العضو من الغرفة' : 'Remove Member'}</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 start-0 z-40 w-72 sm:w-80 md:static md:z-auto md:h-full flex flex-col border-e transition-all duration-300 shadow-xl md:shadow-none select-none ${
          isDark
            ? 'bg-slate-900/98 border-slate-800 text-slate-100'
            : 'bg-white/98 border-slate-200 text-slate-800'
        }`}
        id="chat-active-users-sidebar"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header with Title "المستخدمون النشطون" and Online Count */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {isAr ? 'المستخدمون النشطون' : 'Active Users'}
                  </h3>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400">
                    {onlineMembers.length}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-500 dark:text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    {isAr
                      ? `${onlineMembers.length} متصلين حالياً`
                      : `${onlineMembers.length} connected now`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onAddMember && isRoomOwner && (
                <button
                  type="button"
                  onClick={onAddMember}
                  className="p-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold transition shadow-xs"
                  title={isAr ? 'إضافة عضو جديد' : 'Add member'}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                title={isAr ? 'إغلاق القائمة' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Member Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث بالاسم في الأعضاء...' : 'Search members...'}
              className={`w-full ps-8 pe-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                isDark
                  ? 'bg-slate-950/80 border-slate-800 text-white placeholder-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        {/* Scrollable Members List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3 divide-y divide-slate-100 dark:divide-slate-800/60 scrollbar-thin">
          {/* SECTION 1: Online Members (المستخدمون المتصلون) */}
          <div className="space-y-1">
            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{isAr ? 'المتصلون الآن' : 'Online Now'}</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 font-bold">
                {filteredOnline.length}
              </span>
            </div>

            {filteredOnline.map((member) => renderMemberCard(member, true))}

            {filteredOnline.length === 0 && (
              <div className="p-3 text-center text-slate-400 text-xs italic">
                {isAr ? 'لا يوجد أعضاء متصلون حالياً' : 'No online members'}
              </div>
            )}
          </div>

          {/* SECTION 2: Offline Members (غير متصلين) */}
          {offlineMembers.length > 0 && (
            <div className="pt-2.5 space-y-1">
              <button
                type="button"
                onClick={() => setShowOfflineSection(!showOfflineSection)}
                className="w-full px-2 py-1 flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>{isAr ? 'غير متصلين' : 'Offline'}</span>
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-500/10 text-slate-400 font-bold">
                    {filteredOffline.length}
                  </span>
                  {showOfflineSection ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </div>
              </button>

              {showOfflineSection && (
                <div className="space-y-1">
                  {filteredOffline.map((member) => renderMemberCard(member, false))}
                </div>
              )}
            </div>
          )}

          {filteredOnline.length === 0 && filteredOffline.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-sky-500" />
              <p>{isAr ? 'لا يوجد أعضاء مطابقون للبحث' : 'No members found'}</p>
            </div>
          )}
        </div>

        {/* Footer info: E2EE */}
        <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 text-center shrink-0 flex items-center justify-center gap-1.5">
          <Radio className="w-3 h-3 text-sky-500 animate-pulse" />
          <span>
            {isAr
              ? 'محادثة مشفرة وآمنة • SMART TIME'
              : 'End-to-End Encrypted • SMART TIME'}
          </span>
        </div>
      </aside>
    </>
  );
};
