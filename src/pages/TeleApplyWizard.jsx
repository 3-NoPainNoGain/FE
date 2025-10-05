import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../auth/axios";
import "./session.css";
import "./tele-apply.css";

function nowKST() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
}
function makeKST(dateLike, h, m) {
  const base = new Date(
    new Date(dateLike).toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
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
    const label = `${pad(start.getHours())}:${pad(start.getMinutes())}~${pad(
      end.getHours()
    )}:${pad(end.getMinutes())}`;
    slots.push({ label, start, end });
  };
  for (let h = 10; h < 12; h++) {
    pushSlot(h, 0);
    pushSlot(h, 30);
  }
  for (let h = 13; h < 17; h++) {
    pushSlot(h, 0);
    pushSlot(h, 30);
  }
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
function toHHMMSS(v) {
  const s = String(v || "").trim();
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return s;
}

const SYMPTOM_TO_ENUM = {
  기침: "COUGH",
  가래: "SPUTUM",
  코막힘: "NOSE",
  두통: "HEADACHE",
  발열: "FEVER",
};
function featureModeToOptions(mode) {
  if (mode === "voice") return ["VOICE_TO_TEXT"];
  if (mode === "voice+sign") return ["VOICE_TO_TEXT", "SIGN_TO_TEXT"];
  return [];
}

/* 스텝퍼 */
function Stepper({ step }) {
  return (
    <div className="apply__stepper" aria-label="신청 단계">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`apply__dot ${
            step === n ? "is-active" : step > n ? "is-done" : ""
          }`}
        />
      ))}
    </div>
  );
}

export default function TeleApplyWizard() {
  const { doctorId } = useParams();
  const nav = useNavigate();
  const [step, setStep] = useState(1);

  const [doc, setDoc] = useState({
    id: doctorId,
    hospital: "",
    dept: "",
    name: "",
  });
  const [loadingDoc, setLoadingDoc] = useState(true);

  useEffect(() => {
    let alive = true;
    async function fetchDoctor() {
      setLoadingDoc(true);
      try {
        const res = await api.get(`/api/v2/doctor/${doctorId}`);
        const r = res?.data?.results || {};
        const parsed = {
          id: r.id ?? doctorId,
          hospital: r.hospitalName || "병원명",
          dept: r.speciality || "진료과",
          name: r.name || "",
        };
        if (alive) setDoc(parsed);
      } catch (e) {
        if (alive)
          setDoc({
            id: doctorId,
            hospital: "이화병원",
            dept: "내과",
            name: "의사",
          });
      } finally {
        if (alive) setLoadingDoc(false);
      }
    }
    if (doctorId) fetchDoctor();
    return () => {
      alive = false;
    };
  }, [doctorId]);

  const [rrnFront, setRrnFront] = useState("");
  const [rrnBackRaw, setRrnBackRaw] = useState("");
  const rrnValid = rrnFront.length === 6 && rrnBackRaw.length === 7;
  const maskBack = (s) => (s ? s[0] + "*".repeat(Math.max(0, s.length - 1)) : "");
  const handleBackKeyDown = (e) => {
    const k = e.key;
    if (["Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(k)) return;
    if (k === "Backspace") {
      if (rrnBackRaw.length) setRrnBackRaw(rrnBackRaw.slice(0, -1));
      e.preventDefault();
      return;
    }
    if (k === "Delete") {
      setRrnBackRaw("");
      e.preventDefault();
      return;
    }
    if (/^\d$/.test(k)) {
      if (rrnBackRaw.length < 7) setRrnBackRaw(rrnBackRaw + k);
      e.preventDefault();
      return;
    }
    e.preventDefault();
  };
  const handleBackPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData?.getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, 7);
    setRrnBackRaw(pasted);
  };

  const [dayTab, setDayTab] = useState("today");
  const [slot, setSlot] = useState("");
  const kstNow = nowKST();
  const todaySlots = useMemo(() => {
    const base = generateSlotsKST(kstNow);
    const cutoff = roundUpToNextHalfKST(kstNow);
    return base.map((s) => ({ ...s, disabled: s.start < cutoff }));
  }, [kstNow]);
  const tomorrowSlots = useMemo(() => {
    const t = new Date(kstNow);
    t.setDate(t.getDate() + 1);
    return generateSlotsKST(t);
  }, [kstNow]);
  const slots = dayTab === "today" ? todaySlots : tomorrowSlots;

  const [featureMode, setFeatureMode] = useState(null); // 'voice' | 'voice+sign'
  const [voiceSub, setVoiceSub] = useState("normal");   // 'normal' | 'assist'
  const featureValid = featureMode === "voice" || featureMode === "voice+sign";

  const [symptom, setSymptom] = useState("");
  const [duration, setDuration] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [memo, setMemo] = useState("");

  const onNext = () => setStep((s) => Math.min(4, s + 1));
  const onPrev = () => setStep((s) => Math.max(1, s - 1));

  const onSubmit = async () => {
    if (!rrnValid) return alert("주민등록번호를 올바르게 입력해 주세요.");
    if (!slot) return alert("진료 시간을 선택해 주세요.");
    if (!featureValid) return alert("원하는 기능을 선택해 주세요.");

    try {
      const residentId = `${rrnFront}-${rrnBackRaw}`;
      await api.post("/api/v2/user/resident-id", { residentId });
    } catch (e) {
      alert(e?.response?.data?.message ?? "주민번호 저장에 실패했어요.");
      return;
    }

    const [startRaw, endRaw] = slot.split("~");
    const startStr = toHHMMSS(startRaw);
    const endStr = toHHMMSS(endRaw);
    const baseDate = new Date(kstNow);
    if (dayTab === "tomorrow") baseDate.setDate(baseDate.getDate() + 1);
    const slotDate = baseDate.toISOString().slice(0, 10);

    const interpretationOption = featureModeToOptions(featureMode);
    const symptomEnum = SYMPTOM_TO_ENUM[symptom] ?? "HEADACHE";
    const symptomDuration = unknown ? null : Number(duration || 0);
    const trimmedMemo = (memo || "").trim();

    const payload = {
      doctorProfileId: Number(doc.id ?? 1),
      slotDate,
      startTime: startStr,
      endTime: endStr,
      symptom: symptomEnum,
      symptomDuration,
      description: trimmedMemo || null,
      interpretationOption,
      voiceMode: featureMode === "voice" ? voiceSub : null,
    };

    let data;
    try {
      const res = await api.post("/api/v2/reservation", payload);
      data = res.data;
    } catch (e) {
      alert(
        e?.response?.data?.message ??
          `예약 생성 실패 (${e?.response?.status ?? "network"})`
      );
      return;
    }

    const reservationId = data?.results?.reservationId;
    if (!reservationId) return alert("예약 생성 실패: reservationId 없음");

    try {
  sessionStorage.setItem(`lastMemo:${reservationId}`, trimmedMemo);
} catch (err) {
  if (process.env.NODE_ENV !== "production") {
    console.debug("[Storage] setItem failed", err);
  }
}


    nav(`/reservation/confirm/${reservationId}`, {
      state: {
        interpretationOption,
        memo: trimmedMemo,
        voiceMode: featureMode === "voice" ? voiceSub : null,
      },
    });
  };

  return (
    <div className="telemed apply">
      <Sidebar />
      <main className="apply__main">
        <Stepper step={step} />

        <section className="apply__card">
          <h1 className="apply__title">진료 신청</h1>

          <div className="apply__header">
            <div className="apply__dept">
              {loadingDoc ? "…" : doc.dept || "진료과"}
            </div>
            <div className="apply__hname">
              {loadingDoc ? "불러오는 중…" : doc.hospital || "병원명"}
            </div>
          </div>

          {step === 1 && (
            <div className="apply__body">
              <p className="apply__desc">
                진료 예약을 위해 주민등록번호 입력이 필요합니다. 이는 환자 확인과
                진료 기록 관리 목적이며, 입력된 개인정보는 의료법 및
                개인정보보호법에 따라 안전하게 보호됩니다. 주민등록번호를 올바르게
                입력하지 않은 경우, 진료가 어려울 수 있습니다.
              </p>

              <div className="apply__label apply__label--center">
                주민등록 번호 입력
              </div>

              <div className="apply__rrn">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={rrnFront}
                  onChange={(e) =>
                    setRrnFront(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
                <span className="dash">—</span>
                <input
                  className="backAll"
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="0******"
                  value={maskBack(rrnBackRaw)}
                  onKeyDown={handleBackKeyDown}
                  onPaste={handleBackPaste}
                  readOnly
                  aria-readonly="true"
                  title="키보드 입력만 허용됩니다"
                />
              </div>

              <div className="apply__footer apply__footer--single">
                <button
                  className="btn-primary"
                  onClick={onNext}
                  disabled={!rrnValid}
                  aria-disabled={!rrnValid}
                >
                  다음 단계 ▸
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="apply__body">
              <div
                className="apply__tabs"
                role="tablist"
                aria-label="예약 날짜 선택"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={dayTab === "today"}
                  className={`tab ${dayTab === "today" ? "is-active" : ""}`}
                  onClick={() => {
                    setDayTab("today");
                    setSlot("");
                  }}
                >
                  오늘
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={dayTab === "tomorrow"}
                  className={`tab ${dayTab === "tomorrow" ? "is-active" : ""}`}
                  onClick={() => {
                    setDayTab("tomorrow");
                    setSlot("");
                  }}
                >
                  내일
                </button>
              </div>

              <div className="apply__slotsBox">
                <div
                  className="apply__grid"
                  role="radiogroup"
                  aria-label="예약 시간 선택"
                >
                  {slots.map((s) => {
                    const selected = slot === s.label;
                    const [start, end] = s.label.split("~");
                    return (
                      <button
                        key={s.label}
                        type="button"
                        className={`slot ${selected ? "is-selected" : ""}`}
                        disabled={s.disabled}
                        aria-pressed={selected}
                        aria-label={`${start}부터 ${end}까지`}
                        onClick={() => setSlot(s.label)}
                        title={
                          s.disabled ? "선택 불가한 시간대입니다" : `${start}~${end}`
                        }
                      >
                        <span className="slot__start">{start}</span>
                        <span className="slot__end">~{end}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <ul className="apply__notes">
                <li>대한민국 시간(Asia/Seoul) 기준입니다.</li>
                <li>12:00~13:00은 점심시간으로, 진료가 불가합니다.</li>
                <li>예약 시간은 30분 간격입니다.</li>
              </ul>

              <div className="apply__footer">
                <button className="btn-ghost" type="button" onClick={onPrev}>
                  ◂ 이전 단계
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={onNext}
                  disabled={!slot}
                  aria-disabled={!slot}
                >
                  다음 단계 ▸
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="resv__form">
              <div className="form__row">
                <label className="form__label">원하는 기능 선택</label>
                <p className="form__hint">
                  * 본 서비스는 의사 음성 자막 기능을 기본 제공합니다.
                </p>

                <div
                  className="feature__group"
                  role="radiogroup"
                  aria-label="기능 선택"
                >
                  <label
                    className={`feature__item ${
                      featureMode === "voice" ? "is-active" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="featureMode"
                      value="voice"
                      checked={featureMode === "voice"}
                      onChange={() => setFeatureMode("voice")}
                    />
                    <div className="feature__text">
                      <span className="feature__title">음성으로 진료받기</span>
                      <p className="feature__desc">
                        환자가 음성을 이용해 진료받습니다.
                      </p>

                      {featureMode === "voice" && (
                        <div
                          className="sub-options"
                          role="radiogroup"
                          aria-label="음성 진료 방식"
                        >
                          <label className="subopt">
                            <input
                              type="radio"
                              name="voiceSub"
                              value="normal"
                              checked={voiceSub === "normal"}
                              onChange={() => setVoiceSub("normal")}
                            />
                            <span className="subopt__title">
                              일반 음성 인식 모드
                            </span>
                            <span className="subopt__desc">
                              말한 내용을 그대로 인식하여 전송합니다.
                            </span>
                          </label>

                          <label className="subopt">
                            <input
                              type="radio"
                              name="voiceSub"
                              value="assist"
                              checked={voiceSub === "assist"}
                              onChange={() => setVoiceSub("assist")}
                            />
                            <span className="subopt__title">
                              발음 보조 모드
                            </span>
                            <span className="subopt__desc">
                              발음을 인식해 유사한 3가지 후보를 제시하고, 선택하여
                              전송합니다.
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  </label>

                  <label
                    className={`feature__item ${
                      featureMode === "voice+sign" ? "is-active" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="featureMode"
                      value="voice+sign"
                      checked={featureMode === "voice+sign"}
                      onChange={() => {
                        setFeatureMode("voice+sign");
                        setVoiceSub("normal"); 
                      }}
                    />
                    <div className="feature__text">
                      <span className="feature__title">수어로 진료받기</span>
                      <p className="feature__desc">
                        환자의 수어를 번역하는 서비스를 이용해 진료받습니다.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="apply__footer">
                <button className="btn-ghost" onClick={onPrev}>
                  ◂ 이전 단계
                </button>
                <button
                  className="btn-primary"
                  onClick={onNext}
                  disabled={!featureValid}
                >
                  다음 단계 ▸
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="apply__body">
              <div className="apply__fieldset">
                <div className="apply__legend">증상 선택</div>
                <div className="apply__chips">
                  {["기침", "가래", "코막힘", "두통", "발열"].map((s) => (
                    <label
                      key={s}
                      className={`chip ${symptom === s ? "is-on" : ""}`}
                    >
                      <input
                        type="radio"
                        name="symptom"
                        value={s}
                        checked={symptom === s}
                        onChange={() => setSymptom(s)}
                      />
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
                    onChange={(e) =>
                      setDuration(e.target.value.replace(/\D/g, "").slice(0, 2))
                    }
                    disabled={unknown}
                  />
                  <span>일</span>
                  <label className="chk">
                    <input
                      type="checkbox"
                      checked={unknown}
                      onChange={(e) => setUnknown(e.target.checked)}
                    />
                    잘 모르겠습니다
                  </label>
                </div>
              </div>

              <div className="apply__fieldset">
                <div className="apply__legend">기타 증상 (선택)</div>
                <textarea
                  rows={5}
                  placeholder="증상을 구체적으로 적어주세요."
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>

              <div className="apply__footer">
                <button className="btn-ghost" onClick={onPrev}>
                  ◂ 이전 단계
                </button>
                <button className="btn-primary" onClick={onSubmit}>
                  신청하기
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
