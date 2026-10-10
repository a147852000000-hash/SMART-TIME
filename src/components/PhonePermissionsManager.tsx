import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Users,
  Camera,
  Mic,
  MapPin,
  Bell,
  HardDrive,
  Bluetooth,
  SunMedium,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Download,
  Upload,
  Plus,
  Trash2,
  Search,
  ExternalLink,
  Info,
  Check,
  Play,
  UserPlus,
  Clock,
  Radio,
  Sliders,
} from 'lucide-react';
import {
  PermissionService,
  PermissionItem,
  PermissionId,
  CallLogEntry,
  PhoneContact,
  PermissionAuditLog,
} from '../services/permissionService';
import { Language, ThemeMode } from '../types';

interface PhonePermissionsManagerProps {
  language: Language;
  theme: ThemeMode;
  onShowToast?: (message: string) => void;
}

export const PhonePermissionsManager: React.FC<PhonePermissionsManagerProps> = ({
  language,
  theme,
  onShowToast,
}) => {
  const isAr = language === 'ar';
  const isDark = theme === 'dark';

  const [activeSubTab, setActiveSubTab] = useState<'permissions' | 'call_logs' | 'contacts' | 'audit'>('permissions');
  const [permissions, setPermissions] = useState<PermissionItem[]>(() => PermissionService.getPermissions());
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>(() => PermissionService.getCallLogs());
  const [contacts, setContacts] = useState<PhoneContact[]>(() => PermissionService.getContacts());
  const [auditLogs, setAuditLogs] = useState<PermissionAuditLog[]>(() => PermissionService.getAuditLogs());

  // Filter states
  const [permissionCategory, setPermissionCategory] = useState<'all' | 'phone' | 'media' | 'system' | 'hardware'>('all');
  const [callFilter, setCallFilter] = useState<'all' | 'incoming' | 'outgoing' | 'missed'>('all');
  const [callSearch, setCallSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contactCategory, setContactCategory] = useState<string>('all');

  // New call / contact modals/forms
  const [showAddCallModal, setShowAddCallModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [quickDialNumber, setQuickDialNumber] = useState('');
  const [quickDialName, setQuickDialName] = useState('');

  const [newCallData, setNewCallData] = useState<{
    contactName: string;
    phoneNumber: string;
    type: 'incoming' | 'outgoing' | 'missed';
    durationSeconds: number;
    note: string;
  }>({
    contactName: '',
    phoneNumber: '',
    type: 'outgoing',
    durationSeconds: 60,
    note: '',
  });

  const [newContactData, setNewContactData] = useState<{
    name: string;
    phoneNumber: string;
    email: string;
    category: 'family' | 'work' | 'friends' | 'emergency' | 'other';
  }>({
    name: '',
    phoneNumber: '',
    email: '',
    category: 'family',
  });

  const [testingPermissionId, setTestingPermissionId] = useState<string | null>(null);

  // Sync with global custom events
  useEffect(() => {
    const handlePermChange = () => {
      setPermissions(PermissionService.getPermissions());
      setAuditLogs(PermissionService.getAuditLogs());
    };
    const handleCallChange = () => setCallLogs(PermissionService.getCallLogs());
    const handleContactChange = () => setContacts(PermissionService.getContacts());

    window.addEventListener('smart_time_permissions_changed', handlePermChange);
    window.addEventListener('smart_time_call_logs_changed', handleCallChange);
    window.addEventListener('smart_time_contacts_changed', handleContactChange);

    return () => {
      window.removeEventListener('smart_time_permissions_changed', handlePermChange);
      window.removeEventListener('smart_time_call_logs_changed', handleCallChange);
      window.removeEventListener('smart_time_contacts_changed', handleContactChange);
    };
  }, []);

  const toast = (msg: string) => {
    if (onShowToast) onShowToast(msg);
  };

  const grantedCount = permissions.filter((p) => p.status === 'granted').length;
  const totalCount = permissions.length;
  const grantedPercent = Math.round((grantedCount / totalCount) * 100);

  // Handle granting single permission
  const handleTogglePermission = async (perm: PermissionItem) => {
    if (perm.status === 'granted') {
      PermissionService.setPermissionStatus(perm.id, 'prompt', 'تم إلغاء الإذن يدوياً');
      setPermissions(PermissionService.getPermissions());
      setAuditLogs(PermissionService.getAuditLogs());
      toast(isAr ? `تم إلغاء تفعيل إذن: ${perm.nameAr}` : `Revoked permission: ${perm.nameEn}`);
    } else {
      setTestingPermissionId(perm.id);
      const res = await PermissionService.requestPermissionLive(perm.id);
      setTestingPermissionId(null);
      setPermissions(PermissionService.getPermissions());
      setAuditLogs(PermissionService.getAuditLogs());
      toast(res.message);
    }
  };

  // Grant all permissions
  const handleGrantAll = () => {
    PermissionService.grantAllPermissions();
    setPermissions(PermissionService.getPermissions());
    setAuditLogs(PermissionService.getAuditLogs());
    toast(isAr ? 'تم منح وتفعيل كافة أذونات وصلاحيات الهاتف بنجاح!' : 'All phone permissions granted successfully!');
  };

  // Reset all permissions
  const handleResetAll = () => {
    PermissionService.resetAllPermissions();
    setPermissions(PermissionService.getPermissions());
    setAuditLogs(PermissionService.getAuditLogs());
    toast(isAr ? 'تمت إعادة ضبط الصلاحيات إلى الحالة الافتراضية' : 'Permissions reset to default');
  };

  // Filtered lists
  const filteredPermissions = permissions.filter((p) => {
    if (permissionCategory === 'all') return true;
    return p.category === permissionCategory;
  });

  const filteredCalls = callLogs.filter((c) => {
    if (callFilter !== 'all' && c.type !== callFilter) return false;
    if (callSearch.trim()) {
      const q = callSearch.toLowerCase();
      return c.contactName.toLowerCase().includes(q) || c.phoneNumber.includes(q) || (c.note && c.note.toLowerCase().includes(q));
    }
    return true;
  });

  const filteredContacts = contacts.filter((c) => {
    if (contactCategory !== 'all' && c.category !== contactCategory) return false;
    if (contactSearch.trim()) {
      const q = contactSearch.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.phoneNumber.includes(q) || (c.email && c.email.toLowerCase().includes(q));
    }
    return true;
  });

  // Call handling
  const handleInitiateCall = (phoneNumber: string, contactName?: string) => {
    if (!PermissionService.isGranted('call_logs')) {
      PermissionService.setPermissionStatus('call_logs', 'granted', 'تفعيل تلقائي عند إجراء مكالمة');
    }
    PermissionService.makePhoneCall(phoneNumber, contactName);
    setCallLogs(PermissionService.getCallLogs());
    toast(isAr ? `جاري الاتصال بـ ${contactName || phoneNumber}...` : `Calling ${contactName || phoneNumber}...`);
  };

  const handleSaveNewCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCallData.phoneNumber.trim()) {
      toast(isAr ? 'يرجى إدخال رقم الهاتف' : 'Please enter a phone number');
      return;
    }
    PermissionService.addCallLog({
      contactName: newCallData.contactName.trim() || newCallData.phoneNumber,
      phoneNumber: newCallData.phoneNumber.trim(),
      type: newCallData.type,
      durationSeconds: newCallData.type === 'missed' ? 0 : Number(newCallData.durationSeconds) || 60,
      note: newCallData.note.trim() || undefined,
    });
    setCallLogs(PermissionService.getCallLogs());
    setShowAddCallModal(false);
    setNewCallData({
      contactName: '',
      phoneNumber: '',
      type: 'outgoing',
      durationSeconds: 60,
      note: '',
    });
    toast(isAr ? 'تمت إضافة المكالمة إلى السجل بنجاح' : 'Call log added successfully');
  };

  const handleDeleteCall = (id: string) => {
    PermissionService.deleteCallLog(id);
    setCallLogs(PermissionService.getCallLogs());
    toast(isAr ? 'تم حذف السجل' : 'Call log entry deleted');
  };

  const handleClearAllCalls = () => {
    if (confirm(isAr ? 'هل أنت متأكد من رغبتك في مسح سجل المكالمات بالكامل؟' : 'Are you sure you want to clear all call logs?')) {
      PermissionService.clearCallLogs();
      setCallLogs([]);
      toast(isAr ? 'تم مسح سجل المكالمات بالكامل' : 'All call logs cleared');
    }
  };

  // Contacts handling
  const handleSaveNewContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactData.name.trim() || !newContactData.phoneNumber.trim()) {
      toast(isAr ? 'يرجى إدخال الاسم ورقم الهاتف' : 'Please provide name and phone number');
      return;
    }
    PermissionService.addContact({
      name: newContactData.name.trim(),
      phoneNumber: newContactData.phoneNumber.trim(),
      email: newContactData.email.trim() || undefined,
      category: newContactData.category,
      lastContacted: 'أضيف حديثاً',
    });
    setContacts(PermissionService.getContacts());
    setShowAddContactModal(false);
    setNewContactData({
      name: '',
      phoneNumber: '',
      email: '',
      category: 'family',
    });
    toast(isAr ? 'تمت إضافة جهة الاتصال بنجاح' : 'Contact added successfully');
  };

  const handleDeleteContact = (id: string) => {
    PermissionService.deleteContact(id);
    setContacts(PermissionService.getContacts());
    toast(isAr ? 'تم حذف جهة الاتصال' : 'Contact deleted');
  };

  const handleImportNativeContacts = async () => {
    const res = await PermissionService.pickNativeContacts();
    if (res.success && res.contacts) {
      setContacts(PermissionService.getContacts());
      toast(isAr ? `تم استيراد ${res.contacts.length} جهة اتصال من هاتفك بنجاح!` : `Imported ${res.contacts.length} contacts!`);
    } else {
      toast(res.error || (isAr ? 'تعذر استيراد جهات الاتصال' : 'Failed to import contacts'));
    }
  };

  const handleExportVCF = () => {
    PermissionService.exportContactsVCF();
    toast(isAr ? 'تم تنزيل ملف جهات الاتصال (VCF) بنجاح!' : 'Contacts VCF file downloaded!');
  };

  const renderIcon = (iconName: string, className = 'w-4 h-4') => {
    switch (iconName) {
      case 'PhoneCall':
        return <PhoneCall className={className} />;
      case 'Users':
        return <Users className={className} />;
      case 'Camera':
        return <Camera className={className} />;
      case 'Mic':
        return <Mic className={className} />;
      case 'MapPin':
        return <MapPin className={className} />;
      case 'Bell':
        return <Bell className={className} />;
      case 'HardDrive':
        return <HardDrive className={className} />;
      case 'Bluetooth':
        return <Bluetooth className={className} />;
      case 'SunMedium':
        return <SunMedium className={className} />;
      default:
        return <Shield className={className} />;
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return isAr ? 'فائتة / بدون إجابة' : 'Missed';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s} ${isAr ? 'ثانية' : 'sec'}`;
    return `${m} ${isAr ? 'د' : 'm'} ${s > 0 ? `${s} ${isAr ? 'ث' : 's'}` : ''}`;
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-4 text-xs select-none" id="phone-permissions-manager">
      {/* 1. TOP HERO: Permissions Status & Quick Action Bar */}
      <div className={`p-4 rounded-3xl border transition-all ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-slate-700/60 shadow-lg' : 'bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 border-indigo-100 shadow-sm'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${grantedPercent >= 80 ? 'bg-emerald-500 text-white' : grantedPercent >= 40 ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'}`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isAr ? 'مركز صلاحيات الهاتف وأذونات النظام' : 'Phone & System Permissions Center'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${grantedPercent === 100 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-accent-500/20 text-accent-700 dark:text-accent-400 border border-accent-500/30'}`}>
                  {grantedCount} / {totalCount} {isAr ? 'صلاحية ممنوحة' : 'Granted'} ({grantedPercent}%)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? 'تحكم كامل في أذونات الهاتف، سجل المكالمات، جهات الاتصال، الكاميرا، الصوت، والـ GPS للأداء الأقصى.'
                  : 'Full control over phone permissions, call logs, contacts, camera, mic, and GPS.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleGrantAll}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAr ? 'منح جميع الصلاحيات' : 'Grant All Permissions'}</span>
            </button>
            <button
              type="button"
              onClick={handleResetAll}
              className="p-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold rounded-xl transition-colors"
              title={isAr ? 'إعادة ضبط كافة الصلاحيات' : 'Reset Permissions'}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3.5 space-y-1.5">
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${grantedPercent >= 80 ? 'bg-emerald-500' : grantedPercent >= 40 ? 'bg-amber-500' : 'bg-indigo-500'}`}
              style={{ width: `${grantedPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
            <span>{isAr ? 'مستوى جاهزية وتكامل التطبيق مع هاتفك' : 'App Readiness & Device Integration'}</span>
            <span className="font-mono">{grantedPercent}%</span>
          </div>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('permissions')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
            activeSubTab === 'permissions'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>{isAr ? 'الأذونات والصلاحيات' : 'Permissions List'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono">
            {grantedCount}/{totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('call_logs')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
            activeSubTab === 'call_logs'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>{isAr ? 'سجل المكالمات والاتصال' : 'Call Logs'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
            {callLogs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('contacts')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
            activeSubTab === 'contacts'
              ? 'bg-white dark:bg-slate-900 text-accent-600 dark:text-accent-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{isAr ? 'دليل جهات الاتصال' : 'Contacts Book'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-accent-500/10 text-accent-600 dark:text-accent-400 font-mono">
            {contacts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('audit')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
            activeSubTab === 'audit'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{isAr ? 'سجل تدقيق الأمان' : 'Security Audit'}</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* SUB-TAB 1: PERMISSIONS LIST                              */}
      {/* ======================================================== */}
      {activeSubTab === 'permissions' && (
        <div className="space-y-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', labelAr: 'كافة الصلاحيات', labelEn: 'All' },
              { id: 'phone', labelAr: 'الهاتف والاتصال', labelEn: 'Phone & Calls' },
              { id: 'media', labelAr: 'الكاميرا والوسائط', labelEn: 'Camera & Media' },
              { id: 'system', labelAr: 'النظام والـ GPS', labelEn: 'System & GPS' },
              { id: 'hardware', labelAr: 'العتاد والتخزين', labelEn: 'Hardware & Storage' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setPermissionCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  permissionCategory === cat.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isAr ? cat.labelAr : cat.labelEn}
              </button>
            ))}
          </div>

          {/* Permissions Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredPermissions.map((perm) => {
              const isGranted = perm.status === 'granted';
              const isTesting = testingPermissionId === perm.id;

              return (
                <div
                  key={perm.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    isGranted
                      ? isDark
                        ? 'bg-slate-900/80 border-emerald-500/30 hover:border-emerald-500/50'
                        : 'bg-white border-emerald-200 shadow-xs hover:border-emerald-300'
                      : isDark
                      ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                          isGranted
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {renderIcon(perm.icon, 'w-5 h-5')}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                            {isAr ? perm.nameAr : perm.nameEn}
                          </h4>
                          {isGranted ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" />
                              <span>{isAr ? 'ممنوح' : 'Granted'}</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              {isAr ? 'مطلوب' : 'Required'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {isAr ? perm.descriptionAr : perm.descriptionEn}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Purpose Banner */}
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-[10px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-accent-500 shrink-0" />
                    <span className="truncate">
                      <strong className="text-slate-800 dark:text-slate-200">{isAr ? 'الاستخدام: ' : 'Used in: '}</strong>
                      {isAr ? perm.requiredForAr : perm.requiredForEn}
                    </span>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 gap-2">
                    <button
                      type="button"
                      onClick={() => handleTogglePermission(perm)}
                      disabled={isTesting}
                      className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        isGranted
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
                      }`}
                    >
                      {isTesting ? (
                        <span>{isAr ? 'جاري الفحص...' : 'Checking...'}</span>
                      ) : isGranted ? (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{isAr ? 'إلغاء التفعيل' : 'Revoke'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isAr ? 'إعطاء وتفعيل الصلاحية' : 'Grant Permission'}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTogglePermission(perm)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 text-[10px] font-bold flex items-center gap-1"
                      title={isAr ? 'اختبار الصلاحية الآن' : 'Test Live'}
                    >
                      <Play className="w-3 h-3 text-accent-500" />
                      <span>{isAr ? 'اختبار' : 'Test'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 2: CALL LOGS MANAGER                             */}
      {/* ======================================================== */}
      {activeSubTab === 'call_logs' && (
        <div className="space-y-3.5">
          {/* Quick Dialer & Stats Bar */}
          <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} space-y-3`}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <Phone className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={quickDialNumber}
                    onChange={(e) => setQuickDialNumber(e.target.value)}
                    placeholder={isAr ? 'أدخل رقم الهاتف للاتصال الفوري (مثال: +20100...)' : 'Enter phone number to call...'}
                    className={`w-full ps-9 pe-3 py-2 rounded-xl text-xs border focus:outline-none focus:border-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (quickDialNumber.trim()) {
                      handleInitiateCall(quickDialNumber);
                      setQuickDialNumber('');
                    } else {
                      toast(isAr ? 'يرجى إدخال رقم هاتف صالح' : 'Enter a valid number');
                    }
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>{isAr ? 'اتصال فوري' : 'Dial Now'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCallModal(true)}
                  className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 rounded-xl font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تسجيل مكالمة' : 'Log Call'}</span>
                </button>
                {callLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllCalls}
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl font-bold"
                    title={isAr ? 'مسح سجل المكالمات' : 'Clear Call Logs'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
              {[
                { id: 'all', labelAr: 'الكل', labelEn: 'All' },
                { id: 'incoming', labelAr: 'الواردة', labelEn: 'Incoming' },
                { id: 'outgoing', labelAr: 'الصادرة', labelEn: 'Outgoing' },
                { id: 'missed', labelAr: 'الفائتة', labelEn: 'Missed' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCallFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                    callFilter === f.id
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {isAr ? f.labelAr : f.labelEn}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={callSearch}
                onChange={(e) => setCallSearch(e.target.value)}
                placeholder={isAr ? 'بحث في السجل...' : 'Search logs...'}
                className={`w-full ps-8 pe-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:border-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
              />
            </div>
          </div>

          {/* Call Logs List */}
          <div className="space-y-2">
            {filteredCalls.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                <PhoneMissed className="w-8 h-8 mx-auto opacity-30 text-emerald-500" />
                <p className="font-bold">{isAr ? 'لا توجد مكالمات مسجلة في هذا الفلتر' : 'No call records found'}</p>
              </div>
            ) : (
              filteredCalls.map((call) => {
                const isIncoming = call.type === 'incoming';
                const isOutgoing = call.type === 'outgoing';
                const isMissed = call.type === 'missed';

                return (
                  <div
                    key={call.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                          isMissed
                            ? 'bg-rose-500/15 text-rose-500'
                            : isIncoming
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-blue-500/15 text-blue-500'
                        }`}
                      >
                        {isMissed ? (
                          <PhoneMissed className="w-5 h-5" />
                        ) : isIncoming ? (
                          <PhoneIncoming className="w-5 h-5" />
                        ) : (
                          <PhoneOutgoing className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-xs text-slate-900 dark:text-white truncate">
                            {call.contactName}
                          </h4>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                              isMissed
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                : isIncoming
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {isMissed ? (isAr ? 'فائتة' : 'Missed') : isIncoming ? (isAr ? 'واردة' : 'Incoming') : (isAr ? 'صادرة' : 'Outgoing')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                          <span>{call.phoneNumber}</span>
                          <span>•</span>
                          <span>{formatDuration(call.durationSeconds)}</span>
                          <span>•</span>
                          <span>{formatTimestamp(call.timestamp)}</span>
                        </div>

                        {call.note && (
                          <p className="text-[10px] text-slate-600 dark:text-slate-300 italic mt-0.5 truncate">
                            💬 {call.note}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleInitiateCall(call.phoneNumber, call.contactName)}
                        className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition-transform active:scale-95"
                        title={isAr ? 'إعادة الاتصال' : 'Call back'}
                      >
                        <PhoneCall className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCall(call.id)}
                        className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                        title={isAr ? 'حذف من السجل' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 3: CONTACTS BOOK MANAGER                         */}
      {/* ======================================================== */}
      {activeSubTab === 'contacts' && (
        <div className="space-y-3.5">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddContactModal(true)}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isAr ? 'إضافة جهة اتصال' : 'Add Contact'}</span>
              </button>

              <button
                type="button"
                onClick={handleImportNativeContacts}
                className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 rounded-xl font-bold flex items-center gap-1.5"
                title={isAr ? 'استيراد من دليل الهاتف الحقيقي' : 'Import from phone'}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isAr ? 'استيراد من الهاتف' : 'Import Phone'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportVCF}
                className="p-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl font-bold"
                title={isAr ? 'تصدير جهات الاتصال كملف VCF' : 'Export VCF'}
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder={isAr ? 'بحث بالاسم أو الرقم...' : 'Search contacts...'}
                className={`w-full ps-8 pe-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:border-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
              />
            </div>
          </div>

          {/* Contacts List Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredContacts.length === 0 ? (
              <div className="col-span-2 p-8 text-center text-slate-400 space-y-2 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                <Users className="w-8 h-8 mx-auto opacity-30 text-accent-500" />
                <p className="font-bold">{isAr ? 'لا توجد جهات اتصال مطابقة' : 'No contacts found'}</p>
              </div>
            ) : (
              filteredContacts.map((cnt) => (
                <div
                  key={cnt.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                    isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {cnt.avatarUrl ? (
                      <img src={cnt.avatarUrl} alt={cnt.name} className="w-10 h-10 rounded-2xl object-cover border border-slate-700 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                        {cnt.name.slice(0, 1)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-xs text-slate-900 dark:text-white truncate">
                          {cnt.name}
                        </h4>
                        {cnt.category === 'emergency' && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-rose-500 text-white">
                            {isAr ? 'طوارئ' : 'Emergency'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold truncate">
                        {cnt.phoneNumber}
                      </p>
                      {cnt.email && (
                        <p className="text-[9px] text-slate-400 truncate font-mono">
                          {cnt.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleInitiateCall(cnt.phoneNumber, cnt.name)}
                      className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition-transform active:scale-95"
                      title={isAr ? 'اتصال' : 'Call'}
                    >
                      <PhoneCall className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(cnt.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                      title={isAr ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 4: PERMISSION AUDIT LOG                          */}
      {/* ======================================================== */}
      {activeSubTab === 'audit' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              <h4 className="font-black text-xs text-slate-900 dark:text-white">
                {isAr ? 'سجل عمليات وأذونات الخصوصية والأمان' : 'Permission Security & Audit Trail'}
              </h4>
            </div>
            {auditLogs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  PermissionService.clearAuditLogs();
                  setAuditLogs([]);
                  toast(isAr ? 'تم مسح سجل التدقيق' : 'Audit logs cleared');
                }}
                className="text-[10px] text-rose-500 hover:underline font-bold"
              >
                {isAr ? 'مسح السجل' : 'Clear logs'}
              </button>
            )}
          </div>

          <div className={`rounded-2xl border divide-y ${isDark ? 'bg-slate-900 border-slate-800 divide-slate-800' : 'bg-white border-slate-200 divide-slate-100'}`}>
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Clock className="w-8 h-8 mx-auto opacity-30 text-indigo-500 mb-2" />
                <p>{isAr ? 'سجل التدقيق فارغ حالياً' : 'No audit records yet'}</p>
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3 flex items-center justify-between gap-3 text-[11px]">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${log.action === 'granted' ? 'bg-emerald-500' : log.action === 'denied' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {log.details || log.permissionId}
                      </span>
                      <span className="text-[10px] text-slate-400 ms-2 font-mono">
                        ({log.action})
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD CALL LOG                                      */}
      {/* ======================================================== */}
      {showAddCallModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl border p-5 shadow-2xl space-y-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-emerald-500" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  {isAr ? 'تسجيل مكالمة جديدة في السجل' : 'Log New Call Record'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCallModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewCall} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'اسم جهة الاتصال أو المتصل' : 'Contact Name'}
                </label>
                <input
                  type="text"
                  value={newCallData.contactName}
                  onChange={(e) => setNewCallData({ ...newCallData, contactName: e.target.value })}
                  placeholder={isAr ? 'مثال: أحمد محمود' : 'e.g. John Doe'}
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'رقم الهاتف *' : 'Phone Number *'}
                </label>
                <input
                  type="tel"
                  required
                  value={newCallData.phoneNumber}
                  onChange={(e) => setNewCallData({ ...newCallData, phoneNumber: e.target.value })}
                  placeholder={isAr ? '+20 100 000 0000' : '+1 555 000 0000'}
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'نوع المكالمة' : 'Call Type'}
                  </label>
                  <select
                    value={newCallData.type}
                    onChange={(e) => setNewCallData({ ...newCallData, type: e.target.value as any })}
                    className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <option value="outgoing">{isAr ? 'مكالمة صادرة' : 'Outgoing'}</option>
                    <option value="incoming">{isAr ? 'مكالمة واردة' : 'Incoming'}</option>
                    <option value="missed">{isAr ? 'مكالمة فائتة' : 'Missed'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'مدة المكالمة (ثواني)' : 'Duration (sec)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={newCallData.type === 'missed'}
                    value={newCallData.type === 'missed' ? 0 : newCallData.durationSeconds}
                    onChange={(e) => setNewCallData({ ...newCallData, durationSeconds: Number(e.target.value) })}
                    className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'ملاحظة حول المكالمة (اختياري)' : 'Call Note'}
                </label>
                <input
                  type="text"
                  value={newCallData.note}
                  onChange={(e) => setNewCallData({ ...newCallData, note: e.target.value })}
                  placeholder={isAr ? 'مثال: مناقشة تفاصيل الحساب' : 'e.g. Account discussion'}
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl shadow-md transition-transform active:scale-95"
                >
                  {isAr ? 'حفظ في السجل' : 'Save Record'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCallModal(false)}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD CONTACT                                       */}
      {/* ======================================================== */}
      {showAddContactModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl border p-5 shadow-2xl space-y-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-500" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  {isAr ? 'إضافة جهة اتصال جديدة' : 'Add New Contact'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddContactModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewContact} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'الاسم الكامل *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={newContactData.name}
                  onChange={(e) => setNewContactData({ ...newContactData, name: e.target.value })}
                  placeholder={isAr ? 'مثال: محمد علي' : 'e.g. Mohamed Ali'}
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-indigo-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'رقم الهاتف *' : 'Phone Number *'}
                </label>
                <input
                  type="tel"
                  required
                  value={newContactData.phoneNumber}
                  onChange={(e) => setNewContactData({ ...newContactData, phoneNumber: e.target.value })}
                  placeholder={isAr ? '+20 100 000 0000' : '+1 555 000 0000'}
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-indigo-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'البريد الإلكتروني (اختياري)' : 'Email (Optional)'}
                </label>
                <input
                  type="email"
                  value={newContactData.email}
                  onChange={(e) => setNewContactData({ ...newContactData, email: e.target.value })}
                  placeholder="name@example.com"
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-indigo-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'التصنيف' : 'Category'}
                </label>
                <select
                  value={newContactData.category}
                  onChange={(e) => setNewContactData({ ...newContactData, category: e.target.value as any })}
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-indigo-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                >
                  <option value="family">{isAr ? 'عائلة' : 'Family'}</option>
                  <option value="work">{isAr ? 'عمل' : 'Work'}</option>
                  <option value="friends">{isAr ? 'أصدقاء' : 'Friends'}</option>
                  <option value="emergency">{isAr ? 'طوارئ' : 'Emergency'}</option>
                  <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition-transform active:scale-95"
                >
                  {isAr ? 'حفظ جهة الاتصال' : 'Save Contact'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
