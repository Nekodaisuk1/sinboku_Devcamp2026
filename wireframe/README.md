# シンボク — prototype Build 14

学問名から、その学問にたどり着く高校までを逆に引くツール。偏差値からは引けない。共有機能は持たない。

- `npm start`：`http://127.0.0.1:4317` でローカルサーバー
- `npm test`：31件のテスト
- `npm run check`：JavaScriptの構文検査

## 画面

| ルート | 画面 | 役割 |
| --- | --- | --- |
| `#personal` | 自分の探究 | 興味から枝を広げ、調べたことを自分の言葉で残す（既定の入口） |
| `#routes` | 進み方を見る | 学問を選ぶと、たどり着く経路が4本。分岐点ごとの保留期限と、必要な数学レベルつき |
| `#home` | 探す | 学問・興味・掲載情報の検索 |
| `#map` | 学びの地図 | 学問のつながりと、そこから広がる機会 |
| `#saved` | 気になる | あとで調べる候補と、端末保存の設定 |

## 進み方を見る（Build 14）

学問を選ぶと、性質の異なる4本の経路が出る。

1. 普通科 → 総合大学
2. 専門学科の高校 → 専門の大学
3. 高専 → 大学編入
4. 高校では別分野 → 大学で転向

各経路は「学問・研究 → 大学・学部 → 高校の中の選択 → 高校 → いま必要なこと」の5段で、上が遠い未来、下が今。各段に**保留できる期限**（専攻＝大学2〜3年ごろ／学部＝高3の夏ごろ／文理＝高1の11月ごろ／高校＝中3の12月ごろ）と、経路ごとの**必要な数学レベル**を表示する。

高校の段は原則として学科の型で示す。**特定の高校からの進学実績は主張しない**（検証できないため）。実在校を挙げているのは大島海洋国際高校・鳥羽商船高専・東京高専のみ。大学・高専の情報は各公式サイト（確認 2026-09-11）にもとづき、経路の組み立てと数学レベルの目安はこのアプリの編集である。

## 共有機能について

このアプリに保護者アカウントはない。検索・閲覧・メモを家族や学校に共有する機能、エクスポート、通知、保護者向け画面のいずれも、利用者からは到達できない。

Build 07〜13で実装した保護者共有のサーバー実装（`family-api.mjs`、`/family`、結合テスト）はリポジトリに残っているが、`app.js` の `FAMILY_SHARING_ENABLED = false` によってUIの導線はすべて外れており、起動時に共有APIも呼ばない。フラグを`true`に戻すと復活する。

## 記録の扱い

初期状態では記録はメモリ内のみ。「このブラウザに記録を残す」を有効にしたときだけ、自分のマップ・候補・自分用メモ・見返す経路・探索位置を端末に保存する。サーバーには送らない。保存オフと全削除には確認画面がある。

---

## これまでの経緯（要約）

Wireframe 02〜03 と Build 04〜13 の記録は `../docs/implementation-status.md` にある。要点だけ：

- Wireframe 02〜03：興味から枝分かれする樹形図と、そこから広がるイベント・部活・進学先の可視化。掲載は架空データだった。
- Build 05：架空データを、公式サイトにもとづく13件の実情報に置き換えた。
- Build 06：600px以下のスマホ専用レイアウト。
- Build 07：保護者共有をサーバー実装（招待・権限分離・取り消し）。**Build 14でUIから外した。**
- Build 08〜12：自分のマップ、探究ワークスペース、初回導線の見直し。
- Build 13：検索・保存・共有・端末保存を画面ごとに整理。
- Build 14：学問からの逆引き経路、保留可能期限、必要な数学レベル。共有導線を撤去。

### 保護者共有のコードについて（無効）

`family-api.mjs` と `/family`、`family-api.test.mjs` はリポジトリに残っている。招待は24時間・1回限り、接続相手は1名、共有データは `.data/families.json`（Git管理外・公開許可リスト外）、Cookieはハッシュ保存、セッションは最大30日。ただし `app.js` の `FAMILY_SHARING_ENABLED = false` により、本人アプリからは到達できない。`.data` はコミットも配布もしないこと。

このローカル試作にはアカウント回復がなく、HTTPS下での公開・本番向け認証・永続化は未実装。他端末からは使えない。

## Build 18: data and public build

The editable information source is `data/knowledge.json`. Run `npm run knowledge:check` and `npm run knowledge:build` after editing. Run `npm run check`, `npm test`, then `npm run build` to produce the public `dist` directory. Do not deploy this whole directory; upload only `dist`.

- Information contract: `../docs/knowledge-contract.md`
- Research handoff prompt: `../docs/claude-code-research-prompt.md`
- Architecture and deployment: `../docs/system-and-deployment.md`
- UI vocabulary and navigation: `../docs/ui-contract.md`
