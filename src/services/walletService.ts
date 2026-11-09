import { apiUrl } from './apiConfig';
import { getStoredSession, authHeaders } from './authService';

export interface WalletInfo {
  balance: number;
  tripCost: number;
  isOwner?: boolean;
  walletNumber?: string;
  instapayAddress?: string;
  topupMin?: number;
  topupMax?: number;
}

export interface WalletTransaction {
  id: string;
  amount: number;
  type: 'topup' | 'trip_search' | string;
  reference?: string;
  balance_after: number;
  created_at: string;
}

export interface TopupRequest {
  id: string;
  amount: number;
  method: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(options.headers as any || {}),
  };
  const res = await fetch(apiUrl(path), { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.error || 'حدث خطأ في خدمة المحفظة');
    err.code = data.code;
    err.balance = data.balance;
    err.required = data.required;
    throw err;
  }
  return data;
}

export const WalletService = {
  // جلب رصيد المستخدم الحالي
  getMyWallet(): Promise<WalletInfo> {
    return request('/api/wallet/me');
  },

  // إرسال طلب شحن رصيد بعد تحويل يدوي (فودافون كاش، إنستاباي...)
  requestTopup(amount: number, method: string, note: string) {
    return request('/api/wallet/topup-request', {
      method: 'POST',
      body: JSON.stringify({ amount, method, note }),
    });
  },

  // جلب طلبات الشحن الخاصة بالمستخدم وحالتها
  getMyTopupRequests(): Promise<{ requests: TopupRequest[] }> {
    return request('/api/wallet/topup-requests/mine');
  },

  getMyTransactions(): Promise<{ transactions: WalletTransaction[] }> {
    return request('/api/wallet/transactions');
  },

  // --- خاص بصاحب البرنامج فقط ---
  getPendingTopups(status: string = 'pending') { return request(`/api/admin/wallet/topups?status=${encodeURIComponent(status)}`); },
  getAdminSummary(): Promise<any> { return request('/api/admin/wallet/summary'); },
  getAdminTopups(status: string = 'pending', q = '') { return request(`/api/admin/wallet/topups?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}&limit=200`); },
  getAdminUsers(q = '') { return request(`/api/admin/wallet/users?q=${encodeURIComponent(q)}&limit=200`); },
  getAdminAudit() { return request('/api/admin/wallet/audit?limit=200'); },
  approveTopup(id: string, note = '') { return request(`/api/admin/wallet/topups/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }); },
  rejectTopup(id: string, note = '') { return request(`/api/admin/wallet/topups/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }); },
};
