<<<<<<< Updated upstream
// src/pages/TeleApplyWizard.jsx
// 변경 요약
// 1) 기능 선택을 체크박스→라디오(택1)로 변경
// 2) 예약 생성 성공 시 → /reservation/confirm/:reservationId 로 이동
//    (state로 interpretationOption 전달 + memo도 함께 전달)
// 3) 디버그 로그 추가(주민번호 저장/예약 생성)

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../auth/axios";
import "./session.css";
import "./tele-apply.css";

/* ---------------- 시간 유틸 (KST) ---------------- */
function nowKST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}
function makeKST(dateLike, h, m) {
  const base = new Date(new Date(dateLike).toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  base.setHours(h, m, 0, 0);
  return base;
}
function generateSlotsKST(dateLike) {
  const slots = [];
  const pushSlot = (h, m) => {
    const start = makeKST(dateLike, h, m);
    const end = new Date(start);
    end.setMinutes(start.getMinutes() + 30);
    const pad = (x) => String(x).padStart(2, "0");
    const label = `${pad(start.getHours())}:${pad(start.getMinutes())}~${pad(end.getHours())}:${pad(end.getMinutes())}`;
    slots.push({ label, start, end });
  };
  for (let h = 10; h < 12; h++) { pushSlot(h, 0); pushSlot(h, 30); }
  for (let h = 13; h < 17; h++) { pushSlot(h, 0); pushSlot(h, 30); }
  return slots;
}
function roundUpToNextHalfKST(kstNow) {
  const n = new Date(kstNow);
  const m = n.getMinutes();
  if (m === 0 || m === 30) return n;
  if (m < 30) n.setMinutes(30, 0, 0);
  else n.setHours(n.getHours() + 1, 0, 0, 0);
  return n;
}

/* ---------------- 매핑 ---------------- */
const SYMPTOM_TO_ENUM = {
  "기침": "COUGH",
  "가래": "SPUTUM",
  "코막힘": "NOSE",
  "두통": "HEADACHE",
  "발열": "FEVER",
};
function featureModeToOptions(mode) {
  if (mode === "voice") return ["VOICE_TO_TEXT"];
  if (mode === "voice+sign") return ["VOICE_TO_TEXT", "SIGN_TO_TEXT"];
  return [];
}

/* ---------------- 스텝 표시 ---------------- */
function Stepper({ step }) {
  return (
    <div className="apply__stepper" aria-label="신청 단계">
      {[1,2,3,4].map((n) => (
        <span key={n} className={`apply__dot ${step === n ? "is-active" : step > n ? "is-done" : ""}`} />
      ))}
    </div>
  );
}

/* ---------------- 메인 ---------------- */
export default function TeleApplyWizard() {
  const { doctorId } = useParams();
  const nav = useNavigate();
  const [step, setStep] = useState(1);

  // 의사/병원 (목업)
  const doc = useMemo(() => ({
    id: doctorId,
    hospital: "이화여대 내과 병원",
    dept: "내과",
    name: "이하은 의사",
  }), [doctorId]);

  /* STEP 1: 본인확인(주민번호) */
  const [rrnFront, setRrnFront] = useState("");
  const [rrnBackRaw, setRrnBackRaw] = useState("");
  const rrnValid = rrnFront.length === 6 && rrnBackRaw.length === 7;
  const maskBack = (s) => (s ? s[0] + "*".repeat(Math.max(0, s.length - 1)) : "");
  const handleBackKeyDown = (e) => {
    const k = e.key;
    if (["Tab","ArrowLeft","ArrowRight","Home","End"].includes(k)) return;
    if (k === "Backspace") { if (rrnBackRaw.length) setRrnBackRaw(rrnBackRaw.slice(0, -1)); e.preventDefault(); return; }
    if (k === "Delete") { setRrnBackRaw(""); e.preventDefault(); return; }
    if (/^\d$/.test(k)) { if (rrnBackRaw.length < 7) setRrnBackRaw(rrnBackRaw + k); e.preventDefault(); return; }
    e.preventDefault();
  };
  const handleBackPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 7);
    setRrnBackRaw(pasted);
  };

  /* STEP 2: 시간 선택 (KST) */
  const [dayTab, setDayTab] = useState("today");
  const [slot, setSlot] = useState("");
  const kstNow = nowKST();
  const todaySlots = useMemo(() => {
    const base = generateSlotsKST(kstNow);
    const cutoff = roundUpToNextHalfKST(kstNow);
    return base.map((s) => ({ ...s, disabled: s.start < cutoff }));
  }, [kstNow]);
  const tomorrowSlots = useMemo(() => {
    const t = new Date(kstNow); t.setDate(t.getDate() + 1);
    return generateSlotsKST(t);
  }, [kstNow]);
  const slots = dayTab === "today" ? todaySlots : tomorrowSlots;

  /* STEP 3: 기능 선택 (라디오 택1) */
  const [featureMode, setFeatureMode] = useState(null); // 'voice' | 'voice+sign'
  const featureValid = featureMode === "voice" || featureMode === "voice+sign";

  /* STEP 4: 증상 */
  const [symptom, setSymptom] = useState("두통");
  const [duration, setDuration] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [memo, setMemo] = useState("");

  const onNext = () => setStep((s) => Math.min(4, s + 1));
  const onPrev = () => setStep((s) => Math.max(1, s - 1));

  // 신청하기: 주민번호 저장 → 예약 생성 → 예약확인 이동
  const onSubmit = async () => {
    if (!rrnValid) return alert("주민등록번호를 올바르게 입력해 주세요.");
    if (!slot) return alert("진료 시간을 선택해 주세요.");
    if (!featureValid) return alert("원하는 기능을 선택해 주세요.");

    try {
      // 1) 주민번호 저장
      const residentId = `${rrnFront}-${rrnBackRaw}`;
      const saveRes = await api.post("/api/v2/user/resident-id", { residentId });
      console.log("[DEBUG] 주민번호 저장 응답:", saveRes.data);

      // 2) 시간/날짜 파싱
      const [startStr, endStr] = slot.split("~");
      const baseDate = new Date(kstNow);
      if (dayTab === "tomorrow") baseDate.setDate(baseDate.getDate() + 1);
      const slotDate = baseDate.toISOString().slice(0, 10);

      // 3) 기능/증상 매핑
      const interpretationOption = featureModeToOptions(featureMode);
      const symptomEnum = SYMPTOM_TO_ENUM[symptom] ?? "HEADACHE";
      const symptomDuration = unknown ? null : Number(duration || 0);
      const trimmedMemo = (memo || "").trim();

      // 4) 예약 생성
      const payload = {
        doctorProfileId: Number(doc.id ?? 1),
        slotDate,
        startTime: startStr,
        endTime: endStr,
        symptom: symptomEnum,
        symptomDuration,
        description: trimmedMemo || null,
        interpretationOption,
      };
      console.log("[DEBUG] 예약 생성 요청 payload:", payload);

      const { data } = await api.post("/api/v2/reservation", payload);
      console.log("[DEBUG] 예약 생성 응답:", data);

      const reservationId = data?.results?.reservationId;
      if (!reservationId) {
        alert("예약 생성 실패: reservationId 없음");
        return;
      }

      // 🔒 새로고침/직접 진입 대비: 세션에 백업 저장
      try {
  sessionStorage.setItem(`lastMemo:${reservationId}`, trimmedMemo);
} catch (e) {
  // 세션 저장 실패(사파리 프라이빗 모드 등)는 무시
  console.debug?.("[Storage] setItem failed", e);
}


      // 예약 확인 화면으로 이동 + 선택 옵션/메모 전달
      nav(`/reservation/confirm/${reservationId}`, {
        state: { interpretationOption, memo: trimmedMemo },
      });
    } catch (err) {
      console.error("[ERROR] 예약 신청 중 오류:", err);
      alert("요청 처리 중 오류가 발생했어요.");
    }
  };

  return (
    <div className="telemed apply">
      <Sidebar />
      <main className="apply__main">
        <Stepper step={step} />

        <section className="apply__card">
          <h1 className="apply__title">진료 신청</h1>
          <div className="apply__hospital">
            <span className="apply__dept">{doc.dept}</span>
            <span className="apply__bullet">·</span>
            <span className="apply__hname">{doc.hospital}</span>
          </div>

          {/* STEP 1: 본인확인 */}
          {step === 1 && (
            <div className="apply__body">
              <p className="apply__desc">진료 신청을 위해 주민등록번호 입력이 필요합니다.</p>
              <div className="apply__label">주민등록 번호 입력</div>
              <div className="apply__rrn">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={rrnFront}
                  onChange={(e) => setRrnFront(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <span className="dash">—</span>
                <input
                  className="backAll"
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="*******"
                  value={maskBack(rrnBackRaw)}
                  onKeyDown={handleBackKeyDown}
                  onPaste={handleBackPaste}
                  readOnly
                />
              </div>
              <div className="apply__actions">
                <button className="btn-primary" onClick={onNext} disabled={!rrnValid} aria-disabled={!rrnValid}>
                  다음 단계 ▸
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: 시간 선택 */}
          {step === 2 && (
            <div className="apply__body">
              <div className="apply__tabs">
                <button className={`tab ${dayTab === "today" ? "is-active" : ""}`} onClick={() => { setDayTab("today"); setSlot(""); }}>
                  오늘
                </button>
                <button className={`tab ${dayTab === "tomorrow" ? "is-active" : ""}`} onClick={() => { setDayTab("tomorrow"); setSlot(""); }}>
                  내일
                </button>
              </div>

              <div className="apply__grid">
                {slots.map((s) => {
                  const selected = slot === s.label;
                  return (
                    <button
                      key={s.label}
                      className={`slot ${selected ? "is-selected" : ""}`}
                      disabled={s.disabled}
                      onClick={() => setSlot(s.label)}
                      title={s.disabled ? "선택 불가한 시간대입니다" : s.label}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>

              <ul className="apply__notes">
                <li>대한민국 시간(Asia/Seoul) 기준입니다.</li>
                <li>12:00~13:00 점심시간 제외.</li>
                <li>예약 시간은 30분 간격입니다.</li>
              </ul>

              <div className="apply__nav">
                <button className="btn-ghost" onClick={onPrev}>◂ 이전 단계</button>
                <button className="btn-primary" onClick={onNext} disabled={!slot}>다음 단계 ▸</button>
              </div>
            </div>
          )}

          {/* STEP 3: 기능 선택 (라디오 택1) */}
          {step === 3 && (
            <div className="resv__form">
              <div className="form__row">
                <label className="form__label">
                  원하는 기능 선택 <span className="hint">택 1 (필수)</span>
                </label>

                <div className="feature__group" role="radiogroup" aria-label="기능 선택">
                  <label className="feature__item">
                    <input
                      type="radio"
                      name="featureMode"
                      value="voice"
                      checked={featureMode === "voice"}
                      onChange={() => setFeatureMode("voice")}
                    />
                    <div className="feature__text">
                      <span className="feature__title">음성 → 텍스트</span>
                      <p className="feature__desc">의사/환자 음성을 자막으로 보여줍니다.</p>
                    </div>
                  </label>

                  <label className="feature__item">
                    <input
                      type="radio"
                      name="featureMode"
                      value="voice+sign"
                      checked={featureMode === "voice+sign"}
                      onChange={() => setFeatureMode("voice+sign")}
                    />
                    <div className="feature__text">
                      <span className="feature__title">음성 → 텍스트 + 수어 → 텍스트</span>
                      <p className="feature__desc">음성 자막에 수어 인식 텍스트를 추가로 제공합니다.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="resv__row" style={{ justifyContent: "space-between" }}>
                <button className="btn-ghost" onClick={onPrev}>◂ 이전 단계</button>
                <button className="btn-primary" onClick={onNext} disabled={!featureValid}>다음 단계 ▸</button>
              </div>
            </div>
          )}

          {/* STEP 4: 증상 */}
          {step === 4 && (
            <div className="apply__body">
              <div className="apply__fieldset">
                <div className="apply__legend">증상 선택</div>
                <div className="apply__chips">
                  {["기침","가래","코막힘","두통","발열"].map((s) => (
                    <label key={s} className={`chip ${symptom === s ? "is-on" : ""}`}>
                      <input type="radio" name="symptom" value={s} checked={symptom === s} onChange={() => setSymptom(s)} />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="apply__fieldset">
                <div className="apply__legend">증상 지속 기간</div>
                <div className="apply__duration">
                  <input
                    className="num"
                    inputMode="numeric"
                    maxLength={2}
                    value={unknown ? "" : duration}
                    onChange={(e) => setDuration(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    disabled={unknown}
                  />
                  <span>일</span>
                  <label className="chk">
                    <input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} />
                    잘 모르겠습니다
                  </label>
                </div>
              </div>

              <div className="apply__fieldset">
                <div className="apply__legend">기타 증상 (선택)</div>
                <textarea rows={5} placeholder="증상을 구체적으로 적어주세요." value={memo} onChange={(e) => setMemo(e.target.value)} />
              </div>

              <div className="apply__nav">
                <button className="btn-ghost" onClick={onPrev}>◂ 이전 단계</button>
                <button className="btn-primary" onClick={onSubmit}>신청하기</button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
=======
// src/pages/TeleApplyWizard.jsx
// 변경 요약
// 1) 기능 선택을 체크박스→라디오(택1)로 변경
// 2) 예약 생성 성공 시 → /reservation/confirm/:reservationId 로 이동
//    (state로 interpretationOption 전달 + memo도 함께 전달)
// 3) 디버그 로그 추가(주민번호 저장/예약 생성)

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../auth/axios";
import "./session.css";
import "./tele-apply.css";

/* ---------------- 시간 유틸 (KST) ---------------- */
function nowKST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}
function makeKST(dateLike, h, m) {
  const base = new Date(new Date(dateLike).toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  base.setHours(h, m, 0, 0);
  return base;
}
function generateSlotsKST(dateLike) {
  const slots = [];
  const pushSlot = (h, m) => {
    const start = makeKST(dateLike, h, m);
    const end = new Date(start);
    end.setMinutes(start.getMinutes() + 30);
    const pad = (x) => String(x).padStart(2, "0");
    const label = `${pad(start.getHours())}:${pad(start.getMinutes())}~${pad(end.getHours())}:${pad(end.getMinutes())}`;
    slots.push({ label, start, end });
  };
  for (let h = 10; h < 12; h++) { pushSlot(h, 0); pushSlot(h, 30); }
  for (let h = 13; h < 17; h++) { pushSlot(h, 0); pushSlot(h, 30); }
  return slots;
}
function roundUpToNextHalfKST(kstNow) {
  const n = new Date(kstNow);
  const m = n.getMinutes();
  if (m === 0 || m === 30) return n;
  if (m < 30) n.setMinutes(30, 0, 0);
  else n.setHours(n.getHours() + 1, 0, 0, 0);
  return n;
}

/* ---------------- 매핑 ---------------- */
const SYMPTOM_TO_ENUM = {
  "기침": "COUGH",
  "가래": "SPUTUM",
  "코막힘": "NOSE",
  "두통": "HEADACHE",
  "발열": "FEVER",
};
function featureModeToOptions(mode) {
  if (mode === "voice") return ["VOICE_TO_TEXT"];
  if (mode === "voice+sign") return ["VOICE_TO_TEXT", "SIGN_TO_TEXT"];
  return [];
}

/* ---------------- 스텝 표시 ---------------- */
function Stepper({ step }) {
  return (
    <div className="apply__stepper" aria-label="신청 단계">
      {[1,2,3,4].map((n) => (
        <span key={n} className={`apply__dot ${step === n ? "is-active" : step > n ? "is-done" : ""}`} />
      ))}
    </div>
  );
}

/* ---------------- 메인 ---------------- */
export default function TeleApplyWizard() {
  const { doctorId } = useParams();
  const nav = useNavigate();
  const [step, setStep] = useState(1);

  // 의사/병원 (목업)
  const doc = useMemo(() => ({
    id: doctorId,
    hospital: "이화여대 내과 병원",
    dept: "내과",
    name: "이하은 의사",
  }), [doctorId]);

  /* STEP 1: 본인확인(주민번호) */
  const [rrnFront, setRrnFront] = useState("");
  const [rrnBackRaw, setRrnBackRaw] = useState("");
  const rrnValid = rrnFront.length === 6 && rrnBackRaw.length === 7;
  const maskBack = (s) => (s ? s[0] + "*".repeat(Math.max(0, s.length - 1)) : "");
  const handleBackKeyDown = (e) => {
    const k = e.key;
    if (["Tab","ArrowLeft","ArrowRight","Home","End"].includes(k)) return;
    if (k === "Backspace") { if (rrnBackRaw.length) setRrnBackRaw(rrnBackRaw.slice(0, -1)); e.preventDefault(); return; }
    if (k === "Delete") { setRrnBackRaw(""); e.preventDefault(); return; }
    if (/^\d$/.test(k)) { if (rrnBackRaw.length < 7) setRrnBackRaw(rrnBackRaw + k); e.preventDefault(); return; }
    e.preventDefault();
  };
  const handleBackPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 7);
    setRrnBackRaw(pasted);
  };

  /* STEP 2: 시간 선택 (KST) */
  const [dayTab, setDayTab] = useState("today");
  const [slot, setSlot] = useState("");
  const kstNow = nowKST();
  const todaySlots = useMemo(() => {
    const base = generateSlotsKST(kstNow);
    const cutoff = roundUpToNextHalfKST(kstNow);
    return base.map((s) => ({ ...s, disabled: s.start < cutoff }));
  }, [kstNow]);
  const tomorrowSlots = useMemo(() => {
    const t = new Date(kstNow); t.setDate(t.getDate() + 1);
    return generateSlotsKST(t);
  }, [kstNow]);
  const slots = dayTab === "today" ? todaySlots : tomorrowSlots;

  /* STEP 3: 기능 선택 (라디오 택1) */
  const [featureMode, setFeatureMode] = useState(null); // 'voice' | 'voice+sign'
  const featureValid = featureMode === "voice" || featureMode === "voice+sign";

  /* STEP 4: 증상 */
  const [symptom, setSymptom] = useState("두통");
  const [duration, setDuration] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [memo, setMemo] = useState("");

  const onNext = () => setStep((s) => Math.min(4, s + 1));
  const onPrev = () => setStep((s) => Math.max(1, s - 1));

  // 신청하기: 주민번호 저장 → 예약 생성 → 예약확인 이동
  const onSubmit = async () => {
    if (!rrnValid) return alert("주민등록번호를 올바르게 입력해 주세요.");
    if (!slot) return alert("진료 시간을 선택해 주세요.");
    if (!featureValid) return alert("원하는 기능을 선택해 주세요.");

    try {
      // 1) 주민번호 저장
      const residentId = `${rrnFront}-${rrnBackRaw}`;
      const saveRes = await api.post("/api/v2/user/resident-id", { residentId });
      console.log("[DEBUG] 주민번호 저장 응답:", saveRes.data);

      // 2) 시간/날짜 파싱
      const [startStr, endStr] = slot.split("~");
      const baseDate = new Date(kstNow);
      if (dayTab === "tomorrow") baseDate.setDate(baseDate.getDate() + 1);
      const slotDate = baseDate.toISOString().slice(0, 10);

      // 3) 기능/증상 매핑
      const interpretationOption = featureModeToOptions(featureMode);
      const symptomEnum = SYMPTOM_TO_ENUM[symptom] ?? "HEADACHE";
      const symptomDuration = unknown ? null : Number(duration || 0);
      const trimmedMemo = (memo || "").trim();

      // 4) 예약 생성
      const payload = {
        doctorProfileId: Number(doc.id ?? 1),
        slotDate,
        startTime: startStr,
        endTime: endStr,
        symptom: symptomEnum,
        symptomDuration,
        description: trimmedMemo || null,
        interpretationOption,
      };
      console.log("[DEBUG] 예약 생성 요청 payload:", payload);

      const { data } = await api.post("/api/v2/reservation", payload);
      console.log("[DEBUG] 예약 생성 응답:", data);

      const reservationId = data?.results?.reservationId;
      if (!reservationId) {
        alert("예약 생성 실패: reservationId 없음");
        return;
      }

      try {
  sessionStorage.setItem(`lastMemo:${reservationId}`, trimmedMemo);
} catch (e) {
  // 세션 저장 실패(사파리 프라이빗 모드 등)는 무시
  console.debug?.("[Storage] setItem failed", e);
}


      // 예약 확인 화면으로 이동 + 선택 옵션/메모 전달
      nav(`/reservation/confirm/${reservationId}`, {
        state: { interpretationOption, memo: trimmedMemo },
      });
    } catch (err) {
      console.error("[ERROR] 예약 신청 중 오류:", err);
      alert("요청 처리 중 오류가 발생했어요.");
    }
  };

  return (
    <div className="telemed apply">
      <Sidebar />
      <main className="apply__main">
        <Stepper step={step} />

        <section className="apply__card">
          <h1 className="apply__title">진료 신청</h1>
          <div className="apply__hospital">
            <span className="apply__dept">{doc.dept}</span>
            <span className="apply__bullet">·</span>
            <span className="apply__hname">{doc.hospital}</span>
          </div>

          {/* STEP 1: 본인확인 */}
          {step === 1 && (
            <div className="apply__body">
              <p className="apply__desc">진료 신청을 위해 주민등록번호 입력이 필요합니다.</p>
              <div className="apply__label">주민등록 번호 입력</div>
              <div className="apply__rrn">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={rrnFront}
                  onChange={(e) => setRrnFront(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <span className="dash">—</span>
                <input
                  className="backAll"
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="*******"
                  value={maskBack(rrnBackRaw)}
                  onKeyDown={handleBackKeyDown}
                  onPaste={handleBackPaste}
                  readOnly
                />
              </div>
              <div className="apply__actions">
                <button className="btn-primary" onClick={onNext} disabled={!rrnValid} aria-disabled={!rrnValid}>
                  다음 단계 ▸
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: 시간 선택 */}
          {step === 2 && (
            <div className="apply__body">
              <div className="apply__tabs">
                <button className={`tab ${dayTab === "today" ? "is-active" : ""}`} onClick={() => { setDayTab("today"); setSlot(""); }}>
                  오늘
                </button>
                <button className={`tab ${dayTab === "tomorrow" ? "is-active" : ""}`} onClick={() => { setDayTab("tomorrow"); setSlot(""); }}>
                  내일
                </button>
              </div>

              <div className="apply__grid">
                {slots.map((s) => {
                  const selected = slot === s.label;
                  return (
                    <button
                      key={s.label}
                      className={`slot ${selected ? "is-selected" : ""}`}
                      disabled={s.disabled}
                      onClick={() => setSlot(s.label)}
                      title={s.disabled ? "선택 불가한 시간대입니다" : s.label}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>

              <ul className="apply__notes">
                <li>대한민국 시간(Asia/Seoul) 기준입니다.</li>
                <li>12:00~13:00 점심시간 제외.</li>
                <li>예약 시간은 30분 간격입니다.</li>
              </ul>

              <div className="apply__nav">
                <button className="btn-ghost" onClick={onPrev}>◂ 이전 단계</button>
                <button className="btn-primary" onClick={onNext} disabled={!slot}>다음 단계 ▸</button>
              </div>
            </div>
          )}

          {/* STEP 3: 기능 선택 (라디오 택1) */}
          {step === 3 && (
            <div className="resv__form">
              <div className="form__row">
                <label className="form__label">
                  원하는 기능 선택 <span className="hint">택 1 (필수)</span>
                </label>

                <div className="feature__group" role="radiogroup" aria-label="기능 선택">
                  <label className="feature__item">
                    <input
                      type="radio"
                      name="featureMode"
                      value="voice"
                      checked={featureMode === "voice"}
                      onChange={() => setFeatureMode("voice")}
                    />
                    <div className="feature__text">
                      <span className="feature__title">음성 → 텍스트</span>
                      <p className="feature__desc">의사/환자 음성을 자막으로 보여줍니다.</p>
                    </div>
                  </label>

                  <label className="feature__item">
                    <input
                      type="radio"
                      name="featureMode"
                      value="voice+sign"
                      checked={featureMode === "voice+sign"}
                      onChange={() => setFeatureMode("voice+sign")}
                    />
                    <div className="feature__text">
                      <span className="feature__title">음성 → 텍스트 + 수어 → 텍스트</span>
                      <p className="feature__desc">음성 자막에 수어 인식 텍스트를 추가로 제공합니다.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="resv__row" style={{ justifyContent: "space-between" }}>
                <button className="btn-ghost" onClick={onPrev}>◂ 이전 단계</button>
                <button className="btn-primary" onClick={onNext} disabled={!featureValid}>다음 단계 ▸</button>
              </div>
            </div>
          )}

          {/* STEP 4: 증상 */}
          {step === 4 && (
            <div className="apply__body">
              <div className="apply__fieldset">
                <div className="apply__legend">증상 선택</div>
                <div className="apply__chips">
                  {["기침","가래","코막힘","두통","발열"].map((s) => (
                    <label key={s} className={`chip ${symptom === s ? "is-on" : ""}`}>
                      <input type="radio" name="symptom" value={s} checked={symptom === s} onChange={() => setSymptom(s)} />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="apply__fieldset">
                <div className="apply__legend">증상 지속 기간</div>
                <div className="apply__duration">
                  <input
                    className="num"
                    inputMode="numeric"
                    maxLength={2}
                    value={unknown ? "" : duration}
                    onChange={(e) => setDuration(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    disabled={unknown}
                  />
                  <span>일</span>
                  <label className="chk">
                    <input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} />
                    잘 모르겠습니다
                  </label>
                </div>
              </div>

              <div className="apply__fieldset">
                <div className="apply__legend">기타 증상 (선택)</div>
                <textarea rows={5} placeholder="증상을 구체적으로 적어주세요." value={memo} onChange={(e) => setMemo(e.target.value)} />
              </div>

              <div className="apply__nav">
                <button className="btn-ghost" onClick={onPrev}>◂ 이전 단계</button>
                <button className="btn-primary" onClick={onSubmit}>신청하기</button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
>>>>>>> Stashed changes
