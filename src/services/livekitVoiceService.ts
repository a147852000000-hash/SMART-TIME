import {
  LocalAudioTrack,
  Room,
  RoomEvent,
  ConnectionState,
} from 'livekit-client';
import { apiUrl } from './apiConfig';
import { authHeaders } from './authService';

export interface LiveKitVoiceSession {
  room: Room;
  track: LocalAudioTrack;
  roomName: string;
}

export async function connectLiveKitVoice(stream: MediaStream): Promise<LiveKitVoiceSession> {
  const response = await fetch(apiUrl('/api/voice/livekit-token'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(payload?.error || 'تعذر إنشاء جلسة الصوت.'));
    (error as Error & { code?: string }).code =
      response.status === 401 ? 'authentication-required' :
      response.status === 503 ? 'livekit-not-configured' :
      'livekit-token-failed';
    throw error;
  }

  const serverUrl = String(payload?.serverUrl || '').trim();
  const token = String(payload?.token || '').trim();
  const roomName = String(payload?.roomName || '').trim();
  if (!serverUrl || !token || !roomName) {
    throw new Error('LiveKit session configuration is incomplete.');
  }

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  try {
    await room.connect(serverUrl, token);
    if (room.state !== ConnectionState.Connected) {
      throw new Error('LiveKit connection did not reach connected state.');
    }

    const mediaTrack = stream.getAudioTracks()[0];
    if (!mediaTrack) throw new Error('No microphone track is available for LiveKit.');

    const track = new LocalAudioTrack(mediaTrack);
    await room.localParticipant.publishTrack(track);

    return { room, track, roomName };
  } catch (error) {
    try { await room.disconnect(); } catch {}
    throw error;
  }
}

export function disconnectLiveKitVoice(session: LiveKitVoiceSession | null) {
  if (!session) return;
  try { session.track.stop(); } catch {}
  try { session.room.disconnect(); } catch {}
}
