import React, { useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, ShieldCheck, Trash2, X, UserPlus, Share2, Volume2 } from "lucide-react";
import type { Language, SmartVoiceDnaRelationship, SmartVoiceDnaSpeakingStyle } from "../types";
import { acceptVoiceDnaShare, acknowledgeVoiceDnaSyncPackage, createVoiceDnaShare, listVoiceDnaShares, registerVoiceDnaProfile, revokeVoiceDnaProfile, revokeVoiceDnaShare, synthesizeVoiceDna, type VoiceDnaShareRecord } from "../services/smartVoiceDnaClient";
import { backupVoiceDnaSamplesForRecovery, createVoiceDnaRecoveryEnvelope, deleteVoiceDnaRecoveryEnvelope, ensureVoiceDnaPublicKeyRegistered, hasVoiceDnaRecoveryEnvelope, uploadEncryptedVoiceDnaPackage, listIncomingVoiceDnaPackages, decryptIncomingVoiceDnaPackage, restoreVoiceDnaFromRecovery, restoreVoiceDnaSamplesFromRecovery } from "../services/smartVoiceDnaCrypto";
import {
  createVoiceDnaId,
  deleteVoiceDnaProfile,
  listVoiceDnaProfiles,
  readVoiceDnaSample,
  saveVoiceDnaProfile,
  saveVoiceDnaSample,
  setDefaultVoiceDnaProfile,
  clearDefaultVoiceDnaProfile,
  type SmartVoiceDnaProfile,
} from "../services/smartVoiceDnaService";

interface Props {
  language: Language;
  onClose: () => void;
}

type RecordState = "idle" | "recording" | "saving";

const labels: Record<SmartVoiceDnaRelationship, { ar: string; en: string }> = {
  self: { ar: "أنا", en: "Me" },
  father: { ar: "أبي", en: "Father" },
  mother: { ar: "أمي", en: "Mother" },
  spouse: { ar: "الزوج/الزوجة", en: "Spouse" },
  son: { ar: "ابني", en: "Son" },
  daughter: { ar: "ابنتي", en: "Daughter" },
  family: { ar: "فرد من العائلة", en: "Family member" },
};

const CONSENT_PHRASE_AR = "أنا صاحب الصوت، وأوافق على إنشاء ملف صوتي خاص بي داخل SMART TIME.";
const CONSENT_PHRASE_EN = "I am the voice owner, and I consent to creating my private SMART TIME voice profile.";

export const SmartVoiceDnaPanel: React.FC<Props> = ({ language, onClose }) => {
  const [profiles, setProfiles] = useState<SmartVoiceDnaProfile[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [relationship, setRelationship] = useState<SmartVoiceDnaRelationship>("self");
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [speakingStyle, setSpeakingStyle] = useState<SmartVoiceDnaSpeakingStyle>("natural");
  const [isDefault, setIsDefault] = useState(false);
  const [shareTarget, setShareTarget] = useState<Record<string, string>>({});
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [incomingShares, setIncomingShares] = useState<VoiceDnaShareRecord[]>([]);
  const [outgoingShares, setOutgoingShares] = useState<VoiceDnaShareRecord[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryPassphrase, setRecoveryPassphrase] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [message, setMessage] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  const ar = language === "ar";
  const requiresGuardian = relationship === "son" || relationship === "daughter";

  useEffect(() => {
    void refreshProfiles();
    void refreshShares();
    void ensureVoiceDnaPublicKeyRegistered().catch(() => undefined);
    void refreshRecoveryStatus();
    return () => stopActiveRecorder();
  }, []);

  const refreshProfiles = async () => {
    try {
      setProfiles(await listVoiceDnaProfiles());
    } catch {
      setMessage(ar ? "تعذر فتح تخزين Voice DNA المحلي." : "Could not open local Voice DNA storage.");
    }
  };

  const refreshShares = async () => {
    try {
      const result = await listVoiceDnaShares();
      const incoming = result.incoming || [];
      setIncomingShares(incoming);
      setOutgoingShares(result.outgoing || []);

      const activeIncomingIds = new Set(
        incoming.filter((share) => share.status === "active").map((share) => share.id)
      );
      const localProfiles = await listVoiceDnaProfiles();
      const staleShared = localProfiles.filter(
        (profile) => profile.origin === "shared" && profile.shareId && !activeIncomingIds.has(profile.shareId)
      );
      for (const profile of staleShared) {
        await deleteVoiceDnaProfile(profile.id);
      }
      if (staleShared.length > 0) await refreshProfiles();
    } catch {
      // Sharing is optional; local Voice DNA remains usable when the server is offline.
    }
  };

  const stopActiveRecorder = () => {
    try {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    } catch {
      // no-op
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
  };

  const refreshRecoveryStatus = async () => {
    try { setRecoveryReady(await hasVoiceDnaRecoveryEnvelope()); } catch { setRecoveryReady(false); }
  };

  const configureRecovery = async () => {
    if (recoveryPassphrase.trim().length < 12) {
      setMessage(ar ? "مفتاح الاسترداد لازم يكون 12 حرف على الأقل." : "Recovery passphrase must be at least 12 characters.");
      return;
    }
    setRecoveryBusy(true);
    let envelopeCreated = false;
    try {
      await createVoiceDnaRecoveryEnvelope(recoveryPassphrase);
      envelopeCreated = true;
      setRecoveryReady(true);
      const backedUp = await backupVoiceDnaSamplesForRecovery(recoveryPassphrase);
      setRecoveryPassphrase("");
      setMessage(ar
        ? `تم إعداد الاسترداد وتحديث نسخة آمنة لـ ${backedUp} ملف صوتي.`
        : `Recovery is ready and ${backedUp} voice profile(s) were backed up securely.`);
    } catch (error: any) {
      if (envelopeCreated) {
        setRecoveryReady(true);
        setMessage(ar
          ? `تم إنشاء مفتاح الاسترداد، لكن النسخة الاحتياطية لم تكتمل: ${error?.message || "حاول تحديث النسخة مرة أخرى."}`
          : `The recovery key was created, but the backup did not finish: ${error?.message || "Refresh the backup and try again."}`);
      } else {
        setMessage(error?.message || (ar ? "تعذر إعداد الاسترداد." : "Could not configure recovery."));
      }
    } finally { setRecoveryBusy(false); }
  };

  const restoreRecovery = async () => {
    if (recoveryPassphrase.trim().length < 12) {
      setMessage(ar ? "اكتب مفتاح الاسترداد كاملًا." : "Enter your recovery passphrase.");
      return;
    }
    setRecoveryBusy(true);
    try {
      await restoreVoiceDnaFromRecovery(recoveryPassphrase);
      const restored = await restoreVoiceDnaSamplesFromRecovery(recoveryPassphrase);
      await refreshProfiles();
      setRecoveryPassphrase("");
      setRecoveryReady(true);
      setMessage(ar
        ? `تم استرداد المفتاح والملفات الصوتية: ${restored} ملف.`
        : `Recovery restored the key and ${restored} voice profile(s).`);
    } catch (error: any) {
      setMessage(error?.message || (ar ? "تعذر استرداد المفتاح." : "Could not restore the key."));
    } finally { setRecoveryBusy(false); }
  };

  const updateRecoveryBackup = async () => {
    if (recoveryPassphrase.trim().length < 12) {
      setMessage(ar ? "اكتب مفتاح الاسترداد لتحديث النسخة." : "Enter the recovery passphrase to refresh the backup.");
      return;
    }
    setRecoveryBusy(true);
    try {
      const backedUp = await backupVoiceDnaSamplesForRecovery(recoveryPassphrase);
      setRecoveryPassphrase("");
      setRecoveryReady(true);
      setMessage(ar ? `تم تحديث النسخة المشفّرة لـ ${backedUp} ملف صوتي.` : `Encrypted recovery backup updated for ${backedUp} voice profile(s).`);
    } catch (error: any) {
      setMessage(error?.message || (ar ? "تعذر تحديث النسخة." : "Could not refresh the backup."));
    } finally { setRecoveryBusy(false); }
  };

  const removeRecovery = async () => {
    setRecoveryBusy(true);
    try {
      await deleteVoiceDnaRecoveryEnvelope();
      setRecoveryReady(false);
      setMessage(ar ? "تم حذف نسخة استرداد Voice DNA من الخادم. مفتاح الجهاز الحالي ما زال محليًا." : "The server recovery envelope was deleted. The current device key remains local.");
    } catch (error: any) {
      setMessage(error?.message || (ar ? "تعذر حذف الاسترداد." : "Could not delete recovery."));
    } finally { setRecoveryBusy(false); }
  };

  const startRecording = async () => {
    setMessage("");
    if (!displayName.trim()) {
      setMessage(ar ? "اكتب اسمًا لملف الصوت أولًا." : "Enter a name for the voice profile first.");
      return;
    }
    if (!ownerConfirmed) {
      setMessage(ar ? "لازم صاحب الصوت يوافق بنفسه قبل التسجيل." : "The voice owner must consent before recording.");
      return;
    }
    if (requiresGuardian && !guardianConfirmed) {
      setMessage(ar ? "صوت الطفل يحتاج موافقة ولي الأمر." : "A child voice requires guardian consent.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMessage(ar ? "تسجيل الصوت غير مدعوم على هذا المتصفح." : "Audio recording is not supported by this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });

      chunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      startedAtRef.current = performance.now();
      setElapsedMs(0);
      setRecordState("recording");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const durationMs = Math.max(0, Math.round(performance.now() - startedAtRef.current));
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        streamRef.current = null;
        if (durationMs < 3000) {
          setRecordState("idle");
          setMessage(ar ? "التسجيل قصير جدًا. خليه 3 ثواني أو أكثر." : "The recording is too short. Record at least 3 seconds.");
          return;
        }

        setRecordState("saving");
        try {
          const profileId = createVoiceDnaId();
          const now = new Date().toISOString();
          const profile: SmartVoiceDnaProfile = {
            id: profileId,
            displayName: displayName.trim(),
            relationship,
            language: ar ? "ar" : "en",
            locale: ar ? "ar-EG" : "en-US",
            dialect: ar ? "ar-EG" : "en-US",
            speakingStyle,
            isDefault,
            consentMode: requiresGuardian ? "guardian" : "self",
            ownerConfirmed,
            guardianConfirmed: requiresGuardian ? guardianConfirmed : false,
            consentRecordedAt: now,
            createdAt: now,
            sampleDurationMs: durationMs,
            engineStatus: "pending_local_engine",
          };

          await saveVoiceDnaProfile(profile);
          await saveVoiceDnaSample(profileId, new Blob(chunksRef.current, { type: mimeType }), durationMs);
          try {
            await registerVoiceDnaProfile({
              id: profileId,
              displayName: profile.displayName,
              relationship: profile.relationship,
              language: profile.language,
              dialect: profile.dialect,
              speakingStyle: profile.speakingStyle,
              engineStatus: profile.engineStatus,
              ownerConfirmed: profile.ownerConfirmed,
              guardianConfirmed: profile.guardianConfirmed,
              consentRecordedAt: profile.consentRecordedAt,
            });
          } catch (registrationError) {
            await deleteVoiceDnaProfile(profileId).catch(() => undefined);
            throw registrationError;
          }
          if (isDefault) await setDefaultVoiceDnaProfile(profileId);
          await refreshProfiles();
          setRecordState("idle");
          setMessage(ar
            ? "تم حفظ ملف Voice DNA محليًا ومشفّرًا. لم يتم رفع الصوت إلى أي خدمة."
            : "Voice DNA was saved locally and encrypted. The recording was not uploaded to a service.");
          setDisplayName("");
          setOwnerConfirmed(false);
          setGuardianConfirmed(false);
          setSpeakingStyle("natural");
          setIsDefault(false);
        } catch (error) {
          console.error("Voice DNA save failed:", error);
          setRecordState("idle");
          setMessage(ar ? "تعذر حفظ ملف الصوت محليًا." : "Could not save the local voice profile.");
        }
      };

      recorder.start(250);
      const timer = window.setInterval(() => {
        const nextMs = Math.round(performance.now() - startedAtRef.current);
        setElapsedMs(nextMs);
        if (nextMs >= 30000 && recorder.state === "recording") recorder.stop();
      }, 250);

      recorder.addEventListener("stop", () => window.clearInterval(timer), { once: true });
    } catch (error) {
      console.error("Voice DNA microphone error:", error);
      stopActiveRecorder();
      setRecordState("idle");
      setMessage(ar ? "لم نقدر نفتح الميكروفون. راجع إذن الميكروفون في المتصفح." : "Microphone access failed. Check the browser microphone permission.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  const playVoiceDnaSample = async (profile: SmartVoiceDnaProfile) => {
    setPlayingId(profile.id);
    try {
      const sample = await readVoiceDnaSample(profile.id);
      if (!sample) throw new Error(ar ? "العينة المحلية غير موجودة." : "Local voice sample not found.");
      const phrase = ar
        ? "أهلاً، أنا صوتي الشخصي داخل SMART TIME. النهارده عندي حاجة مهمة أقولها لك."
        : "Hello, this is my personal voice inside SMART TIME. I have something important to tell you.";
      const audioBlob = await synthesizeVoiceDna({
        profileId: profile.id,
        text: phrase,
        speakingStyle: profile.speakingStyle,
        consentConfirmed: profile.ownerConfirmed && ((profile.relationship !== "son" && profile.relationship !== "daughter") || profile.guardianConfirmed),
        referenceText: ar ? CONSENT_PHRASE_AR : CONSENT_PHRASE_EN,
        referenceAudio: sample,
      });
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      const done = () => { URL.revokeObjectURL(url); setPlayingId(null); };
      audio.onended = done;
      audio.onerror = done;
      await audio.play();
    } catch (error: any) {
      setPlayingId(null);
      setMessage(error?.message || (ar ? "تعذر تشغيل Voice DNA. المحرك المحلي غير موصل." : "Voice DNA playback failed. The local engine is not connected."));
    }
  };

  const syncProfileToRecipient = async (profileId: string, share: VoiceDnaShareRecord) => {
    if (!share.recipientUserId) {
      setMessage(ar ? "بيانات المستلم ناقصة." : "Recipient data is incomplete.");
      return;
    }
    setSyncingId(share.id);
    try {
      const sample = await readVoiceDnaSample(profileId);
      if (!sample) throw new Error(ar ? "العينة الصوتية غير موجودة." : "Local voice sample not found.");
      await ensureVoiceDnaPublicKeyRegistered();
      await uploadEncryptedVoiceDnaPackage({ profileId, shareId: share.id, recipientUserId: share.recipientUserId, audio: sample });
      setMessage(ar ? "تمت مزامنة نسخة مشفّرة من الصوت." : "Encrypted voice copy synced.");
    } catch (error: any) {
      setMessage(error?.message || (ar ? "تعذر مزامنة الصوت." : "Voice sync failed."));
    } finally {
      setSyncingId(null);
    }
  };

  const syncIncomingPackages = async () => {
    setSyncingId("incoming");
    try {
      await ensureVoiceDnaPublicKeyRegistered();
      const packages = await listIncomingVoiceDnaPackages();
      for (const pkg of packages) {
        const profileId = "shared_" + String(pkg.profileId);
        const blob = await decryptIncomingVoiceDnaPackage(pkg);
        const profile: SmartVoiceDnaProfile = {
          id: profileId,
          displayName: String(pkg.displayName || "Shared Voice"),
          relationship: (pkg.relationship || "family") as SmartVoiceDnaRelationship,
          language: pkg.language === "en" ? "en" : "ar",
          locale: pkg.locale === "en-US" ? "en-US" : "ar-EG",
          dialect: pkg.dialect === "en-US" ? "en-US" : "ar-EG",
          speakingStyle: (pkg.speakingStyle || "natural") as SmartVoiceDnaSpeakingStyle,
          isDefault: false,
          consentMode: "self",
          ownerConfirmed: true,
          guardianConfirmed: false,
          consentRecordedAt: new Date().toISOString(),
          createdAt: String(pkg.createdAt || new Date().toISOString()),
          sampleDurationMs: 0,
          engineStatus: "pending_local_engine",
          origin: "shared",
          ownerUserId: pkg.ownerUserId,
          shareId: pkg.shareId,
        };
        await saveVoiceDnaProfile(profile);
        await saveVoiceDnaSample(profileId, blob, 0);
        await acknowledgeVoiceDnaSyncPackage(String(pkg.id));
      }
      await refreshProfiles();
      setMessage(packages.length
        ? (ar ? "تم استلام وفك تشفير الأصوات المشتركة على الجهاز." : "Shared voices were received and decrypted locally.")
        : (ar ? "مفيش أصوات جديدة للمزامنة." : "No new voice packages."));
    } catch (error: any) {
      setMessage(error?.message || (ar ? "تعذر مزامنة الأصوات الواردة." : "Incoming voice sync failed."));
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const profile = profiles.find((item) => item.id === id);
      if (!profile) return;

      if (profile.origin === "shared" && profile.shareId) {
        await revokeVoiceDnaShare(profile.shareId);
      } else {
        await revokeVoiceDnaProfile(id);
      }

      await deleteVoiceDnaProfile(id);
      if (profile.isDefault) await clearDefaultVoiceDnaProfile();
      await refreshProfiles();
      await refreshShares();
      setMessage(ar
        ? "تم حذف ملف Voice DNA وعينته المحلية وإلغاء صلاحية المشاركة."
        : "Voice DNA profile and local sample were deleted and access was revoked.");
    } catch (error: any) {
      setMessage(error?.message || (ar ? "تعذر حذف الملف." : "Could not delete the profile."));
    }
  };

  return (
    <div className="bg-slate-950 text-white rounded-3xl border border-purple-900/40 shadow-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-extrabold">
            <ShieldCheck className="w-5 h-5 text-purple-300" />
            <span>SMART VOICE DNA</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
            {ar
              ? "اصنع ملفًا صوتيًا بإذن صاحبه. في V1 التسجيل يظل محليًا ومشفّرًا، ومحرك الاستنساخ المحلي سيتم ربطه لاحقًا."
              : "Create a voice profile with the owner's consent. In V1 the recording stays local and encrypted; the local cloning engine will be connected later."}
          </p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" title="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid gap-3 mt-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
          <label className="block text-[11px] font-bold text-slate-300 mb-1">{ar ? "اسم الملف" : "Profile name"}</label>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs outline-none" placeholder={ar ? "مثال: صوتي / بابا / ماما" : "Example: Me / Dad / Mom"} />

          <label className="block text-[11px] font-bold text-slate-300 mt-3 mb-1">{ar ? "صلة القرابة" : "Relationship"}</label>
          <select value={relationship} onChange={(event) => {
            const next = event.target.value as SmartVoiceDnaRelationship;
            setRelationship(next);
            if (next !== "son" && next !== "daughter") setGuardianConfirmed(false);
          }} className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs outline-none">
            {Object.entries(labels).map(([id, label]) => (
              <option key={id} value={id}>{ar ? label.ar : label.en}</option>
            ))}
          </select>

          <label className="flex items-start gap-2 mt-3 text-[11px] text-slate-300 leading-relaxed">
            <input type="checkbox" checked={ownerConfirmed} onChange={(event) => setOwnerConfirmed(event.target.checked)} className="mt-0.5" />
            <span>{ar ? "أنا صاحب الصوت وقد وافقت بنفسي على إنشاء هذا الملف." : "I am the voice owner and I personally consent to this profile."}</span>
          </label>

          {requiresGuardian && (
            <label className="flex items-start gap-2 mt-2 text-[11px] text-slate-300 leading-relaxed">
              <input type="checkbox" checked={guardianConfirmed} onChange={(event) => setGuardianConfirmed(event.target.checked)} className="mt-0.5" />
              <span>{ar ? "أنا ولي الأمر وأوافق على إنشاء ملف صوت الطفل." : "I am the guardian and consent to the child's voice profile."}</span>
            </label>
          )}

          <label className="block text-[11px] font-bold text-slate-300 mt-3 mb-1">{ar ? "أسلوب الكلام" : "Speaking style"}</label>
          <select value={speakingStyle} onChange={(event) => setSpeakingStyle(event.target.value as SmartVoiceDnaSpeakingStyle)} className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs outline-none">
            <option value="natural">{ar ? "طبيعي" : "Natural"}</option>
            <option value="calm">{ar ? "هادئ" : "Calm"}</option>
            <option value="warm">{ar ? "دافئ" : "Warm"}</option>
            <option value="formal">{ar ? "رسمي" : "Formal"}</option>
            <option value="alert">{ar ? "تنبيه" : "Alert"}</option>
          </select>
          <label className="flex items-center gap-2 mt-3 text-[11px] text-slate-300">
            <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
            <span>{ar ? "استخدم هذا الصوت تلقائيًا مع SMART AI" : "Use this voice by default with SMART AI"}</span>
          </label>

          <div className="mt-3 rounded-xl bg-purple-500/10 border border-purple-400/20 p-2.5 text-[10px] leading-relaxed text-purple-100">
            <div className="font-bold mb-1">{ar ? "جملة الموافقة للتسجيل" : "Consent phrase"}</div>
            <div>{ar ? CONSENT_PHRASE_AR : CONSENT_PHRASE_EN}</div>
          </div>

          <button type="button" disabled={recordState === "saving"} onClick={recordState === "recording" ? stopRecording : () => void startRecording()} className="mt-3 w-full rounded-xl px-3 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 flex items-center justify-center gap-2 text-xs font-extrabold">
            {recordState === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            {recordState === "recording"
              ? (ar ? "إيقاف التسجيل" : "Stop recording") + " · " + (elapsedMs / 1000).toFixed(1) + "s"
              : recordState === "saving"
                ? (ar ? "جارٍ الحفظ..." : "Saving...")
                : (ar ? "تسجيل Voice DNA" : "Record Voice DNA")}
          </button>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-extrabold">{ar ? "ملفاتك الصوتية" : "Your voice profiles"}</div>
            <div className="text-[10px] text-slate-400">{profiles.length}</div>
          </div>
          <div className="space-y-2 mt-3 max-h-72 overflow-y-auto">
            {profiles.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-slate-400">
                {ar ? "لسه مفيش ملفات صوتية." : "No voice profiles yet."}
              </div>
            )}
            {profiles.map((profile) => (
              <div key={profile.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{profile.displayName}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {ar ? labels[profile.relationship].ar : labels[profile.relationship].en} · {(profile.sampleDurationMs / 1000).toFixed(1)}s
                    </div>
                  </div>
                  <button type="button" onClick={() => void handleDelete(profile.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-400/10" title={ar ? "حذف" : "Delete"}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-300">
                  <Check className="w-3.5 h-3.5" />
                  <span>{ar ? "محلي ومشفّر" : "Local and encrypted"}</span>
                </div>
                <div className="text-[10px] text-purple-200/90 mt-1">{profile.speakingStyle ? (ar ? `الأسلوب: ${profile.speakingStyle}` : `Style: ${profile.speakingStyle}`) : ""}</div>
                <div className="mt-3 border-t border-white/10 pt-3">
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">
                    {ar ? "مشاركة خاصة مع فرد من العائلة" : "Private family sharing"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={shareTarget[profile.id] || ""}
                      onChange={(event) => setShareTarget((current) => ({ ...current, [profile.id]: event.target.value }))}
                      className="flex-1 rounded-lg bg-black/20 border border-white/10 px-2.5 py-1.5 text-[10px] outline-none"
                      placeholder={ar ? "اسم المستخدم أو البريد الإلكتروني" : "Username or email"}
                    />
                    <button
                      type="button"
                      disabled={sharingId === profile.id || !String(shareTarget[profile.id] || "").trim()}
                      onClick={async () => {
                        const target = String(shareTarget[profile.id] || "").trim();
                        setSharingId(profile.id);
                        try {
                          await createVoiceDnaShare(profile.id, target);
                          setShareTarget((current) => ({ ...current, [profile.id]: "" }));
                          await refreshShares();
                          setMessage(ar ? "تم إرسال طلب مشاركة خاصة. الصوت نفسه لم يُرفع." : "Private share request sent. The voice sample was not uploaded.");
                        } catch (error: any) {
                          setMessage(error?.message || (ar ? "تعذر المشاركة." : "Sharing failed."));
                        } finally {
                          setSharingId(null);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-600 text-white text-[10px] font-bold disabled:opacity-50"
                    >
                      {sharingId === profile.id ? "…" : (ar ? "مشاركة" : "Share")}
                    </button>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1">
                    {ar ? "المشاركة تمنح صلاحية فقط؛ وعند المزامنة تنتقل نسخة مشفّرة لا يملك SMART TIME مفتاح فكها." : "Sharing grants access metadata only; secure sample sync transfers an encrypted copy that SMART TIME cannot decrypt."}
                  </div>
                </div>
                <div className="text-[10px] text-amber-200/90 mt-1">
                  {ar ? "محرك الصوت المحلي: يعمل فقط عند توصيل مزوّد VoiceTuT عبر الخادم." : "Local voice engine: available when a VoiceTuT provider is connected through the server."}
                </div>
                <button type="button" onClick={() => void playVoiceDnaSample(profile)} disabled={playingId === profile.id} className="mt-2 w-full rounded-lg border border-purple-400/30 px-2 py-1.5 text-[10px] font-bold text-purple-200 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" />{playingId === profile.id ? "…" : (ar ? "تجربة الصوت" : "Test voice")}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

<div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-extrabold"><UserPlus className="w-4 h-4 text-purple-300" />{ar ? "دعوات واردة" : "Incoming invitations"}</div><button type="button" onClick={() => void syncIncomingPackages()} disabled={syncingId === "incoming"} className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[9px] font-bold disabled:opacity-50">{syncingId === "incoming" ? "…" : (ar ? "مزامنة" : "Sync")}</button></div>
          <div className="space-y-2 mt-3">
            {incomingShares.length === 0 && <div className="text-[10px] text-slate-500">{ar ? "مفيش دعوات مشاركة حاليًا." : "No incoming voice invitations."}</div>}
            {incomingShares.map((share) => (
              <div key={share.id} className="rounded-xl border border-white/10 bg-black/10 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold truncate">{share.displayName}</div>
                    <div className="text-[9px] text-slate-500">{share.ownerUsername || ""}</div>
                  </div>
                  <span className="text-[9px] text-amber-200">{share.status}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-slate-500">{share.ownerUsername || ""}</span>
              </div>
              {share.status === "active" && (
                <button type="button" onClick={() => void syncIncomingPackages()} disabled={syncingId === "incoming"} className="mt-2 w-full rounded-lg bg-purple-600 px-2 py-1.5 text-[10px] font-bold disabled:opacity-50">
                  {syncingId === "incoming" ? "…" : (ar ? "استلام الصوت المشفّر" : "Receive encrypted voice")}
                </button>
              )}
                {share.status === "pending" && (
                  <button type="button" onClick={async () => {
                    try {
                      await acceptVoiceDnaShare(share.id);
                      await refreshShares();
                      setMessage(ar ? "تم قبول مشاركة الصوت." : "Voice share accepted.");
                    } catch (error: any) {
                      setMessage(error?.message || (ar ? "تعذر قبول المشاركة." : "Could not accept the share."));
                    }
                  }} className="mt-2 w-full rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold">{ar ? "قبول" : "Accept"}</button>
                )}
                {share.status === "active" && (
                  <button type="button" onClick={async () => {
                    try {
                      await revokeVoiceDnaShare(share.id);
                      await refreshShares();
                      setMessage(ar ? "تم إلغاء الوصول لهذا الصوت." : "Access to this voice was revoked.");
                    } catch (error: any) {
                      setMessage(error?.message || (ar ? "تعذر إلغاء الوصول." : "Could not revoke access."));
                    }
                  }} className="mt-2 w-full rounded-lg border border-rose-400/20 px-2 py-1.5 text-[10px] font-bold text-rose-200">{ar ? "إلغاء الوصول" : "Revoke access"}</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2 text-xs font-extrabold"><Share2 className="w-4 h-4 text-purple-300" />{ar ? "المشاركات الصادرة" : "Outgoing shares"}</div>
          <div className="space-y-2 mt-3">
            {outgoingShares.length === 0 && <div className="text-[10px] text-slate-500">{ar ? "مفيش مشاركات صادرة." : "No outgoing shares."}</div>}
            {outgoingShares.map((share) => (
              <div key={share.id} className="rounded-xl border border-white/10 bg-black/10 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold truncate">{share.displayName}</div>
                    <div className="text-[9px] text-slate-500">{share.recipientUsername || ""}</div>
                  </div>
                  <span className="text-[9px] text-amber-200">{share.status}</span>
                </div>
                {share.status === "active" && (
                  <button type="button" disabled={syncingId === share.id} onClick={() => void syncProfileToRecipient(share.profileId, share)} className="mt-2 w-full rounded-lg bg-purple-600 px-2 py-1.5 text-[10px] font-bold disabled:opacity-50">
                    {syncingId === share.id ? "…" : (ar ? "مزامنة الصوت المشفّر" : "Sync encrypted voice")}
                  </button>
                )}
                {share.status !== "revoked" && (
                  <button type="button" onClick={async () => {
                    try {
                      await revokeVoiceDnaShare(share.id);
                      const localProfiles = await listVoiceDnaProfiles();
                      for (const profile of localProfiles) {
                        if (profile.origin === "shared" && profile.shareId === share.id) {
                          await deleteVoiceDnaProfile(profile.id);
                        }
                      }
                      await refreshShares();
                      await refreshProfiles();
                      setMessage(ar ? "تم إلغاء مشاركة الصوت ومسح النسخة المحلية." : "Voice share revoked and the local shared copy was removed.");
                    } catch (error: any) {
                      setMessage(error?.message || (ar ? "تعذر إلغاء المشاركة." : "Could not revoke the share."));
                    }
                  }} className="mt-2 w-full rounded-lg border border-rose-400/20 px-2 py-1.5 text-[10px] font-bold text-rose-200">{ar ? "إلغاء المشاركة" : "Revoke share"}</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold">{ar ? "استرداد Voice DNA على جهاز جديد" : "Voice DNA device recovery"}</div>
            <div className="text-[9px] text-slate-400 mt-1">
              {ar ? "نسخة المفتاح مشفّرة بكلمة مرور استرداد لا يتم إرسالها للخادم." : "The recovery key is encrypted with a passphrase that is never sent to the server."}
            </div>
          </div>
          <span className={recoveryReady ? "text-[9px] font-bold text-emerald-300" : "text-[9px] font-bold text-slate-500"}>
            {recoveryReady ? (ar ? "مفعل" : "Ready") : (ar ? "غير مفعل" : "Not set")}
          </span>
        </div>
        <input
          type="password"
          value={recoveryPassphrase}
          onChange={(event) => setRecoveryPassphrase(event.target.value)}
          className="mt-3 w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-[11px] outline-none"
          placeholder={ar ? "كلمة مرور استرداد طويلة (12+ حرف)" : "Long recovery passphrase (12+ chars)"}
          autoComplete="new-password"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
          <button type="button" onClick={() => void configureRecovery()} disabled={recoveryBusy} className="rounded-lg bg-cyan-600 px-2 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">
            {ar ? "إعداد/تدوير" : "Set / rotate"}
          </button>
          <button type="button" onClick={() => void updateRecoveryBackup()} disabled={recoveryBusy || !recoveryReady} className="rounded-lg bg-purple-600 px-2 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">
            {ar ? "تحديث النسخة" : "Refresh backup"}
          </button>
          <button type="button" onClick={() => void restoreRecovery()} disabled={recoveryBusy || !recoveryReady} className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">
            {ar ? "استرداد الجهاز" : "Restore device"}
          </button>
          <button type="button" onClick={() => void removeRecovery()} disabled={recoveryBusy || !recoveryReady} className="rounded-lg border border-rose-400/20 px-2 py-1.5 text-[10px] font-bold text-rose-200 disabled:opacity-50">
            {ar ? "حذف النسخة" : "Delete backup"}
          </button>
        </div>
        <div className="text-[9px] text-cyan-100/70 mt-2 leading-relaxed">
          {ar ? "إعداد الاسترداد يولّد مفتاح مزامنة جديدًا. الحزم القديمة المشفّرة بالمفتاح السابق تحتاج إعادة مزامنة من صاحب الصوت." : "Setting recovery creates a new sync key. Packages encrypted to the previous key need to be re-synced by the voice owner."}
        </div>
      </div>

      {message && <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-200">{message}</div>}
    </div>
  );
};
