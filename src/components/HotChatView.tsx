import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Image,
  FileImage,
  Paperclip,
  Mic,
  Smile,
  MoreVertical,
  CheckCheck,
  Check,
  Search,
  Phone,
  Video,
  Sparkles,
  Plus,
  Users,
  UserPlus,
  X,
  Hash,
  Lock,
  Globe,
  Pin,
  VolumeX,
  Archive,
  Trash2,
  Reply,
  Share2,
  Heart,
  ThumbsUp,
  Flame,
  Info,
  Settings,
  ShieldAlert,
  Clock,
  ChevronRight,
  CircleDot,
  FileText,
  MapPin,
  Camera,
  StopCircle,
  Play,
  UserCheck,
  Contact,
  ArrowRight,
  ArrowLeft,
  Navigation2,
  ShieldCheck,
  Shield,
  UserMinus,
  Crown,
  Ban,
  Link,
  Palette,
  Bell,
  BellOff,
  MessageCircleOff,
  CheckCircle2,
  SlidersHorizontal,
  BarChart3,
  Vote,
  Bookmark,
  BookmarkCheck,
  Edit3,
  Copy,
  CornerDownRight,
  Radio,
} from 'lucide-react';
import {
  ChatRoom,
  ChatMessage,
  ChatMember,
  ChatRoomPermissions,
  ChatRoomSettings,
  Language,
  ThemeMode,
  IconStyle,
} from '../types';
import { translations } from '../services/i18n';
import { ChatCameraModal } from './ChatCameraModal';
import { ChatMembersSidebar } from './ChatMembersSidebar';
import { ChatSettingsModal } from './ChatSettingsModal';
import { SavedMessagesModal } from './SavedMessagesModal';
import { AddMemberModal } from './AddMemberModal';
import { chatService } from '../services/chatService';
import { getStoredSession } from '../services/authService';

interface HotChatViewProps {
  language: Language;
  theme?: ThemeMode;
  iconStyle?: IconStyle;
  onNavigateHome?: () => void;
}

interface StoryItem {
  id: string;
  name: string;
  avatar: string;
  hasNew: boolean;
  time: string;
}

export const HotChatView: React.FC<HotChatViewProps> = ({
  language,
  theme = 'light',
  iconStyle = 'classic',
  onNavigateHome,
}) => {
  const isAr = language === 'ar';
  const t = translations[language];
  const isDark = theme === 'dark';
  const chatSurface = isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-white text-slate-800';
  const chatPanel = isDark ? 'bg-[#111b21]' : 'bg-[#f0f2f5]';
  const chatStream = isDark ? 'bg-[#0b141a]' : 'bg-[#efeae2]/50';
  const chatBorder = isDark ? 'border-slate-850' : 'border-slate-200';
  const chatMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const chatIconButton = isDark
    ? 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white'
    : 'bg-slate-200/60 hover:bg-slate-200 text-slate-600 hover:text-slate-900';
  const chatInput = isDark
    ? 'bg-[#202c33] border-slate-700/80 text-white placeholder-slate-400'
    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400';

  // Current logged in user
  const currentSession = getStoredSession();
  const currentUserId = currentSession?.user?.id || 'me';
  const currentUserName = currentSession?.user?.name || (isAr ? 'أنا' : 'Me');
  const currentUserAvatar =
    (currentSession?.user as any)?.avatar ||
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';

  // Tabs: 'all' | 'private' | 'rooms'
  const [activeTab, setActiveTab] = useState<'all' | 'private' | 'rooms'>('all');

  // Rooms State
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState<string>('room_family');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);

  // Stories List
  const [stories, setStories] = useState<StoryItem[]>([
    {
      id: 's1',
      name: isAr ? 'حالتي' : 'My Status',
      avatar: currentUserAvatar,
      hasNew: false,
      time: isAr ? 'إضافة حالة' : 'Add Status',
    },
    {
      id: 's2',
      name: isAr ? 'محمد علي' : 'Mohamed Ali',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      hasNew: true,
      time: 'منذ 25 دقيقة',
    },
    {
      id: 's3',
      name: isAr ? 'ساره أحمد' : 'Sara Ahmed',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
      hasNew: true,
      time: 'منذ ساعتين',
    },
    {
      id: 's4',
      name: isAr ? 'مهندس خالد' : 'Eng. Khaled',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
      hasNew: false,
      time: 'منذ 4 ساعات',
    },
  ]);

  // Messages State per room
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // roomId -> userName typing

  // Typing debounce timer
  const typingTimerRef = useRef<any>(null);

  // Messages Stream container ref
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // Input & Reply state
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Audio Recording
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  // Calls
  const [activeCall, setActiveCall] = useState<'voice' | 'video' | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Modals & Panels
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoomInfoModal, setShowRoomInfoModal] = useState(false);
  const [showMembersSidebar, setShowMembersSidebar] = useState(true);
  const [chatBackground, setChatBackground] = useState<string>('');

  // Create room state
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [newRoomType, setNewRoomType] = useState<'group' | 'direct' | 'public'>('group');
  const [newRoomAvatar, setNewRoomAvatar] = useState(
    'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=120&auto=format&fit=crop&q=80'
  );
  const newRoomAvatarInputRef = useRef<HTMLInputElement | null>(null);

  // Room details & settings modal state
  const [roomMembers, setRoomMembers] = useState<ChatMember[]>([]);
  const [roomDescription, setRoomDescription] = useState('');
  const [disappearingMessages, setDisappearingMessages] = useState<ChatRoomSettings['disappearing']>('off');
  const [isMuted, setIsMuted] = useState(false);
  const [roomPermissions, setRoomPermissions] = useState<ChatRoomPermissions>({
    sendMessages: true,
    sendMedia: true,
    addMembers: true,
    pinMessages: true,
    editRoom: true,
    deleteMessages: true,
    startCalls: true,
    mentionEveryone: true,
  });
  const [adminPermissions, setAdminPermissions] = useState<ChatRoomPermissions>({
    sendMessages: true,
    sendMedia: true,
    addMembers: true,
    pinMessages: true,
    editRoom: true,
    deleteMessages: true,
    startCalls: true,
    mentionEveryone: true,
  });
  const [moderatorPermissions, setModeratorPermissions] = useState<ChatRoomPermissions>({
    sendMessages: true,
    sendMedia: true,
    addMembers: false,
    pinMessages: true,
    editRoom: false,
    deleteMessages: true,
    startCalls: true,
    mentionEveryone: true,
  });
  const [roomPrefs, setRoomPrefs] = useState<ChatRoomSettings>({
    disappearing: 'off',
    muted: false,
    readReceipts: true,
    typingIndicator: true,
    linkPreviews: true,
    mediaAutoSave: false,
    enterToSend: true,
    slowModeSeconds: 0,
    approvalRequired: false,
  });

  // Attachment inputs
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [liveLocationWatchId, setLiveLocationWatchId] = useState<number | null>(null);
  const [liveLocationMsgId, setLiveLocationMsgId] = useState<string | null>(null);

  // Window state
  const [isFloating, setIsFloating] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);

  const presetAvatars = [
    { url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=120&auto=format&fit=crop&q=80', label: 'عائلة 🏡' },
    { url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=120&auto=format&fit=crop&q=80', label: 'عمل 💼' },
    { url: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=120&auto=format&fit=crop&q=80', label: 'أصدقاء ☕' },
    { url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=120&auto=format&fit=crop&q=80', label: 'تقنية 🤖' },
  ];

  // Load Rooms from Backend on Mount
  const loadRooms = async () => {
    setLoadingRooms(true);
    try {
      const list = await chatService.getRooms();
      if (list && list.length > 0) {
        setRooms(list);
        if (!list.some((r) => r.id === activeRoomId)) {
          setActiveRoomId(list[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch rooms from backend:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    loadRooms();
    chatService.authenticateSocket();
  }, []);

  // Load Messages for Active Room
  const loadMessagesForRoom = async (roomId: string) => {
    if (!roomId) return;
    setLoadingMessages(true);
    try {
      chatService.joinRoom(roomId);
      const msgs = await chatService.getMessages(roomId);
      setMessagesMap((prev) => ({ ...prev, [roomId]: msgs }));

      // Mark room as read
      await chatService.markRoomAsRead(roomId);
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r))
      );
    } catch (err) {
      console.warn(`Failed to fetch messages for room ${roomId}:`, err);
    } finally {
      setLoadingMessages(false);
      scrollToBottom();
    }
  };

  useEffect(() => {
    if (activeRoomId) {
      loadMessagesForRoom(activeRoomId);
      // Load room details
      chatService
        .getRoomDetails(activeRoomId)
        .then((detail) => {
          if (detail) {
            setRoomMembers(detail.members || []);
            if (detail.settings) setRoomPrefs(detail.settings);
            if (detail.permissions) setRoomPermissions(detail.permissions);
            if (detail.adminPermissions) setAdminPermissions(detail.adminPermissions);
            if (detail.moderatorPermissions) setModeratorPermissions(detail.moderatorPermissions);
            setRoomDescription(detail.description || '');
            setChatBackground(detail.background || '');
          }
        })
        .catch(() => {});
    }
  }, [activeRoomId]);

  // Real-Time WebSocket Listeners
  useEffect(() => {
    const unsubWs = chatService.on('connection_status', ({ isConnected }) => {
      setIsWsConnected(isConnected);
    });

    // New real-time message received
    const unsubMsg = chatService.on('new_message', ({ message, roomId }) => {
      if (!message || !roomId) return;

      setMessagesMap((prev) => {
        const currentList = prev[roomId] || [];
        if (currentList.some((m) => m.id === message.id)) return prev;
        return {
          ...prev,
          [roomId]: [...currentList, message],
        };
      });

      // Update room in sidebar
      setRooms((prev) =>
        prev.map((r) => {
          if (r.id === roomId) {
            const isCurrentActive = activeRoomId === roomId;
            return {
              ...r,
              lastMessage: message.text || message.body || 'رسالة جديدة',
              lastMessageTime: new Date(message.timestamp || message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              unreadCount: isCurrentActive ? 0 : (r.unreadCount || 0) + 1,
            };
          }
          return r;
        })
      );

      if (roomId === activeRoomId) {
        scrollToBottom();
        chatService.markRoomAsRead(roomId);
      }
    });

    // Message updated / edited
    const unsubUpdate = chatService.on('message_updated', ({ roomId, messageId, body, text }) => {
      setMessagesMap((prev) => {
        const list = prev[roomId] || [];
        return {
          ...prev,
          [roomId]: list.map((m) =>
            m.id === messageId ? { ...m, text: text || body, body: text || body, isEdited: true } : m
          ),
        };
      });
    });

    // Message deleted
    const unsubDelete = chatService.on('message_deleted', ({ roomId, messageId }) => {
      setMessagesMap((prev) => {
        const list = prev[roomId] || [];
        return {
          ...prev,
          [roomId]: list.map((m) =>
            m.id === messageId
              ? { ...m, isDeleted: true, text: isAr ? 'تم حذف هذه الرسالة' : 'This message was deleted' }
              : m
          ),
        };
      });
    });

    // Message pinned / unpinned
    const unsubPin = chatService.on('message_pinned', ({ roomId, messageId, pinnedBy, pinnedAt }) => {
      setMessagesMap((prev) => {
        const list = prev[roomId] || [];
        return {
          ...prev,
          [roomId]: list.map((m) =>
            m.id === messageId ? { ...m, isPinned: true, pinnedBy, pinnedAt } : m
          ),
        };
      });
    });

    const unsubUnpin = chatService.on('message_unpinned', ({ roomId, messageId }) => {
      setMessagesMap((prev) => {
        const list = prev[roomId] || [];
        return {
          ...prev,
          [roomId]: list.map((m) =>
            m.id === messageId ? { ...m, isPinned: false, pinnedBy: undefined, pinnedAt: undefined } : m
          ),
        };
      });
    });

    // Messages read
    const unsubRead = chatService.on('messages_read', ({ roomId, userId }) => {
      setMessagesMap((prev) => {
        const list = prev[roomId] || [];
        return {
          ...prev,
          [roomId]: list.map((m) => (m.isOutgoing ? { ...m, status: 'read' } : m)),
        };
      });
    });

    // User typing
    const unsubTyping = chatService.on('user_typing', ({ roomId, userName, isTyping }) => {
      setTypingUsers((prev) => {
        if (!isTyping) {
          const next = { ...prev };
          delete next[roomId];
          return next;
        }
        return { ...prev, [roomId]: userName };
      });
    });

    // Room created / updated / deleted
    const unsubRoomUpdate = chatService.on('room_updated', ({ roomId, title, description, avatar, background, backgroundUrl }) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? { ...r, title: title || r.title, description: description ?? r.description, avatar: avatar || r.avatar, background, backgroundUrl }
            : r
        )
      );
    });

    const unsubRoomCreated = chatService.on('room_created', () => {
      loadRooms();
    });

    const unsubRoomDeleted = chatService.on('room_deleted', ({ roomId }) => {
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      if (activeRoomId === roomId) {
        setActiveRoomId(rooms[0]?.id || '');
      }
    });

    // Presence update
    const unsubPresence = chatService.on('presence_update', ({ userId, isOnline }) => {
      setRooms((prev) =>
        prev.map((r) => {
          if (r.type === 'direct') {
            return { ...r, isOnline: isOnline };
          }
          return r;
        })
      );
      setRoomMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, isOnline } : m))
      );
    });

    return () => {
      unsubWs();
      unsubMsg();
      unsubUpdate();
      unsubDelete();
      unsubPin();
      unsubUnpin();
      unsubRead();
      unsubTyping();
      unsubRoomUpdate();
      unsubRoomCreated();
      unsubRoomDeleted();
      unsubPresence();
    };
  }, [activeRoomId, isAr]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const jumpToMessage = (roomId: string, messageId: string) => {
    if (activeRoomId !== roomId) {
      setActiveRoomId(roomId);
    }
    setTimeout(() => {
      const el = document.getElementById(`chat-msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(messageId);
        setTimeout(() => setHighlightedMessageId(null), 3000);
      }
    }, 400);
  };

  // Active room object
  const activeRoom: ChatRoom =
    rooms.find((r) => r.id === activeRoomId) ||
    rooms[0] || {
      id: 'room_family',
      title: isAr ? 'مجموعة العائلة 🏡' : 'Family Group 🏡',
      name: isAr ? 'مجموعة العائلة 🏡' : 'Family Group 🏡',
      type: 'group',
      avatar: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=120&auto=format&fit=crop&q=80',
      unreadCount: 0,
    };

  const isRoomOwner =
    activeRoom.creatorId === currentUserId ||
    activeRoom.currentUserRole === 'owner' ||
    (roomMembers.find((m) => m.id === currentUserId)?.role === 'owner');

  const currentMessages = messagesMap[activeRoomId] || [];

  // Pinned message in active room
  const pinnedMessage = currentMessages.find((m) => m.isPinned);

  // Handle Input Typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);

    chatService.sendTyping(activeRoomId, true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      chatService.sendTyping(activeRoomId, false);
    }, 2000);
  };

  // Send Message
  const handleSendMessage = async (
    e?: React.FormEvent,
    customText?: string,
    customType?: 'text' | 'voice' | 'image' | 'video' | 'file' | 'location' | 'poll',
    customLocation?: { lat: number; lng: number; isLive?: boolean },
    customMediaUrl?: string,
    customExtra?: any
  ) => {
    e?.preventDefault();

    // If editing existing message
    if (editingMessage) {
      const textToUpdate = customText !== undefined ? customText : inputText;
      if (!textToUpdate.trim()) return;
      try {
        await chatService.editMessage(activeRoomId, editingMessage.id, textToUpdate);
        setEditingMessage(null);
        setInputText('');
      } catch (err: any) {
        alert(err.message || 'فشل تعديل الرسالة');
      }
      return;
    }

    const textToSend = customText !== undefined ? customText : inputText;
    if (!textToSend.trim() && customType !== 'voice' && !customMediaUrl) return;

    const type = customType || 'text';
    const extra = {
      ...(customLocation ? { location: customLocation } : {}),
      ...(customExtra || {}),
      ...(replyingTo
        ? {
            replyTo: {
              id: replyingTo.id,
              senderName: replyingTo.senderName,
              text: (replyingTo.text || replyingTo.body || '').slice(0, 60),
            },
          }
        : {}),
    };

    if (!customText) setInputText('');
    setReplyingTo(null);
    chatService.sendTyping(activeRoomId, false);

    try {
      const sentMsg = await chatService.sendMessage(activeRoomId, {
        text: textToSend,
        body: textToSend,
        type,
        mediaUrl: customMediaUrl,
        extra,
      });

      // Optimistic addition
      setMessagesMap((prev) => {
        const currentList = prev[activeRoomId] || [];
        if (currentList.some((m) => m.id === sentMsg.id)) return prev;
        return {
          ...prev,
          [activeRoomId]: [...currentList, sentMsg],
        };
      });

      scrollToBottom();
    } catch (err: any) {
      alert(err.message || 'فشل إرسال الرسالة');
    }
  };

  // Voice recording
  const startVoiceRecording = () => {
    setIsRecordingAudio(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  };

  const stopVoiceRecording = (send: boolean) => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecordingAudio(false);
    if (send) {
      handleSendMessage(
        undefined,
        isAr ? `🎤 رسالة صوتية (${recordingSeconds} ثانية)` : `🎤 Voice note (${recordingSeconds}s)`,
        'voice'
      );
    }
    setRecordingSeconds(0);
  };

  // File Upload Helper
  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileAttachment = async (file: File, kind: 'image' | 'video' | 'file') => {
    setShowAttachMenu(false);
    if (file.size > 10 * 1024 * 1024) {
      alert(isAr ? 'الحد الأقصى للملف 10 ميجابايت.' : 'Maximum file size is 10 MB.');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const label =
        kind === 'image' ? `🖼️ ${file.name}` : kind === 'video' ? `🎬 ${file.name}` : `📄 ${file.name}`;
      handleSendMessage(undefined, label, kind, undefined, dataUrl);
    } catch {
      alert(isAr ? 'تعذر قراءة الملف.' : 'Unable to read the file.');
    }
  };

  const handleLiveCameraCapture = async (file: File, caption?: string) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      handleSendMessage(
        undefined,
        caption || (isAr ? '📷 صورة بالكاميرا' : '📷 Camera photo'),
        'image',
        undefined,
        dataUrl
      );
    } catch (err) {
      console.error('Error handling camera capture:', err);
    }
  };

  // Share Location
  const handleShareLocation = () => {
    setShowAttachMenu(false);
    if (!navigator.geolocation) {
      alert(isAr ? '⚠️ المتصفح لا يدعم تحديد الموقع' : '⚠️ Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleSendMessage(
          undefined,
          isAr ? '📍 تمت مشاركة الموقع الحالي' : '📍 Current location shared',
          'location',
          { lat: pos.coords.latitude, lng: pos.coords.longitude, isLive: false }
        );
      },
      () =>
        alert(
          isAr
            ? '⚠️ تعذر الوصول إلى الموقع، يرجى التأكد من تفعيل صلاحية الموقع'
            : '⚠️ Unable to access location, please check permissions'
        ),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Live Location
  const handleStartLiveLocation = () => {
    setShowAttachMenu(false);
    if (!navigator.geolocation) {
      alert(isAr ? '⚠️ المتصفح لا يدعم تحديد الموقع' : '⚠️ Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleSendMessage(
          undefined,
          isAr ? '📡 بدأت مشاركة الموقع المباشر' : '📡 Live location sharing started',
          'location',
          { lat: pos.coords.latitude, lng: pos.coords.longitude, isLive: true }
        );
        const watchId = navigator.geolocation.watchPosition(
          () => {},
          () => {},
          { enableHighAccuracy: true }
        );
        setLiveLocationWatchId(watchId);
      },
      () => alert(isAr ? '⚠️ تعذر الوصول للموقع' : '⚠️ Location error'),
      { enableHighAccuracy: true }
    );
  };

  const handleStopLiveLocation = () => {
    if (liveLocationWatchId !== null) {
      navigator.geolocation.clearWatch(liveLocationWatchId);
      setLiveLocationWatchId(null);
    }
  };

  // Poll Creator
  const createPoll = () => {
    const question = pollQuestion.trim();
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!question || options.length < 2) {
      alert(isAr ? 'اكتب السؤال وأضف خيارين على الأقل.' : 'Enter question and 2+ options.');
      return;
    }
    const poll = { question, options, votes: {} as Record<number, string[]>, multiple: pollMultiple };
    handleSendMessage(undefined, `📊 ${question}`, 'poll', undefined, undefined, { poll });
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollMultiple(false);
    setShowPollModal(false);
    setShowAttachMenu(false);
  };

  // Pin / Unpin
  const handleTogglePin = async (msg: ChatMessage) => {
    try {
      const res = await chatService.pinMessage(activeRoomId, msg.id, !msg.isPinned);
      setMessagesMap((prev) => ({
        ...prev,
        [activeRoomId]: (prev[activeRoomId] || []).map((m) =>
          m.id === msg.id ? { ...m, isPinned: res.isPinned } : m
        ),
      }));
    } catch (err: any) {
      alert(err.message || 'فشل تثبيت الرسالة');
    }
  };

  // Save / Bookmark Message
  const handleToggleSaveMessage = async (msg: ChatMessage) => {
    try {
      if (msg.isSaved) {
        await chatService.unsaveMessage(msg.id);
      } else {
        await chatService.saveMessage(msg.id);
      }
      setMessagesMap((prev) => ({
        ...prev,
        [activeRoomId]: (prev[activeRoomId] || []).map((m) =>
          m.id === msg.id ? { ...m, isSaved: !msg.isSaved } : m
        ),
      }));
    } catch (err: any) {
      alert(err.message || 'فشل حفظ الرسالة');
    }
  };

  // Delete Message
  const handleDeleteMessage = async (msg: ChatMessage) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذه الرسالة؟' : 'Delete this message?')) return;
    try {
      await chatService.deleteMessage(activeRoomId, msg.id);
      setMessagesMap((prev) => ({
        ...prev,
        [activeRoomId]: (prev[activeRoomId] || []).map((m) =>
          m.id === msg.id ? { ...m, isDeleted: true, text: isAr ? 'تم حذف هذه الرسالة' : 'Deleted' } : m
        ),
      }));
    } catch (err: any) {
      alert(err.message || 'فشل حذف الرسالة');
    }
  };

  // Create Room Handler
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomTitle.trim()) return;

    try {
      const res = await chatService.createRoom({
        title: newRoomTitle,
        description: newRoomDescription,
        type: newRoomType,
        avatar: newRoomAvatar,
      });

      setShowCreateModal(false);
      setNewRoomTitle('');
      setNewRoomDescription('');
      await loadRooms();
      setActiveRoomId(res.roomId);
    } catch (err: any) {
      alert(err.message || 'فشل إنشاء الغرفة');
    }
  };

  // Room settings handlers
  const handleSaveRoomSettings = async (patch: Partial<ChatRoom>) => {
    try {
      await chatService.updateRoom(activeRoomId, patch);
      setRooms((prev) => prev.map((r) => (r.id === activeRoomId ? { ...r, ...patch } : r)));
      if (patch.background !== undefined) setChatBackground(patch.background || '');
      setShowRoomInfoModal(false);
    } catch (err: any) {
      alert(err.message || 'فشل حفظ إعدادات الغرفة');
    }
  };

  const handleClearRoomHistory = async () => {
    if (!window.confirm(isAr ? 'مسح جميع الرسائل في هذه الغرفة؟' : 'Clear all messages in room?')) return;
    try {
      await chatService.clearRoomMessages(activeRoomId);
      setMessagesMap((prev) => ({ ...prev, [activeRoomId]: [] }));
    } catch (err: any) {
      alert(err.message || 'فشل مسح الرسائل');
    }
  };

  const handleLeaveRoom = async () => {
    if (!window.confirm(isAr ? 'مغادرة هذه الغرفة؟' : 'Leave this room?')) return;
    try {
      await chatService.leaveRoomApi(activeRoomId);
      setShowRoomInfoModal(false);
      await loadRooms();
    } catch (err: any) {
      alert(err.message || 'فشل مغادرة الغرفة');
    }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm(isAr ? 'حذف الغرفة نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.' : 'Permanently delete room?')) return;
    try {
      await chatService.deleteRoom(activeRoomId);
      setShowRoomInfoModal(false);
      await loadRooms();
    } catch (err: any) {
      alert(err.message || 'فشل حذف الغرفة');
    }
  };

  // Filter rooms by search & tab
  const filteredRooms = rooms.filter((r) => {
    const matchesSearch = (r.title || r.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'private') return r.type === 'direct';
    if (activeTab === 'rooms') return r.type === 'group' || r.type === 'public';
    return true;
  });

  // Filter messages in search mode
  const displayedMessages = messageSearchQuery.trim()
    ? currentMessages.filter((m) =>
        (m.text || m.body || '').toLowerCase().includes(messageSearchQuery.toLowerCase())
      )
    : currentMessages;

  return (
    <div
      className={
        isFloating
          ? `fixed bottom-16 end-4 z-50 w-[95%] sm:w-[440px] h-[620px] grid grid-cols-1 md:grid-cols-12 ${chatSurface} rounded-3xl border-2 border-sky-500/70 shadow-2xl overflow-hidden select-none animate-scaleUp`
          : mobileShowChat
          ? `fixed inset-0 z-50 w-screen h-[100dvh] flex flex-col ${chatSurface} overflow-hidden select-none md:static md:z-auto md:w-full md:h-[calc(100vh-100px)] md:min-h-[680px] md:rounded-3xl md:border md:border-sky-500/35 md:shadow-2xl`
          : `w-full h-[calc(100vh-130px)] min-h-[640px] grid grid-cols-1 md:grid-cols-12 ${chatSurface} rounded-3xl border border-sky-500/35 shadow-2xl overflow-hidden select-none`
      }
      id="professional-chat-suite"
      data-icon-style={iconStyle}
      data-theme-mode={theme}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* ========================================================================= */}
      {/* LEFT / SIDEBAR: Chat List & Tabs (4 cols) */}
      {/* ========================================================================= */}
      <div
        className={`md:col-span-4 border-e ${chatBorder} flex flex-col ${chatPanel} ${
          mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header & Stories */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold shadow-xs">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-wide">
                  {isAr ? 'المحادثات المباشرة' : 'Live Chat Suite'}
                </h2>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    {isWsConnected
                      ? isAr
                        ? 'متصل بالخادم • Realtime'
                        : 'Realtime Connected'
                      : isAr
                      ? 'جاري الاتصال...'
                      : 'Connecting...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions: Floating, Saved Messages & Create */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowSavedModal(true)}
                className={`p-2 rounded-xl ${chatIconButton} text-amber-500 transition-all`}
                title={isAr ? 'الرسائل المحفوظة' : 'Saved Messages'}
              >
                <Bookmark className="w-4 h-4 fill-amber-500/20" />
              </button>

              <button
                type="button"
                onClick={() => setIsFloating(!isFloating)}
                className={`p-2 rounded-xl ${chatIconButton} text-sky-500 transition-all`}
                title={
                  isFloating
                    ? isAr
                      ? 'تكبير لملء الشاشة'
                      : 'Full Screen'
                    : isAr
                    ? 'تصغير كشاشة عائمة'
                    : 'Floating Window'
                }
              >
                {isFloating ? (
                  <Plus className="w-4 h-4 rotate-45" />
                ) : (
                  <div className="w-3.5 h-3.5 border-2 border-sky-500 rounded-xs" />
                )}
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all"
                id="fab-create-room"
                title={isAr ? 'إنشاء محادثة أو غرفة جديدة' : 'New Chat / Room'}
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>{isAr ? 'جديد' : 'New'}</span>
              </button>
            </div>
          </div>

          {/* Stories / Status Bar */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
            {stories.map((story) => (
              <div key={story.id} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group">
                <div
                  className={`w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr ${
                    story.hasNew
                      ? 'from-sky-500 via-cyan-400 to-emerald-400'
                      : 'from-slate-400 to-slate-500 dark:from-slate-700 dark:to-slate-600'
                  } group-hover:scale-105 transition-transform`}
                >
                  <img
                    src={story.avatar}
                    alt={story.name}
                    className="w-full h-full rounded-full object-cover border-2 border-white dark:border-[#161616]"
                  />
                </div>
                <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium truncate max-w-[56px]">
                  {story.name}
                </span>
              </div>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث في المحادثات والغرف...' : 'Search chats & rooms...'}
              className="w-full ps-9 pe-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Back to Home Button */}
          {onNavigateHome && (
            <button
              type="button"
              onClick={() => onNavigateHome()}
              id="chat-back-to-home-btn"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white dark:bg-slate-900 border border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-800 hover:border-sky-500/60 text-xs font-bold transition-all active:scale-[0.98]"
              title={isAr ? 'الرجوع إلى الواجهة الرئيسية' : 'Back to Home'}
            >
              {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              <span>{isAr ? 'الرجوع إلى الواجهة الرئيسية' : 'Back to Home'}</span>
            </button>
          )}

          {/* Tabs: الكل | الخاص | الغرف */}
          <div className="grid grid-cols-3 gap-1 bg-slate-200/60 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {[
              { id: 'all', label: isAr ? 'الكل' : 'All' },
              { id: 'private', label: isAr ? 'الخاص' : 'Private' },
              { id: 'rooms', label: isAr ? 'الغرف' : 'Rooms' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-850'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat List */}
        <div className={`flex-1 overflow-y-auto divide-y ${chatBorder}/60`}>
          {loadingRooms ? (
            <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
              {isAr ? 'جاري تحميل المحادثات...' : 'Loading chats...'}
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isSelected = room.id === activeRoomId;
              return (
                <button
                  key={room.id}
                  onClick={() => {
                    setActiveRoomId(room.id);
                    setMobileShowChat(true);
                  }}
                  className={`w-full p-3.5 text-start flex items-center gap-3 transition-all ${
                    isSelected
                      ? 'bg-sky-500/10 border-s-4 border-sky-500'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-850/60'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={room.avatar}
                      alt={room.title || room.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                    />
                    {room.isOnline && (
                      <span className="absolute -bottom-0.5 -end-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-[#161616] rounded-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {room.title || room.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono-num">
                        {room.lastMessageTime}
                      </span>
                    </div>

                    <p className={`text-xs ${chatMuted} truncate`}>
                      {typingUsers[room.id]
                        ? isAr
                          ? `✍️ ${typingUsers[room.id]} يكتب الآن...`
                          : `✍️ ${typingUsers[room.id]} is typing...`
                        : room.lastMessage || (isAr ? 'لا توجد رسائل بعد' : 'No messages yet')}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {room.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-sky-500 text-white font-bold text-[10px] flex items-center justify-center shadow-xs animate-scaleUp">
                        {room.unreadCount}
                      </span>
                    )}
                    <CheckCheck className="w-3.5 h-3.5 text-sky-500" />
                  </div>
                </button>
              );
            })
          )}

          {!loadingRooms && filteredRooms.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-sky-500" />
              <p>{isAr ? 'لا توجد محادثات مطابقة' : 'No chats found'}</p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT / MAIN AREA: Active Chat View (8 cols) */}
      {/* ========================================================================= */}
      <div
        className={`w-full h-full flex-1 flex flex-col ${
          isDark ? 'bg-slate-950' : 'bg-[#f0f2f5]'
        } relative ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}
      >
        {/* Header */}
        <div
          className={`px-4 py-3 ${chatPanel} border-b ${chatBorder} flex items-center justify-between z-10 shadow-xs`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileShowChat(false)}
              className="md:hidden p-2 rounded-xl bg-slate-200/60 dark:bg-slate-800 text-sky-500 hover:bg-slate-200 dark:hover:bg-slate-700"
              title={isAr ? 'الرجوع للقائمة' : 'Back to list'}
            >
              <ChevronRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
            </button>
            <div className="relative shrink-0">
              <img
                src={activeRoom.avatar}
                alt={activeRoom.title || activeRoom.name}
                className="w-10 h-10 rounded-2xl object-cover border border-sky-500/30 shadow-xs"
              />
              {activeRoom.isOnline && (
                <span className="absolute -bottom-0.5 -end-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#1a1a1a] rounded-full" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                  {activeRoom.title || activeRoom.name}
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/30 flex items-center gap-1 shrink-0">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Realtime DB</span>
                </span>
              </div>
              <p className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {typingUsers[activeRoomId]
                    ? isAr
                      ? `${typingUsers[activeRoomId]} يكتب الآن... ✍️`
                      : `${typingUsers[activeRoomId]} is typing... ✍️`
                    : isAr
                    ? 'متصل الآن • حفظ لحظي'
                    : 'Online • Real-time DB sync'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Search inside room messages */}
            <button
              type="button"
              onClick={() => setShowMessageSearch((v) => !v)}
              className={`p-2 sm:p-2.5 rounded-xl ${chatIconButton} text-slate-600 dark:text-slate-300 transition-all hover:scale-105`}
              title={isAr ? 'بحث في الرسائل' : 'Search in messages'}
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Active Users Sidebar Toggle */}
            <button
              type="button"
              onClick={() => setShowMembersSidebar((prev) => !prev)}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl ${chatIconButton} ${
                showMembersSidebar
                  ? 'text-sky-600 dark:text-sky-400 bg-sky-500/15 ring-1 ring-sky-500/40'
                  : 'text-slate-700 dark:text-slate-300'
              } transition-all hover:scale-105 flex items-center gap-1.5`}
              title={isAr ? 'الأعضاء' : 'Members'}
            >
              <Users className="w-4 h-4 text-sky-500" />
              <span className="hidden sm:inline text-xs font-bold text-slate-800 dark:text-slate-200">
                {isAr ? 'الأعضاء' : 'Members'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {roomMembers.filter((m) => m.isOnline).length || 1}
              </span>
            </button>

            <button
              onClick={() => setActiveCall('voice')}
              className={`p-2 sm:p-2.5 rounded-xl ${chatIconButton} text-sky-500 transition-all hover:scale-105`}
              title={isAr ? 'مكالمة صوتية' : 'Voice Call'}
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveCall('video')}
              className={`p-2 sm:p-2.5 rounded-xl ${chatIconButton} text-sky-500 transition-all hover:scale-105`}
              title={isAr ? 'مكالمة فيديو' : 'Video Call'}
            >
              <Video className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowRoomInfoModal(true)}
              className={`p-2 sm:p-2.5 rounded-xl ${chatIconButton} text-slate-600 dark:text-slate-300 transition-all hover:scale-105`}
              title={isAr ? 'إعدادات الغرفة' : 'Room Settings'}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Search Sub-bar */}
        {showMessageSearch && (
          <div className="p-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 animate-fade-in">
            <Search className="w-4 h-4 text-sky-500 ms-2" />
            <input
              type="text"
              autoFocus
              value={messageSearchQuery}
              onChange={(e) => setMessageSearchQuery(e.target.value)}
              placeholder={isAr ? 'ابحث عن كلمة داخل هذه المحادثة...' : 'Search message in this chat...'}
              className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none"
            />
            {messageSearchQuery && (
              <button
                type="button"
                onClick={() => setMessageSearchQuery('')}
                className="text-slate-400 hover:text-white text-xs px-2"
              >
                {isAr ? 'مسح' : 'Clear'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowMessageSearch(false);
                setMessageSearchQuery('');
              }}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PINNED MESSAGE BANNER */}
        {pinnedMessage && (
          <div
            onClick={() => jumpToMessage(activeRoomId, pinnedMessage.id)}
            className="px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between cursor-pointer hover:bg-amber-500/20 transition-colors z-10"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                <Pin className="w-3.5 h-3.5 fill-slate-950" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold text-amber-500 flex items-center gap-1">
                  <span>{isAr ? 'رسالة مثبتة' : 'Pinned Message'}</span>
                  {pinnedMessage.pinnedBy && <span>• {pinnedMessage.pinnedBy}</span>}
                </div>
                <div className="text-xs text-slate-800 dark:text-slate-200 truncate font-medium">
                  {pinnedMessage.text || pinnedMessage.body}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePin(pinnedMessage);
              }}
              className="p-1 rounded-lg text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 text-xs"
              title={isAr ? 'إلغاء التثبيت' : 'Unpin'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Workspace Layout */}
        <div className="flex-1 flex min-h-0 relative overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
          {/* Members Sidebar on Right in RTL */}
          <ChatMembersSidebar
            isOpen={showMembersSidebar}
            onClose={() => setShowMembersSidebar(false)}
            members={roomMembers}
            isRoomOwner={isRoomOwner}
            isAr={isAr}
            isDark={isDark}
            onAddMember={() => setShowAddMemberModal(true)}
            onTagMember={(m) => setInputText((prev) => `${prev ? prev + ' ' : ''}@${m.name} `)}
            onStartCall={(kind) => setActiveCall(kind)}
            onChangeRole={async (id, role) => {
              try {
                await chatService.updateMemberRole(activeRoomId, id, role);
                setRoomMembers((prev) =>
                  prev.map((m) => (m.id === id ? { ...m, role } : m))
                );
              } catch (err: any) {
                alert(err.message || 'فشل تحديث الدور');
              }
            }}
            onRemoveMember={async (id) => {
              try {
                await chatService.removeMember(activeRoomId, id);
                setRoomMembers((prev) => prev.filter((m) => m.id !== id));
              } catch (err: any) {
                alert(err.message || 'فشل إزالة العضو');
              }
            }}
            onBanMember={() => {}}
            onSaveContact={() => {}}
          />

          {/* Middle: Chat Messages Stream + Message Input Bar */}
          <div className="flex-1 flex flex-col min-w-0 h-full">
            {/* Messages Stream */}
            <div
              ref={messagesContainerRef}
              className={`flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 ${chatStream}`}
              style={
                activeRoom?.backgroundUrl
                  ? {
                      backgroundImage: `url(${activeRoom.backgroundUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : chatBackground
                  ? { backgroundImage: chatBackground }
                  : undefined
              }
            >
              {loadingMessages ? (
                <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
                  {isAr ? 'جاري تحميل الرسائل من قاعدة البيانات...' : 'Loading messages from DB...'}
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30 text-sky-500" />
                  <p className="font-bold text-slate-500">
                    {isAr ? 'لا توجد رسائل بعد في هذه المحادثة' : 'No messages yet in this conversation'}
                  </p>
                  <p className="text-[11px] opacity-70 mt-1">
                    {isAr ? 'اكتب أول رسالة للبدء!' : 'Type the first message to start!'}
                  </p>
                </div>
              ) : (
                displayedMessages.map((msg) => {
                  const isHighlighted = highlightedMessageId === msg.id;

                  return (
                    <div
                      key={msg.id}
                      id={`chat-msg-${msg.id}`}
                      className={`flex flex-col transition-all duration-300 ${
                        msg.isOutgoing ? 'items-end' : 'items-start'
                      } ${isHighlighted ? 'scale-[1.02] ring-2 ring-amber-500 rounded-2xl p-1' : ''}`}
                    >
                      {!msg.isOutgoing && activeRoom.type !== 'direct' && (
                        <span className="text-[10px] font-bold text-sky-500 mb-1 px-1 flex items-center gap-1">
                          <span>{msg.senderName}</span>
                        </span>
                      )}

                      <div
                        className={`max-w-md p-3.5 rounded-2xl text-xs sm:text-sm shadow-xs space-y-1.5 relative group ${
                          msg.isOutgoing
                            ? 'bg-sky-600 text-white font-medium rounded-br-xs'
                            : isDark
                            ? 'bg-[#202c33] text-slate-100 border border-slate-750/60 rounded-bl-xs'
                            : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                        }`}
                      >
                        {/* Hover Message Action Toolbar */}
                        <div
                          className={`absolute -top-3 ${
                            msg.isOutgoing ? 'start-0 -translate-x-2' : 'end-0 translate-x-2'
                          } opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900/95 text-slate-200 border border-slate-700 rounded-xl px-1.5 py-0.5 shadow-xl z-20 backdrop-blur-xs`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleSaveMessage(msg)}
                            className="p-1 hover:text-amber-400 transition-colors"
                            title={msg.isSaved ? (isAr ? 'إلغاء الحفظ' : 'Unsave') : (isAr ? 'حفظ الرسالة' : 'Save message')}
                          >
                            <Bookmark
                              className={`w-3.5 h-3.5 ${msg.isSaved ? 'fill-amber-400 text-amber-400' : ''}`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTogglePin(msg)}
                            className="p-1 hover:text-sky-400 transition-colors"
                            title={msg.isPinned ? (isAr ? 'إلغاء التثبيت' : 'Unpin') : (isAr ? 'تثبيت الرسالة' : 'Pin message')}
                          >
                            <Pin className={`w-3.5 h-3.5 ${msg.isPinned ? 'fill-sky-400 text-sky-400' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyingTo(msg)}
                            className="p-1 hover:text-sky-400 transition-colors"
                            title={isAr ? 'رد' : 'Reply'}
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          {msg.isOutgoing && !msg.isDeleted && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMessage(msg);
                                setInputText(msg.text || msg.body || '');
                              }}
                              className="p-1 hover:text-emerald-400 transition-colors"
                              title={isAr ? 'تعديل' : 'Edit'}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(msg.text || msg.body || '');
                            }}
                            className="p-1 hover:text-slate-100 transition-colors"
                            title={isAr ? 'نسخ' : 'Copy'}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {(msg.isOutgoing || isRoomOwner) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg)}
                              className="p-1 hover:text-rose-400 transition-colors"
                              title={isAr ? 'حذف' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Pinned Marker */}
                        {msg.isPinned && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-300 pb-1 border-b border-white/20">
                            <Pin className="w-3 h-3 fill-amber-300" />
                            <span>{isAr ? 'مثبتة في الغرفة' : 'Pinned'}</span>
                          </div>
                        )}

                        {/* Poll Card */}
                        {msg.type === 'poll' && msg.poll ? (
                          <div className="min-w-[240px] max-w-[320px] space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-fuchsia-500/15 flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-fuchsia-500" />
                              </div>
                              <div>
                                <div className="font-extrabold text-xs">{isAr ? 'استطلاع رأي' : 'Poll'}</div>
                                <div className="text-[10px] opacity-60">
                                  {msg.poll.multiple
                                    ? isAr
                                      ? 'يمكن اختيار أكثر من إجابة'
                                      : 'Multiple answers'
                                    : isAr
                                    ? 'إجابة واحدة'
                                    : 'Single answer'}
                                </div>
                              </div>
                            </div>
                            <div className="font-bold text-sm leading-relaxed">{msg.poll.question}</div>
                            <div className="space-y-2">
                              {msg.poll.options.map((option, i) => (
                                <div key={i} className="rounded-xl border border-current/10 p-2.5">
                                  <span className="font-semibold text-xs">{option}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : msg.type === 'location' && msg.location ? (
                          <a
                            href={`https://www.google.com/maps?q=${msg.location.lat},${msg.location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 group/loc"
                          >
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                msg.location.isLive
                                  ? 'bg-rose-500/20 text-rose-500 animate-pulse'
                                  : 'bg-slate-900/20 text-current'
                              }`}
                            >
                              {msg.location.isLive ? (
                                <Navigation2 className="w-5 h-5" />
                              ) : (
                                <MapPin className="w-5 h-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs">{msg.text || msg.body}</span>
                                {msg.location.isLive && (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-bold shrink-0">
                                    {isAr ? 'مباشر' : 'LIVE'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] opacity-70 font-mono-num block truncate group-hover/loc:underline">
                                {isAr ? 'فتح في خرائط جوجل' : 'Open in Google Maps'} ·{' '}
                                {msg.location.lat.toFixed(4)}, {msg.location.lng.toFixed(4)}
                              </span>
                            </div>
                          </a>
                        ) : msg.type === 'voice' ? (
                          <div className="flex items-center gap-3">
                            <button className="w-8 h-8 rounded-full bg-slate-900/30 flex items-center justify-center text-current">
                              <Play className="w-4 h-4 fill-current" />
                            </button>
                            <div className="flex-1">
                              <div className="h-1 bg-current/30 rounded-full w-32 overflow-hidden">
                                <div className="h-full bg-current w-2/3" />
                              </div>
                              <span className="text-[10px] opacity-80 mt-0.5 block">{msg.text || msg.body}</span>
                            </div>
                          </div>
                        ) : msg.type === 'image' && msg.mediaUrl ? (
                          <div className="space-y-2">
                            <img
                              src={msg.mediaUrl}
                              alt={msg.text}
                              className="max-w-full max-h-72 rounded-xl object-contain border border-current/10"
                            />
                            <div className="text-[11px] font-semibold">{msg.text || msg.body}</div>
                          </div>
                        ) : msg.type === 'video' && msg.mediaUrl ? (
                          <div className="space-y-2">
                            <video
                              src={msg.mediaUrl}
                              controls
                              playsInline
                              className="max-w-full max-h-72 rounded-xl border border-current/10"
                            />
                            <div className="text-[11px] font-semibold">{msg.text || msg.body}</div>
                          </div>
                        ) : msg.type === 'file' && msg.mediaUrl ? (
                          <a
                            href={msg.mediaUrl}
                            download={(msg.text || 'file').replace(/^📄\s*/, '')}
                            className="flex items-center gap-3 p-2 rounded-xl bg-black/10 hover:bg-black/20"
                          >
                            <FileText className="w-8 h-8 text-sky-400 shrink-0" />
                            <span className="text-xs font-bold break-all">{msg.text || msg.body}</span>
                          </a>
                        ) : (
                          <div className={msg.isDeleted ? 'italic opacity-60' : ''}>
                            {msg.text || msg.body}
                          </div>
                        )}

                        <div
                          className={`text-[9px] flex items-center justify-end gap-1 font-mono-num ${
                            msg.isOutgoing ? 'text-sky-100' : 'text-slate-400'
                          }`}
                        >
                          {msg.isSaved && <Bookmark className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />}
                          {msg.isEdited && (
                            <span className="opacity-75">{isAr ? '(معدلة)' : '(edited)'}</span>
                          )}
                          <span>
                            {new Date(msg.timestamp || msg.createdAt || '').toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {msg.isOutgoing && (
                            <span title={msg.status === 'read' ? 'مقروءة' : 'تم الإرسال'}>
                              {msg.status === 'read' ? (
                                <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-sky-200" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Replying banner */}
            {replyingTo && (
              <div className="px-4 py-2 bg-sky-500/10 border-t border-sky-500/30 flex items-center justify-between gap-2 animate-fade-in">
                <div className="flex items-center gap-2 min-w-0 text-xs">
                  <CornerDownRight className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span className="font-bold text-sky-500 shrink-0">
                    {isAr ? 'الرد على' : 'Replying to'} {replyingTo.senderName}:
                  </span>
                  <span className="truncate text-slate-500 dark:text-slate-400">
                    {replyingTo.text || replyingTo.body}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="p-1 rounded hover:bg-sky-500/20 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Editing banner */}
            {editingMessage && (
              <div className="px-4 py-2 bg-emerald-500/10 border-t border-emerald-500/30 flex items-center justify-between gap-2 animate-fade-in">
                <div className="flex items-center gap-2 min-w-0 text-xs">
                  <Edit3 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="font-bold text-emerald-500 shrink-0">
                    {isAr ? 'تعديل الرسالة:' : 'Editing message:'}
                  </span>
                  <span className="truncate text-slate-500 dark:text-slate-400">
                    {editingMessage.text || editingMessage.body}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessage(null);
                    setInputText('');
                  }}
                  className="p-1 rounded hover:bg-emerald-500/20 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Audio Recording Overlay or Input Bar */}
            {isRecordingAudio ? (
              <div
                className={`p-4 ${chatPanel} border-t ${chatBorder} flex items-center justify-between gap-4 animate-fade-in`}
              >
                <div className="flex items-center gap-3 text-rose-500 font-bold text-xs animate-pulse">
                  <Mic className="w-5 h-5" />
                  <span>
                    {isAr
                      ? `جاري تسجيل الصوت... (${recordingSeconds} ثانية)`
                      : `Recording... (${recordingSeconds}s)`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stopVoiceRecording(false)}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => stopVoiceRecording(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold shadow-md hover:bg-amber-400"
                  >
                    {isAr ? 'إرسال الصوت' : 'Send Voice'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {liveLocationWatchId !== null && (
                  <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-rose-400 text-[11px] font-bold">
                      <Navigation2 className="w-3.5 h-3.5 animate-pulse" />
                      <span>{isAr ? 'جاري مشاركة موقعك المباشر...' : 'Sharing your live location...'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleStopLiveLocation}
                      className="text-[11px] font-bold text-rose-400 hover:text-rose-300 underline"
                    >
                      {isAr ? 'إيقاف' : 'Stop'}
                    </button>
                  </div>
                )}

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      handleFileAttachment(
                        f,
                        f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'file'
                      );
                    e.currentTarget.value = '';
                  }}
                />
                <input
                  ref={documentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileAttachment(f, 'file');
                    e.currentTarget.value = '';
                  }}
                />

                <form
                  onSubmit={(e) => handleSendMessage(e)}
                  className={`p-3 ${chatPanel} border-t ${chatBorder} flex items-center gap-2.5`}
                >
                  <div className="relative">
                    {showAttachMenu && (
                      <div
                        className={`absolute bottom-full start-0 mb-2 w-56 rounded-2xl border border-sky-500/30 ${
                          isDark ? 'bg-[#1c1c1c]' : 'bg-white'
                        } shadow-2xl p-2 z-20 animate-fade-in space-y-1`}
                        id="chat-attach-menu"
                      >
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                        >
                          <Image className="w-4 h-4 text-sky-500" />
                          <span>{isAr ? 'صورة أو فيديو' : 'Photo / Video'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => documentInputRef.current?.click()}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                        >
                          <FileText className="w-4 h-4 text-sky-500" />
                          <span>{isAr ? 'مستند أو ملف' : 'Document / File'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(false);
                            setShowPollModal(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                        >
                          <Vote className="w-4 h-4 text-fuchsia-500" />
                          <span>{isAr ? 'استطلاع رأي' : 'Poll'}</span>
                        </button>
                        <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
                        <button
                          type="button"
                          id="attach-share-location-btn"
                          onClick={handleShareLocation}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                        >
                          <MapPin className="w-4 h-4 text-emerald-500" />
                          <span>{isAr ? 'موقعي الحالي' : 'My Location'}</span>
                        </button>
                        <button
                          type="button"
                          id="attach-share-live-location-btn"
                          onClick={
                            liveLocationWatchId !== null ? handleStopLiveLocation : handleStartLiveLocation
                          }
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                            liveLocationWatchId !== null
                              ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                              : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <Navigation2
                            className={`w-4 h-4 ${
                              liveLocationWatchId !== null ? 'text-rose-400' : 'text-rose-500'
                            }`}
                          />
                          <span>
                            {liveLocationWatchId !== null
                              ? isAr
                                ? 'إيقاف الموقع المباشر'
                                : 'Stop live location'
                              : isAr
                              ? 'موقع مباشر (Live)'
                              : 'Live location'}
                          </span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowAttachMenu((v) => !v)}
                      className={`p-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${
                        showAttachMenu ? 'text-sky-500 bg-sky-500/15' : 'text-slate-500 dark:text-slate-400 hover:text-sky-500'
                      }`}
                      title={isAr ? 'إرفاق ملف' : 'Attach'}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCameraModal(true)}
                    className="p-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-sky-500 transition-colors"
                    title={isAr ? 'التقاط صورة بالكاميرا' : 'Take photo'}
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    placeholder={
                      editingMessage
                        ? isAr
                          ? 'عدّل نص الرسالة...'
                          : 'Edit message text...'
                        : isAr
                        ? 'اكتب رسالتك المباشرة هنا...'
                        : 'Type your message...'
                    }
                    className={`flex-1 px-4 py-2.5 text-xs rounded-xl border focus:outline-none focus:border-sky-500 ${chatInput}`}
                  />

                  {inputText.trim() ? (
                    <button
                      type="submit"
                      className="p-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-md transition-transform active:scale-95"
                      title={isAr ? 'إرسال' : 'Send'}
                    >
                      <Send className="w-4 h-4 rtl:rotate-180" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className={`p-3 ${chatIconButton} text-sky-500 rounded-xl shadow-md transition-transform active:scale-95`}
                      title={isAr ? 'تسجيل رسالة صوتية' : 'Record voice note'}
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CALL MODAL */}
      {/* ========================================================================= */}
      {activeCall && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-3xl overflow-hidden border border-sky-500/30 shadow-2xl ${
              isDark ? 'bg-slate-900' : 'bg-white'
            }`}
          >
            <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {activeCall === 'video'
                    ? isAr
                      ? 'مكالمة فيديو مشفرة'
                      : 'Video Call'
                    : isAr
                    ? 'مكالمة صوتية مشفرة'
                    : 'Voice Call'}
                </div>
                <div className="text-[10px] text-emerald-500 font-bold">
                  {isAr ? 'اتصال آمن • جاري الاتصال بالطرف الآخر' : 'Secure call • Connecting'}
                </div>
              </div>
              <button
                onClick={() => setActiveCall(null)}
                className="p-2 rounded-xl bg-rose-500/10 text-rose-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {activeCall === 'video' ? (
              <div className="aspect-video bg-black relative flex items-center justify-center">
                <Camera className="w-12 h-12 text-slate-500 animate-pulse" />
                <div className="absolute bottom-3 start-3 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px]">
                  {isAr ? 'جاري تهيئة الفيديو...' : 'Initializing video...'}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-500 animate-pulse">
                  <Phone className="w-9 h-9" />
                </div>
                <div className={`mt-4 font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {activeRoom.title || activeRoom.name}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {isAr ? 'جاري بدء الاتصال الصوتي…' : 'Starting voice call…'}
                </div>
              </div>
            )}
            <div className="p-4 flex justify-center">
              <button
                onClick={() => setActiveCall(null)}
                className="px-6 py-2.5 rounded-2xl bg-rose-500 text-white font-black text-xs hover:bg-rose-600 transition-colors"
              >
                {isAr ? 'إنهاء المكالمة' : 'End Call'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Create New Room */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div
            className={`${
              isDark ? 'bg-slate-900' : 'bg-white'
            } border border-sky-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-500 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {isAr ? 'إنشاء غرفة أو محادثة جديدة' : 'Create Room or Chat'}
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'اسم الغرفة أو المحادثة *' : 'Room Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  placeholder={isAr ? 'مثال: رحلة العمل ✈️، العائلة 🏡' : 'e.g. Work Trip ✈️'}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'الوصف (اختياري)' : 'Description (Optional)'}
                </label>
                <input
                  type="text"
                  value={newRoomDescription}
                  onChange={(e) => setNewRoomDescription(e.target.value)}
                  placeholder={isAr ? 'نبذة عن الغرفة...' : 'Brief description...'}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'نوع المحادثة' : 'Chat Type'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'group', label: isAr ? 'مجموعة 👥' : 'Group' },
                    { id: 'direct', label: isAr ? 'خاص 👤' : 'Direct' },
                    { id: 'public', label: isAr ? 'قناة عامة 📢' : 'Public' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setNewRoomType(type.id as any)}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                        newRoomType === type.id
                          ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                          : 'border-slate-800 text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'اختر الأيقونة الرمزية' : 'Select Avatar'}
                </label>
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                  {presetAvatars.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNewRoomAvatar(av.url)}
                      className={`relative rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                        newRoomAvatar === av.url
                          ? 'border-sky-500 scale-105 shadow-md'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={av.url} alt={av.label} className="w-12 h-12 object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white shadow-md"
                >
                  {isAr ? 'إنشاء الغرفة الآن' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SAVED MESSAGES MODAL */}
      {/* ========================================================================= */}
      <SavedMessagesModal
        isOpen={showSavedModal}
        onClose={() => setShowSavedModal(false)}
        isAr={isAr}
        isDark={isDark}
        onJumpToMessage={(roomId, messageId) => jumpToMessage(roomId, messageId)}
      />

      {/* ========================================================================= */}
      {/* ADD MEMBER MODAL */}
      {/* ========================================================================= */}
      <AddMemberModal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        roomId={activeRoomId}
        existingMembers={roomMembers}
        isAr={isAr}
        isDark={isDark}
        onMemberAdded={async () => {
          const detail = await chatService.getRoomDetails(activeRoomId);
          if (detail?.members) setRoomMembers(detail.members);
        }}
      />

      {/* ========================================================================= */}
      {/* CHAT SETTINGS MODAL */}
      {/* ========================================================================= */}
      <ChatSettingsModal
        isOpen={showRoomInfoModal}
        onClose={() => setShowRoomInfoModal(false)}
        room={{
          ...activeRoom,
          members: roomMembers,
          settings: roomPrefs,
          permissions: roomPermissions,
          adminPermissions,
          moderatorPermissions,
          description: roomDescription || activeRoom.description,
          background: chatBackground || activeRoom.background,
        }}
        isRoomOwner={isRoomOwner}
        language={language}
        isDark={isDark}
        onSave={handleSaveRoomSettings}
        onClearHistory={handleClearRoomHistory}
        onExportChat={() => {
          const msgs = messagesMap[activeRoomId] || [];
          const lines = msgs.map((m) => `[${m.timestamp || m.createdAt}] ${m.senderName}: ${m.text || m.body}`);
          const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `chat_${(activeRoom.title || activeRoom.name || 'room').replace(/\s+/g, '_')}.txt`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }}
        onLeaveRoom={handleLeaveRoom}
        onDeleteRoom={handleDeleteRoom}
      />

      {/* ========================================================================= */}
      {/* LIVE CAMERA CAPTURE MODAL */}
      {/* ========================================================================= */}
      <ChatCameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleLiveCameraCapture}
        isAr={isAr}
        isDark={isDark}
      />

      {/* ========================================================================= */}
      {/* POLL MODAL */}
      {/* ========================================================================= */}
      {showPollModal && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={() => setShowPollModal(false)}
        >
          <div
            className={`w-full max-w-md rounded-3xl border shadow-2xl p-5 ${
              isDark ? 'bg-[#17191d] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-fuchsia-500/10 flex items-center justify-center">
                  <Vote className="w-4 h-4 text-fuchsia-500" />
                </div>
                <div>
                  <h3 className="font-black text-sm">{isAr ? 'استطلاع رأي جديد' : 'New Poll'}</h3>
                  <p className="text-[10px] text-slate-500">
                    {isAr ? 'شارك المجموعة سؤالاً تفاعلياً.' : 'Ask group and collect votes.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPollModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-[10px] font-bold mb-1.5">{isAr ? 'السؤال' : 'Question'}</label>
            <input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder={isAr ? 'مثلاً: ما رأيك في الموعد الجديد؟' : 'e.g. What do you think of the new schedule?'}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs mb-3"
            />
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold">{isAr ? 'الاختيارات' : 'Options'}</label>
              <button
                type="button"
                onClick={() => setPollOptions((v) => [...v, ''])}
                className="text-[10px] text-fuchsia-500 font-bold"
              >
                + {isAr ? 'إضافة اختيار' : 'Add option'}
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {pollOptions.map((option, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={option}
                    onChange={(e) =>
                      setPollOptions((v) => v.map((x, idx) => (idx === i ? e.target.value : x)))
                    }
                    placeholder={`${isAr ? 'اختيار' : 'Option'} ${i + 1}`}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((v) => v.filter((_, idx) => idx !== i))}
                      className="p-2 text-rose-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 mt-3 text-[10px] font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={pollMultiple}
                onChange={(e) => setPollMultiple(e.target.checked)}
                className="accent-fuchsia-500"
              />
              {isAr ? 'السماح باختيار أكثر من إجابة' : 'Allow multiple answers'}
            </label>
            <button
              type="button"
              onClick={createPoll}
              className="w-full mt-4 py-2.5 rounded-xl bg-fuchsia-500 text-white font-black text-xs hover:bg-fuchsia-600 transition"
            >
              {isAr ? 'إنشاء الاستطلاع وإرساله' : 'Create & send poll'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
