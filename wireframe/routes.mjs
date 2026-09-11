export const ROUTES_CHECKED_ON = '2026-09-11';

// 経路上の分岐点。「保留できる期限」は一般的な目安であり、地域・学校・入試方式で前後する。
export const decisionPoints = {
  lab: {
    name: '専攻・研究室を選ぶ',
    defer: '大学2〜3年ごろまで',
    detail: '学科に入ってから、その中でさらに選ぶ段階。配属の時期は大学によって違います。'
  },
  faculty: {
    name: '学部・学科を選ぶ',
    defer: '高3の夏ごろまで',
    detail: '一般選抜なら出願は高3の冬。総合型選抜・学校推薦型選抜を使う場合は高3の夏ごろに前倒しになります。'
  },
  course: {
    name: '文理・コースを選ぶ',
    defer: '高1の11月ごろまで',
    detail: '2年生の科目選択に向けた希望調査の時期。学校によって違い、入学時に学科で決まっている高校もあります。'
  },
  highschool: {
    name: '高校を選ぶ',
    defer: '中3の12月ごろまで',
    detail: '公立の一般入試を想定した目安。私立の併願や推薦を使う場合は前倒しになります。'
  }
};

// 経路ごとに、その先で実際に要求される数学の水準。
export const mathLevels = {
  1: {
    label: '数学I・A中心',
    summary: '観察・記録・分類が中心。数学は表とグラフの読み書きから。',
    detail: '数量を扱う場面はありますが、微積分を前提にした授業は多くありません。数学が苦手でも入口は閉じません。'
  },
  2: {
    label: '数学II・B ＋ データの扱い',
    summary: '調べた結果を統計で比べる。平均・ばらつき・相関を使う。',
    detail: '実験や調査のデータを扱うため、確率・統計を使います。数学IIIを必須としない学科もあります。'
  },
  3: {
    label: '数学III・微積分まで',
    summary: '変化を式で表して予測する。物理と並行して使う。',
    detail: '力学・電気・信号処理・数理モデルを扱うため、微積分と線形代数を道具として使い続けます。'
  }
};

// 経路の型。高校の段階で何が決まり、何が決まらないかが型ごとに違う。
export const routeKinds = {
  general: {
    order: 1,
    name: '普通科 → 総合大学',
    summary: '高校では分野を決めず、大学の学部選択で決める。',
    course: {
      title: '文理・科目選択で方向を決める',
      detail: '高1の後半に文理を選び、理科の科目（物理・化学・生物）を決めます。この時点でも学部までは決まりません。'
    },
    highschool: {
      title: '普通科（理科と数学を続けられる学校）',
      detail: '学科名で分野は決まりません。理科3科目の開講状況と、数学をどこまで履修できるかだけ確認しておけば足ります。'
    },
    now: '志望校を決める前に確かめられるのは、その高校で理科と数学をどこまで履修できるかだけです。分野の決定はここでは起きません。'
  },
  specialized: {
    order: 2,
    name: '専門学科の高校 → 専門の大学',
    summary: '高校の3年間をその分野に使う。早く深く関われるかわりに、分野の選択が前倒しになる。',
    course: {
      title: '入学時に学科で決まっている',
      detail: 'この型では文理選択という分岐がありません。そのぶん高校選択のときに分野の判断が必要になります。'
    },
    highschool: {
      title: '専門学科のある高校',
      detail: '実習・専門科目が3年間続きます。他分野へ進めなくなるわけではありませんが、進路変更のコストは普通科より大きくなります。'
    },
    now: 'この型だけは、分野の判断が高校選択と同時に来ます。迷っているなら、先に普通科ルートを見てから比べてください。'
  },
  kosen: {
    order: 3,
    name: '高専 → 大学編入',
    summary: '5年制。高校受験の段階で入り、大学3年次への編入で進む道。',
    course: {
      title: '入学時に学科で決まっている',
      detail: '1年生から専門科目が始まります。大学編入を選ぶかどうかは4〜5年生で判断します。'
    },
    highschool: {
      title: '高等専門学校（5年制）',
      detail: '高校ではなく高専という別の学校種です。中学からの入試で入り、卒業時は短大と同じ扱い。就職・専攻科・大学編入から選べます。'
    },
    now: '高専入試は中3の冬。普通科より早い時期に手続きが動く学校が多いので、日程だけは先に確認してください。',
    nowLink: 'kosenList'
  },
  switch: {
    order: 4,
    name: '高校では別分野 → 大学で転向',
    summary: '高校ではこの分野に触れず、大学から入る。実際に多い道。',
    course: {
      title: '出願に必要な科目だけ押さえる',
      detail: '学部の入試科目に合う選択をしておけば、高校で扱わなかった分野にも出願できます。'
    },
    highschool: {
      title: 'どの学科でもよい',
      detail: '高校の学科と大学の学部は直結していません。この経路では、高校選択の段階でこの分野を選んだことにはなりません。'
    },
    now: 'いま決める必要があるのは高校であって、分野ではありません。この経路は「今は決めない」という選択そのものです。'
  }
};

const link = (name, url, source) => ({name, url, source});

// 大学・学部は公式ページが示す範囲だけを記載する。学科・研究室の構成は各サイトで確認する。
const universities = {
  kaiyodaiLife: link('東京海洋大学 海洋生命科学部', 'https://www.kaiyodai.ac.jp/faculty/s/', '東京海洋大学'),
  kaiyodaiEnv: link('東京海洋大学 海洋資源環境学部', 'https://www.kaiyodai.ac.jp/faculty/r/', '東京海洋大学'),
  kaiyodaiEng: link('東京海洋大学 海洋工学部', 'https://www.kaiyodai.ac.jp/faculty/e/', '東京海洋大学'),
  mieBio: link('三重大学 生物資源学部', 'https://www.bio.mie-u.ac.jp/', '三重大学'),
  utokyoAgri: link('東京大学 農学部', 'https://www.a.u-tokyo.ac.jp/', '東京大学'),
  nodaiBio: link('東京農業大学 応用生物科学部', 'https://www.nodai.ac.jp/academics/bio/', '東京農業大学'),
  aizu: link('会津大学 コンピュータ理工学部', 'https://www.u-aizu.ac.jp/curriculum/', '会津大学'),
  ritsumeiImage: link('立命館大学 映像学部', 'https://admission.ritsumei.ac.jp/faculty/cias.html', '立命館大学'),
  kyushuAcoustic: link('九州大学 芸術工学部 音響設計コース', 'https://www.design.kyushu-u.ac.jp/schools/ad/', '九州大学'),
  toyohashi: link('豊橋技術科学大学', 'https://www.tut.ac.jp/', '豊橋技術科学大学'),
  nagaoka: link('長岡技術科学大学', 'https://www.nagaokaut.ac.jp/', '長岡技術科学大学')
};

const schools = {
  oshima: link('東京都立大島海洋国際高等学校', 'https://www.metro.ed.jp/oosimakaiyokokusai-h/index.html', '東京都立大島海洋国際高等学校'),
  tobaShip: link('鳥羽商船高等専門学校 商船学科', 'https://www.toba-cmt.ac.jp/gakka/ship/', '鳥羽商船高等専門学校'),
  tobaDepartments: link('鳥羽商船高等専門学校 学科紹介', 'https://www.toba-cmt.ac.jp/gakka/', '鳥羽商船高等専門学校'),
  tokyoCtInfo: link('東京工業高等専門学校 情報工学科', 'https://www.tokyo-ct.ac.jp/department/computer_science/', '東京工業高等専門学校'),
  tokyoCt: link('東京工業高等専門学校 学科一覧', 'https://www.tokyo-ct.ac.jp/department/', '東京工業高等専門学校'),
  kosenList: link('全国の高等専門学校を探す', 'https://www.kosen-k.go.jp/', '独立行政法人 国立高等専門学校機構'),
  metroAdmission: link('都立高校の入試・学科を調べる', 'https://www.kyoiku.metro.tokyo.lg.jp/admission/high_school/', '東京都教育委員会')
};

// 領域ごとの経路。theme は研究室段階で扱われる問いの例、why はその型を選ぶ意味。
const routeData = {
  ecology: {
    general: {math: 2, university: universities.mieBio, theme: '生き物と環境の関係を、野外調査とデータで確かめる', why: '高校では分野を決めず、生物・化学を続けながら大学で絞る。最も人数の多い道です。', highschoolLink: schools.metroAdmission},
    specialized: {math: 1, university: universities.kaiyodaiLife, theme: '海の生物資源を、実習と観測から扱う', why: '高校の段階から海と関わる実習がある。3年間その環境に居られるかどうかが判断の中心になります。', school: schools.oshima, highschoolTitle: '海洋・水産系の専門学科'},
    kosen: {math: 3, university: universities.toyohashi, theme: '観測機器や船を通して、海の現場に関わる', why: '生き物そのものより、海で使う技術から関わる道。編入で理工系の大学へ進みます。', school: schools.tobaDepartments, highschoolTitle: '商船・工業系の高専'},
    switch: {math: 2, university: universities.utokyoAgri, theme: '生物・環境・食料生産を横断して扱う', why: '高校で生物を専門に扱わなくても、入試科目を満たせば出願できます。', highschoolLink: schools.metroAdmission}
  },
  environment: {
    general: {math: 2, university: universities.kaiyodaiEnv, theme: '海洋環境と資源の変化を、観測データで捉える', why: '普通科から理系に進み、大学で環境を扱う学部を選ぶ道。', highschoolLink: schools.metroAdmission},
    specialized: {math: 1, university: universities.mieBio, theme: '地域の環境と、そこでの生産を合わせて考える', why: '農業・水産・環境系の学科で、実習を通して環境に関わる道。', highschoolTitle: '農業・水産・環境系の専門学科', highschoolLink: schools.metroAdmission},
    kosen: {math: 3, university: universities.nagaoka, theme: '環境を測る・きれいにする技術をつくる', why: '環境問題を技術として扱う道。物質工学・環境都市工学などの学科から編入します。', school: schools.tokyoCt, highschoolTitle: '工業系の高専'},
    switch: {math: 2, university: universities.utokyoAgri, theme: '人の活動と自然環境の関係を扱う', why: '高校で環境に触れていなくても、大学の学部選択で入れます。', highschoolLink: schools.metroAdmission}
  },
  engineering: {
    general: {math: 3, university: universities.kaiyodaiEng, theme: '船・観測装置・海上物流の仕組みを設計する', why: '普通科で数学IIIと物理を積み、大学で工学部を選ぶ道。', highschoolLink: schools.metroAdmission},
    specialized: {math: 2, university: universities.kaiyodaiEng, theme: '船を動かす技術を、資格と実習から身につける', why: '商船・工業高校で実習から入る道。海技士など資格に直結する課程もあります。', highschoolTitle: '商船・工業系の専門学科', highschoolLink: schools.metroAdmission},
    kosen: {math: 3, university: universities.toyohashi, theme: '機械・電気・制御を、実験と製作で扱う', why: '高専の5年間で専門を積み、編入で技術系大学へ進む道。工学ではよく使われる経路です。', school: schools.tobaShip, highschoolTitle: '商船・工業系の高専'},
    switch: {math: 3, university: universities.kaiyodaiEng, theme: '海という条件のもとで機械や情報を扱う', why: '高校で工業を扱わなくても、数学IIIと物理を選択していれば出願できます。', highschoolLink: schools.metroAdmission}
  },
  information: {
    general: {math: 2, university: universities.aizu, theme: 'プログラムとデータの仕組みを、理論と実装の両面から扱う', why: '普通科から情報系学部へ。数学IIIを課さない入試方式がある大学もあります。', highschoolLink: schools.metroAdmission},
    specialized: {math: 1, university: universities.aizu, theme: '情報を扱う技術を、資格と実習から身につける', why: '工業高校の情報系学科で、早くから実習と資格に取り組む道。', highschoolTitle: '情報・工業系の専門学科', highschoolLink: schools.metroAdmission},
    kosen: {math: 3, university: universities.toyohashi, theme: 'ソフトウェアとハードウェアの両方を扱う', why: '高専の情報工学科から編入する道。1年生から専門科目が始まります。', school: schools.tokyoCtInfo, highschoolTitle: '情報系の高専'},
    switch: {math: 2, university: universities.aizu, theme: '情報の技術を、別の分野の問題に使う', why: '情報科学は高校の学科を問わず入りやすい分野です。大学から始める人が多くいます。', highschoolLink: schools.metroAdmission}
  },
  food: {
    general: {math: 2, university: universities.nodaiBio, theme: '食品の成分や微生物の働きを、実験で確かめる', why: '普通科から化学・生物を続け、大学で食品・応用生物系を選ぶ道。', highschoolLink: schools.metroAdmission},
    specialized: {math: 1, university: universities.kaiyodaiLife, theme: '食品の生産と品質を、実習を通して扱う', why: '農業・食品系の専門学科で、製造実習から入る道。', highschoolTitle: '農業・食品系の専門学科（食品科学科など）', highschoolLink: schools.metroAdmission},
    kosen: {math: 3, university: universities.nagaoka, theme: '食品を、化学プロセスと装置の側から扱う', why: '物質工学系の高専から編入する道。料理ではなく、化学と製造技術として扱います。', school: schools.tokyoCt, highschoolTitle: '物質・化学系の高専'},
    switch: {math: 2, university: universities.nodaiBio, theme: '食と健康、食料生産の仕組みを扱う', why: '高校で食品を扱わなくても、化学・生物の選択があれば出願できます。', highschoolLink: schools.metroAdmission}
  },
  sound: {
    general: {math: 3, university: universities.kyushuAcoustic, theme: '音の物理と、人の聞こえ方の両方を扱う', why: '音響設計は芸術系に見えて、物理と数学を使う分野です。普通科の理系から進めます。', highschoolLink: schools.metroAdmission},
    specialized: {math: 1, university: universities.ritsumeiImage, theme: '音と映像で、どんな体験をつくるか考える', why: '音楽科・芸術科で演奏や制作を軸に進む道。表現の側から入ります。', highschoolTitle: '音楽科・芸術系の専門学科', highschoolLink: schools.metroAdmission},
    kosen: {math: 3, university: universities.toyohashi, theme: '音を信号として記録・加工する技術を扱う', why: '電気・情報系の高専から、信号処理として音に関わる道。', school: schools.tokyoCt, highschoolTitle: '電気・情報系の高専'},
    switch: {math: 2, university: universities.kyushuAcoustic, theme: '音の文化・環境・情報を横断して扱う', why: '楽器が弾けることは条件ではありません。高校で音楽を専門にしなくても進めます。', highschoolLink: schools.metroAdmission}
  },
  media: {
    general: {math: 1, university: universities.ritsumeiImage, theme: '映像・ゲームの表現と、それを届ける仕組みを扱う', why: '普通科から映像・表現系の学部へ。実技よりも作品と考えを問う入試もあります。', highschoolLink: schools.metroAdmission},
    specialized: {math: 1, university: universities.ritsumeiImage, theme: '作品制作を軸に、表現の方法を積み上げる', why: '美術科・デザイン科で制作を続ける道。実技の比重が高くなります。', highschoolTitle: '美術・デザイン系の専門学科', highschoolLink: schools.metroAdmission},
    kosen: {math: 3, university: universities.toyohashi, theme: 'ゲームや映像を、動かす技術の側からつくる', why: '情報系の高専から、描画・エンジン・インタラクションの技術に進む道。', school: schools.tokyoCtInfo, highschoolTitle: '情報系の高専'},
    switch: {math: 2, university: universities.aizu, theme: '作る側の技術を、情報科学として扱う', why: '「ゲームが好き」から、表現ではなく仕組みの側へ移る人も多くいます。', highschoolLink: schools.metroAdmission}
  },
  design: {
    general: {math: 1, university: universities.kyushuAcoustic, theme: '人の行動を調べ、形や体験に落とす', why: '普通科から芸術工学・デザイン系へ。観察と試作を学問として扱います。', highschoolLink: schools.metroAdmission},
    specialized: {math: 1, university: universities.ritsumeiImage, theme: '制作を通して、伝え方を組み立てる', why: '美術科・デザイン科で実技を積む道。ポートフォリオが評価に入ります。', highschoolTitle: '美術・デザイン系の専門学科', highschoolLink: schools.metroAdmission},
    kosen: {math: 3, university: universities.toyohashi, theme: '使う人の視点を、製品と技術の設計に入れる', why: '高専の工学系から、人と技術の接点を扱う道。', school: schools.tokyoCt, highschoolTitle: '工業系の高専'},
    switch: {math: 2, university: universities.aizu, theme: '情報を扱う技術を、使いやすさの側から考える', why: '絵が描けることは条件ではありません。情報系の学部からデザインに関わる道もあります。', highschoolLink: schools.metroAdmission}
  }
};

export function hasRoutes(domainId) {
  return Object.hasOwn(routeData, domainId);
}

export function routeDomains() {
  return Object.keys(routeData);
}

function buildRoute(domainId, kindId, domain) {
  const data = routeData[domainId][kindId];
  const kind = routeKinds[kindId];
  const school = data.school || data.highschoolLink || null;
  return {
    id: `${domainId}-${kindId}`,
    domain: domainId,
    kind: kindId,
    kindName: kind.name,
    kindSummary: kind.summary,
    order: kind.order,
    math: {level: data.math, ...mathLevels[data.math]},
    why: data.why,
    now: kind.now,
    checkedOn: ROUTES_CHECKED_ON,
    steps: [
      {
        stage: 'goal',
        decision: 'lab',
        title: domain.name,
        detail: data.theme,
        note: 'この分野の中で、どの問いを扱うかを選ぶのはこの段階です。'
      },
      {
        stage: 'university',
        decision: 'faculty',
        title: data.university.name,
        detail: kindId === 'kosen' ? '高専の卒業後に3年次編入で進む例です。編入の条件・科目は大学ごとに違います。' : 'この分野を扱う学部の一例です。学科・研究室の構成は公式サイトで確認してください。',
        link: data.university
      },
      {
        stage: 'course',
        decision: 'course',
        title: kind.course.title,
        detail: kind.course.detail
      },
      {
        stage: 'highschool',
        decision: 'highschool',
        title: data.highschoolTitle || kind.highschool.title,
        detail: kind.highschool.detail,
        link: school
      },
      {
        stage: 'now',
        decision: null,
        title: 'いま必要なこと',
        detail: kind.now,
        link: kind.nowLink ? schools[kind.nowLink] : null
      }
    ]
  };
}

export function routesForDomain(domainId, domain) {
  if (!hasRoutes(domainId)) return [];
  return Object.keys(routeData[domainId])
    .map(kindId => buildRoute(domainId, kindId, domain))
    .sort((a, b) => a.order - b.order);
}

// 経路の集合から、分岐点ごとの保留可能期限を今に近い順に並べる。
export function deferralTimeline() {
  return ['lab', 'faculty', 'course', 'highschool'].map(id => ({id, ...decisionPoints[id]}));
}

// 同じ学問でも経路によって数学の要求が違うことを、幅として示す。
export function mathSpread(routes) {
  if (!routes.length) return null;
  const levels = routes.map(route => route.math.level);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  return {min, max, varies: min !== max, lowest: mathLevels[min], highest: mathLevels[max]};
}
