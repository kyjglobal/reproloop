"use client";

import { FormEvent, useEffect, useState } from "react";

type Locale = "ko" | "en";
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const reportSeed = {
  ko: {
    build: "0.8.14-beta",
    platform: "Windows 11 · Steam · RTX 4060",
    frequency: "5회 중 3회",
    location: "Ashen Keep 보스방",
    actual: "컷신을 건너뛴 뒤 인벤토리를 열면 화면이 멈추고 음악만 재생됩니다.",
    expected: "컷신이 종료되고 보스 2페이즈가 정상적으로 시작되어야 합니다.",
    steps: "1. Ashen Keep 보스방 입장\n2. 보스 체력을 50%까지 감소\n3. 컷신 건너뛰기\n4. 즉시 인벤토리 열기",
  },
  en: {
    build: "0.8.14-beta",
    platform: "Windows 11 · Steam · RTX 4060",
    frequency: "3 of 5 attempts",
    location: "Ashen Keep boss room",
    actual: "The screen freezes and only the music continues after skipping the cutscene and opening inventory.",
    expected: "The cutscene should end and boss phase two should begin normally.",
    steps: "1. Enter the Ashen Keep boss room\n2. Lower boss HP to 50%\n3. Skip the cutscene\n4. Open inventory immediately",
  },
};

const text = {
  ko: {
    nav: ["제품", "직접 체험", "적합한 팀", "보안"], pilot: "파일럿 신청",
    eyebrow: "1~10인 게임팀을 위한 Discord 버그 트리아지",
    hero1: "버그 제보가 왔습니다.", hero2: "재현 방법부터 다시 묻지 마세요.",
    heroBody: "Discord 제보를 빌드·환경·재현 단계가 갖춰진 리포트로 바꾸고, 중복 정리부터 수정 알림까지 한 흐름으로 연결합니다.",
    demoCta: "3분 데모 체험", auditCta: "기존 제보 5건 무료 진단",
    heroNote: "가입 없이 체험 · 설치 없이 진단 · 초기 3개 팀 7일 지원",
    raw: "DISCORD에서 들어온 제보", rawMessage: "보스방 들어가면 가끔 화면이 멈춰요. 다시 켜면 되긴 합니다 ㅠㅠ",
    devQuestion: "어느 빌드인가요? 재현 방법과 로그가 있나요?", clean: "REPROLOOP가 만든 리포트",
    cleanTitle: "컷신 직후 인벤토리를 열면 게임 정지", complete: "필수 정보 6/6",
    build: "빌드", env: "환경", steps: "재현 단계", actual: "실제 결과", expected: "기대 결과",
    valueTitle: "흩어진 대화를, 바로 조사할 수 있는 한 장으로.",
    valueBody: "플레이어는 익숙한 Discord에서 제보하고, 개발자는 필요한 맥락이 채워진 리포트만 확인합니다.",
    values: [
      ["질문 왕복 감소", "빌드·환경·재현 단계를 처음부터 받습니다."],
      ["중복 영향도 유지", "같은 현상을 하나로 묶고 제보자는 남깁니다."],
      ["수정 결과 전달", "수정된 빌드를 원래 제보자에게 돌려보냅니다."],
    ],
    demoTag: "GUIDED PRODUCT DEMO", demoTitle: "버그 하나를 끝까지 처리해 보세요.",
    demoBody: "가상의 플레이테스트 제보를 직접 구조화하고 중복을 병합한 뒤, 수정 알림까지 보내는 데 약 3분이 걸립니다.",
    simulated: "실제 서비스가 아닌 브라우저 시뮬레이션입니다. 입력 내용은 저장되지 않습니다.",
    stepNames: ["제보 확인", "정보 수집", "리포트 생성", "중복 정리", "수정 등록", "알림 전송", "결과 확인"],
    incomingTitle: "# bug-report에 새 메시지가 도착했습니다",
    incomingBody: "증상만 있고 빌드, 환경, 재현 단계는 없습니다. ReproLoop 질문 흐름으로 필요한 맥락을 채워보세요.",
    start: "이 제보 정리하기", formTitle: "재현에 필요한 정보를 채웁니다",
    formBody: "실제 Discord Modal처럼 핵심 항목만 묻습니다. 예시를 확인하고 리포트를 만드세요.",
    location: "발생 위치", frequency: "발생 빈도", makeReport: "구조화된 리포트 만들기",
    structuredTitle: "BUG-247 · 컷신 직후 인벤토리를 열면 게임 정지", actionable: "바로 조사 가능",
    structuredBody: "채팅 한 줄이 개발자가 바로 재현을 시작할 수 있는 리포트가 되었습니다.", inbox: "개발자 Inbox에서 확인",
    duplicateTitle: "유사한 기존 제보 2건을 찾았습니다",
    duplicateBody: "빌드, 발생 위치, 멈춤 시점이 같은 후보를 비교합니다. 유사도는 데모용 예시 값입니다.",
    similarity: "유사도", canonical: "대표 이슈", candidate1: "보스 2페이즈 진입 시 화면 정지", candidate2: "Ashen Keep 컷신 후 오디오만 재생",
    note1: "같은 빌드 · 같은 위치 · 동일한 멈춤 시점", note2: "빌드 미상 · 인벤토리 조작 정보 없음", merge: "선택한 이슈에 병합",
    fixTitle: "대표 이슈에 제보자 4명이 연결되었습니다", fixBody: "재현 완료 상태를 확인하고 수정이 포함된 빌드를 선택하세요.",
    timeline: ["접수", "재현 완료", "수정 완료"], fixedBuild: "수정 버전", preview: "수정 알림 미리보기",
    notifyTitle: "플레이어에게 돌아갈 메시지", recipients: "관련 제보자 4명", send: "수정 알림 보내기",
    sentTitle: "버그 처리 루프를 닫았습니다", sentBody: "아래 수치는 실제 고객 성과가 아닌 데모 시뮬레이션입니다.",
    results: [["1회", "추가 질문 방지"], ["3건", "중복 제보 연결"], ["4명", "수정 알림 전달"]],
    restart: "데모 다시 시작", pilotFromDemo: "우리 팀 제보로 테스트", back: "이전",
    workflowTag: "ONE CLOSED LOOP", workflowTitle: "제보부터 수정 알림까지, Discord를 떠나지 않습니다.",
    workflow: [
      ["/", "/bug로 접수", "플레이어가 Discord에서 60초 안에 필요한 정보를 제출합니다."],
      ["▤", "조사 가능한 형태로", "빌드, 환경, 기대 결과와 재현 단계가 한 장에 정리됩니다."],
      ["⌁", "중복과 상태 관리", "같은 현상을 대표 이슈에 모으고 영향도를 잃지 않습니다."],
      ["↗", "수정 결과 회신", "수정 빌드가 등록되면 관련 제보자 모두에게 알립니다."],
    ],
    fitTag: "WHO IT IS FOR", fitTitle: "작은 팀의 플레이테스트 운영에 집중합니다.", fitYes: "지금 잘 맞는 팀", fitNo: "아직 맞지 않는 팀",
    fits: ["1~10인 규모의 인디게임 팀", "Discord에서 플레이테스트를 운영하는 팀", "정보 누락과 중복 제보가 반복되는 팀", "직접 피드백을 주고받을 초기 파트너"],
    notFits: ["대규모 QA 조직과 복잡한 승인 체계", "Jira·Linear 연동이 당장 필요한 팀", "Discord를 사용하지 않는 커뮤니티", "완전 자동 AI 판정을 기대하는 팀"],
    securityTag: "PRIVACY BY DEFAULT", securityTitle: "채널 전체를 읽지 않는 구조부터 시작합니다.",
    securityBody: "사용자가 시작한 /bug 명령, 버튼, Modal 중심으로 설계합니다. 실제 MVP에서는 로그의 이메일·IP·홈 경로·토큰을 제거하고 기본 보관 기간을 둡니다.",
    securityItems: ["필요한 Discord 권한만 요청", "민감 문자열 제거 후 로그 저장", "서명된 링크와 기본 30일 보관", "관리자·제보자 삭제 지원"],
    mvp: "현재 이 페이지는 핵심 흐름을 검증하는 인터랙티브 MVP입니다. 실제 Discord 봇과 영구 저장은 파트너 검증 후 연결합니다.",
    pilotTag: "DESIGN PARTNER PROGRAM", pilotTitle: "다음 플레이테스트 제보 5건부터 함께 정리해 보겠습니다.",
    pilotBody: "봇 설치 전에 기존 제보를 진단합니다. 초기 3개 팀에는 게임별 양식 설정과 7일 운영을 직접 지원합니다.",
    benefits: ["기존 제보 5건 무료 진단", "게임별 제보 양식 설계", "7일 플레이테스트 운영 지원", "종료 후 개선 결과 정리"],
    apply: "파일럿 신청서 만들기", noCard: "카드 등록 없음 · 의무 계약 없음 · 신청서를 복사해 회신",
    faqTitle: "궁금한 점", faqs: [
      ["기존 이슈 트래커를 대체하나요?", "아니요. Discord 제보를 조사 가능한 형태로 만드는 입구에 집중합니다. 외부 트래커 연동은 핵심 가치를 검증한 뒤 추가합니다."],
      ["Discord 메시지를 모두 읽나요?", "아니요. /bug 명령, 버튼, Modal처럼 사용자가 시작한 Interaction만 처리하는 방향으로 설계합니다."],
      ["지금 바로 봇을 설치할 수 있나요?", "아직 디자인 파트너와 핵심 흐름을 검증하는 단계입니다. 먼저 기존 제보 5건을 진단하고 팀에 맞는 MVP를 운영합니다."],
    ],
    modalTitle: "파일럿 신청서 만들기", modalBody: "연락받은 이메일이나 DM에 그대로 답장할 신청 문구를 만듭니다. 정보는 이 페이지에서 전송되지 않습니다.",
    team: "팀 이름", game: "게임 이름", playtest: "다음 테스트 예정일", channel: "현재 제보 방식", contact: "Discord ID 또는 이메일",
    generate: "신청 문구 만들기", ready: "신청 문구가 준비되었습니다", readyBody: "아래 내용을 복사해 ReproLoop를 소개받은 이메일이나 DM에 답장해 주세요.",
    copyRequest: "신청 문구 복사", copied: "복사했습니다", rewrite: "다시 작성", close: "닫기", footer: "Better reports. Faster fixes. Happier testers.",
  },
  en: {
    nav: ["Product", "Live demo", "Best fit", "Security"], pilot: "Join the pilot",
    eyebrow: "Discord bug triage for 1–10 person game teams", hero1: "A bug report just landed.", hero2: "Stop asking how to reproduce it.",
    heroBody: "Turn Discord feedback into reports with builds, environments, and reproduction steps—then connect duplicate triage and fix notifications in one loop.",
    demoCta: "Try the 3-minute demo", auditCta: "Get 5 reports audited free", heroNote: "No sign-up · No install for audit · 7-day support for 3 early teams",
    raw: "REPORT FROM DISCORD", rawMessage: "The game sometimes freezes in the boss room. Restarting fixes it :(", devQuestion: "Which build? Do you have steps or logs?",
    clean: "REPORT FROM REPROLOOP", cleanTitle: "Game freezes when inventory opens after cutscene", complete: "6/6 required fields",
    build: "Build", env: "Environment", steps: "Reproduction steps", actual: "Actual result", expected: "Expected result",
    valueTitle: "Turn scattered chat into one actionable report.", valueBody: "Players stay in Discord. Developers get the context they need to start investigating.",
    values: [["Fewer follow-ups", "Collect build, environment, and steps up front."], ["Keep duplicate impact", "Group the symptom without losing reporters."], ["Return the result", "Send the fixed build back to original reporters."]],
    demoTag: "GUIDED PRODUCT DEMO", demoTitle: "Close one bug yourself.", demoBody: "Structure a fictional report, merge a duplicate, and send the fix notification in about three minutes.",
    simulated: "This is an in-browser simulation, not the live service. Your input is not saved.",
    stepNames: ["Open report", "Collect context", "Create report", "Merge duplicate", "Register fix", "Notify players", "Review result"],
    incomingTitle: "A new message landed in #bug-report", incomingBody: "It has a symptom but no build, environment, or steps. Use ReproLoop to fill the gaps.", start: "Structure this report",
    formTitle: "Collect the context needed to reproduce it", formBody: "Like a Discord Modal, it asks only for the essentials. Review the example and create the report.",
    location: "Location", frequency: "Frequency", makeReport: "Create structured report",
    structuredTitle: "BUG-247 · Game freezes when inventory opens after cutscene", actionable: "Ready to investigate", structuredBody: "One chat message is now a report a developer can reproduce immediately.", inbox: "Open in developer inbox",
    duplicateTitle: "We found two similar reports", duplicateBody: "Compare candidates with the same build, location, and freeze point. Similarity is predefined for the demo.", similarity: "Similarity", canonical: "Canonical issue",
    candidate1: "Screen freezes as boss phase two begins", candidate2: "Only audio plays after Ashen Keep cutscene", note1: "Same build · same location · same freeze point", note2: "Unknown build · no inventory action", merge: "Merge into selected issue",
    fixTitle: "Four reporters are now linked to one issue", fixBody: "Confirm reproduction and select the build containing the fix.", timeline: ["Received", "Reproduced", "Fixed"], fixedBuild: "Fixed in build", preview: "Preview fix notification",
    notifyTitle: "Message going back to players", recipients: "4 linked reporters", send: "Send fix notification", sentTitle: "You closed the reporting loop", sentBody: "These are simulated outcomes, not real customer results.",
    results: [["1", "follow-up avoided"], ["3", "duplicates linked"], ["4", "reporters notified"]], restart: "Restart demo", pilotFromDemo: "Test with our reports", back: "Back",
    workflowTag: "ONE CLOSED LOOP", workflowTitle: "From report to fix notification—without leaving Discord.",
    workflow: [["/", "Report with /bug", "Players submit the context you need inside Discord in about 60 seconds."], ["▤", "Get an actionable report", "Build, environment, results, and steps arrive together."], ["⌁", "Triage duplicates", "Group matching symptoms without losing impact or reporters."], ["↗", "Return the fix", "When a fixed build ships, every linked reporter gets the result."]],
    fitTag: "WHO IT IS FOR", fitTitle: "Built around playtests run by small teams.", fitYes: "A strong fit now", fitNo: "Not yet a fit",
    fits: ["Indie game teams with 1–10 people", "Playtests and communities run in Discord", "Repeated missing context and duplicates", "Early partners open to hands-on feedback"],
    notFits: ["Large QA organizations with approval chains", "Teams needing Jira or Linear sync today", "Communities that do not use Discord", "Teams expecting fully autonomous AI decisions"],
    securityTag: "PRIVACY BY DEFAULT", securityTitle: "Start with a design that does not read every channel.", securityBody: "ReproLoop is designed around user-initiated /bug commands, buttons, and Modals. The live MVP will redact email, IP, home paths, and tokens from logs.",
    securityItems: ["Only required Discord permissions", "Redact sensitive strings before storage", "Signed links and 30-day retention", "Deletion controls for admins and reporters"],
    mvp: "This page is an interactive MVP for validating the core loop. The live Discord bot and durable storage follow design-partner validation.",
    pilotTag: "DESIGN PARTNER PROGRAM", pilotTitle: "Let’s clean up five reports from your next playtest.", pilotBody: "Start with an audit before installing a bot. We will tailor the flow and support the first three teams for seven days.",
    benefits: ["Free audit of 5 existing reports", "A flow tailored to your game", "7 days of hands-on support", "A short outcome review"], apply: "Build my pilot request", noCard: "No card · No contract · Copy and reply directly",
    faqTitle: "Questions", faqs: [["Does this replace our issue tracker?", "No. We focus on turning Discord feedback into actionable intake. Tracker integrations follow validation."], ["Does it read every Discord message?", "No. It is designed around user-initiated /bug commands, buttons, and Modals."], ["Can we install the bot today?", "We are validating the core workflow with design partners. We start by auditing five reports, then operate a tailored MVP."]],
    modalTitle: "Build your pilot request", modalBody: "Create a request to reply with in the email or DM that brought you here. Nothing is transmitted from this page.",
    team: "Team name", game: "Game name", playtest: "Next playtest", channel: "Current report channel", contact: "Discord ID or email", generate: "Generate request", ready: "Your request is ready", readyBody: "Copy this and reply where ReproLoop was introduced.", copyRequest: "Copy request", copied: "Copied", rewrite: "Start over", close: "Close", footer: "Better reports. Faster fixes. Happier testers.",
  },
} as const;

function track(name: string, detail: Record<string, string | number> = {}) {
  if (typeof window === "undefined") return;
  try {
    const old = JSON.parse(sessionStorage.getItem("reproloop_events") || "[]");
    sessionStorage.setItem("reproloop_events", JSON.stringify([...old.slice(-29), { name, detail, at: Date.now() }]));
  } catch { /* measurement must not interrupt the demo */ }
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("ko");
  const [step, setStep] = useState<Step>(0);
  const [report, setReport] = useState(reportSeed.ko);
  const [duplicate, setDuplicate] = useState("BUG-219");
  const [fixedBuild, setFixedBuild] = useState("0.8.15-beta");
  const [pilotOpen, setPilotOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [copied, setCopied] = useState(false);
  const t = text[locale];

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    if (!pilotOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setPilotOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [pilotOpen]);

  const move = (next: Step, event?: string) => { setStep(next); if (event) track(event, { locale, step: next }); };
  const changeLocale = (next: Locale) => { setLocale(next); setReport(reportSeed[next]); setStep(0); track("language_changed", { locale: next }); };
  const restart = () => { setReport(reportSeed[locale]); setStep(0); setDuplicate("BUG-219"); setFixedBuild("0.8.15-beta"); };
  const openPilot = (source: string) => { setPilotOpen(true); setRequestText(""); track("pilot_cta_clicked", { source, locale }); };

  function buildRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => data.get(key)?.toString() || "-";
    setRequestText(locale === "ko"
      ? `[ReproLoop 파일럿 신청]\n팀: ${value("team")}\n게임: ${value("game")}\n다음 테스트: ${value("playtest")}\n현재 제보 방식: ${value("channel")}\n연락처: ${value("contact")}\n\n기존 버그 제보 5건 무료 진단과 7일 파일럿을 신청합니다.`
      : `[ReproLoop pilot request]\nTeam: ${value("team")}\nGame: ${value("game")}\nNext playtest: ${value("playtest")}\nCurrent report channel: ${value("channel")}\nContact: ${value("contact")}\n\nWe would like the free five-report audit and 7-day pilot.`);
  }

  async function copyRequest() {
    try { await navigator.clipboard.writeText(requestText); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); }
  }

  function renderDemoScene() {
    if (step === 0) return <div className="scene incoming-scene">
      <SceneHeading code="01 · INCOMING" title={t.incomingTitle} body={t.incomingBody} />
      <DiscordMessage message={t.rawMessage} />
      <button className="button primary scene-cta" onClick={() => move(1, "demo_started")}>{t.start}<span>→</span></button>
    </div>;

    if (step === 1) return <div className="scene form-scene">
      <SceneHeading code="02 · /BUG" title={t.formTitle} body={t.formBody} />
      <div className="report-form">
        <div className="field-row"><Field label={t.build}><select value={report.build} onChange={e => setReport({ ...report, build: e.target.value })}><option>0.8.14-beta</option><option>0.8.13-beta</option></select></Field><Field label={t.frequency}><select value={report.frequency} onChange={e => setReport({ ...report, frequency: e.target.value })}><option>{locale === "ko" ? "5회 중 3회" : "3 of 5 attempts"}</option><option>{locale === "ko" ? "항상" : "Every time"}</option><option>{locale === "ko" ? "한 번" : "Once"}</option></select></Field></div>
        <div className="field-row"><Field label={t.location}><input value={report.location} onChange={e => setReport({ ...report, location: e.target.value })} /></Field><Field label={t.env}><input value={report.platform} onChange={e => setReport({ ...report, platform: e.target.value })} /></Field></div>
        <Field label={t.actual}><textarea value={report.actual} onChange={e => setReport({ ...report, actual: e.target.value })} /></Field>
        <Field label={t.expected}><textarea value={report.expected} onChange={e => setReport({ ...report, expected: e.target.value })} /></Field>
        <Field label={t.steps}><textarea className="steps-field" value={report.steps} onChange={e => setReport({ ...report, steps: e.target.value })} /></Field>
      </div><SceneActions back={t.back} onBack={() => move(0)} next={t.makeReport} onNext={() => move(2, "report_submitted")} />
    </div>;

    if (step === 2) return <div className="scene">
      <SceneHeading code="03 · ACTIONABLE" title={t.structuredTitle} body={t.structuredBody} />
      <article className="structured-report"><div className="report-head"><div><span>BUG-247</span><b>HIGH</b></div><strong>● {t.actionable}</strong></div><div className="complete-bar"><span>{t.complete}</span><i /></div><div className="facts"><Fact label={t.build} value={report.build} /><Fact label={t.env} value={report.platform} /><Fact label={t.frequency} value={report.frequency} /></div><div className="report-detail"><Fact label={t.actual} value={report.actual} /><Fact label={t.expected} value={report.expected} /><Fact label={t.steps} value={report.steps} wide /></div></article>
      <SceneActions back={t.back} onBack={() => move(1)} next={t.inbox} onNext={() => move(3, "structured_report_viewed")} />
    </div>;

    if (step === 3) return <div className="scene">
      <SceneHeading code="04 · DUPLICATE REVIEW" title={t.duplicateTitle} body={t.duplicateBody} />
      <div className="candidates">{[
        ["BUG-219", "92%", t.candidate1, t.note1], ["BUG-204", "74%", t.candidate2, t.note2],
      ].map(item => <button key={item[0]} className={`candidate ${duplicate === item[0] ? "selected" : ""}`} onClick={() => setDuplicate(item[0])}><span className="radio"><i /></span><div><small>{item[0]} {item[0] === "BUG-219" && <em>{t.canonical}</em>}</small><h4>{item[2]}</h4><p>{item[3]}</p></div><strong><small>{t.similarity}</small>{item[1]}</strong></button>)}</div>
      <SceneActions back={t.back} onBack={() => move(2)} next={t.merge} onNext={() => move(4, "duplicate_merged")} />
    </div>;

    if (step === 4) return <div className="scene">
      <SceneHeading code="05 · FIX READY" title={t.fixTitle} body={t.fixBody} />
      <div className="fix-panel"><div className="timeline">{t.timeline.map((label, index) => <div key={label}><span>{index < 2 ? "✓" : "●"}</span><b>{label}</b></div>)}</div><div className="fix-row"><div><small>{t.canonical}</small><b>{duplicate} · {t.candidate1}</b></div><Field label={t.fixedBuild}><select value={fixedBuild} onChange={e => setFixedBuild(e.target.value)}><option>0.8.15-beta</option><option>0.8.16-beta</option></select></Field></div><div className="reporters"><span>PF</span><span>MB</span><span>N7</span><span>+1</span><b>{t.recipients}</b></div></div>
      <SceneActions back={t.back} onBack={() => move(3)} next={t.preview} onNext={() => move(5, "fix_registered")} />
    </div>;

    if (step === 5) return <div className="scene">
      <SceneHeading code="06 · CLOSE THE LOOP" title={t.notifyTitle} body={`${t.recipients} · Discord DM`} />
      <div className="notification"><div className="bot">R</div><div><div className="message-meta"><b>ReproLoop</b><em>APP</em><span>{locale === "ko" ? "방금" : "now"}</span></div><p>{locale === "ko" ? `제보해 주신 ‘보스 2페이즈 화면 정지’ 문제가 ${fixedBuild}에서 수정되었습니다. 업데이트 후 다시 확인해 주세요.` : `The “boss phase two freeze” you reported has been fixed in ${fixedBuild}. Please update and try it again.`}</p><div className="fixed-card"><span>FIXED IN</span><b>{fixedBuild}</b><i>✓</i></div></div></div>
      <SceneActions back={t.back} onBack={() => move(4)} next={t.send} onNext={() => move(6, "demo_completed")} />
    </div>;

    return <div className="scene summary"><div className="success">✓</div><SceneHeading code="LOOP CLOSED" title={t.sentTitle} body={t.sentBody} /><div className="results">{t.results.map(result => <div key={result[1]}><strong>{result[0]}</strong><span>{result[1]}</span></div>)}</div><div className="summary-actions"><button className="quiet" onClick={restart}>↻ {t.restart}</button><button className="button primary" onClick={() => openPilot("demo")}>{t.pilotFromDemo}<span>→</span></button></div></div>;
  }

  return <main>
    <header className="site-header"><a className="brand" href="#top"><BrandMark /><b>REPRO<span>LOOP</span></b><small>beta</small></a><nav>{t.nav.map((item, index) => <a key={item} href={["#product", "#demo", "#fit", "#security"][index]}>{item}</a>)}</nav><div className="header-actions"><div className="lang"><button className={locale === "ko" ? "active" : ""} onClick={() => changeLocale("ko")}>KO</button><span>/</span><button className={locale === "en" ? "active" : ""} onClick={() => changeLocale("en")}>EN</button></div><button className="header-cta" onClick={() => openPilot("header")}>{t.pilot}<span>↗</span></button></div></header>

    <section className="hero shell" id="top"><div className="hero-grid" /><div className="hero-copy"><p className="eyebrow"><i />{t.eyebrow}</p><h1>{t.hero1}<span>{t.hero2}</span></h1><p className="hero-body">{t.heroBody}</p><div className="hero-actions"><a className="button primary" href="#demo">{t.demoCta}<span>↓</span></a><button className="button secondary" onClick={() => openPilot("hero")}>{t.auditCta}<span>↗</span></button></div><p className="hero-note"><span>✓</span>{t.heroNote}</p></div><div className="product-preview"><div className="window-bar"><span>● ● ●</span><b>PLAYTEST / BUG-REPORTS</b><em>LIVE</em></div><div className="raw-card"><small>{t.raw}</small><DiscordMessage message={t.rawMessage} /><div className="dev-question"><span>DEV</span>{t.devQuestion}</div></div><div className="transform">STRUCTURE <i /></div><div className="clean-card"><div><small>{t.clean}</small><b>{t.complete}</b></div><h2>{t.cleanTitle}</h2><div className="preview-facts"><Fact label={t.build} value="0.8.14-beta" /><Fact label={t.env} value="Win 11 · Steam" /></div><div className="preview-steps"><small>{t.steps}</small><p>01 · Ashen Keep 입장</p><p>02 · 컷신 건너뛰기</p><p>03 · 인벤토리 열기 → FREEZE</p></div><i className="scan" /></div></div></section>

    <section className="value shell" id="product"><div className="section-title split"><h2>{t.valueTitle}</h2><p>{t.valueBody}</p></div><div className="value-grid">{t.values.map((value, index) => <article key={value[0]}><span>0{index + 1}</span><div className={`value-icon icon-${index}`}><i /><i /><i /></div><h3>{value[0]}</h3><p>{value[1]}</p></article>)}</div></section>

    <section className="demo-section" id="demo"><div className="shell"><div className="section-title centered"><p className="eyebrow">{t.demoTag}</p><h2>{t.demoTitle}</h2><p>{t.demoBody}</p></div><div className="demo-shell"><div className="demo-top"><div><BrandMark /><b>REPROLOOP</b><small>INTERACTIVE MVP</small></div><span>EF · Emberfall Playtest</span><button onClick={restart} aria-label={t.restart}>↻</button></div><div className="progress"><div><small>STEP {step + 1} / 7</small><b>{t.stepNames[step]}</b></div><nav>{t.stepNames.map((name, index) => <button key={name} className={`${index <= step ? "done" : ""} ${index === step ? "current" : ""}`} onClick={() => index < step && setStep(index as Step)} aria-label={name}><span>{index < step ? "✓" : index + 1}</span></button>)}</nav></div><div className="demo-body">{renderDemoScene()}</div><div className="disclaimer">ⓘ {t.simulated}</div></div></div></section>

    <section className="workflow shell"><div className="section-title centered"><p className="eyebrow">{t.workflowTag}</p><h2>{t.workflowTitle}</h2></div><div className="workflow-grid">{t.workflow.map((item, index) => <article key={item[1]}><small>0{index + 1}</small><div>{item[0]}</div><h3>{item[1]}</h3><p>{item[2]}</p>{index < 3 && <i>→</i>}</article>)}</div></section>

    <section className="fit" id="fit"><div className="shell fit-inner"><div><p className="eyebrow">{t.fitTag}</p><h2>{t.fitTitle}</h2></div><div className="fit-grid"><FitCard title={t.fitYes} items={t.fits} positive /><FitCard title={t.fitNo} items={t.notFits} /></div></div></section>

    <section className="security shell" id="security"><div className="security-art" aria-hidden="true"><i /><i /><div>R</div><span>/bug interaction</span><span>TOKEN ·•••••</span><span>DELETE / 30D</span></div><div className="security-copy"><p className="eyebrow">{t.securityTag}</p><h2>{t.securityTitle}</h2><p>{t.securityBody}</p><ul>{t.securityItems.map(item => <li key={item}><span>✓</span>{item}</li>)}</ul><aside><b>MVP</b><p>{t.mvp}</p></aside></div></section>

    <section className="pilot shell"><div className="pilot-card"><div><p className="eyebrow">{t.pilotTag}</p><h2>{t.pilotTitle}</h2><p>{t.pilotBody}</p><button className="button primary" onClick={() => openPilot("pilot")}>{t.apply}<span>→</span></button><small>{t.noCard}</small></div><ol>{t.benefits.map((item, index) => <li key={item}><span>0{index + 1}</span><b>{item}</b><i>✓</i></li>)}</ol></div></section>

    <section className="faq shell"><h2>{t.faqTitle}</h2><div>{t.faqs.map((faq, index) => <details key={faq[0]} open={index === 0}><summary>{faq[0]}<span>+</span></summary><p>{faq[1]}</p></details>)}</div></section>
    <footer className="footer shell"><a className="brand" href="#top"><BrandMark /><b>REPRO<span>LOOP</span></b></a><p>{t.footer}</p><div><button onClick={() => changeLocale("ko")}>KO</button> / <button onClick={() => changeLocale("en")}>EN</button></div></footer>

    {pilotOpen && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setPilotOpen(false)}><section className="pilot-modal" role="dialog" aria-modal="true" aria-labelledby="pilot-title"><button className="modal-close" onClick={() => setPilotOpen(false)} aria-label={t.close}>×</button>{!requestText ? <><p className="eyebrow">EARLY ACCESS</p><h2 id="pilot-title">{t.modalTitle}</h2><p>{t.modalBody}</p><form onSubmit={buildRequest}><div className="field-row"><Field label={t.team}><input name="team" required /></Field><Field label={t.game}><input name="game" required /></Field></div><div className="field-row"><Field label={t.playtest}><input name="playtest" type="date" required /></Field><Field label={t.channel}><select name="channel"><option>Discord</option><option>Steam Community</option><option>Google Form</option><option>Other</option></select></Field></div><Field label={t.contact}><input name="contact" required placeholder="@handle or name@example.com" /></Field><button className="button primary modal-submit" type="submit">{t.generate}<span>→</span></button></form></> : <><div className="success small">✓</div><h2 id="pilot-title">{t.ready}</h2><p>{t.readyBody}</p><pre>{requestText}</pre><button className="button primary modal-submit" onClick={copyRequest}>{copied ? t.copied : t.copyRequest}<span>{copied ? "✓" : "⧉"}</span></button><button className="quiet rewrite" onClick={() => setRequestText("")}>{t.rewrite}</button></>}</section></div>}
  </main>;
}

function BrandMark() { return <span className="brand-mark"><i /></span>; }
function SceneHeading({ code, title, body }: { code: string; title: string; body: string }) { return <div className="scene-heading"><small>{code}</small><h3>{title}</h3><p>{body}</p></div>; }
function DiscordMessage({ message }: { message: string }) { return <div className="discord-message"><span>PF</span><div><div className="message-meta"><b>pixel_fox</b><small>21:42</small></div><p>{message}</p><em>🐛 1</em></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={`fact ${wide ? "wide" : ""}`}><small>{label}</small><p className={wide ? "preline" : ""}>{value}</p></div>; }
function SceneActions({ back, onBack, next, onNext }: { back: string; onBack: () => void; next: string; onNext: () => void }) { return <div className="scene-actions"><button className="quiet" onClick={onBack}>{back}</button><button className="button primary" onClick={onNext}>{next}<span>→</span></button></div>; }
function FitCard({ title, items, positive = false }: { title: string; items: readonly string[]; positive?: boolean }) { return <article className={positive ? "positive" : ""}><h3><span>{positive ? "✓" : "×"}</span>{title}</h3><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></article>; }
