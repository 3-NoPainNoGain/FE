import Sidebar from "../components/Sidebar";
import "./session.css";
import "./tele-reservation.css";

export default function ReservationConfirm() {
  const mock = {
    dept: "내과",
    hospital: "이화여대 내과 병원",
    doctor: "이하은 의사",
    date: "2025.09.02",
    time: "11:00 ~ 11:20",
    rrn: "000000 - 4000000",
    symptoms: ["기침", "발열"],
    duration: "7",
    unknown: false,
    memo: "",
    name: "이하은",
  };

  const symptomOptions = ["기침", "가래", "코막힘", "두통", "발열"];

  return (
    <div className="telemed resv">
      <Sidebar />

      <main className="resv__wrap">
        {/* 좌측 */}
        <section className="resv__left">
          <h1 className="resv__headline">예약을 확인하고 있어요</h1>

          <div className="resv__dept">{mock.dept}</div>
          <div className="resv__hname">{mock.hospital}</div>
          <div className="resv__dname">{mock.doctor}</div>
          <div className="resv__when">
            {mock.date} | {mock.time}
          </div>

          <button className="resv__go">진료 받으러 가기</button>

          <div className="resv__cancelwrap">
            <button className="resv__cancel">예약 취소하기</button>
            <div className="tooltip">
              <span className="tooltip__icon">?</span>
              <span className="tooltip__text">
                예약 취소는 진료 시작 1시간 전까지만 가능합니다.
              </span>
            </div>
          </div>
        </section>

        {/* 우측 카드 */}
        <section className="resv__card">
          <header className="resv__cardhead">
            <h2 className="resv__title">진료 신청서</h2>
            <span className="resv__date">{mock.date}</span>
          </header>

          <div className="resv__form">
            <div className="form__row">
              <label className="form__label">이름</label>
              <div className="form__value">{mock.name}</div>
            </div>

            <div className="form__row">
              <label className="form__label">주민등록 번호</label>
              <div className="form__value">{mock.rrn}</div>
            </div>

            <div className="form__row">
              <label className="form__label">증상 선택</label>
              <div className="form__options">
                {symptomOptions.map((s) => (
                  <label key={s} className="form__chip">
                    <input
                      type="checkbox"
                      disabled
                      checked={mock.symptoms.includes(s)}
                      readOnly
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form__row">
              <label className="form__label">증상 지속 기간</label>
              <div className="form__value">
                {mock.duration}일{" "}
                {mock.unknown && <span>잘 모르겠습니다</span>}
              </div>
            </div>

            <div className="form__row">
              <label className="form__label">기타 증상 (선택)</label>
              <div className="form__value">{mock.memo || "-"}</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
