// @ts-nocheck
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import crypto from 'node:crypto';
import { db } from './database.js';

// Types
export interface WsClient extends WebSocket {
  userId?: string;
  userName?: string;
  userAvatar?: string;
  rooms?: Set<string>;
  isAlive?: boolean;
}

// Global active connections
const userConnections = new Map<string, Set<WsClient>>();
const roomSubscriptions = new Map<string, Set<WsClient>>();
const onlineUserIds = new Set<string>();

export function getOnlineUsers(): string[] {
  return Array.from(onlineUserIds);
}

export function isUserOnline(userId: string): boolean {
  return onlineUserIds.has(userId);
}

// Helpers to broadcast
export function broadcastToRoom(roomId: string, payload: any, excludeWs?: WebSocket) {
  const clients = roomSubscriptions.get(roomId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export function sendToUser(userId: string, payload: any) {
  const clients = userConnections.get(userId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export function broadcastAll(payload: any, excludeWs?: WebSocket) {
  const msg = JSON.stringify(payload);
  for (const [_, clients] of userConnections) {
    for (const ws of clients) {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }
}

// Auth Helper
export function getAuthUser(req: express.Request) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  
  try {
    const user = db.prepare(`
      SELECT u.id, u.email, u.display_name as name, u.avatar, u.phone, u.phone_verified as phoneVerified
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND julianday(s.expires_at) > julianday('now')
    `).get(token) as any;
    return user || null;
  } catch {
    return null;
  }
}

export function getAuthUserFromToken(token: string) {
  if (!token) return null;
  try {
    const user = db.prepare(`
      SELECT u.id, u.email, u.display_name as name, u.avatar, u.phone, u.phone_verified as phoneVerified
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND julianday(s.expires_at) > julianday('now')
    `).get(token) as any;
    return user || null;
  } catch {
    return null;
  }
}

// Verify conversation membership or public access
export function verifyConversationAccess(userId: string, roomId: string): { allowed: boolean; role?: string; isPublic?: boolean } {
  try {
    const conv = db.prepare('SELECT id, type, creator_id FROM conversations WHERE id = ?').get(roomId) as any;
    if (!conv) return { allowed: false };
    
    if (conv.type === 'public') {
      const member = db.prepare('SELECT role, banned FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(roomId, userId) as any;
      if (member?.banned) return { allowed: false };
      return { allowed: true, role: member?.role || (conv.creator_id === userId ? 'owner' : 'member'), isPublic: true };
    }

    const member = db.prepare('SELECT role, banned FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(roomId, userId) as any;
    if (!member || member.banned) return { allowed: false };
    return { allowed: true, role: member.role, isPublic: false };
  } catch {
    return { allowed: false };
  }
}

// Setup WebSocket server
export function setupChatWebSocket(httpServer: http.Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/chat' });

  // Heartbeat interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  wss.on('connection', (ws: WsClient, req) => {
    ws.isAlive = true;
    ws.rooms = new Set<string>();

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const { type, payload } = data;

        if (type === 'auth') {
          const user = getAuthUserFromToken(payload?.token);
          if (user) {
            ws.userId = user.id;
            ws.userName = user.name;
            ws.userAvatar = user.avatar;

            if (!userConnections.has(user.id)) {
              userConnections.set(user.id, new Set());
            }
            userConnections.get(user.id)!.add(ws);
            onlineUserIds.add(user.id);

            ws.send(JSON.stringify({
              type: 'auth_success',
              payload: { userId: user.id, onlineUsers: getOnlineUsers() },
            }));

            // Broadcast presence
            broadcastAll({
              type: 'presence_update',
              payload: { userId: user.id, isOnline: true, onlineUsers: getOnlineUsers() },
            }, ws);
          } else {
            ws.send(JSON.stringify({ type: 'auth_error', payload: { message: 'Invalid session token' } }));
          }
        }

        if (type === 'join_room') {
          const { roomId } = payload || {};
          if (roomId) {
            if (!roomSubscriptions.has(roomId)) {
              roomSubscriptions.set(roomId, new Set());
            }
            roomSubscriptions.get(roomId)!.add(ws);
            ws.rooms?.add(roomId);

            ws.send(JSON.stringify({
              type: 'joined_room',
              payload: { roomId },
            }));
          }
        }

        if (type === 'leave_room') {
          const { roomId } = payload || {};
          if (roomId) {
            roomSubscriptions.get(roomId)?.delete(ws);
            ws.rooms?.delete(roomId);
          }
        }

        if (type === 'typing') {
          const { roomId, isTyping } = payload || {};
          if (roomId && ws.userId) {
            broadcastToRoom(roomId, {
              type: 'user_typing',
              payload: {
                roomId,
                userId: ws.userId,
                userName: ws.userName || 'مستخدم',
                isTyping: !!isTyping,
              },
            }, ws);
          }
        }
      } catch (err) {
        console.warn('WS message parse error:', err);
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        const userSet = userConnections.get(ws.userId);
        if (userSet) {
          userSet.delete(ws);
          if (userSet.size === 0) {
            userConnections.delete(ws.userId);
            onlineUserIds.delete(ws.userId);
            broadcastAll({
              type: 'presence_update',
              payload: { userId: ws.userId, isOnline: false, onlineUsers: getOnlineUsers() },
            });
          }
        }
      }

      if (ws.rooms) {
        for (const roomId of ws.rooms) {
          roomSubscriptions.get(roomId)?.delete(ws);
        }
      }
    });
  });

  return wss;
}

// Router Setup
export const chatRouter = express.Router();

// 1. GET /api/chat/users - List users for direct chat or adding to group
chatRouter.get('/users', (req, res) => {
  try {
    const user = getAuthUser(req);
    const users = db.prepare(`
      SELECT id, display_name as name, email, avatar, phone
      FROM users
      ORDER BY created_at DESC
      LIMIT 100
    `).all() as any[];

    const result = users.map((u) => ({
      id: u.id,
      name: u.name || u.email.split('@')[0],
      email: u.email,
      avatar: u.avatar || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80`,
      phone: u.phone,
      isOnline: isUserOnline(u.id),
      isCurrent: user ? user.id === u.id : false,
    }));

    res.json({ users: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/chat/rooms - List all rooms accessible to the current user
chatRouter.get('/rooms', (req, res) => {
  try {
    const user = getAuthUser(req);
    const userId = user?.id || '';

    // Query all public rooms + rooms where user is member or creator
    const query = userId
      ? `
        SELECT DISTINCT c.*,
          cm.role as user_role,
          (
            SELECT COUNT(*) FROM messages m
            WHERE m.conversation_id = c.id
              AND m.is_deleted = 0
              AND m.created_at > COALESCE(
                (SELECT mr.read_at FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?),
                '1970-01-01'
              )
              AND m.sender_id != ?
          ) as unread_count,
          (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) as members_count
        FROM conversations c
        LEFT JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
        WHERE c.type = 'public' OR cm.user_id = ? OR c.creator_id = ?
        ORDER BY c.pinned DESC, c.updated_at DESC
      `
      : `
        SELECT c.*,
          0 as unread_count,
          (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) as members_count
        FROM conversations c
        WHERE c.type = 'public'
        ORDER BY c.pinned DESC, c.updated_at DESC
      `;

    const rows = (userId ? db.prepare(query).all(userId, userId, userId, userId, userId) : db.prepare(query).all()) as any[];

    const rooms = rows.map((r) => {
      let settings = null;
      let permissions = null;
      let adminPermissions = null;
      let moderatorPermissions = null;
      try { settings = JSON.parse(r.settings_json || '{}'); } catch {}
      try { permissions = JSON.parse(r.permissions_json || '{}'); } catch {}
      try { adminPermissions = JSON.parse(r.admin_permissions_json || '{}'); } catch {}
      try { moderatorPermissions = JSON.parse(r.moderator_permissions_json || '{}'); } catch {}

      // If direct conversation, adjust title and avatar for other user
      let title = r.title;
      let avatar = r.avatar;
      let isOnline = false;

      if (r.type === 'direct' && userId) {
        const otherMember = db.prepare(`
          SELECT u.id, u.display_name as name, u.avatar
          FROM conversation_members cm
          JOIN users u ON u.id = cm.user_id
          WHERE cm.conversation_id = ? AND cm.user_id != ?
        `).get(r.id, userId) as any;

        if (otherMember) {
          title = otherMember.name || title;
          avatar = otherMember.avatar || avatar;
          isOnline = isUserOnline(otherMember.id);
        }
      }

      return {
        id: r.id,
        title: title || r.name || 'محادثة',
        name: title || r.name || 'محادثة',
        description: r.description || '',
        type: r.type || 'group',
        avatar: avatar || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=120&auto=format&fit=crop&q=80',
        creatorId: r.creator_id,
        pinned: !!r.pinned,
        background: r.background || '',
        backgroundUrl: r.background_url || '',
        lastMessage: r.last_message || '',
        lastMessageTime: r.last_message_time || '',
        unreadCount: Number(r.unread_count || 0),
        membersCount: Number(r.members_count || 0),
        isOnline,
        settings,
        permissions,
        adminPermissions,
        moderatorPermissions,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    res.json({ rooms });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/chat/rooms - Create a new conversation (Direct, Group, or Channel)
chatRouter.post('/rooms', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول لإنشاء محادثة' });

    const {
      title,
      description = '',
      type = 'group',
      avatar,
      memberIds = [],
      background = '',
      backgroundUrl = '',
      settings,
      permissions,
    } = req.body;

    const roomId = `room_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    // Check if direct chat between these two users already exists
    if (type === 'direct' && memberIds.length === 1) {
      const targetUserId = memberIds[0];
      const existing = db.prepare(`
        SELECT c.id FROM conversations c
        JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = ?
        JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = ?
        WHERE c.type = 'direct'
      `).get(user.id, targetUserId) as any;

      if (existing) {
        return res.json({ roomId: existing.id, isExisting: true });
      }
    }

    const defaultSettings = JSON.stringify(settings || {
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

    const defaultPerms = JSON.stringify(permissions || {
      sendMessages: true,
      sendMedia: true,
      addMembers: true,
      pinMessages: false,
      editRoom: false,
      deleteMessages: false,
      startCalls: true,
      mentionEveryone: false,
    });

    const defaultAvatar = avatar || (
      type === 'direct'
        ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=120&auto=format&fit=crop&q=80'
    );

    db.prepare(`
      INSERT INTO conversations (id, title, description, type, avatar, background, background_url, creator_id, pinned, settings_json, permissions_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `).run(roomId, title || 'محادثة جديدة', description, type, defaultAvatar, background, backgroundUrl, user.id, defaultSettings, defaultPerms, now, now);

    // Add creator as owner
    db.prepare(`
      INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
      VALUES (?, ?, 'owner', ?)
    `).run(roomId, user.id, now);

    // Add other members
    const allMembers: string[] = Array.from(new Set((memberIds || []).filter((id: string) => id !== user.id)));
    for (const mId of allMembers) {
      db.prepare(`
        INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, role, joined_at)
        VALUES (?, ?, 'member', ?)
      `).run(roomId, mId as string, now);
    }

    // Broadcast room created to members
    const newRoomPayload = {
      type: 'room_created',
      payload: { roomId, type, creatorId: user.id, title: title || 'محادثة جديدة' },
    };
    sendToUser(user.id, newRoomPayload);
    for (const mId of allMembers) {
      sendToUser(mId as string, newRoomPayload);
    }

    res.json({ ok: true, roomId, message: 'تم إنشاء الغرفة بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GET /api/chat/rooms/:roomId - Full room details with members and permissions
chatRouter.get('/rooms/:roomId', (req, res) => {
  try {
    const user = getAuthUser(req);
    const userId = user?.id || '';
    const { roomId } = req.params;

    const access = verifyConversationAccess(userId, roomId);
    if (!access.allowed && !access.isPublic) {
      return res.status(403).json({ error: 'ليس لديك صلاحية الوصول لهذه الغرفة' });
    }

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(roomId) as any;
    if (!conv) return res.status(404).json({ error: 'الغرفة غير موجودة' });

    // Members
    const members = db.prepare(`
      SELECT cm.user_id as id, u.display_name as name, u.email, u.avatar, u.phone, cm.role, cm.joined_at as joinedAt, cm.muted, cm.banned
      FROM conversation_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.conversation_id = ?
      ORDER BY
        CASE cm.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'moderator' THEN 3
          ELSE 4
        END,
        cm.joined_at ASC
    `).all(roomId) as any[];

    const formattedMembers = members.map((m) => ({
      id: m.id,
      name: m.name || m.email.split('@')[0],
      avatar: m.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      phone: m.phone,
      role: m.role,
      joinedAt: m.joinedAt,
      isOnline: isUserOnline(m.id),
      muted: !!m.muted,
      banned: !!m.banned,
    }));

    let settings = null;
    let permissions = null;
    let adminPermissions = null;
    let moderatorPermissions = null;
    try { settings = JSON.parse(conv.settings_json || '{}'); } catch {}
    try { permissions = JSON.parse(conv.permissions_json || '{}'); } catch {}
    try { adminPermissions = JSON.parse(conv.admin_permissions_json || '{}'); } catch {}
    try { moderatorPermissions = JSON.parse(conv.moderator_permissions_json || '{}'); } catch {}

    res.json({
      room: {
        id: conv.id,
        title: conv.title,
        name: conv.title,
        description: conv.description || '',
        type: conv.type,
        avatar: conv.avatar,
        background: conv.background || '',
        backgroundUrl: conv.background_url || '',
        creatorId: conv.creator_id,
        pinned: !!conv.pinned,
        lastMessage: conv.last_message || '',
        lastMessageTime: conv.last_message_time || '',
        members: formattedMembers,
        settings,
        permissions,
        adminPermissions,
        moderatorPermissions,
        currentUserRole: access.role || 'member',
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. PUT /api/chat/rooms/:roomId - Update room details & settings
chatRouter.put('/rooms/:roomId', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { roomId } = req.params;
    const access = verifyConversationAccess(user.id, roomId);
    if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
      return res.status(403).json({ error: 'لا تملك صلاحية تعديل إعدادات الغرفة' });
    }

    const {
      title,
      name,
      description,
      avatar,
      background,
      backgroundUrl,
      pinned,
      settings,
      permissions,
      adminPermissions,
      moderatorPermissions,
    } = req.body;

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(roomId) as any;
    if (!conv) return res.status(404).json({ error: 'الغرفة غير موجودة' });

    const now = new Date().toISOString();
    const newTitle = title !== undefined ? title : (name !== undefined ? name : conv.title);
    const newDesc = description !== undefined ? description : conv.description;
    const newAvatar = avatar !== undefined ? avatar : conv.avatar;
    const newBg = background !== undefined ? background : conv.background;
    const newBgUrl = backgroundUrl !== undefined ? backgroundUrl : conv.background_url;
    const newPinned = pinned !== undefined ? (pinned ? 1 : 0) : conv.pinned;
    const newSettings = settings !== undefined ? JSON.stringify(settings) : conv.settings_json;
    const newPerms = permissions !== undefined ? JSON.stringify(permissions) : conv.permissions_json;
    const newAdminPerms = adminPermissions !== undefined ? JSON.stringify(adminPermissions) : conv.admin_permissions_json;
    const newModPerms = moderatorPermissions !== undefined ? JSON.stringify(moderatorPermissions) : conv.moderator_permissions_json;

    db.prepare(`
      UPDATE conversations
      SET title = ?, description = ?, avatar = ?, background = ?, background_url = ?, pinned = ?, settings_json = ?, permissions_json = ?, admin_permissions_json = ?, moderator_permissions_json = ?, updated_at = ?
      WHERE id = ?
    `).run(newTitle, newDesc, newAvatar, newBg, newBgUrl, newPinned, newSettings, newPerms, newAdminPerms, newModPerms, now, roomId);

    broadcastToRoom(roomId, {
      type: 'room_updated',
      payload: { roomId, title: newTitle, description: newDesc, avatar: newAvatar, background: newBg, backgroundUrl: newBgUrl },
    });

    res.json({ ok: true, message: 'تم حفظ التعديلات بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. DELETE /api/chat/rooms/:roomId - Delete room (Owner only)
chatRouter.delete('/rooms/:roomId', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { roomId } = req.params;
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(roomId) as any;
    if (!conv) return res.status(404).json({ error: 'الغرفة غير موجودة' });

    if (conv.creator_id !== user.id && conv.id !== 'room_temp') {
      const member = db.prepare('SELECT role FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(roomId, user.id) as any;
      if (member?.role !== 'owner') {
        return res.status(403).json({ error: 'فقط مالك الغرفة يمكنه حذفها' });
      }
    }

    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(roomId);
    db.prepare('DELETE FROM conversation_members WHERE conversation_id = ?').run(roomId);
    db.prepare('DELETE FROM conversations WHERE id = ?').run(roomId);

    broadcastToRoom(roomId, {
      type: 'room_deleted',
      payload: { roomId },
    });

    res.json({ ok: true, message: 'تم حذف الغرفة بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. POST /api/chat/rooms/:roomId/leave - Leave room
chatRouter.post('/rooms/:roomId/leave', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { roomId } = req.params;
    db.prepare('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?').run(roomId, user.id);

    broadcastToRoom(roomId, {
      type: 'member_left',
      payload: { roomId, userId: user.id },
    });

    res.json({ ok: true, message: 'تمت مغادرة الغرفة بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. POST /api/chat/rooms/:roomId/clear - Clear messages (Owner/Admin)
chatRouter.post('/rooms/:roomId/clear', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { roomId } = req.params;
    const access = verifyConversationAccess(user.id, roomId);
    if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
      return res.status(403).json({ error: 'ليس لديك صلاحية مسح رسائل الغرفة' });
    }

    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(roomId);
    db.prepare("UPDATE conversations SET last_message = '', last_message_time = '' WHERE id = ?").run(roomId);

    broadcastToRoom(roomId, {
      type: 'messages_cleared',
      payload: { roomId },
    });

    res.json({ ok: true, message: 'تم مسح سجل الرسائل بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. GET /api/chat/rooms/:roomId/messages - Fetch messages with pagination & saved state
chatRouter.get('/rooms/:roomId/messages', (req, res) => {
  try {
    const user = getAuthUser(req);
    const userId = user?.id || '';
    const { roomId } = req.params;
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const before = String(req.query.before || '');
    const search = String(req.query.q || '').trim();

    const access = verifyConversationAccess(userId, roomId);
    if (!access.allowed && !access.isPublic) {
      return res.status(403).json({ error: 'ليس لديك صلاحية قراءة هذه الرسائل' });
    }

    let sql = `
      SELECT m.*,
        EXISTS(SELECT 1 FROM saved_messages sm WHERE sm.message_id = m.id AND sm.user_id = ?) as is_saved,
        u.display_name as sender_real_name,
        u.avatar as sender_real_avatar
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ?
    `;
    const params: any[] = [userId, roomId];

    if (search) {
      sql += ` AND m.body LIKE ?`;
      params.push(`%${search}%`);
    }

    if (before) {
      sql += ` AND m.created_at < ?`;
      params.push(before);
    }

    sql += ` ORDER BY m.created_at ASC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as any[];

    // Map rows to clean frontend ChatMessage format
    const messages = rows.map((r) => {
      let extra = null;
      try { extra = JSON.parse(r.extra_json || '{}'); } catch {}

      return {
        id: r.id,
        roomId: r.conversation_id,
        senderId: r.sender_id,
        senderName: r.sender_name || r.sender_real_name || 'مستخدم',
        senderAvatar: r.sender_avatar || r.sender_real_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
        text: r.is_deleted ? 'تم حذف هذه الرسالة' : r.body,
        body: r.body,
        mediaUrl: r.media_url || undefined,
        type: r.type || 'text',
        status: r.status || 'sent',
        isPinned: !!r.is_pinned,
        pinnedBy: r.pinned_by,
        pinnedAt: r.pinned_at,
        isEdited: !!r.is_edited,
        isDeleted: !!r.is_deleted,
        isSaved: !!r.is_saved,
        isOutgoing: userId ? r.sender_id === userId : false,
        timestamp: r.created_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        location: extra?.location,
        poll: extra?.poll,
      };
    });

    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. POST /api/chat/rooms/:roomId/messages - Send real message
chatRouter.post('/rooms/:roomId/messages', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول لإرسال رسالة' });

    const { roomId } = req.params;
    const { text, body, type = 'text', mediaUrl, extra } = req.body;
    const messageText = String(text || body || '').trim();

    if (!messageText && !mediaUrl) {
      return res.status(400).json({ error: 'نص الرسالة أو المرفق مطلوب' });
    }

    const access = verifyConversationAccess(user.id, roomId);
    if (!access.allowed && !access.isPublic) {
      return res.status(403).json({ error: 'ليس لديك صلاحية الإرسال في هذه الغرفة' });
    }

    // Auto-join public room if not already a member
    if (access.isPublic) {
      db.prepare(`
        INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, role, joined_at)
        VALUES (?, ?, 'member', ?)
      `).run(roomId, user.id, new Date().toISOString());
    }

    const messageId = `msg_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const extraJson = extra ? JSON.stringify(extra) : null;

    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, sender_name, sender_avatar, body, media_url, type, status, is_pinned, is_edited, is_deleted, extra_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sent', 0, 0, 0, ?, ?, ?)
    `).run(
      messageId,
      roomId,
      user.id,
      user.name || 'مستخدم',
      user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      messageText,
      mediaUrl || null,
      type,
      extraJson,
      now,
      now
    );

    // Update conversation last message
    const previewText = type === 'image' ? '📷 صورة' : type === 'voice' ? '🎙️ رسالة صوتية' : type === 'file' ? '📁 ملف' : messageText;
    const timeDisplay = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    db.prepare(`
      UPDATE conversations
      SET last_message = ?, last_message_time = ?, updated_at = ?
      WHERE id = ?
    `).run(previewText, timeDisplay, now, roomId);

    const messageObj = {
      id: messageId,
      roomId,
      senderId: user.id,
      senderName: user.name || 'مستخدم',
      senderAvatar: user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      text: messageText,
      body: messageText,
      mediaUrl,
      type,
      status: 'sent',
      isPinned: false,
      isEdited: false,
      isDeleted: false,
      isSaved: false,
      timestamp: now,
      createdAt: now,
      updatedAt: now,
      location: extra?.location,
      poll: extra?.poll,
    };

    // Broadcast in real-time via WebSocket
    broadcastToRoom(roomId, {
      type: 'new_message',
      payload: { message: messageObj, roomId },
    });

    // Also notify users of conversation update
    broadcastAll({
      type: 'conversation_updated',
      payload: {
        roomId,
        lastMessage: previewText,
        lastMessageTime: timeDisplay,
        updatedAt: now,
      },
    });

    res.json({ ok: true, message: messageObj });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. PUT /api/chat/rooms/:roomId/messages/:messageId - Edit message
chatRouter.put('/rooms/:roomId/messages/:messageId', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { roomId, messageId } = req.params;
    const { text, body } = req.body;
    const newText = String(text || body || '').trim();
    if (!newText) return res.status(400).json({ error: 'النص المعدل مطلوب' });

    const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND conversation_id = ?').get(messageId, roomId) as any;
    if (!msg) return res.status(404).json({ error: 'الرسالة غير موجودة' });

    if (msg.sender_id !== user.id) {
      return res.status(403).json({ error: 'لا يمكنك تعديل رسالة مستخدم آخر' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE messages SET body = ?, is_edited = 1, updated_at = ? WHERE id = ?').run(newText, now, messageId);

    broadcastToRoom(roomId, {
      type: 'message_updated',
      payload: { roomId, messageId, body: newText, text: newText, isEdited: true, updatedAt: now },
    });

    res.json({ ok: true, messageId, body: newText });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. DELETE /api/chat/rooms/:roomId/messages/:messageId - Delete message
chatRouter.delete('/rooms/:roomId/messages/:messageId', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { roomId, messageId } = req.params;
    const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND conversation_id = ?').get(messageId, roomId) as any;
    if (!msg) return res.status(404).json({ error: 'الرسالة غير موجودة' });

    const access = verifyConversationAccess(user.id, roomId);
    const isOwnerOrAdmin = access.role === 'owner' || access.role === 'admin' || access.role === 'moderator';

    if (msg.sender_id !== user.id && !isOwnerOrAdmin) {
      return res.status(403).json({ error: 'ليس لديك صلاحية حذف هذه الرسالة' });
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE messages SET is_deleted = 1, body = 'تم حذف هذه الرسالة', media_url = NULL, updated_at = ? WHERE id = ?").run(now, messageId);

    broadcastToRoom(roomId, {
      type: 'message_deleted',
      payload: { roomId, messageId, updatedAt: now },
    });

    res.json({ ok: true, messageId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13. POST /api/chat/rooms/:roomId/messages/:messageId/pin - Pin/Unpin message
chatRouter.post('/rooms/:roomId/messages/:messageId/pin', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { roomId, messageId } = req.params;
    const { isPinned } = req.body;

    const access = verifyConversationAccess(user.id, roomId);
    if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin' && access.role !== 'moderator')) {
      return res.status(403).json({ error: 'ليس لديك صلاحية تثبيت الرسائل' });
    }

    const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND conversation_id = ?').get(messageId, roomId) as any;
    if (!msg) return res.status(404).json({ error: 'الرسالة غير موجودة' });

    const newPinned = isPinned !== undefined ? (isPinned ? 1 : 0) : (msg.is_pinned ? 0 : 1);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE messages
      SET is_pinned = ?, pinned_by = ?, pinned_at = ?, updated_at = ?
      WHERE id = ?
    `).run(newPinned, newPinned ? user.name || 'مدير' : null, newPinned ? now : null, now, messageId);

    broadcastToRoom(roomId, {
      type: newPinned ? 'message_pinned' : 'message_unpinned',
      payload: {
        roomId,
        messageId,
        isPinned: !!newPinned,
        pinnedBy: user.name || 'مدير',
        pinnedAt: now,
        messageText: msg.body,
      },
    });

    res.json({ ok: true, isPinned: !!newPinned, messageId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 14. POST /api/chat/rooms/:roomId/read - Mark messages as read
chatRouter.post('/rooms/:roomId/read', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { roomId } = req.params;
    const now = new Date().toISOString();

    // Get unread message ids for this room not sent by current user
    const unreadMsgs = db.prepare(`
      SELECT m.id, m.sender_id FROM messages m
      WHERE m.conversation_id = ? AND m.sender_id != ?
        AND NOT EXISTS(SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?)
    `).all(roomId, user.id, user.id) as any[];

    for (const m of unreadMsgs) {
      db.prepare(`
        INSERT OR IGNORE INTO message_reads (message_id, user_id, read_at)
        VALUES (?, ?, ?)
      `).run(m.id, user.id, now);

      db.prepare("UPDATE messages SET status = 'read' WHERE id = ?").run(m.id);
    }

    if (unreadMsgs.length > 0) {
      broadcastToRoom(roomId, {
        type: 'messages_read',
        payload: {
          roomId,
          userId: user.id,
          readCount: unreadMsgs.length,
          readAt: now,
        },
      });
    }

    res.json({ ok: true, markedCount: unreadMsgs.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 15. Saved Messages APIs
chatRouter.get('/saved-messages', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const rows = db.prepare(`
      SELECT m.*, sm.saved_at, c.title as room_title, c.type as room_type, u.display_name as sender_real_name, u.avatar as sender_real_avatar
      FROM saved_messages sm
      JOIN messages m ON m.id = sm.message_id
      JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE sm.user_id = ?
      ORDER BY sm.saved_at DESC
    `).all(user.id) as any[];

    const savedMessages = rows.map((r) => ({
      id: r.id,
      roomId: r.conversation_id,
      roomTitle: r.room_title,
      senderId: r.sender_id,
      senderName: r.sender_name || r.sender_real_name || 'مستخدم',
      senderAvatar: r.sender_avatar || r.sender_real_avatar,
      text: r.body,
      body: r.body,
      mediaUrl: r.media_url,
      type: r.type,
      savedAt: r.saved_at,
      timestamp: r.created_at,
    }));

    res.json({ savedMessages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

chatRouter.post('/saved-messages/:messageId', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { messageId } = req.params;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR IGNORE INTO saved_messages (user_id, message_id, saved_at)
      VALUES (?, ?, ?)
    `).run(user.id, messageId, now);

    res.json({ ok: true, messageId, saved: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

chatRouter.delete('/saved-messages/:messageId', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { messageId } = req.params;
    db.prepare('DELETE FROM saved_messages WHERE user_id = ? AND message_id = ?').run(user.id, messageId);

    res.json({ ok: true, messageId, saved: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 16. Member Management APIs
chatRouter.post('/rooms/:roomId/members', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { roomId } = req.params;
    const { userId: targetUserId, role = 'member' } = req.body;

    const access = verifyConversationAccess(user.id, roomId);
    if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin' && access.role !== 'moderator')) {
      return res.status(403).json({ error: 'ليس لديك صلاحية إضافة أعضاء' });
    }

    const existing = db.prepare('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(roomId, targetUserId) as any;
    if (existing) {
      return res.status(409).json({ error: 'هذا المستخدم عضو بالفعل في الغرفة' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?)
    `).run(roomId, targetUserId, role, now);

    const targetUser = db.prepare('SELECT id, display_name as name, avatar, email FROM users WHERE id = ?').get(targetUserId) as any;

    broadcastToRoom(roomId, {
      type: 'member_added',
      payload: {
        roomId,
        member: {
          id: targetUser.id,
          name: targetUser.name || targetUser.email.split('@')[0],
          avatar: targetUser.avatar,
          role,
          joinedAt: now,
          isOnline: isUserOnline(targetUserId),
        },
      },
    });

    sendToUser(targetUserId, {
      type: 'room_invited',
      payload: { roomId },
    });

    res.json({ ok: true, message: 'تمت إضافة العضو بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

chatRouter.delete('/rooms/:roomId/members/:targetUserId', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { roomId, targetUserId } = req.params;

    const access = verifyConversationAccess(user.id, roomId);
    if (!access.allowed || (access.role !== 'owner' && access.role !== 'admin')) {
      return res.status(403).json({ error: 'ليس لديك صلاحية إزالة الأعضاء' });
    }

    db.prepare('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?').run(roomId, targetUserId);

    broadcastToRoom(roomId, {
      type: 'member_removed',
      payload: { roomId, userId: targetUserId },
    });

    res.json({ ok: true, message: 'تمت إزالة العضو بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

chatRouter.put('/rooms/:roomId/members/:targetUserId/role', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });

    const { roomId, targetUserId } = req.params;
    const { role } = req.body;

    const access = verifyConversationAccess(user.id, roomId);
    if (!access.allowed || access.role !== 'owner') {
      return res.status(403).json({ error: 'فقط مالك الغرفة يمكنه تعديل الأدوار' });
    }

    db.prepare('UPDATE conversation_members SET role = ? WHERE conversation_id = ? AND user_id = ?').run(role, roomId, targetUserId);

    broadcastToRoom(roomId, {
      type: 'member_role_changed',
      payload: { roomId, userId: targetUserId, role },
    });

    res.json({ ok: true, message: 'تم تحديث الدور بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 17. Search inside chat messages
chatRouter.get('/search', (req, res) => {
  try {
    const user = getAuthUser(req);
    const userId = user?.id || '';
    const query = String(req.query.q || '').trim();
    if (!query) return res.json({ results: [] });

    const sql = `
      SELECT m.*, c.title as room_title, c.type as room_type, u.display_name as sender_real_name, u.avatar as sender_real_avatar
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN users u ON u.id = m.sender_id
      LEFT JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
      WHERE (c.type = 'public' OR cm.user_id = ? OR c.creator_id = ?)
        AND m.is_deleted = 0
        AND m.body LIKE ?
      ORDER BY m.created_at DESC
      LIMIT 50
    `;

    const rows = db.prepare(sql).all(userId, userId, userId, `%${query}%`) as any[];

    const results = rows.map((r) => ({
      id: r.id,
      roomId: r.conversation_id,
      roomTitle: r.room_title,
      roomType: r.room_type,
      senderId: r.sender_id,
      senderName: r.sender_name || r.sender_real_name || 'مستخدم',
      senderAvatar: r.sender_avatar || r.sender_real_avatar,
      text: r.body,
      createdAt: r.created_at,
    }));

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
