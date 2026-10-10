import React, { useState, useEffect } from 'react';
import { UserPlus, Search, X, Check, Shield, User, ShieldAlert } from 'lucide-react';
import { ChatMember } from '../types';
import { chatService } from '../services/chatService';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  existingMembers: ChatMember[];
  isAr: boolean;
  isDark: boolean;
  onMemberAdded?: () => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  roomId,
  existingMembers,
  isAr,
  isDark,
  onMemberAdded,
}) => {
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; avatar: string; phone?: string; isOnline?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'moderator' | 'member'>('member');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      chatService
        .getUsers()
        .then((list) => setUsers(list))
        .catch((err) => console.warn('Failed to load users:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const existingIds = new Set(existingMembers.map((m) => m.id));

  const filteredUsers = users.filter((u) =>
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.phone || '').includes(searchQuery)
  );

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    try {
      await chatService.addMember(roomId, selectedUserId, selectedRole);
      onMemberAdded?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إضافة العضو');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      <div className={`w-full max-w-lg rounded-3xl border ${isDark ? 'bg-slate-900 border-sky-500/40 text-white' : 'bg-white border-sky-500/40 text-slate-900'} shadow-2xl overflow-hidden flex flex-col max-h-[85vh]`}>
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-500 border border-sky-500/30 flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">
                {isAr ? 'إضافة عضو جديد للغرفة' : 'Add New Member'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {isAr ? 'اختر مستخدماً من النظام لإضافته وتحديد صلاحياته' : 'Select user to add and set their role'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث بالاسم أو البريد الإلكتروني أو الهاتف...' : 'Search by name, email, or phone...'}
              className="w-full ps-9 pe-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-60">
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs animate-pulse">
              {isAr ? 'جاري تحميل المستخدمين...' : 'Loading users...'}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              {isAr ? 'لا يوجد مستخدمون متطابقون' : 'No users found'}
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isAlreadyMember = existingIds.has(u.id);
              const isSelected = selectedUserId === u.id;

              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={isAlreadyMember}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full p-3 rounded-2xl border text-start flex items-center justify-between transition-all ${
                    isAlreadyMember
                      ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-850/30 border-slate-200 dark:border-slate-800'
                      : isSelected
                      ? 'bg-sky-500/15 border-sky-500 ring-1 ring-sky-500/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-850/60 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      {u.isOnline && (
                        <span className="absolute -bottom-0.5 -end-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs truncate">{u.name}</h4>
                      <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                    </div>
                  </div>

                  <div className="shrink-0 ms-2">
                    {isAlreadyMember ? (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500">
                        {isAr ? 'عضو بالفعل' : 'Already in'}
                      </span>
                    ) : isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Role Selector */}
        {selectedUserId && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              {isAr ? 'تحديد رتبة العضو في الغرفة:' : 'Assign member role:'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'member', label: isAr ? 'عضو عادي' : 'Member', icon: User },
                { id: 'moderator', label: isAr ? 'مشرف' : 'Moderator', icon: Shield },
                { id: 'admin', label: isAr ? 'مسؤول' : 'Admin', icon: ShieldAlert },
              ].map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRole(r.id as any)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      selectedRole === r.id
                        ? 'bg-sky-600 text-white border-sky-500 shadow-xs'
                        : 'border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!selectedUserId || submitting}
            onClick={handleAdd}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white shadow-md transition-all active:scale-95"
          >
            {submitting ? (isAr ? 'جاري الإضافة...' : 'Adding...') : (isAr ? 'إضافة إلى الغرفة' : 'Add Member')}
          </button>
        </div>
      </div>
    </div>
  );
};
