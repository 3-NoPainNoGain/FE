// src/pages/TeleApplyWizard.jsx
// 변경 요약:
// - 스텝 구성: 1) 본인확인 → 2) 시간 선택 → 3) 원하는 기능(복수 선택) → 4) 증상 입력
// - 기능 선택을 체크박스 다중선택으로 구현 (features: string[])
// - 유효성: 기능 1개 이상 선택 시에만 다음 단계 가능
// - 최종 제출 시 payload 예시에 features 포함 (백엔드 협의 주석)

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./session.css";
import "./tele-apply.css";

/* ===== 시간 유틸 (KST) ===== */
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
    const label = `${pad(start.getHours())}:${pad(
      start.getMinutes()
    )}~${pad(end.getHours())}:${pad(end.getMinutes())}`;
    slots.push({ label, start, end });
  };
  // 10:00~12:00
  for (let h = 10; h < 12; h++) {
    pushSlot(h, 0);
    pushSlot(h, 30);
  }
  // 13:00~17:00
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

/* ===== 스텝 표시 ===== */
function Stepper({ step }) {
  // 총 4단계
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

/* ===== 메인 컴포넌트 ===== */
export default function TeleApplyWizard() {
  const { doctorId } = useParams();
  const nav = useNavigate();
  const [step, setStep] = useState(1);

  // 병원/의사 목업 (나중에 API 연결)
  const doc = useMemo(
    () => ({
      id: doctorId,
      hospital: "이화여대 내과 병원",
      dept: "내과",
      name: "이하은 의사",
    }),
    [doctorId]
  );

  /* ---- STEP 1: 본인확인(주민번호) ---- */
  const [rrnFront, setRrnFront] = useState(""); // 앞 6자리
  const [rrnBackRaw, setRrnBackRaw] = useState(""); // 뒤 7자리(단일 입력창)
  const rrnValid = rrnFront.length === 6 && rrnBackRaw.length === 7;

  // 뒤 7자리 마스킹: 첫 글자만 보이고 나머지는 '*'
  const maskBack = (s) => {
    if (!s) return "";
    const first = s[0] ?? "";
    return first + "*".repeat(Math.max(0, s.length - 1));
  };

  // 뒤 7자리 단일 입력창: 키보드로 숫자/백스페이스만 처리
  const handleBackKeyDown = (e) => {
    const k = e.key;

    // 허용: Tab/Arrow/Home/End
    if (["Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(k)) return;

    // 삭제
    if (k === "Backspace") {
      if (rrnBackRaw.length > 0) setRrnBackRaw(rrnBackRaw.slice(0, -1));
      e.preventDefault();
      return;
    }
    if (k === "Delete") {
      setRrnBackRaw("");
      e.preventDefault();
      return;
    }

    // 숫자 입력
    if (/^\d$/.test(k)) {
      if (rrnBackRaw.length >= 7) {
        e.preventDefault();
        return;
      }
      setRrnBackRaw(rrnBackRaw + k);
      e.preventDefault();
      return;
    }

    // 그 외 키는 차단
    e.preventDefault();
  };

  // 붙여넣기: 숫자만 최대 7자리
  const handleBackPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData?.getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, 7);
    setRrnBackRaw(pasted);
  };

  /* ---- STEP 2: 시간 선택 (KST, 오늘 기본, 과거 비활성) ---- */
  const [dayTab, setDayTab] = useState("today"); // 기본: 오늘
  const [slot, setSlot] = useState("");

  const kstNow = nowKST();
  const todaySlots = useMemo(() => {
    const base = generateSlotsKST(kstNow);
    const cutoff = roundUpToNextHalfKST(kstNow); // 예: 10:40 → 11:00
    return base.map((s) => ({ ...s, disabled: s.start < cutoff }));
  }, [kstNow]);

  const tomorrowSlots = useMemo(() => {
    const t = new Date(kstNow);
    t.setDate(t.getDate() + 1);
    return generateSlotsKST(t).map((s) => ({ ...s, disabled: false }));
  }, [kstNow]);

  const slots = dayTab === "today" ? todaySlots : tomorrowSlots;

  /* ---- STEP 3: 원하는 기능 선택 (복수선택 체크박스) ---- */
  // 옵션 정의 (라벨/설명은 UI 카피와 동일)
  const FEATURE_OPTIONS = [
    {
      key: "signLanguageTranslation",
      label: "수어-텍스트 변환",
      help:
        "화면을 보고 수어를 하면, 이를 인식하여 텍스트로 변환하고 화면에 보여주는 기능입니다. " +
        "인식이 틀릴 경우, 재시도할 수 있습니다.",
    },
    {
      key: "speechToText",
      label: "음성-텍스트 변환",
      help:
        "의사와 환자의 음성을 인식하여, 텍스트로 변환하여 화면에 보여주는 기능입니다.",
    },
    // 필요 시 확장 가능:
    // { key: "largeCaption", label: "큰 글씨 자막", help: "가독성 높은 대형 텍스트 제공" },
    // { key: "captionSync", label: "자막 동기화", help: "대본 기반 싱크 보정" },
  ];
  const [features, setFeatures] = useState([]); // string[]

  const toggleFeature = (key) => {
    setFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };
  const featuresValid = features.length > 0;

  /* ---- STEP 4: 증상 ---- */
  const [symptom, setSymptom] = useState("기침");
  const [duration, setDuration] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [memo, setMemo] = useState("");

  const onNext = () => setStep((s) => Math.min(4, s + 1));
  const onPrev = () => setStep((s) => Math.max(1, s - 1));

  // ✅ 신청하기 → 예약 확인 화면으로 이동
  const onSubmit = () => {
    if (!rrnValid) return alert("주민등록번호를 올바르게 입력해 주세요.");
    if (!slot) return alert("진료 시간을 선택해 주세요.");
    if (!featuresValid) return alert("원하는 기능을 1개 이상 선택해 주세요.");

    // 실제 환경에선 API 호출 후 성공 시로 이동
    // 백엔드 협의용 payload 예시:
    // const payload = {
    //   doctorProfileId: Number(doc.id),
    //   rrnFront,
    //   rrnBack: rrnBackRaw, // 서버 전송 시 마스킹 없이; HTTPS/보안 저장 필수
    //   slotDate:
    //     dayTab === "today"
    //       ? new Date(kstNow).toISOString().slice(0, 10)
    //       : new Date(
    //           new Date(kstNow).setDate(kstNow.getDate() + 1)
    //         ).toISOString().slice(0, 10),
    //   slotLabel: slot, // "HH:mm~HH:mm"
    //   features,        // 예: ["signLanguageTranslation","speechToText"]
    //   symptom,
    //   symptomDuration: unknown ? null : Number(duration || 0),
    //   description: memo,
    // };

    // TODO: await api.post("/api/v2/apply", payload);
    nav("/reservation/confirm");
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

          {/* ===== STEP 1: 본인확인 ===== */}
          {step === 1 && (
            <div className="apply__body">
              <p className="apply__desc">
                진료 신청을 위해 주민등록번호 입력이 필요합니다. 입력된 개인정보는
                관련 법에 따라 안전하게 보호됩니다.
              </p>

              <div className="apply__label">주민등록 번호 입력</div>
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
                  placeholder="*******"
                  value={maskBack(rrnBackRaw)}
                  onKeyDown={handleBackKeyDown}
                  onPaste={handleBackPaste}
                />
              </div>

              <div className="apply__actions">
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

          {/* ===== STEP 2: 시간 선택 ===== */}
          {step === 2 && (
            <div className="apply__body">
              <div className="apply__tabs">
                <button
                  className={`tab ${dayTab === "today" ? "is-active" : ""}`}
                  onClick={() => {
                    setDayTab("today");
                    setSlot("");
                  }}
                >
                  오늘
                </button>
                <button
                  className={`tab ${dayTab === "tomorrow" ? "is-active" : ""}`}
                  onClick={() => {
                    setDayTab("tomorrow");
                    setSlot("");
                  }}
                >
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
                <li>12:00~13:00은 점심시간으로 예약이 불가합니다.</li>
                <li>예약 시간은 30분 간격으로 제공됩니다.</li>
              </ul>

              <div className="apply__nav">
                <button className="btn-ghost" onClick={onPrev}>
                  ◂ 이전 단계
                </button>
                <button className="btn-primary" onClick={onNext} disabled={!slot}>
                  다음 단계 ▸
                </button>
              </div>
            </div>
          )}

          {/* ===== STEP 3: 원하는 기능 선택 (복수선택) ===== */}
          {step === 3 && (
            <div className="resv__form">
              <div className="form__row">
                <label className="form__label">
                  기능 선택 <span className="hint">복수 선택할 수 있습니다</span>
                </label>

                <div className="feature__group">
                  {FEATURE_OPTIONS.map((opt) => {
                    const on = features.includes(opt.key);
                    return (
                      <label key={opt.key} className="feature__item">
                        <input
                          type="checkbox"
                          value={opt.key}
                          checked={on}
                          onChange={() => toggleFeature(opt.key)}
                        />
                        <div className="feature__text">
                          <span className="feature__title">{opt.label}</span>
                          <p className="feature__desc">{opt.help}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="resv__row" style={{ justifyContent: "space-between" }}>
                <button className="btn-ghost" onClick={onPrev}>
                  ◂ 이전 단계
                </button>
                <button
                  className="btn-primary"
                  onClick={onNext}
                  disabled={!featuresValid}
                >
                  다음 단계 ▸
                </button>
              </div>
            </div>
          )}

          {/* ===== STEP 4: 증상 ===== */}
          {step === 4 && (
            <div className="apply__body">
              <div className="apply__fieldset">
                <div className="apply__legend">증상 선택</div>
                <div className="apply__chips">
                  {["기침", "가래", "코막힘", "두통", "발열"].map((s) => (
                    <label key={s} className={`chip ${symptom === s ? "is-on" : ""}`}>
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

              <div className="apply__nav">
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
