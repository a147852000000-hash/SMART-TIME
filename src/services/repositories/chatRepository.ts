import { ChatRoom, ChatMessage, AiMessage } from '../../types';
import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import { DEFAULT_CHAT_ROOMS, DEFAULT_CHAT_MESSAGES, DEFAULT_AI_MESSAGES } from '../seedData';

export class ChatRepository {
  // Chat Rooms
  static getChatRooms(): ChatRoom[] {
    return StorageAdapter.getItem<ChatRoom[]>(STORAGE_KEYS.CHAT_ROOMS, DEFAULT_CHAT_ROOMS);
  }

  static saveChatRooms(rooms: ChatRoom[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.CHAT_ROOMS, rooms);
  }

  // Chat Messages
  static getChatMessages(): ChatMessage[] {
    return StorageAdapter.getItem<ChatMessage[]>(STORAGE_KEYS.CHAT_MESSAGES, DEFAULT_CHAT_MESSAGES);
  }

  static saveChatMessages(messages: ChatMessage[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.CHAT_MESSAGES, messages);
  }

  static addChatMessage(message: ChatMessage): ChatMessage[] {
    const list = this.getChatMessages();
    const updated = [...list, message];
    this.saveChatMessages(updated);
    return updated;
  }

  // AI Chat History
  static getAiChatHistory(): AiMessage[] {
    return StorageAdapter.getItem<AiMessage[]>(STORAGE_KEYS.AI_CHAT_HISTORY, DEFAULT_AI_MESSAGES);
  }

  static saveAiChatHistory(messages: AiMessage[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.AI_CHAT_HISTORY, messages);
  }

  static clearAiChatHistory(): void {
    StorageAdapter.setItem(STORAGE_KEYS.AI_CHAT_HISTORY, []);
  }
}
