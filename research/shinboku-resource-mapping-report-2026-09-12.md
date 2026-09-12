# シンボク 実在情報マッピング調査

## 1. 既存マップの棚卸し

確認時点の正本は version 2。topics 4、domains 8、verbs 5、directions 12、concepts 18、resources 42件（published 42、draft 0）である。

### topics

| id | label | domains |
|---|---|---|
| games | ゲーム | information, media, design |
| cooking | 料理・食べもの | food, ecology, design |
| music | ギター・音楽 | sound, information, design |
| sea | 海・生き物 | ecology, environment, engineering |

### domains

| id | label |
|---|---|
| ecology | 生態学 |
| environment | 環境科学 |
| engineering | 海洋工学 |
| information | 情報科学 |
| design | デザイン |
| food | 食品科学 |
| sound | 音響・音楽 |
| media | 映像・ゲーム表現 |

### verbs

| id | label | domains |
|---|---|---|
| make | つくる | media, design, information, engineering, food, sound |
| compare | くらべる | ecology, food, sound, design, environment |
| observe | 観察する | ecology, environment, design |
| dig | 調べる | ecology, environment, food, sound, engineering, information |
| tell | 伝える | media, design, information, environment |

### directions

| topic | id | title | activities |
|---|---|---|---:|
| music | together | 一緒に演奏する | 3 |
| music | grow | 上達する | 3 |
| music | cross | 音楽と異分野 | 3 |
| games | together | 誰かと楽しむ | 3 |
| games | make | 自分でつくる | 3 |
| games | cross | ゲームと異分野 | 3 |
| cooking | share | 誰かに作る | 3 |
| cooking | grow | 味を探究する | 3 |
| cooking | cross | 食と異分野 | 3 |
| sea | observe | 生き物を知る | 3 |
| sea | protect | 海と暮らしを考える | 3 |
| sea | cross | 海と異分野 | 3 |

### concepts

| id | label | kind | domains |
|---|---|---|---|
| biology | 生き物の世界 | field | ecology |
| fieldwork | 外に出て観察する | activity | ecology, environment |
| marine-life | 海の生き物 | subject | ecology, environment |
| forest-life | 森・里山の生き物 | subject | ecology, environment |
| freshwater-life | 川・池の生き物 | subject | ecology, environment |
| urban-nature | 街の中の自然 | subject | ecology, environment |
| plant-life | 植物のこと | subject | ecology |
| insect-life | 虫のこと | subject | ecology |
| bird-life | 鳥のこと | subject | ecology |
| microbe-life | 目に見えない生き物 | subject | food, ecology |
| ecology-links | 生き物と環境のつながり | field | ecology, environment |
| environment-living | 環境と暮らし | field | environment |
| sound-science | 音のしくみ | field | sound, engineering |
| record-keeping | 記録してまとめる | activity | information, media |
| citizen-survey | みんなで調べる | activity | environment, ecology |
| research-challenge | 自分の研究にする | activity | information, ecology |
| forest-care | 森や里山を手入れする | activity | environment, ecology |
| making-things | つくって試す | activity | information, design, sound |

### 既存resourcesの偏り

既存42件のうち、生態学を含むものが多く、料理・食、音楽・音響、ゲーム・デザインの現地体験と継続参加が薄い。地域では東京都と全国情報へ偏り、東北・四国・沖縄は特に少ない。今回の40候補は、この空白を優先した。

## 2. 新しいジャンル候補

| id | label | kind | summary | domains | broader | related | 既存conceptとの接続理由 |
|---|---|---|---|---|---|---|---|
| food-science | 食品科学 | field | 食品の成分・加工・安全・おいしさを実験で調べる。 | food | — | microbe-life, making-things | 既存の microbe-life, making-things を、固有の対象・行為・分野へ具体化する。 |
| nutrition-science | 栄養学 | field | 食べたものと体の働きの関係を調べる。 | food, ecology | — | biology | 既存の biology を、固有の対象・行為・分野へ具体化する。 |
| fermentation | 発酵 | subject | 微生物の働きで食品が変化する現象と文化。 | food, ecology | — | microbe-life | 既存の microbe-life を、固有の対象・行為・分野へ具体化する。 |
| food-culture | 食文化 | subject | 地域の料理、食材、技法と歴史のつながり。 | food, media | — | environment-living | 既存の environment-living を、固有の対象・行為・分野へ具体化する。 |
| flavor-aroma | 味・香り | subject | 味覚・嗅覚と食品成分、調香を横断する対象。 | food, design | — | making-things | 既存の making-things から、試作して比較できる感覚の対象へ具体化する。 |
| food-development | 食品を開発する | activity | 試作、比較、改良、説明までを行う。 | food, design | making-things | record-keeping | 既存の making-things, record-keeping を、固有の対象・行為・分野へ具体化する。 |
| music | 音楽 | field | 演奏・作曲・録音・文化研究を含む表現分野。 | sound, media | — | sound-science | 既存の sound-science を、固有の対象・行為・分野へ具体化する。 |
| acoustic-engineering | 音響工学 | field | 音を測り、処理し、空間での聞こえ方を設計する。 | sound, engineering, information | — | sound-science | 既存の sound-science を、固有の対象・行為・分野へ具体化する。 |
| guitar | ギター | subject | 弦、木材、電気回路、演奏文化を持つ楽器。 | sound, design | — | sound-science | 既存の sound-science を、固有の対象・行為・分野へ具体化する。 |
| instrument-making | 楽器を作る・直す | activity | 設計、木工、調整、修理で楽器に関わる。 | sound, engineering, design | making-things | guitar | 既存の making-things, guitar を、固有の対象・行為・分野へ具体化する。 |
| compose-record | 作曲・録音する | activity | 音を組み立て、収録し、編集して作品にする。 | sound, media, information | making-things | record-keeping | 既存の making-things, record-keeping を、固有の対象・行為・分野へ具体化する。 |
| perform | 演奏して発表する | activity | 一人または合奏で練習し、舞台や録音で届ける。 | sound, media | — | record-keeping | 既存の record-keeping を、固有の対象・行為・分野へ具体化する。 |
| game-studies | ゲーム研究 | field | 遊びを文化・歴史・心理・社会から研究する。 | media, information | — | research-challenge | 既存の research-challenge を、固有の対象・行為・分野へ具体化する。 |
| game-design | ゲームデザイン | field | ルール、体験、難易度、画面と操作を設計する。 | design, information, media | — | making-things | 既存の making-things を、固有の対象・行為・分野へ具体化する。 |
| programming | プログラミング | activity | 命令とデータを組み合わせ、動く仕組みを作る。 | information, engineering | making-things | — | 既存の making-things を、固有の対象・行為・分野へ具体化する。 |
| character-story | キャラクター・物語 | subject | 人物、世界観、文章、映像を組み合わせる表現対象。 | media, design | — | making-things | 既存の making-things を、固有の対象・行為・分野へ具体化する。 |
| game-sound | ゲームの音 | subject | 効果音、音楽、音声が操作と物語に与える働き。 | sound, media, information | — | sound-science | 既存の sound-science を、固有の対象・行為・分野へ具体化する。 |
| present-work | 作品を発表する | activity | 作品と意図を整理して外部へ見せ、反応を得る。 | media, design, information, sound | — | record-keeping | 既存の record-keeping を、固有の対象・行為・分野へ具体化する。 |

broader は包含関係だけに限定した。「ギター→音響工学」「料理→栄養学」のような同義化は行わず、対象・活動と専門分野の横断は related として扱う。

## 3. 具体物の調査結果

### 採用候補（40件）

すべて一次情報の該当ページを2026-09-12に確認し、draft JSONへ収録した。正規課程は在学生向けであり、中高生が授業へ一般参加できるものとしては扱っていない。過去イベントは継続開催の根拠となる「実施例」と明記した。

| テーマ | 件数 |
|---|---:|
| 料理・食・栄養 | 12 |
| ギター・音楽・音響 | 15 |
| ゲーム・情報・デザイン・メディア | 13 |

### 保留候補（5件）

| 候補 | 公式URL | 確認日 | 保留理由 |
|---|---|---|---|
| Tech Kids Grand Prix 2026 | https://techkidsschool.jp/grandprix/areas/ | 2026-09-12 | 2026年度は小学生限定で、中高生向けマップの具体物として不適合。教材だけの分離登録は再検討余地あり |
| 沖縄こどもの国 体験プログラム | https://www.okzm.jp/experience/ | 2026-09-12 | 生物分野では有力だが、今回優先した3テーマの空白を埋めない |
| エイサー会館 | https://eisa-museum.jp/ | 2026-09-12 | 中高生料金と体験は確認できたが、定常プログラムの具体条件を追加確認したい |
| 香川大学 ひらめき☆ときめきサイエンス | https://www.ag.kagawa-u.ac.jp/hirameki2025/ | 2026-09-12 | 既存の全国版「ひらめき☆ときめきサイエンス」と重複するため個別回の登録基準を要検討 |
| 東京工芸大学 ゲーム学科 | https://blog.t-kougei.ac.jp/game/ | 2026-09-12 | 現行学科のまとまったカリキュラムページを特定できず、ブログ断片のみのため保留 |

### 不採用候補（4件）

| 候補 | 公式URL | 確認日 | 不採用理由 |
|---|---|---|---|
| 伊勢原市食育料理コンテスト（古い実績） | https://www.maff.go.jp/j/syokuiku/gekkan/archive/attach/pdf/h29-145.pdf | 2026-09-12 | 2017年度実績で、現在の継続性を確認できない |
| 武庫川女子大学オープンカレッジ 食科学コース | https://opencoll.mukogawa-u.ac.jp/list/food_science/ | 2026-09-12 | 一般向け有料講座で、中高生の参加条件を確認できない |
| 日本作曲家協会 ソングコンテスト | https://www.jacompa.or.jp/song_contest/2026.php | 2026-09-12 | 年齢制限はないが演歌歌手向け課題曲で、今回の中高生向け入口として接続が弱い |
| Tech Kids Grand Prix 本大会 | https://techkidsschool.jp/grandprix/areas/ | 2026-09-12 | 小学生限定で対象外 |

## 4. マッピング表

| 具体物 | ジャンル | field | subject | activity | topic | verb | group | 地域 | 対象学年 | 接続理由 | 根拠URL |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 静岡県立大学 食品サマースクール（実施例） | 料理・食・栄養 | 食品科学／栄養学 | 食材・発酵・味 | 観察する・くらべる | cooking | observe, compare | try | 中部 | h1, h2, h3 | 料理の味や色を、感覚だけでなく分析・観察する食品科学へ接続できる。 | [公式](https://dfns.u-shizuoka-ken.ac.jp/dfsb/index.html) |
| 別府大学「シリーズ体験講座 食品科学のすゝめ」（実施例） | 料理・食・栄養 | 食品科学／栄養学 | 食材・発酵・味 | つくる・観察する・くらべる | cooking | make, observe, compare | try | 九州沖縄 | h1, h2, h3 | 料理から発酵・微生物・香りの科学へ、作ることと観察することを横断できる。 | [公式](https://www.beppu-u.ac.jp/event/%E3%80%90%E5%8F%82%E5%8A%A0%E8%80%85%E5%8B%9F%E9%9B%86%E3%80%91%E5%85%AC%E9%96%8B%E8%AC%9B%E5%BA%A7%E3%80%80%E3%80%8C%E3%82%B7%E3%83%AA%E3%83%BC%E3%82%BA%E4%BD%93%E9%A8%93%E8%AC%9B%E5%BA%A7-%E9%A3%9F/) |
| 県立広島大学「高校生のための健康科学入門講座」（2026） | 料理・食・栄養 | 食品科学／栄養学 | 食材・発酵・味 | 調べる・くらべる | cooking | dig, compare | try | 全国・オンライン | h1, h2, h3 | 食べることを、微生物・人体・運動との関係から調べる入口になる。 | [公式](https://www.pu-hiroshima.ac.jp/site/koukai-kouza/r808260902.html) |
| 南九州大学 食品開発キャンプ2026 | 料理・食・栄養 | 食品科学／栄養学 | 食材・発酵・味 | つくる・くらべる・伝える | cooking | make, compare, tell | try | 九州沖縄 | h1, h2, h3 | 料理を「商品として開発する」視点へ広げ、食品科学・デザイン・情報を横断できる。 | [公式](https://www.nankyudai.ac.jp/annai/community-contribution-activities/kouza-syokuhin/foodcamp/) |
| 第4回 ジーニアス農業遺産ふーどコンテスト | 料理・食・栄養 | 食品科学／栄養学 | 食材・発酵・味 | つくる・伝える・調べる | cooking | make, tell, dig | continue | 全国・オンライン | h1, h2, h3 | 料理を地域の農業・自然・文化を伝える制作と発表へつなげられる。 | [公式](https://www.maff.go.jp/j/nousin/kantai/260615.html) |
| 東北農政局「とうほく食育ひろば」 | 料理・食・栄養 | 食品科学／栄養学 | 食材・発酵・味 | 調べる・くらべる | cooking | dig, compare | try | 全国・オンライン | 未確認 | 料理から地域の農産物・流通・環境へ調べる範囲を広げられる。 | [公式](https://www.maff.go.jp/tohoku/syouan/syokuiku/) |
| 東北地域の農林漁業体験施設マップ | 料理・食・栄養 | 食品科学／栄養学 | 食材・発酵・味 | 調べる・観察する | cooking | dig, observe | try | 全国・オンライン | 未確認 | 料理の材料が作られ加工される現場へ、地域ごとの体験先を探せる。 | [公式](https://www.maff.go.jp/tohoku/syouan/syokuiku/taiken.html) |
| 中部大学 食品栄養科学科 食品栄養科学専攻 | 料理・食・栄養 | 食品科学／栄養学 | 食材・発酵・味 | 学ぶ | cooking | — | study | 中部 | h1, h2, h3 | 料理の味・加工・安全性を、化学と生物の実験で確かめる進学先になる。 | [公式](https://www.chubu.ac.jp/academics/biology/food-nutrition/study/) |
| 京都府立大学 農学食科学部 和食文化科学科 | 料理・食・栄養 | 食品科学／栄養学 | 食材・発酵・味 | 学ぶ | cooking | — | study | 近畿 | h1, h2, h3 | 料理を栄養だけに限定せず、地域文化・歴史・表現とともに学べる。 | [公式](https://www.kpu.ac.jp/guidance/disclosure/kyouikukatei/) |
| 近畿大学 生物理工学部 食品安全工学科 | 料理・食・栄養 | 食品科学／栄養学 | 食材・発酵・味 | 学ぶ | cooking | — | study | 近畿 | h1, h2, h3 | 料理から「安全に作り届ける」技術と検査の分野へ進める。 | [公式](https://www.kindai.ac.jp/bost/department/food-safety/curriculum/) |
| 九州大学 農学部 食糧化学工学分野 | 料理・食・栄養 | 食品科学／栄養学 | 食材・発酵・味 | 学ぶ | cooking | — | study | 九州沖縄 | h1, h2, h3 | 食べものの疑問を、成分分析・加工・健康影響の研究へつなげられる。 | [公式](https://www.kyushu-u.ac.jp/f/62226/14_nougaku_p.pdf) |
| 香川大学 農学部 食品科学領域 | 料理・食・栄養 | 食品科学／栄養学 | 食材・発酵・味 | 学ぶ | cooking | — | study | 四国 | h1, h2, h3 | 料理のおいしさと安全を、分析と加工の両方から学ぶ進路になる。 | [公式](https://www.kagawa-u.ac.jp/files/9317/5213/4658/2026.pdf) |
| 神戸電子専門学校 ライブ音響・照明体験会（2026） | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | つくる・くらべる・観察する | music | make, compare, observe | try | 近畿 | h1, h2, h3 | ギター演奏から、聴こえ方を作る音響・照明・舞台運営へ視野を広げられる。 | [公式](https://www.kobedenshi.ac.jp/event/special-class/1462/) |
| 第51回GLC学生ギターコンクール | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | くらべる・伝える | music | compare, tell | continue | 関東 | j1, j2, j3, h1, h2, h3 | ギター演奏を録音して聴き比べ、外部の舞台で発表する目標にできる。 | [公式](https://guitarists.or.jp/compe/glc/glc51/) |
| キャットミュージックカレッジ専門学校 ギタークラフト＆リペアコース | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | 学ぶ | music | — | study | 近畿 | h1, h2, h3 | 弾く興味から、木材・構造・調整・修理というものづくりへ進める。 | [公式](https://www.cat.ac.jp/support/subject/engineer/index.html) |
| 札幌大谷大学 音楽学科 作曲・サウンドクリエイションコース | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | 学ぶ | music | — | study | 北海道 | h1, h2, h3 | ギターで曲を作る興味を、録音・編曲・音響デザインへ広げられる。 | [公式](https://www.sapporo-otani.ac.jp/department/music/curriculum) |
| 東京音楽大学 ミュージックビジネス・テクノロジー専攻 | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | 学ぶ | music | — | study | 関東 | h1, h2, h3 | 演奏や作曲を、配信・ICT・企画運営まで含む音楽の仕事へ接続できる。 | [公式](https://www.tokyo-ondai.ac.jp/subject_education/music_business_technology) |
| 国立音楽大学 音楽デザイン専修 | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | 学ぶ | music | — | study | 関東 | h1, h2, h3 | ギターの音色への興味から、録音と音場を設計する技術へ進める。 | [公式](https://www.kunitachi.ac.jp/undergraduate/college/perform/computer.html) |
| 中部楽器技術専門学校 音楽サービス創造学科 | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | 学ぶ | music | — | study | 中部 | h1, h2, h3 | ギターを弾く・直す・舞台で鳴らすという複数の関わり方を一つの課程で比べられる。 | [公式](https://chubugakki.ac.jp/subject/sougo/) |
| 沖縄県立芸術大学 音楽文化専攻 音楽学コース | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | 学ぶ | music | — | study | 九州沖縄 | h1, h2, h3 | ギターや楽曲だけでなく、地域文化や環境の音を調べる学問へ広げられる。 | [公式](https://www.okigei.ac.jp/details/music/culture-musicology.html) |
| 沖縄県立芸術大学 音楽学部 | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | 学ぶ | music | — | study | 九州沖縄 | h1, h2, h3 | 演奏する興味を、地域固有の音楽・舞台・文化研究と比較できる。 | [公式](https://www.okigei.ac.jp/details/music/music-index.html) |
| 沖縄ラフ＆ピース専門学校 音響テクノロジーコース | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | 学ぶ | music | — | study | 九州沖縄 | h1, h2, h3 | 音楽からライブ・映像・アニメの音を支える技術へ接続できる。 | [公式](https://laughandpeace.ac.jp/course-sound) |
| 平成音楽大学 サウンドデザインコース | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | 学ぶ | music | — | study | 九州沖縄 | h1, h2, h3 | ギターや作曲から、デジタル制作と舞台音響を一緒に試せる。 | [公式](https://www.heisei-music.ac.jp/sounddesign/) |
| 第74回全日本吹奏楽コンクール（中学生・高校生の部） | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | くらべる・伝える | music | compare, tell | continue | 全国・オンライン | j1, j2, j3, h1, h2, h3 | 個人の演奏から、合奏のバランス・音色・舞台での発表へ視点を広げられる。 | [公式](https://www.ajba.or.jp/competition.html) |
| 九州大学 芸術工学部 音響設計コース（カリキュラム） | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | 学ぶ | music | — | study | 九州沖縄 | h1, h2, h3 | 楽器の音への興味を、聴覚・信号処理・建物の響き・文化研究へ分岐できる。 | [公式](https://www.design.kyushu-u.ac.jp/schools/ad/) |
| 穴吹デザイン専門学校 CG・ゲーム学科 | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | 学ぶ | games | — | study | 中国 | h1, h2, h3 | ゲームを遊ぶ興味から、絵・立体・動きのデザイン制作へ進める。 | [公式](https://web.anabukih.ac.jp/course/cg/) |
| 専門学校福岡デザイナー・アカデミー ゲーム・CG学科 | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | 学ぶ | games | — | study | 九州沖縄 | h1, h2, h3 | ゲームの絵とプログラムを分けず、両方を試しながら進路を選べる。 | [公式](https://www.kdg.ac.jp/course/game-creator/) |
| 大阪電気通信大学 デジタルゲーム学科 ゲーム・社会デザイン専攻 | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | 学ぶ | games | — | study | 近畿 | h1, h2, h3 | ゲーム制作を娯楽だけでなく、教育・社会課題・コミュニケーション設計へ広げられる。 | [公式](https://www.osakac.ac.jp/about/policy/faculty/isa/gs/) |
| 京都コンピュータ学院 デジタルゲーム学系 | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | 学ぶ | games | — | study | 近畿 | h1, h2, h3 | ゲームを、プログラム・ルール・演出・チーム制作に分解して学べる。 | [公式](https://www.kcg.ac.jp/departments/game/) |
| 九州産業大学造形短期大学部 ゲーム・メディアデザイン系 | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | 学ぶ | games | — | study | 九州沖縄 | h1, h2, h3 | ゲームのキャラクターや画面への興味から、映像・UI・メディア表現へ進める。 | [公式](https://www.zokei.kyusan-u.ac.jp/course/game/) |
| 武蔵野美術大学 デザイン情報学科「ゲームデザイン」 | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | 学ぶ | games | — | study | 関東 | h1, h2, h3 | 遊びのルールと画面表現を、デザインの課題として考える進路例になる。 | [公式](https://dinfo.musabi.ac.jp/curriculum/gamedesign/) |
| 宝塚大学 東京メディア芸術学部 ゲーム分野 | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | 学ぶ | music | — | study | 関東 | h1, h2, h3 | ゲームの中の絵・音・物語・仕組みを複数分野として学べる。 | [公式](https://www.takara-univ.ac.jp/tokyo/academics/area/game/) |
| HAL東京 ゲーム4年制学科 ゲームデザインコース | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | 学ぶ | games | — | study | 関東 | h1, h2, h3 | ゲームを作り、作品として説明・発表する職業教育へ接続できる。 | [公式](https://www.hal.ac.jp/tokyo/course/game_design) |
| HAL大阪 ゲーム4年制学科 ゲームデザインコース | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | 学ぶ | games | — | study | 近畿 | h1, h2, h3 | ゲームの企画と技術を制作物にまとめ、発表する進学先になる。 | [公式](https://www.hal.ac.jp/osaka/course/game_design) |
| 日本電子専門学校 ゲーム制作研究科 | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | 学ぶ | games | — | study | 関東 | h1, h2, h3 | ゲームを一人の趣味から、役割分担したチーム開発へ広げられる。 | [公式](https://www.jec.ac.jp/course/game/cu/) |
| ゲームクリエイター甲子園2026 | ギター・音楽・音響 | 音楽／音響工学 | ギター・楽曲・音 | つくる・くらべる・伝える | music | make, compare, tell | continue | 全国・オンライン | 未確認 | ゲームを作る活動を、締切だけでなく継続的な改善と外部発表へつなげられる。 | [公式](https://game.creators-guild.com/gck2026-terms/) |
| セキュリティ・キャンプ2026 ジュニア（実施例） | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | 調べる・つくる | games | dig, make | continue | 全国・オンライン | j1, j2, j3 | ゲームやプログラムを作る興味から、安全な仕組みとネットワークへ進める。 | [公式](https://www.ipa.go.jp/jinzai/security-camp/junior.html) |
| セキュリティ・キャンプ2026 全国大会（実施例） | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | 調べる・つくる | games | dig, make | continue | 全国・オンライン | j1, j2, j3, h1, h2, h3 | ゲーム開発から、Web・AI・ハードウェアを安全に作る情報科学へ発展できる。 | [公式](https://www.ipa.go.jp/jinzai/security-camp/zenkoku.html) |
| PCNこどもプログラマーフェア2026 in TSURUGA（実施例） | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | つくる・くらべる・伝える | games | make, compare, tell | try | 中部 | 未確認 | 家で作ったゲームを現地で見せ、ほかの作品と比べる発表の入口になる。 | [公式](https://pcn.club/contest/kpfair02.html) |
| 立命館大学ゲーム研究センター | ゲーム・情報・デザイン・メディア | ゲームデザイン／情報科学 | ルール・映像・キャラクター | 学ぶ | games | — | study | 近畿 | h1, h2, h3 | ゲームを作るだけでなく、歴史・文化・アーカイブの研究対象として見る道を示せる。 | [公式](https://www.rcgs.jp/?page_id=451) |

## 5. 網羅性レポート

### 新規候補：テーマ × 参加形式

| テーマ | 家 | 単発 | 継続・発表 | 進学 |
|---|---:|---:|---:|---:|
| 料理・食・栄養 | 2 | 4 | 1 | 5 |
| ギター・音楽・音響 | 0 | 1 | 3 | 11 |
| ゲーム・情報・デザイン・メディア | 0 | 1 | 2 | 10 |

「学校で学ぶ」は既存高校・部活動と今回の進学課程を分けて扱う必要がある。今回の新規候補では一般参加可能な高校・高専コースを十分に確認できず、0件である。

### 新規候補：テーマ × 地域

| テーマ | 北海道 | 東北 | 関東 | 中部 | 近畿 | 中国 | 四国 | 九州沖縄 | 全国・オンライン |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 料理・食・栄養 | 0 | 0 | 0 | 2 | 2 | 0 | 1 | 3 | 4 |
| ギター・音楽・音響 | 1 | 0 | 4 | 1 | 2 | 0 | 0 | 5 | 2 |
| ゲーム・情報・デザイン・メディア | 0 | 0 | 3 | 1 | 4 | 1 | 0 | 2 | 2 |

### 0件・薄いセル

- 0件：料理の北海道の中高生向け入口、音楽の東北・中国・四国の現地体験、ゲームの北海道・東北・四国・沖縄の進学・体験、3テーマすべての「高校・高専で学ぶ」一般向け確認情報。
- 1〜2件：料理の中国・四国、音楽の北海道・中部、ゲームの中部・中国。
- 家から試す：既存Scratch・ギター構造・発酵解説がある一方、公式の段階教材をテーマ別に追加する余地が大きい。
- 継続参加：音楽は学校団体経由のコンクールに偏り、個人が地域で継続できる非営利クラブが不足。料理は継続教室より単発講座・コンテストが中心。

### 期限切れ・再確認対象

- 2026-09-30締切：ジーニアス農業遺産ふーどコンテスト。
- 2026年中に終了：県立広島大学講座、食品サマースクール、神戸電子音響体験、GLC学生ギターコンクール、セキュリティ・キャンプ各種、PCNフェア。
- 2027年春〜夏に再確認：大学の公開講座、食品サマースクール、音響体験、学生コンテストの次年度募集。

### 次回優先調査

1. 東北・四国の中高生向け音響実験、軽音楽ワークショップ、地域の継続演奏団体。
2. 北海道・沖縄の中高生向け食品科学・地域料理プログラム。
3. 北海道・東北・四国・沖縄のゲーム／メディア系高校・高専・大学の体験授業。
4. 年齢・料金・一般参加条件まで明示された自宅向け公式教材。
5. 個人参加できる継続クラブと、学校外から応募できる発表機会。

## 6. インポート可能なdraft JSON

新規resourcesのみを [new-resources-2026-09-12.json](./new-resources-2026-09-12.json) に保存した。40件すべて reviewStatus は draft。既存IDは含まず、正本への --write は実行していない。

## 7. 根拠記録

resource ID、公式URL、確認日、裏付けた内容、不明点は [research-evidence-2026-09-12.md](./research-evidence-2026-09-12.md) に整理した。公開前に docs/research-evidence.md へレビュー済みの項目だけを追記する。

## 検証結果

- 調査候補：49件（採用40、保留5、不採用4）
- 新規concept案：18件
- 既存resources：42件。採用候補を加えた到達件数：82件
- 重複除外：2件（全国版ひらめき☆ときめきサイエンス、Tech Kids Grand Prixの重複評価）
- dry-run：40件すべて検証成功
