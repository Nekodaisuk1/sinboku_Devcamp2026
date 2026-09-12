# Implementation status

## Build 26 — サービス基盤（2026-09-12）

- 時間の野原を内部スクロールではなくページ全体の高さで表示し、上端の研究室から下端の「いま」まで同じスクロールで見渡せるようにした。
- 学問を選んだ直後は4経路を時間軸上へ同時に展開し、特徴・必要な数学・大学例を比較してから1経路へ絞れるようにした。大学・学部候補は経路をまたいだグループで4件まで同時表示し、それ以降は「広げる」に収めた。各候補と経路詳細には公式ページへの直接リンクを付けた。
- `service/` にCloudflare WorkersのWeb/APIを追加。ゲスト開始・メールリンクによるSupabase Authログイン・`/api/v1/health`・`/api/v1/me` を用意した。service role keyはクライアント、Worker設定、リポジトリのいずれにも置かない。
- `supabase/migrations/20260912000100_build26_foundation.sql` にプロフィール、本人専用workspace、公開カタログと根拠のテーブル、Auth作成トリガー、RLSを追加。本人が他人のプロフィール・workspaceを読めず、編集者だけがカタログを書けるRLSテストを置いた。
- 既存の公開済み42件を `supabase/seed.sql` へ生成する経路を追加。seedは同じ安定IDの既存行や公開版を上書きしない。
- Cloudflare用設定、環境変数の雛形、CIを追加。現行プロトタイプはサービス内の `/prototype/` として同梱し、Build 27の段階移行までそのまま使える。
- 検証: seed生成（42件）、JavaScript構文検査、プロトタイプの94テスト、サービスの型検査・4テスト、Assets bindingを含むWorkers dry-runビルド、依存監査（脆弱性0件）、差分の空白検査を通過。公開カタログは現在選択中の公開版だけ読めるRLSへ修正した。本番Supabaseへmigrationとseedを適用し、再dry-runで差分なし、database lintでエラーなしを確認した。

## Build 25 — 家族のおすすめ受信箱とサービス化設計（2026-09-12）

- Build 24の42掲載情報に不足していた種類・都道府県・対象学年・費用・申込期限を補完し、絞り込みと掲載範囲集計を実データで成立させた。
- 家族がURL・名前・一言・任意タグを1件のリンクにし、本人が受信箱で「野原に置く／あとで見る／消す」を選べるようにした。家族側へ本人の野原・学年・記録を返さない。
- 野原へ置いたおすすめは出どころを「家族から」とし、内容未確認の注意、一言、タグを保持する。
- 実データをdraft限定で検証・投入する `resources:import` を追加。既存IDの上書きと公開状態での一括投入を拒否する。
- 静的サイトを体験検証用と位置づけ直し、Cloudflare Workers上のTypeScriptモジュラーモノリスとSupabase PostgreSQL/Auth/Storageによるサービス構成、権限、データモデル、API、Build 26〜30の移行順を `docs/service-architecture.md` に定義した。
- 公式リンク42件を実通信で確認し、恒久リダイレクト2件を正規URLへ更新した。最終結果は問題0件。
- 検証: データ検証・構文検査・90テスト・公開ビルド通過。ブラウザで家族用フォーム→共有リンク→本人受信箱→野原へ置く動線と、家族由来表示を確認した。

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

## Build 19 — 7年の拠点（2026-09-12）

`docs/redesign-proposal.md` の提案1〜3と「捨てる提案」を実装した。5画面を2タブに畳み、Build 14 の経路をホームに昇格させた。

### 実装したもの

1. **7年の地図をホームに（`#now`）**：4つの分岐点と保留可能期限を、学問を選ばなくても起動直後に表示する。初期表示は下2段で、「もっと先まで見る」で7年全体。「今日決めなければならないのは、いちばん下の1つだけ」が第一画面に入る。
2. **分岐点ごとの「いまの考え」**：1行・60字まで・任意。空欄には「まだ決める段階ではありません」と表示し、埋めるよう促さない。
3. **任意の学年**：1タップで選ぶと「あと3か月（2026年12月ごろ）」を表示する。日本の学校年度（4月始まり）で計算。未設定でも地図は全部見られ、残り月数だけ出ない。位置情報・学校名は尋ねない。
4. **やったことの記録**：日付＋1行。締切・連続記録・達成率は持たない。月ごとの件数だけを見返せる。上限500件。
5. **動詞を逆算の起点に（`#find`）**：つくる／くらべる／観察する／調べる／伝える の5つ。同じ動詞がゲーム・料理・音楽・海をまたいで並び、そこから学問、さらに `#routes` の4経路へつながる。活動には所要時間の目安と「家でできるか」が付き、「やった」で記録に入る。
6. **経路（`#routes/<学問>`）**：Build 14 の `routes.mjs` / `routes-ui.mjs` をそのまま再利用。8領域×4経路、保留期限、数学レベル、出典を維持。

### データ（`knowledge.json` を version 2 へ）

- `verbs`（5件）と `domains`（8件）を追加。これまで `app.js` と `catalog.mjs` に直接書かれていた領域定義をデータへ移し、画面のコードから領域名を消した。
- 既存36件の活動アイデアに `verb` / `minutes` / `athome` を付けた。活動の文言は変えていない。
- 掲載情報42件に `verbs` を付けた。学校・大学（`group: "study"`）は空を許し、それ以外は1つ以上を必須にした。
- 検証を追加：動詞は3〜8個／動詞ごとに活動3件以上／活動は全件に動詞・所要時間・場所／`study` 以外の掲載情報は動詞1つ以上。

**掲載件数の訂正**：Build 18 までのUIは「8領域・13件の公式情報を掲載」と表示していたが、実データは42件だった。Build 19 の表示はデータから件数を出す。

### 退避したもの（`wireframe/archive/`）

`studio` `inquiry` `inquiry-ui` `personal-map` `directions` `guide` `journey` `capture` `knowledge-ui` `workspace` `geometry` `room.css` `family-api` `family.html` `family.js` `family-api.test.mjs`。

`FAMILY_SHARING_ENABLED` フラグを削除し、`server.mjs` の配信許可リストからも `/family` を外した。フラグを戻せば共有が復活する構造を解消した（`self-evaluation.md` の「次の改善5」への回答）。削除ではなく退避にしたのは、実装が間違っていたのではなく目的の再定義に合わなくなったためで、判断の記録として残す。

### 検証

- テスト25件・データ検証・構文チェック・公開ビルド通過。経路の要件（4本／保留期限／数学の幅／出典がHTTPS）は Build 14 のテストをそのまま維持し、「動詞から到達できる学問には必ず経路がある」を追加した。
- ブラウザ（390×844）：学年設定→あと3か月の表示→いまの考えの保存→やったことの記録→`#find/make` で3つの興味をまたぐ11件→「やった」が `#now` の記録に入る→端末保存オン→再読み込みで復元→保存オフで消去、を確認。
- 320 / 390 / 1366px でページの横はみ出しなし。コンソールエラーなし。
- `dist` に `server.mjs`・`archive/`・`.data` が含まれないことを確認（公開12ファイル）。
- 検証中に作った記録は、端末保存をオフにして再読み込みし、消えていることを確認した。

### 残る制約

- **対象者本人による利用観察は未実施。** ここに書いた検証はすべて開発者による操作確認である。
- 経路は「型」であり、地域ごとの実在校リストではない。高校の段は都立の入試案内へ送るところで止まっている。
- 動詞は5つ。提案では7つ（直す・つづけるを含む）としていたが、既存の編集資料でそれぞれ1件しか裏づけられなかったため、検証（動詞ごとに活動3件以上）に従って5つにした。「直す」は「つくる」に、「つづける」は記録そのものに畳んである。
- 活動アイデアは編集であり、募集中のイベント一覧ではない。
- 保留可能期限は一般的な目安で、自治体の実日程は取り込んでいない。

## Build 20 — 時間の野原（2026-09-12）

Build 19 への指摘：「ビジュアル的に面白くない。動きがついたWebサイトになっていて、情報を見せる上での優位性がない」。

そのとおりで、Build 19 の主画面は**縦に積んだカードの一覧**だった。一覧で書けることを図にしただけで、平面を使っていなかった。Build 20 は主画面をキャンバスに置き換える。

### 軸の約束

- **縦だけが時間。** 下が今日、上が7年先。段は4つの分岐点と「いま」。
- **横に意味はない。** 本人がどこに置いてもよく、アプリは置き直さない。整列も並べ替えもしない。横位置を領域や確信度に割り当てれば、その瞬間「勝手に分類される」側に落ちる。
- **意味を持つのは線。** 置いたものから伸びた線が、どこで合流するか。これが一覧では出せない唯一の情報である。

### 世界は、置いたぶんだけ現れる

初期状態は空の野原。学問も経路も最初から並べない。

1. 「いま」に1つ置く → その興味が扱う領域が上の段に現れ、線が伸びる
2. 2つ目を置く → 同じ領域に2本届いたら、そこが合流として光る（色・枠線・印の3つで示す）
3. 学問を選ぶ → そこへの経路を1本ずつ、中間の段に引ける（大学・文理・高校の3段が現れる）
4. 未来の段にも置ける → 「高校に入ったらやりたい」を今日から持てる。指で段をまたいで動かせる

合流した学問の横位置は、届いている置きものの平均。合流するほど2つの間に寄るので、**収束が位置そのものに出る。**

### 合流しないことを失敗にしない

共通点が出なければ「まだ合流していません」と言い、無理に線をつながない。自由入力は、本人が関わり方（動詞）を選ぶまで、どこにもつながない。文字列から領域を推測しない。

### 置けるもの

好きなこと4／活動アイデア36／掲載情報42／自分で書いたもの。「探す」で見つけたものは、その場から野原に置ける。置きものごとに「やったこと」の記録がぶら下がる。置きものを外しても、記録は消さずに紐づけだけ切る。

### 実装

- `field.mjs`：段・配置・行送り・合流の判定・経路の展開・保存形式（純粋関数）
- `field-ui.mjs`：SVGの描画と、同じ内容の一覧
- 幅は実際の表示幅を1:1で使い、文字を縮小しない。狭い画面では重なったものが下の行へ送られ、段が厚くなる
- 何も置かれていない段は薄くする。時間の隔たりは見出しの日付が示す
- 野原はキャンバス内でスクロールし、本人が動かすまで下端（いま）に留まる
- ドラッグは Pointer Events。6px動くまではタップ扱いにして、選択操作を邪魔しない
- 幅の変化は `ResizeObserver` で拾う（`resize` イベントでは取りこぼした）

### 検証

- テスト38件（Build 19 から12件追加）、データ検証、構文チェック、公開ビルド（14ファイル）通過。
- 追加したテスト：段が上から下へ隙間なく積まれる／横位置がレイアウトで書き換わらない／重なりは横移動ではなく行送りで解消／空の野原は何も現れない／別々の興味が同じ領域に届いたときだけ合流／同じ興味を2回置いても合流にしない／自由入力は動詞を選ぶまでつながらない／経路は1本ずつ中間3段に出る／落とした段は縦位置から決まり野原の外に出ない／置きものの保存と不正値の拒否／記録は置きものを外しても消えない。
- ブラウザ（390×844）：空の野原 → 海を置く → 料理を置く → 生態学が合流して光る → 学問をタップ → 高専経路を野原に引く → 置きものをドラッグして高校の段へ移動 → 保存・再読み込みで復元。
- 320 / 390 / 1366px でページの横はみ出しなし。SVGの幅が表示幅に追従することを確認。コンソールエラーなし。
- 検証中に作った記録は、端末保存をオフにして再読み込みし、消えていることを確認した。

### 残る制約

- **対象者本人による利用観察は未実施。** 「一覧より分かりやすいか」「合流が面白いと感じるか」は、この実装では判定できない。
- 合流は領域の一致であり、内容の一致ではない。掲載領域が8つしかないので、偶然そろうことがある。画面には「向き不向きの判定ではない」と書いているが、それで足りるかは未検証。
- 置きものが増えたときの可読性は未検証。上限60件だが、20件を超えたあたりで線が読めなくなる可能性がある。
- ドラッグはPointer Eventsに依存する。マウス・タッチでは確認したが、ペンや支援技術での操作は未検証。キーボードでの移動は未実装で、代わりに詳細パネルの「いつのこと？」から段を変えられる。

## Build 21 — 入口と接続のレビュー（2026-09-12）

Build 20 の機能を実ブラウザで見直し、機能の有無ではなく「最初に見えるか」「調べたものをその場で取り込めるか」「線の根拠が内容に合うか」を修正した。

### 実装したもの

1. **空の野原そのものを開始画面にした。** 画面外にあった開始案内をキャンバス内へ置き、ゲーム・料理・音楽・海・自由入力を第一画面から1タップで置ける。
2. **次に開く扉と続きの入口を野原の直前に置いた。** 次の分岐点、1件置いた後の次の一手、2件以上あるときの最後の置きものを同じ位置に出す。
3. **保存の意味を行動の言葉にした。** 「端末保存」を「次回も残す」に変え、未保存の記録があるときだけ強調する。保存は引き続き本人の選択で、初期値はオフ。
4. **動詞詳細の長い縦ページを分割した。** 「やってみる」「学問」「掲載情報」を同じ画面内で切り替え、件数を先に見せる。
5. **検索結果から直接取り込めるようにした。** 好きなこと・活動・掲載情報には「野原に置く」を出し、取り込み後は `#now` に戻る。
6. **活動から伸びる線の根拠を修正した。** 動詞に属する全領域ではなく、活動が属するグループの領域だけへ接続する。音楽の「観察する」から生態学へ伸びるような無関係な線を防ぐ。
7. **SVGの段とノードをキーボード操作可能にした。** Tabで移動し、EnterまたはSpaceで詳細を開ける。選択ダイアログはEscapeで閉じた後も再表示されない。

### 検証

- データ検証、構文チェック、公開ビルド、テスト39件が通過。
- 実ブラウザで、空の野原から配置、1件後の次操作、動詞詳細の3種類切替、掲載情報から野原への取り込みを確認。
- Tabで5つの時間段と学問ノードへ移動し、Enterで学問詳細を開けることを確認。選択ダイアログのEscape終了も確認。
- 自動axe監査はローカルのNode.js 20と取得されたChromeDriver 153の要件が合わず実行できなかった。静的確認とキーボード操作確認は完了している。

### 残る制約

- 対象者本人による利用観察は引き続き必要。今回の修正で「最初の1タップ」が見えるようになったことと、実際に押したくなることは別である。
- 20件以上を置いたときの線の可読性は未検証。
- 自由入力は動詞だけを手がかりに領域へ接続するため、活動・掲載情報より線の根拠が広い。

## Build 22 — 20件あっても読める野原（2026-09-12）

Build 21 の「残る制約」に挙げた「20件以上を置いたときの線の可読性は未検証」に応えた。機能を増やすのではなく、長く使ったときに野原が読めなくなる原因を取り除いた。

守った原則は3つで、どれも崩していない。縦だけが時間であること、横位置は本人のものでアプリが並べ替えないこと、意味を持つのは線がどこで合流するかであること。したがって可読性の対策はすべて「描くものを減らす／まとめる／一時的に行を分ける」で実現し、保存された `x` を書き換えるコードは1行も足していない。

### 実装したもの

1. **表示切替を足した。** 「全体を見る」「選んだものだけ」「最近置いたもの（5件）」。隠すのは描画だけで保存データには触れず、絞ったときは「20件のうち1件を表示しています」と必ず件数を出す。黙って減らさない。「選んだものだけ」は**線1本ぶん**（置きものを選べばその学問、学問を選べばそこへ届いている置きもの）。合流相手は学問のほうを選ぶと出るので、2段階のドリルダウンになる。
2. **段ごとに「まとめ」を入れた。** 1つの段は4行まで描き、入りきらない分は「ほか◯件」の破線チップ1つにまとめる。まとめられたものへ伸びていた線は消さず、チップへ付け替える。タップまたはEnterで展開する。
3. **段ごとに「広げる／まとめる」を足した。** 広げると、その段だけ1ノード1行になり、ラベルの重なりがなくなる。横位置は各自のままで、変わるのは行だけ。一時表示で保存しない。
4. **選んだものと、その線の行き先はまとめに隠さない。** 隠すと「1つ選べば学問までの線を追える」が成り立たなくなる。合流相手までは広げないので、選んだ瞬間に段が伸びることはない（テストで高さの増分を制約している）。
5. **関係する線を前面に出した。** SVGはCSSのz-indexが効かないので、DOMの出力順を「薄い→素→明るい」に並べ替えた。選択中のノードも最後に描く。
6. **ドラッグ中に画面全体を描き直すのをやめた。** 動かしているノードの `transform` と、そこにつながる `<path>` の `d` だけを直接書き換え、指を離したときに確定して保存する。`previewBox()` が `layout()` と同じ式を共有するので、プレビューと確定位置がずれない。
7. **一覧に並べ替えを足した。** 「時間の段」「追加順」「つながる学問」。どの並びでも置いたものが1つも欠けないことをテストで保証している。
8. **キーボードで置きものを動かせるようにした。** 選んで矢印キーで横移動（Shiftで細かく）、上下で段の移動。段を移したときは何段へ動かしたかを読み上げる。これでマウス・タッチ・キーボードが同じことをできる。
9. **合流の文を短くした。** 1つの学問に8件届くことがあり、名前を全部並べると1文が画面を埋めていた。名前は3つまでにして残りを件数で言い、3件以上のときは「どちらも」ではなく「どれも」にする。
10. **段の見出しを線より後に描くようにした。** 20件置くと線が何本も見出しの上を通り、日付が読めなくなっていた。

### 検証

- テスト50件とデータ検証・構文チェックが通過。
- 実ブラウザ（375×812）で20件を置いた状態を確認した。野原の高さ1060px、描画ノード18個、線41本。20件でも段ごとに見渡せ、「ほか◯件」から残りを開ける。
- 置きものを1つ選ぶと、そこから伸びる3本の線が前面に出て、行き先の学問名が3つともまとめから外れて表示されることを確認した。このときの野原の高さは変わらない（1060px→1060px）。
- ドラッグ中にノードのDOM要素が同一のまま（再生成されていない）ことと、指を離した後の確定位置がドラッグ中のプレビュー位置と完全に一致することを確認した。pointermove 1回あたりの処理は0.03msで、全体描画（0.32ms）の約10分の1。これはJavaScriptの実行時間だけの比較で、実際にはこれに加えて `main` 全体の作り直しとフォーカス・スクロール位置の復元がなくなる。
- キーボードだけで、横移動・細かい横移動・段の移動ができ、移動後もフォーカスが対象に残ることを確認した。
- 一覧の3つの並べ替えを確認した（時間の段28件、追加順20件、つながる学問は8学問に61件＝1件が複数の学問に現れる）。

### レビュー後の修正（同日）

実装後の見直しで、次の3点を直した。

- **「選んだものだけ」が絞り込みになっていなかった。** 合流相手（学問をまたいだ2ホップ先）まで含めていたため、検証データでは20件中16件が残っていた。名前と挙動が食い違うので、線1本ぶんに変えた。20件中1件まで絞れる。合流相手は学問を選べば出る。これに伴い `focusSet()` は使われなくなったので削除した。
- **広げた段を閉じられなくなることがあった。** 段の見出しにある「まとめる」は、広げて縦に長くなった段をスクロールすると画面外へ出てしまう。野原の外に「広げている段：いま ✕」を常時出した。
- **axe の代わりを用意した。** 依存を足さずに、描画結果の文字列を検査する回帰テストを追加した。

### 残る制約

- 対象者本人による利用観察は引き続き未実施。20件を「操作できる」ことと、20件置きたくなることは別である。**Build 22 は20件を前提に作ったが、実際は3〜5件で止まる可能性がある。その場合、まとめも表示切替も一度も発火しない。観察で最初に確かめるのはそこである。**
- 2段階のドリルダウン（置きもの → 学問 → 合流相手）が、説明なしに伝わるかは未検証。画面には「同じ学問に届いている他のものは、学問のほうを選ぶと出ます」と書いているが、読まれる保証はない。
- 段を「広げる」と1ノード1行になるので、12件ある段は縦に長くなる。本人が明示的に広げたときだけなので長さ自体は許容し、上限は設けていない。代わりに、広げている段を野原の外にも常時出して、スクロールしても閉じられるようにした。
- まとめに入った置きものは、開くまで名前が画面に出ない。「ほか◯件」から開くか一覧を見る必要がある。
- 自動axe監査は Build 21 と同じ理由（ChromeDriverの要件不一致）で未実行。代わりに、依存を足さずに描画結果の文字列を検査する回帰テストを入れた（操作できる要素に名前があるか、合流が色以外でも示されているか、ユーザー由来の文字列がエスケープされているか、図から消えたものが一覧には出るか）。コントラスト比の検査はこの方法では代替できない。

## Build 23 — 自分で調べたものを、そのまま取り込む（2026-09-12）

「わざわざアプリを開いて入力する」負担を減らす。本人がすでに見つけたもの（ページ・写真・思いつき）を、掲載情報や活動と同じ「置きもの」として野原に置けるようにした。Build 18 で退避した URL 取り込みの作り直しであって、復活ではない。退避した理由（一覧画面のための機能で、野原と噛み合わなかった）を繰り返さないよう、取り込みの出口を必ず野原にした。

### 実装したもの

1. **置きものの形を1つにそろえた。** 出どころ（掲載情報／このアプリの項目／自分で追加／家族から）と、内容（好きなこと／活動／掲載情報／自由入力／リンク／写真）を別の軸にした。既存の `kind` は残し、`source` は保存データに無ければ `kind` から導く。**保存形式は version 2 のまま**なので、Build 22 までに置いたものはそのまま読める。
2. **リンクを置けるようにした。** URL を貼る、またはブックマークレットから `#add?u=…&t=…` で届く。**http と https だけ**を受け付け、`javascript:` `data:` `file:` は「置けるのは http と https のページだけです」と断る。
3. **置く前に確認画面を出す。** 貼り付けただけでは置かない。リンク先の全文・写真・名前・タグを見せ、**いまの選び方だとどこへ線が伸びるのかを文章で先に言う**。
4. **通信しない。** 貼られた URL を開いて中身を取りに行かない。題名もサムネイルも取りに行かない。題名はブックマークレットが送ってきたものか、無ければホスト名を初期値にして、本人が書き換える。
5. **写真を置けるようにした。** 端末の中で 480px まで縮小して JPEG にし、1枚160KBまで・12枚まで。入りきらなければ黙って諦めず「この端末に残すには大きすぎました」と言う。**ノードには写真を出さない**（野原が写真だらけになると時間の軸が読めなくなる）。写真はパネルに出す。
6. **タグは3つだけ。** 「何について」「どんな関わり方」「いつやりたい」。どれも任意。
7. **タグの組み合わせを積集合にした。** 「海について」×「つくる」→ 海洋工学。和集合にすると1つ置いただけで6領域へ線が伸び、合流が意味を失う。積が空のときは「何について」側を採る。片方だけならその領域。どちらも選ばなければ線を作らない（**文字列や URL から推測しない**という原則は変えていない）。
8. **出どころを隠さない。** 自分で足したものには「自分で追加」「内容は確認していません」を、パネルにも一覧にも出す。図の上でも、破線の枠と小さな印で見分けられる（まとめノードとは破線の間隔を変えた）。リンクは `↗`、写真は `▣` をラベルの前に置き、意味は `aria-label` で言う。
9. **リンクは自動で開かない。** 別のタブで、`rel="noopener noreferrer nofollow"` を付けて開く。開くかどうかは本人が決める、とパネルに書く。
10. **保存の上限を入れた。** 状態が 4MB を超えると `encodeState` が例外を投げる。写真を足して黙って保存が止まるのを防ぐ。保存に失敗したときの文言も、容量が原因の場合とブラウザ設定が原因の場合で書き分けた。

### 検証

- テスト68件（新規13件）とデータ検証・構文チェック・公開ビルドが通過。
- 実ブラウザ（375×812）で次を確認した。
  - リンク：URL を貼る → 確認画面 → タグを選ぶと線の行き先の説明が変わる（「海・生き物」だけ → 生態学・環境科学・海洋工学／「海・生き物」＋「つくる」→ 海洋工学）→ 置くとパネルに出どころ・注意・リンクが出る。
  - ブックマークレット経由：`#add?u=…&t=…` で確認画面が開き、ハッシュは `#now` に戻る（再読み込みで二重に出ない）。
  - `javascript:` と `data:text/html,<script>…` はどちらも拒否され、確認画面が開かない。
  - 題名に `<img src=x onerror=alert(1)>&"'` を入れても、確認画面・野原・一覧のどこにも要素として注入されない（`img[onerror]` は0件）。URL の `"` も同様。
  - 写真：2400×1600・285KB の画像が 38KB の JPEG data URL に縮小されて入り、ノードには画像が描かれず（`<image>` 0件）、パネルにだけ出る。
  - 一覧：31件すべてに出どころが付き、自分で足した7件に「内容は確認していません」が出る。掲載情報には付かない。

### 残る制約

- ブックマークレットはスマートフォンでは登録が難しい（iOS Safari はお気に入りの編集が必要、Android Chrome も同様）。パソコンで調べる場面を想定した機能で、スマートフォンからは URL を貼る経路が主になる。この差を画面には書いていない。
- 写真は端末の localStorage に入るため、ブラウザの記録を消すと一緒に消える。12枚・4MBの上限も、写真を多く使う人には足りない可能性がある。IndexedDB へ移す判断は利用観察の後。
- 「何について」は4つ（ゲーム／料理・食べもの／ギター・音楽／海・生き物）しかない。これに当てはまらないページを取り込むと、関わり方（動詞）だけが手がかりになり、線の根拠が広くなる。
- 積集合の規則は確認画面に文章で出しているが、規則そのものが直感に反していないかは未検証。
- 対象者本人による利用観察は引き続き未実施。

## Build 26 — 自分の興味からマップを作る（2026-09-12）

既成の候補を見るだけでなく、本人が複数の興味を選び、その組み合わせを起点に進路マップを作れるようにした。「ゲームか音楽か」のように1つへ絞らず、最大5件を一度に追加できる。既存の4テーマに当てはまらない興味は自由に書けるが、文字列から内容を推測せず、本人が選んだ「関係があるジャンル」だけを学問との接続根拠にする。

追加済みのテーマはフォーム上で明示し、二重追加を防ぐ。操作は1回の保存・描画にまとめ、複数の興味が同じ学問へつながった場合は共通点が現れたことを通知する。これにより、学部や大学の候補を先に見せるのではなく、「自分が選んだ興味 → 共通する学問 → 複数の進路ルート」という順序で比較を始められる。

提示されたマップを本人のものにできるよう、項目名を変更し、項目と学問の接続を1本ずつ追加・解除できる編集欄も追加した。本人が接続を編集した場合は提示データと分けて保存し、空の接続も本人の選択として維持する。「提示された接続に戻す」を選んだときだけ、カタログやタグから導いた接続へ戻る。進路ルートは出典のある事実情報なので、この自由編集の対象には含めない。

「学校・大学」から掲載情報を追加した場合は、現在地点へ一律に置かず、高校は「高校を選ぶ」、大学・学部は「学部・学科を選ぶ」の段へ置く。教材・イベントなど、進学段階そのものではない掲載情報は従来どおり現在地点へ置く。
