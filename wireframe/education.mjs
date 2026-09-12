export const EDUCATION_CHECKED_ON = '2026-09-12';

const candidate = (id, name, url, source, activity, domains) => ({
  id, name, url, source, activity, domains, checkedOn: EDUCATION_CHECKED_ON
});

// University and faculty pages checked on the date above. A candidate may belong to
// several fields when its official curriculum explicitly crosses those fields.
export const universityCandidates = [
  candidate('utokyo-math', '東京大学 理学部数学科', 'https://www.ms.u-tokyo.ac.jp/gakubu/cur.html', '東京大学', '代数・幾何・解析を講義と演習で学ぶ', ['mathematics']),
  candidate('kyushu-math', '九州大学 理学部数学科', 'https://www.math.kyushu-u.ac.jp/curriculum/', '九州大学', '微積分・線形代数から少人数セミナーへ進む', ['mathematics']),
  candidate('tokai-math', '東海大学 理学部数学科', 'https://www.u-tokai.ac.jp/ud-science/dpt-mathematics/curriculum/', '東海大学', '集合と論理・微分積分・数理科学演習に取り組む', ['mathematics']),
  candidate('shinshu-science', '信州大学 理学部', 'https://www.shinshu-u.ac.jp/faculty/science/faculty/curriculum.html', '信州大学', '数学と自然科学をコースで深め、フィールドワークにも取り組む', ['mathematics', 'physics', 'chemistry', 'biology', 'earth-science', 'environment']),
  candidate('rikkyo-science', '立教大学 理学部', 'https://www.rikkyo.ac.jp/undergraduate/science/', '立教大学', '数学・物理・化学・生命理学を専門的に学ぶ', ['mathematics', 'physics', 'chemistry', 'biology']),

  candidate('utokyo-physics', '東京大学 理学部物理学科', 'https://www.phys.s.u-tokyo.ac.jp/', '東京大学', '素粒子・光・物性・宇宙を研究する', ['physics']),
  candidate('hiroshima-physics', '広島大学 理学部物理学科', 'https://phys.hiroshima-u.ac.jp/', '広島大学', '物質・素粒子から銀河までを実験と理論で扱う', ['physics']),
  candidate('tmu-physics', '東京都立大学 理学部物理学科', 'https://www.tmu.ac.jp/academics/science/phys.html', '東京都立大学', '宇宙からナノまでの物理を実験と理論で学ぶ', ['physics']),
  candidate('tus-science', '東京理科大学 理学部第一部', 'https://www.tus.ac.jp/academics/faculty/sciencedivision1/', '東京理科大学', '数学・物理・化学を基礎から研究へつなぐ', ['mathematics', 'physics', 'chemistry']),

  candidate('kwansei-chem', '関西学院大学 理学部化学科', 'https://www.kwansei.ac.jp/s_science/d_c/', '関西学院大学', '分析・物理化学と無機・有機化学の実験を行う', ['chemistry']),
  candidate('nagoya-chem', '名古屋大学 理学部化学科', 'https://www.sci.nagoya-u.ac.jp/academics/about/chem/', '名古屋大学', '物質の構造・反応と新しい物質の創製を研究する', ['chemistry']),
  candidate('omu-chem-earth', '大阪公立大学 理学部', 'https://www.omu.ac.jp/sci/', '大阪公立大学', '化学実験や地球学の観測・実習に取り組む', ['chemistry', 'earth-science']),

  candidate('kanagawa-bio', '神奈川大学 理学部生物コース', 'https://www.kanagawa-u.ac.jp/education/faculty/sciences/about/course04/', '神奈川大学', '臨海・森林・昆虫実習などのフィールドワークを行う', ['biology', 'ecology']),
  candidate('mie-bio', '三重大学 生物資源学部', 'https://www.bio.mie-u.ac.jp/', '三重大学', '生物資源と自然環境を実験・フィールドで扱う', ['biology', 'ecology', 'environment', 'food']),
  candidate('kaiyodai-life', '東京海洋大学 海洋生命科学部', 'https://www.kaiyodai.ac.jp/faculty/s/', '東京海洋大学', '海の生物資源・食品生産を実習と研究で扱う', ['biology', 'ecology', 'food']),
  candidate('human-environment', '人間環境大学 環境科学部', 'https://www.uhe.ac.jp/departments/environment-okzk/', '人間環境大学', 'フィールド生態調査と環境データ分析を行う', ['biology', 'ecology', 'environment']),
  candidate('nagasaki-environment', '長崎大学 環境科学部', 'https://www.env.nagasaki-u.ac.jp/', '長崎大学', '自然環境の保全と持続可能な社会を横断して学ぶ', ['ecology', 'environment']),

  candidate('nihon-earth', '日本大学 文理学部地球科学科', 'https://dept.chs.nihon-u.ac.jp/earth_science/', '日本大学', '地質巡検・観測・データ解析で地球環境を調べる', ['earth-science', 'environment']),
  candidate('okayama-earth', '岡山大学 理学部地球科学科', 'https://www.okayama-u.ac.jp/user/earth/index.html', '岡山大学', '野外観測・分析実験・数値解析で地球と惑星を調べる', ['earth-science']),
  candidate('hokudai-earth', '北海道大学 理学部地球惑星科学科', 'https://www.sci.hokudai.ac.jp/department/eps', '北海道大学', '地球と惑星を物理・化学・地質の視点で研究する', ['earth-science']),

  candidate('kaiyodai-environment', '東京海洋大学 海洋資源環境学部', 'https://www.kaiyodai.ac.jp/faculty/r/', '東京海洋大学', '海洋観測と資源・環境保全を実習から学ぶ', ['environment', 'ecology', 'earth-science']),
  candidate('utokyo-engineering', '東京大学 工学部', 'https://www.t.u-tokyo.ac.jp/about/academics/foe/department', '東京大学', '機械・電気・情報・材料を設計と研究で横断する', ['engineering', 'information', 'design']),
  candidate('shizuoka-engineering', '静岡大学 工学部', 'https://www.eng.shizuoka.ac.jp/department/', '静岡大学', '機械・電気電子・化学バイオ・数理システムを実験する', ['engineering', 'information', 'chemistry']),
  candidate('oit-information', '大阪工業大学 情報科学部', 'https://www.oit.ac.jp/academic/is/', '大阪工業大学', 'プログラミングと情報システムを実践的に開発する', ['information', 'engineering']),
  candidate('toyohashi-tech', '豊橋技術科学大学', 'https://www.tut.ac.jp/', '豊橋技術科学大学', '高専からの編入を含め、工学を実験と研究で深める', ['engineering', 'information']),
  candidate('nagaoka-tech', '長岡技術科学大学', 'https://www.nagaokaut.ac.jp/', '長岡技術科学大学', '機械・電気電子・情報・物質環境を実践的に学ぶ', ['engineering']),

  candidate('aizu-computer', '会津大学 コンピュータ理工学部', 'https://www.u-aizu.ac.jp/curriculum/', '会津大学', 'コンピュータ科学を理論とソフトウェア開発から学ぶ', ['information']),
  candidate('hosei-information', '法政大学 情報科学部', 'https://cis.hosei.ac.jp/', '法政大学', 'コンピュータ・ネットワークを学生主体で設計運用する', ['information', 'media']),
  candidate('aichi-information', '愛知工業大学 情報科学部', 'https://www.ait.ac.jp/faculty/info-science/', '愛知工業大学', 'コンピュータシステムとメディア情報を制作・研究する', ['information', 'media']),

  candidate('ishikawa-food', '石川県立大学 食品科学科', 'https://www.ishikawa-pu.ac.jp/undergraduate/food_science/', '石川県立大学', '食品の加工・貯蔵・安全性を実験と現場研修で学ぶ', ['food', 'chemistry']),
  candidate('jwu-food', '日本女子大学 食科学部食科学科', 'https://www.jwu.ac.jp/unv/academics/food_and_nutritional_sciences/food_science/index.html', '日本女子大学', '食品・調理・栄養を科学的に実験する', ['food']),
  candidate('nvlu-food', '日本獣医生命科学大学 食品科学科', 'https://www.nvlu.ac.jp/food/', '日本獣医生命科学大学', '食を生命科学と製造・安全の視点から研究する', ['food']),
  candidate('nodai-bio', '東京農業大学 応用生物科学部', 'https://www.nodai.ac.jp/academics/bio/', '東京農業大学', '微生物・食品・栄養を実験で扱う', ['food', 'biology']),

  candidate('kyushu-acoustic', '九州大学 芸術工学部音響設計コース', 'https://www.design.kyushu-u.ac.jp/schools/ad/', '九州大学', '音の物理・聴覚・音文化を実験と制作で扱う', ['sound', 'design', 'physics']),
  candidate('ritsumei-image', '立命館大学 映像学部', 'https://admission.ritsumei.ac.jp/faculty/cias.html', '立命館大学', '映像・ゲーム・音響を制作と研究から学ぶ', ['sound', 'media', 'design']),
  candidate('osakac-game-media', '大阪電気通信大学 ゲーム＆メディア専攻', 'https://www.osakac.ac.jp/faculty/isa/gm/', '大阪電気通信大学', 'ゲーム・映像・音楽・サウンドデザインを制作する', ['sound', 'media', 'design']),
  candidate('digital-hollywood', 'デジタルハリウッド大学 デジタルコミュニケーション学部', 'https://www.dhw.ac.jp/faculty/', 'デジタルハリウッド大学', 'ゲーム・映像・3DCG・メディアアートを横断して制作する', ['sound', 'media', 'design']),
  candidate('chiba-design', '千葉大学 工学部デザインコース', 'https://www.f-eng.chiba-u.jp/education/design.html', '千葉大学', '技術と科学に基づく製品・情報・環境のデザインを行う', ['design', 'engineering']),
  candidate('tokyo-polytechnic-media', '東京工芸大学 芸術学部', 'https://www.t-kougei.ac.jp/arts/', '東京工芸大学', '写真・映像・デザイン・ゲーム・メディアアートを制作する', ['sound', 'media', 'design'])
];

export function universityCandidatesForDomain(domainId, {limit = 5, excludeUrl = null} = {}) {
  return universityCandidates
    .filter(item => item.domains.includes(domainId) && item.url !== excludeUrl)
    .slice(0, limit);
}
