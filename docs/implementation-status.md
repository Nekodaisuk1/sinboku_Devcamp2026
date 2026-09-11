# Implementation status

## 完了した機能

- 入力不要の入口、興味の例から地図、前回の続きから再開。
- 入口・地図・気になるものの履歴に対応した画面遷移。
- 学問の樹形図、近領域、イベント・部活・進学先の展開。
- 部活と所属校、公開講座と主催大学の往復。
- ノード境界から接続線を計算し、画面幅やノードのサイズ変更に追従。
- 学問の比較、候補の仮置き、任意の一言メモ。
- 本人が選んだ候補だけを表示する相談カード。
- 明示的な端末保存、復元、保存オフ、個別メモの削除、全削除。

## 検証

- Node.jsのテスト5件、構文チェックを実施。
- PC・スマホ幅で線の端がノード境界に一致することを測定。
- 入り口・再開・ブラウザの戻る・保存復元・削除のキャンセル／確定をブラウザで確認。
- ユーザー本人による操作性の評価は未実施。

## 次の実装対象

1. 内容・根拠・更新日を分離した実データの整備と検査。対象地域を確認後に学校・活動を調査する。
2. 興味の自由入力と対応範囲内の候補検索。未対応分野を明示する。
3. 同種の学校・活動の条件比較。
4. 相談内容の自由編集、体験後の振り返り。

現時点の学校・活動は架空データ。ログイン、クラウド同期、実際の申し込み、他者への送信は実装していない。

## 追加：保護者共有モック

- 気になる候補単位の公開範囲（既定は自分だけ）、共有範囲だけの保護者プレビュー。
- URL／写真・情報の種類・見出し・タグ・ひとことを入力して、同一ブラウザ内の受信箱へ追加。
- おすすめを気になるに残す／見送る／戻す。領域タグが一致する地図の詳細へ表示。
- 自分用メモと採否を保護者向け表示に含めない。共有を取り消すとプレビューから非表示。
- 端末保存の対象に共有設定とおすすめを追加。既存形式は全件非公開として読み込む。
- 単体テスト9件・構文チェック通過。ブラウザでURL投稿、共有範囲、自分用メモの非表示、採用、復元、共有解除、領域への表示、スマホ幅を確認。
- 複数アカウントの実共有、外部送信、URLの内容取得、OCRは未実装。認証・サーバー側権限の要件はproduct-navigation.mdに記載。

## Build 05：固定例から検索・実情報へ

- 料理・ゲーム・音楽を加えた6入口、8領域。入力検索・かな／英数表記ゆれ対応、0件と条件解除。
- 13件の公式教材・活動・高校・大学・イベントをcatalog.mjsに分離。新しい地図と検索は実情報のみ表示。旧保存データ向けに旧IDは保持している。
- 自宅で無料／体験・活動／高校・大学の絞り込み。掲載範囲と条件不明を明示。
- 内容、関係の編集理由、公式出典、確認日、参加・入学条件、まず試す行動を表示。日付のあるイベントは終了後に案内を切り替える。
- 同種の実候補を比較、自分用の振り返りを保存・取消。保護者向けデータには含めない。
- スマホの詳細をネイティブdialogのシートへ変更。地図に戻る操作と、比較への遷移を検証。
- 単体テスト14件・構文チェック通過。PCの接続線24本は端点誤差0.006px未満、候補のはみ出しなし。
- 写真のみのおすすめ添付、縮小プレビュー、受信画像表示をブラウザで確認。
- 詳しい自己評価と未達項目はself-evaluation.md。全体目標は未完了。

## Build 06：スマホの地図

- 600px以下は3分岐が画面内に収まる専用レイアウト。根・枝・選択した学び・機会・近領域の順で表示する。
- 枝の選択はその場で説明を更新。詳しく知りたいときだけ詳細シートを開く。
- 機会は「まず触れる／続ける／進学する」で切り替え。件数と未掲載状態を表示する。
- 近領域を選ぶと、その領域の説明へ移動し、どの枝から広がったかを表示する。
- スマホの線も要素の実際の境界から描画。320/390/600pxで7本、601/1366pxでデスクトップ表示の20本を検査。端点誤差0.006px未満、ページ全体の横はみ出しなし。
- 320pxで分岐→進学候補→詳細シート→地図→近領域の操作を確認。コンソールエラーなし。
- 領域の説明に関連する実情報の出典を表示し、旧保存候補には「旧モックの架空例」と表示。

## Build 07：実通信する保護者共有

- `/family`は本人アプリとは別のページとJavaScriptで動く。本人のローカルメモを読み込まない。
- 本人が共有を開始し、選んだ候補のIDだけを送る。公開範囲の変更は「共有に反映」でサーバーに確定し、未反映状態を表示する。
- 24時間・1回限りの招待。保護者が受け取るとHttpOnly・SameSite=Strict Cookieで接続する。現在は接続相手1名。新しい相手の参加は古い相手の接続を置き換える。
- 本人と保護者のAPI権限を分離。サーバーは公式カタログから共有候補を返し、非公開候補・メモ・振り返りを保存・返却しない。
- URL・縮小した写真・タグ・メッセージがサーバー経由で本人の受信箱へ届く。受信確認は更新ボタンで行う。採否は端末内のみ。
- Cookie用の秘密値・招待値はサーバーにハッシュで保存。共有データは`.data/families.json`に原子的に書き込む。公開ファイルの許可リストから除外。
- 接続解除は招待・閲覧・投稿を無効化。共有データ全削除はサーバーの候補・おすすめ・認証情報を削除する。
- 同一送信番号の再送による二重投稿を防止。OriginとHostの照合、入力と添付サイズの検査、CSPを追加。
- 15件のテスト通過。API結合テストでは独立した本人2組・保護者のCookieを使い、権限・期限・招待再利用・公開取消・投稿拒否・保存復元・共有データ削除を確認。
- ブラウザでは本人ページ→招待→保護者ページ→URL投稿／写真投稿→本人受信→解除後の閲覧拒否を確認。同一ブラウザの別タブであり、独立したCookieの分離はAPI結合テストで検証した。

### 運用範囲

現在のサーバーはこのPCの127.0.0.1にのみ公開する。別端末から使うにはHTTPS環境への公開と本番向けの永続化・認証運用が必要。アカウント回復、複数の共有相手、通知、リアルタイム同期は未実装。Cookieを消すと本人用の接続を回復できない。接続の有効期限は作成から最大30日。期限はアクセスを停止するが、定期的な物理削除ジョブはない。

## Build 08：自分のマップ

- 専用の「自分のマップ」画面。興味・アイデアを自由に追加し、枝の名前・親・つながる理由・自分用メモを編集。
- 学びの詳細と気になる一覧から、実在する学校・活動・教材を取り込む。取り込んだ候補は元の情報に戻れる。
- 樹形図とは別の枝にも、自分が考えた関連理由を残せる。つながりは編集パネルに表示し、相手の枝へ移動可能。
- 枝の削除では下位の枝と関連線を一緒に除去。「ひとつ元に戻す」で直近15操作を戻せる（この画面を開いている間）。
- 親変更による循環、欠けた親、重複関連、未知の参照IDを検査。40ノード・80関連まで。
- 端末保存がオンならマップも保存・復元する。マップと私的メモは保護者共有APIへ送らない。
- 編集途中の入力は、別の枝へ移っても同じ画面の間は保持。「変更を保存」で確定。再読み込み前には確定が必要。
- テスト18件通過。ブラウザで自由な枝の作成、実情報の取り込み、親変更、関連理由、保存復元、削除と取消、スマホでの入力保持を確認。390pxでページの横はみ出しなし、3本の線の端点誤差0.005px未満。

## Build 09 — Application workspace (2026-09-11)

- Replaced the promotional home hero with immediate search, filters, and continuation shortcuts.
- Split saved workspace into candidates, family sharing, and device storage settings.
- Added candidate search across names, summaries, and private notes; filters cover domains, activities, schools, reflections, and sharing selection.
- Collapsed notes, reflections, and visibility into per-card disclosures that retain expansion during edits. Candidate details and personal-map import remain primary actions.
- Added fixed four-item mobile navigation, route-change scroll/focus management, a skip link, and a device-storage shortcut on each page.
- Validation: syntax checks and 18 existing tests passed. Browser checks covered search → save → note/reflection → filter/reset → tab switch → personal-map import; notes and expanded state survived rerenders. Widths 320, 390, and 1366 showed no horizontal page overflow. Map connections rendered and browser error logs were empty. Temporary UI fixtures were removed through reload with device saving disabled.
- Scope remains a local prototype; this build does not add public hosting or accounts.

## Build 10 — Connected research and personal maps (2026-09-11)

- Research details now open an import preview carrying the current interest, the related academic domain, the resource, connection reasons, and saved private notes into a personal map.
- Saved candidates support explicit multi-selection and grouped import. Domain and resource comparisons offer importing both candidates together.
- Users choose an existing destination branch and either preserve the research path or connect directly. Shared path segments are reused; existing personalized names and notes are never overwritten by re-import.
- Personal-map editors retain original titles, summaries, and source links alongside editable names, notes, and relationship reasons. Related catalog resources can be added beneath the selected branch without restarting search.
- Integration is atomic and undoable, uses the existing workspace persistence, and retains the existing 40-node validation. No new dependencies or external AI service.
- Validation: 20 tests passed, including grouped imports, edit preservation, unknown sources, nonexistent parents, and capacity rejection. Browser checks verified game → information → Scratch import; editing a title; attaching CoderDojo beneath the edited branch; two-candidate import sharing one domain; copying saved notes; repeated import adding zero nodes while preserving edits; and mobile preview/tree layouts without horizontal page overflow.

## Build 11 — Inquiry-first workspace (2026-09-11)

The personal-map editor is replaced by a contextual inquiry workspace. New sessions open it directly; existing search, map, saved, and sharing routes remain available.

- An interest starter creates an editable interest-to-domain tree. Additional interests can be added to the same workspace at any time.
- Selecting a branch scopes the adjacent research panel. Users search, inspect participation/cost conditions, open official sources, add information directly to the branch, and optionally save it as a candidate without leaving the workspace.
- Separate contextual panels support writing private interpretations and questions, moving subtrees, and connecting distant branches. Branches can collapse and expand; undo retains the prior map.
- External URLs and received recommendations can become reference-backed nodes with titles, notes, domain tags, and optional existing recommendation photos. Original provenance remains separate from user-edited names. The app does not fetch or infer arbitrary URL contents.
- Inquiry rendering and contextual operations are extracted to `studio.mjs`, with a dedicated `studio.css`. Storage remains backward compatible; external references are validated and remain outside the family publication projection.
- Search updates only result content so typing and Japanese IME composition do not replace the input element.
- Validation: syntax checks and 22 tests passed. Browser verification covered interest start, direct resource import, draft preservation across panels, adding another interest after research, moving an edited branch, external URL/note import, branch collapse/expand, candidate saving, and access to family sharing. Desktop 1366px and mobile 390px showed no page-width overflow; no browser error logs occurred during the verified workflow. Temporary in-memory browser fixtures were cleared by reload with device saving off.
- Remaining limits: the catalog is still curated and small; arbitrary external URLs require user-provided titles and notes; family access remains local-server only. No deployment or account recovery was added.

## Build 12 — First-use navigation audit (2026-09-11)

Observed blockers and fixes:

1. The first screen exposed an empty map, three editor modes, and thirteen resource cards before an interest had been chosen. It now shows only the interest starter, plus a direct custom-interest form.
2. Starting from games selected the last generated domain (Design), with no user decision. Starter selection now stays on the chosen interest and prompts users to choose a branch.
3. Adding a resource silently changed the selected destination to the new resource. Direct additions now retain the parent and search/filter state. A persistent receipt names the destination and the added item, with actions to write a note or locate it in the map. The receipt scrolls into view below the mobile switch.
4. At 390px, the action panel began around 709px down the viewport after starting. At widths up to 850px, explicit map/action switches show one pane at a time. Selecting a branch opens its actions; returning to the map is explicit. Desktop retains both panes.
5. The saved-page introduction now explains its role as a holding place for later research and its bulk-import action.

Verification: 23 tests passed, including selected-interest regression coverage. Browser checks covered empty entry, preset and custom starts, branch selection, direct import with stable destination, visible receipt (approximately y=80–210 at 390×844), note editing/saving, and returning to the map. Desktop 1366px and mobile 390px had no page-width overflow; checked browser error logs were empty. These are agent walkthrough findings, not results from a user study.

## Build 14 — 学問から高校までの逆引き経路（2026-09-11）

プロダクトシートの機能2・3・4を実装し、機能5との矛盾を解消した。

### 追加した画面

- 「進み方を見る」（`#routes`）を新設。学問を選ぶと、その学問にたどり着く経路を4本並べる。
- 経路の型は、普通科→総合大学／専門学科の高校→専門の大学／高専→大学編入／高校では別分野→大学で転向の4つ。掲載8領域すべてに4本ある。
- 各経路は「学問・研究 → 大学・学部 → 高校の中の選択 → 高校 → いま必要なこと」の5段で、上から遠い未来、下が今になる。
- 経路の入口は、サイドバー、探すページの学問一覧、学びの地図の詳細パネル、自分の探究で学びの枝を選んだときの4か所。

### 機能3：保留可能期限

- 分岐点は専攻・研究室（大学2〜3年ごろ）／学部・学科（高3の夏ごろ）／文理・コース（高1の11月ごろ）／高校（中3の12月ごろ）の4つ。
- 経路上の各段に期限を表示し、ページ下部に「今日決めなければならないのは、いちばん下の1つだけ」とまとめる。
- 公立の一般入試を想定した目安であることと、地域・学校・入試方式で前後することを併記している。

### 機能4：必要な数学レベル

- 数学I・A中心／数学II・B＋データの扱い／数学III・微積分まで の3段階。経路ごとに水準と理由を表示する。
- 同じ学問でも経路によって水準が変わることを、ページ上部で幅として示す（8領域すべてで幅が生じることをテストで固定した）。

### 機能5：共有機能をUIから外した

- `app.js` の `FAMILY_SHARING_ENABLED = false` で、保護者共有タブ・公開範囲の選択・相談カード・受信箱・起動時の`/api/family/owner`問い合わせをすべて止めた。
- サーバー実装（`family-api.mjs`）と結合テストは残してあるため、フラグ1つで戻せる。`/family`ページも配信自体は残っているが、本人アプリからは到達できない。
- 端末保存の説明文から共有設定・おすすめの記述を外し、「サーバーには送りません」を明記した。

### データの扱い

- 大学・学部・高専は公式ページが示す範囲だけを記載。19件のURLすべてがHTTPSで200を返すことを確認した（確認 2026-09-11）。
- 高校の段は、原則として学科の型（普通科／専門学科／高専／どの学科でもよい）で示し、実在校を挙げるのは大島海洋国際高校・鳥羽商船高専・東京高専のみ。**特定の高校からの進学実績は主張していない。** 検証できないため。
- 経路の組み立てと数学レベルの目安が本アプリの編集であることを、ページ下部に明示している。

### 検証

- テスト31件通過（Build 13から5件追加）、構文チェック通過。
- 追加したテスト：全領域に型の異なる経路が3本以上ある／最終段以外のすべての分岐点に保留期限がある／最終段は期限を持たない／経路ごとに数学レベルがあり同一学問内で幅が生じる／出典がHTTPSかつ出典名つき／見返す経路の保存・復元と未知IDの拒否。
- ブラウザ：8領域すべてで経路4本・保留期限16件・出典9件を確認。経路の保持→端末保存→再読み込みでの復元、数学の説明の開閉、4か所の入口からの遷移を確認。
- 幅1366／390／320pxでページの横はみ出しなし。モバイル下部ナビは5項目になったため、CSSを5列にし、ラベルを幅600px以下で「進み方」に短縮した。
- 気になるページに保護者共有タブと相談カードが表示されないこと、起動時に共有APIを呼ばないことを確認。

### 残る制約

- 経路は「型」であり、地域ごとの実在校リストではない。利用者の地域が分かるまでは、都道府県の入試案内へ誘導する形にしている。
- 保留可能期限は一般的な目安で、自治体の実日程を取り込んではいない。
- 対象者本人による利用観察は未実施。ここに書いた検証はすべて開発者による操作確認である。

## Build 13 — Evidence, comparison, and experience records

Implemented `inquiry.mjs` and `inquiry-ui.mjs`: candidates beneath a selected question are compared using attributed catalog facts (content, costs, eligibility, location), user-defined criteria, and private assessments. Arbitrary imported URLs explicitly retain unknown facts; no page extraction service is claimed. Plans, experience status, observations, lessons, and next questions persist with map nodes and remain outside family publication. Experiences flow back into the comparison; the next question can become a child node. Session drafts preserve unfinished assessment/record edits.

## Build 15 — User feedback: first visit and resumption (2026-09-12)

- First viewport explains the purpose and offers a three-step guide. Preset and custom-interest starters remain directly available.
- Returning workspace shows the last recorded action and a concrete next action based on selected information, saved plans, completed experiences, or multiple candidates. The app records the last selected map item and a bounded recent activity list, including viewed catalog entries. Device persistence stays opt-in with a visible switch and accurate status message.
- Disabled native scroll restoration and added initial page-show positioning: reopening starts at the welcome/next-action card, not a stale scroll position.
- Replaced abstract control labels with literal actions. Maps, resource cards, original-source disclosures, and pre-/post-experience forms now have separate visual boundaries.
- Preserved the existing routes feature and its tests, and the current disabled family-sharing configuration.
- Verification: syntax checks and 33 tests passed. Browser workflow: guide → interest → resource addition → custom comparison axes and assessments → plan → reload/resume → observation/lesson → comparison → next question node. At 390×844, the resume CTA ended around y=468 and the first interest choice around y=566, both in the first viewport. Mobile and desktop showed no page-width overflow; checked browser error logs were empty. Test-only persisted records were removed by turning device saving off and reloading; viewport overrides were reset.
- Further user testing is still needed. These browser walkthroughs establish operability and visibility, not proof that first-time users understand every control.

### Build 16 — First-view exploration map
- Replaced the large welcome text card with a clickable, scrollable tree overview. Empty maps offer four interest starters; existing maps show actual parent relationships and the last selected branch.
- Added a separate viewed-information map, grouped by catalog domain, with direct reopening of details. Catalog visits and official links are recorded, capped at 100 unique sources, under the existing optional local persistence setting.
- Preserved next-action suggestions, the guide, and explicit storage controls below the map. Added stronger section boundaries, lavender/coral/mint/lime nodes, outlined cards, and raised action buttons.
- Browser checked: interest starter → branch → related resources; viewed-history tab → source detail; 390px mobile and 1366px desktop. No browser errors observed. Syntax checks and 35 tests passed.
- This is an overview, not a drag-and-drop canvas. External browser-wide history is not read; only catalog information opened through this app is recorded. Existing historical data is limited to the prior recent-activity entries.

### Radial map refinement
- Changed the first-view personal/history overview to radial branches, with collision-aware spacing and curved connections. Interest starters surround the center.
- Added zoom in/out and fit-to-view controls; softened card outlines, corners, shadows and canvas borders.
- Verified browser zoom and branch-to-resource navigation, and all 35 tests including radial sibling separation. The detailed editing tree below remains available.

### Build 17 — Interest directions and external capture
- Added 12 editorial interest directions and 36 activity ideas across music, games, cooking and sea. New starters branch into ways of engaging before academic fields or individual providers. Existing nodes and notes are preserved.
- Direction cards preview the range of activities. An activity can become an editable map node; its description carries into the plan/reflection panel. Catalog resources are separated under a clearly labeled expandable section, rather than presented as if all were direct activity providers.
- Added a review-first URL/title capture form with branch selection and an optional note. A desktop bookmarklet passes only the current title/URL to this local app. Incoming capture parameters open a confirmation form, do not auto-save, and are removed from the address bar.
- Browser verified music → direction → activity → record, manual URL capture, incoming capture parameters, and mobile cards. Syntax checks and 37 tests passed.
- Limits: activity ideas are editorial, not event listings. No arbitrary page-body extraction, browser extension or native mobile share-sheet support. Bookmarklet installation/execution on every external browser/site remains unverified; same-map use across tabs requires local persistence to be enabled and the local server running. Existing user tabs were preserved during testing.

### Build 18 — One-screen browsing and research handoff
- Kept the map and detail panel in one viewport: side-by-side on desktop, a compact local map above independently scrollable details on mobile. Genre entrances remain visible. Selection preserves map pan/zoom; history details open in-place. Fixed inherited mobile body padding that allowed focus to shift the document.
- Standardized action labels to 見つける / メモ / 整理する / 並べて見る and shortened the default note form. Added brief panel transitions with reduced-motion support.
- Extracted the 13 existing resources, topic definitions and 36 editorial activities into data/knowledge.json with executable validation and generation. Added five editorial concept connections for biology, marine life, forests, freshwater and fieldwork. No new real-world providers were researched in this change; unpopulated concepts explicitly show no published information.
- Added the Claude Code research prompt, data contract, evidence migration record, UI vocabulary and system/deployment documents. Selected Cloudflare Pages static hosting with explicit local persistence; generated dist without server code, .data, raw data or test files. No cloud account or production deployment was created.
- Verified source and public builds in the browser. Music → activity → short note saves; biology → forest opens in place; history → resource keeps #personal. On 390×844, body height remained 844 and scrollY remained 0 through selection. Public .mjs served as JavaScript, server.mjs returned 404. No browser errors observed. Data validation, syntax checks, 40 tests and the public build passed. Cloudflare-specific response headers and actual account deployment still require checking after upload.
