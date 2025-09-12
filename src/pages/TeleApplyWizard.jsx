// src/pages/TeleApplyWizard.jsx
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
  return (
    <div className="apply__stepper" aria-label="신청 단계">
      {[1, 2, 3].map((n) => (
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

  /* ---- STEP 1: 주민번호 ---- */
  const [rrnFront, setRrnFront] = useState(""); // 앞 6자리
  const [rrnBackRaw, setRrnBackRaw] = useState(""); // 뒤 7자리(실제값, 단일 입력창)
  const rrnValid = rrnFront.length === 6 && rrnBackRaw.length === 7;

  // 뒤 7자리 마스킹: 첫 글자만 보이고 나머지는 '*'
  const maskBack = (s) => {
    if (!s) return "";
    const first = s[0] ?? "";
    return first + "*".repeat(Math.max(0, s.length - 1));
  };

  // 뒤 7자리 단일 입력창: 키보드로 숫자/백스페이스만 처리 (브라우저 호환 안정)
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
      e.preventDefault(); // 실제 입력은 우리가 관리
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
    // 🔧 수정: 다음 30분 경계부터 선택 가능 → cutoff "이전"만 비활성화
    return base.map((s) => ({ ...s, disabled: s.start < cutoff }));
  }, [kstNow]);

  const tomorrowSlots = useMemo(() => {
    const t = new Date(kstNow);
    t.setDate(t.getDate() + 1);
    return generateSlotsKST(t).map((s) => ({ ...s, disabled: false }));
  }, [kstNow]);

  const slots = dayTab === "today" ? todaySlots : tomorrowSlots;

  /* ---- STEP 3: 증상 ---- */
  const [symptom, setSymptom] = useState("기침");
  const [duration, setDuration] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [memo, setMemo] = useState("");

  const onNext = () => setStep((s) => Math.min(3, s + 1));
  const onPrev = () => setStep((s) => Math.max(1, s - 1));

  const onSubmit = () => {
    if (!rrnValid) return alert("주민등록번호를 올바르게 입력해 주세요.");
    if (!slot) return alert("진료 시간을 선택해 주세요.");

    console.log("APPLY_FORM", {
      doctorId,
      rrnFront,
      rrnBack: rrnBackRaw,
      dayTab,
      slot,
      symptom,
      duration: unknown ? "모름" : duration,
      memo,
    });

    alert("신청이 완료되었습니다. (목업)");
    nav("/");
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

          {/* ===== STEP 1 ===== */}
          {step === 1 && (
            <div className="apply__body">
              <p className="apply__desc">
                진료 예약을 위해 주민등록번호 입력이 필요합니다. 입력된 개인정보는
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

          {/* ===== STEP 2 ===== */}
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
                <button
                  className="btn-primary"
                  onClick={onNext}
                  disabled={!slot}
                >
                  다음 단계 ▸
                </button>
              </div>
            </div>
          )}

          {/* ===== STEP 3 ===== */}
          {step === 3 && (
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
