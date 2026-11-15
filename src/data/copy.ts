/**
 * 확산의 숲 온라인 쉼터 · 화면 문구 전체
 * ------------------------------------------------------------
 * 화면에 보이는 모든 글자는 이 파일 한 곳에 있습니다.
 * 코드를 몰라도 따옴표 안의 글자만 고치면 화면에 반영됩니다.
 *
 * 표기 규칙 (제작 지시서 4-0)
 *  - 공간명은 항상 "확산의 숲"
 *  - 연구 주체 서명은 아래 두 상수로만 씁니다.
 *  - "~연구하고 있어요"로 끝내고, 효과를 단정하는 표현은 쓰지 않습니다.
 *  - '치료' 대신 '치유'. 환자·질환과 연결하는 표현 금지.
 */

/** 연구 주체 서명 · 전체 표기 (팀이 여기 한 곳만 바꾸면 전체 화면에 반영됩니다) */
export const SIGNATURE_FULL = '한국산림복지진흥원 산림복지디지털연구실 효과연구확산팀';
/** 연구 주체 서명 · 짧은 표기 */
export const SIGNATURE_SHORT = '산림복지디지털연구실 효과연구확산팀';

/** 공간명 */
export const SPACE_NAME = '확산의 숲';
/** 서비스 설명이 필요할 때 */
export const SERVICE_NAME = '확산의 숲 온라인 쉼터';

export const COPY = {
  /** ① 첫 로딩 */
  boot: {
    title: SPACE_NAME,
    subtitle: `${SIGNATURE_FULL}이 연구하는 숲`,
    lines: [
      '숲에서 보낸 시간이 마음에 어떤 변화를 주는지 연구하고 있어요.',
      '15년 가까이 숲이 사람에게 주는 변화를 연구해 왔어요.',
      '일에 지친 직장인과 숲의 관계를 연구하고 있어요.',
      '숲의 향이 사람에게 주는 변화도 연구하고 있어요.',
    ],
    done: '숲 입구에 도착했어요',
  },

  /** ② 숲 고르기 */
  select: {
    label: `${SPACE_NAME} · ${SIGNATURE_SHORT}이 연구하는 숲들`,
    title: '오늘은 어느 숲에 앉아볼까요?',
    subtitle: '퇴근하고 10분, 다녀온 숲에 다시 앉아 쉬어 가세요.',
    open: '지금 앉아볼 수 있어요',
    soon: '곧 열려요',
    soonToast: '이 숲은 곧 열려요. 오늘은 대전숲체원에 앉아보세요.',
    moreHealingForests: '그 밖의 치유의숲도 곧 열려요',
    footer: '털어놓은 말은 저장되지 않아요.',
  },

  /** ③ 숲 진입 로딩 (준비 문구와 둘째 줄은 forests.json의 preparingLine / entryLine) */
  entry: {
    labelOf: (forestName: string) => `${SPACE_NAME} · ${forestName}`,
  },

  /** ④ 숲 안 */
  forest: {
    labelOf: (forestName: string) => `${SPACE_NAME} · ${forestName}`,
    demoNotice: '시연 화면 · 함께 있는 방문자는 예시예요',
    soundOn: '소리 켜기',
    welcome: {
      default: '천천히 걸어보고, 마음에 드는 자리에 앉아 쉬어 가세요.',
      kakao: '얼마 전 다녀가신 대전숲체원, 오늘은 화면으로 다시 걸어보세요.',
      booth: '축제에서 만난 숲, 이번엔 대전숲체원을 걸어보세요.',
      homepage: '퇴근하고 10분, 숲에 앉아 쉬어 가세요.',
    } as Record<string, string>,
    places: {
      gate: '숲 입구',
      plaza: '잔디광장',
      deck: '관망데크',
      valley: '골짜기숲길',
    } as Record<string, string>,
    buttons: {
      sit: '앉기',
      stand: '일어나기',
      breathe: '숨쉬기',
      confide: '털어놓기',
      places: '장소',
      sound: '소리',
      exit: '나가기',
      close: '닫기',
    },
    /** 화면 낭독기용 이름(화면에는 보이지 않음) */
    mainActions: '주요 동작',
    moveHint: '가고 싶은 곳을 눌러보세요.',
    sitHint: '가까운 벤치로 가볼까요?',
    avatarPick: {
      title: '오늘은 어떤 옷을 입고 걸어볼까요?',
      colors: { moss: '이끼색', beige: '베이지', navy: '남색', chestnut: '밤색' } as Record<string, string>,
    },
    plaque: {
      big: SPACE_NAME,
      small: `${SIGNATURE_SHORT}이 연구하는 숲`,
    },
    meBadge: '나',
    researcherName: '숲지기 연구원',
    /** 시연용 방문자·내 아바타에 무작위로 붙는 숲 낱말 이름 */
    names: [
      '쉬어가는 바람', '느린 솔방울', '조용한 이끼', '따뜻한 편백', '작은 개울', '노을 단풍',
      '고요한 능선', '저녁 산책', '둥근 조약돌', '포근한 낙엽', '맑은 숲길', '느긋한 도토리',
      '잔잔한 물소리', '늦가을 햇살',
    ],
  },

  /** 숨쉬기 */
  breathe: {
    inhale: '들이쉬어요',
    hold: '잠시 머물러요',
    exhale: '천천히 내쉬어요',
    done: '잘하셨어요. 편하실 때까지 더 앉아 계세요.',
  },

  /** 털어놓기 */
  confide: {
    guide: '여기는 대나무숲이에요. 누구에게도 보이지 않으니 편하게 털어놓으세요.',
    placeholder: '오늘 하고 싶었던 말을 적어보세요.',
    submit: '숲에 묻기',
    close: '닫기',
    footer: '적은 말은 저장되지 않고 바로 사라져요.',
    after: {
      title: '털어놓은 말은 숲에 묻어두었어요.',
      line1: '숲은 비밀을 퍼뜨리지 않아요.',
      line2: '대신, 숲이 사람에게 주는 변화를 연구해 널리 알려요.',
    },
  },

  /** 위기 표현 안내 */
  crisis: {
    title: '많이 힘드셨겠어요.',
    line1: '지금 이야기를 들어줄 사람이 있어요.',
    line2pre: '자살예방 상담전화 ',
    number: '109',
    line2post: ' (24시간)',
    call: '전화 걸기',
    close: '닫기',
  },

  /** 숲지기 연구원 대사 (연구 수치는 넣지 않습니다) */
  researchers: {
    plaza: [
      '저는 이 숲이 사람에게 어떤 도움이 되는지 연구해요.',
      '가족과 다녀가신 이 숲도, 저희가 늘 살펴보는 곳이에요.',
    ],
    deckroad: [
      '일에 지친 분들과 숲에서 함께 연구해 왔어요.',
      '숲에 다녀온 뒤 마음이 어떻게 달라지는지 살펴보고 있어요.',
    ],
    valley: [
      '숲의 향이 사람에게 주는 변화도 연구하고 있어요.',
      `저희는 ${SIGNATURE_FULL}이에요.`,
    ],
  } as Record<string, string[]>,

  /** 나무 표찰 */
  signs: {
    hinoki: { name: '편백나무', line: '연구 중' },
    pine: { name: '소나무', line: '숲의 향을 연구하고 있어요' },
    valley: { name: '골짜기숲길', line: '물소리와 쉼의 관계를 살펴보고 있어요' },
    maple: { name: '단풍나무', line: '오늘도 관찰 중' },
    deck: { name: '관망데크', line: '숲을 바라보는 쉼도 연구하고 있어요' },
    gate: { name: '숲 입구', line: `이 숲은 ${SIGNATURE_SHORT}이 연구해요` },
  } as Record<string, { name: string; line: string }>,

  /** 숲지기의 질문 (재방문자) */
  recall: {
    lead: '숲지기가 여쭤봐요.',
    question: '이 숲은 어디에서 연구하는 숲일까요?',
    options: ['국립산림과학원', '산림청', SIGNATURE_FULL],
    dontKnow: '잘 모르겠어요',
    correct: '맞아요. 다시 찾아주셔서 고마워요.',
    wrong: `이 숲은 ${SIGNATURE_SHORT}이 연구하고 있어요. 또 들러주세요.`,
  },

  /** ⑤ 종료 화면 */
  exit: {
    labelOf: (forestName: string) => `${SPACE_NAME} · ${forestName}`,
    A: {
      title: '편안히 쉬어 가셨나요',
      /** {time} 자리에 "12분" 또는 "잠시"가 들어갑니다 */
      line1: '오늘 이 숲에 {time} 앉아 계셨어요.',
      line2: `다녀오신 이 숲의 효과, ${SIGNATURE_SHORT}이 연구하고 있어요.`,
    },
    B: {
      title: '털어놓은 말은 숲에 묻어두었어요',
      line1: '숲은 비밀을 퍼뜨리지 않아요.',
      line2: '대신 숲이 사람에게 주는 변화를 연구해 널리 알려요.',
      sign: SIGNATURE_FULL,
    },
    C: {
      title: '숲지기 연구원이 인사를 전해요',
      line1: '"오늘 쉬어 가신 이 숲, 저희가 계속 살펴보고 연구할게요."',
      sign: SIGNATURE_SHORT,
    },
    minutes: (m: number) => `${m}분`,
    moment: '잠시',
    stay: '다시 앉아 있기',
    revisit: '이 숲 다시 가보기',
    otherForests: '다른 숲 보기',
    bookingMissing: '예약 페이지는 준비 중이에요.',
    surveyLead: '잠깐, 세 가지만 여쭤봐도 될까요?',
    surveyOptional: '(선택)',
    surveySkip: '건너뛰기',
    surveyDone: '고맙습니다. 또 쉬어 가세요.',
    footer: '털어놓은 말은 저장되지 않았어요. 설문 응답은 이름 없이 집계돼요.',
    survey: [
      {
        q: '숲의 효과를 연구하는 사업이 있다는 걸 알고 계셨나요?',
        options: ['원래 알고 있었어요', '오늘 처음 알았어요'],
        shuffle: false,
        last: null as string | null,
      },
      {
        q: '이 숲의 효과를 연구하는 곳은 어디일까요?',
        options: ['국립산림과학원', '산림청', SIGNATURE_FULL],
        shuffle: true,
        last: '잘 모르겠어요' as string | null,
      },
      {
        q: '한국산림복지진흥원을 전에 들어보셨나요?',
        options: ['잘 알고 있었어요', '이름만 들어봤어요', '처음 들어봐요'],
        shuffle: false,
        last: null as string | null,
      },
    ],
  },

  /** 3D를 띄울 수 없을 때의 대체 화면 */
  fallback: {
    alt: '초저녁 국립대전숲체원 풍경 그림',
  },

  /** 측정 패널 (?debug=1, 발표 시연용) */
  debug: {
    title: '측정 패널 (데모용 로컬 기록)',
    reset: '기록 지우기',
    bySrc: '유입 경로별 방문 (src)',
    byCohort: '발송 대상군별 방문 (c)',
    engage: '참여',
    rows: {
      enter: '숲 입장',
      place: '장소 도착',
      sit: '앉기',
      breathe: '숨쉬기 완료',
      confide: '털어놓기(횟수만)',
      researcher: '연구원 누름',
      sign: '표찰 읽음',
      exit: '종료 화면',
      booking: '예약 누름',
    },
    surveyOf: (q: string) => `설문 ${q} 응답 분포`,
    recall: '재방문 질문',
    recallCount: '응답 수',
    recallRate: '정답률',
    lowTier: '저사양',
  },
};

/** 위기 표현 감지 (띄어쓰기 변형 허용) */
export const CRISIS_PATTERNS: RegExp[] = [
  /죽\s*고\s*싶/,
  /죽\s*을\s*래/,
  /자\s*살/,
  /사\s*라\s*지\s*고\s*싶/,
  /살\s*기\s*싫/,
  /끝\s*내\s*고\s*싶/,
  /목\s*숨/,
  /자\s*해/,
];
