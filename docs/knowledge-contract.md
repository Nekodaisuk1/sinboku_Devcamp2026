# 情報の管理仕様

## 編集するファイル

正本は `wireframe/data/knowledge.json`。UIや `catalog.mjs` に情報を追加しない。`npm --prefix wireframe run knowledge:build` で `knowledge-data.mjs` を生成する。生成物の直接編集は禁止。

```text
knowledge.json → 検証・変換 → knowledge-data.mjs → 地図・詳細・検索
```

`version: 1`。実行可能な検証仕様は `wireframe/scripts/knowledge.mjs`。追加前後に `knowledge:check`、`knowledge:build`、`check`、`test`、`build` を実行する。新しい外部依存は不要。

## 混ぜないもの

| データ | 意味 | 例 |
|---|---|---|
| topics | 興味の入口 | 音楽、料理 |
| directions | 楽しみ方と活動アイデア | 一緒に演奏する、友達と一曲 |
| concepts | 情報同士を横断するためのつながり | 生物学、海の生き物、野外観察 |
| resources | 実在する教材・活動・学校など | 特定の団体の観察会、大学の公式カリキュラム |

「海」は生物学の同義語ではない。場所・対象と、学問・活動を分ける。海から生物学へ、生物学から森や川へ、野外観察から複数の場所へつなぐ。学校の所在地だけで「フィールドワークができる」と分類しない。

## concepts

```json
{
  "id": "forest-life",
  "label": "森・里山の生き物",
  "kind": "subject",
  "summary": "植物・昆虫・鳥など、陸の生き物のつながりに目を向ける。",
  "domains": ["ecology", "environment"],
  "broader": ["biology"],
  "related": ["fieldwork"]
}
```

- `kind`: `field`（分野）、`subject`（場所・対象）、`activity`（活動）。表示名は生徒に通じる短い言葉にする。
- `broader`: 本当に包含関係があるもの。循環禁止。`related`: 包含しないが行き来できるもの。両方向に見せるなら双方に明記する。
- `domains`: 既存画面への互換用分類。使用できる値は ecology / environment / engineering / information / design / food / sound / media。細かい分類は無理にここへ足さずconceptsを増やす。
- `biology` の互換先が ecology でも、生物学全体が生態学という意味ではない。UIの広がりはconceptの関係で表す。将来の学問モデル再編まではこのアダプターを維持する。
- 関係は編集上の整理。受験資格、必須科目、向き不向きの判定に流用しない。

## resources

既存の13件をひな型にする。最低限必要な値：

| フィールド | ルール |
|---|---|
| id | 小文字英数・ハイフン、先頭英字、50文字以内。一度公開したIDは変更・削除しない |
| name / summary / reason | 名前80字以内。何ができるか・つながる理由を分ける。カードの要約は80字程度を目安 |
| domain / domains | 主分類は必ずdomainsに含める。上記互換分類を使用 |
| conceptIds | この情報を表示する具体的なconceptのID。空配列は既存移行情報のみ。新規は必ず1つ以上 |
| group | try（単発・自宅で試す）/ continue（継続活動）/ study（進学） |
| type / kind | typeはresource / community / club / event / school / university。kindは「地域の観察会」など短い表示名 |
| url / source | 公式の該当ページURL、発信元の正式名。トップページだけで内容を保証しない |
| checkedOn | 実際にページを確認した日。YYYY-MM-DD。推測で更新しない |
| reviewAfter | 再確認日、またはnull。募集イベントは締切・開催日に合わせて設定 |
| reviewStatus | draft / published。draftは公開用データに含まれない |
| conditions | `[見出し, 内容]` の配列。対象・場所・費用・参加条件・日程など。不明は「公式案内で未確認」 |
| date | eventで必須。開催日YYYY-MM-DD |
| online / free | 確認できる場合のみtrue。falseは「オンライン不可」「有料」の断定ではなく検索用の未該当値 |
| example | 実在する掲載情報はfalse。活動案を実在の募集として登録しない |
| step | 最初にできる小さな行動。実際の参加資格を確認せず申し込みを促さない |

教材の無料閲覧と、交通費・実地参加費の無料を混同しない。対象年齢、在校生限定、一般参加、オンラインの違いはconditionsに明記する。大学の授業と中高生向け体験は別のresourcesにする。

既存利用者が保存したIDを復元するため、公開済み情報の削除やdraftへの戻しはこの作業では行わない。期限切れを見つけた場合は募集終了とわかるname/kind/conditionsに改め、研究報告に記す。期限の自動失効や自動再調査は未実装。reviewAfterの確認を公開前の手動工程に含める。

## directions

topicごとの配列。各項目にid / icon / title / description / domains / activitiesを持つ。activitiesはid / title / description / labelの配列。活動案と確認済み募集は別管理。

現行の保存互換では活動の配列順を識別に使用しているため、**既存項目は並べ替え・削除せず末尾に追加**する。idやtopic名も変更しない。活動が増える場合は画面の量を点検する。

## 確認・公開フロー

1. 公式の該当ページを読む。検索結果の抜粋だけで確定しない。
2. `docs/research-evidence.md` にID、確認URL、確認日、どの記述を裏付けるか、不明点を記録する。長文転載はしない。
3. draftで追加し、条件・関連付け・重複を確認する。
4. 根拠を確認できたものだけpublishedにする。IDとリンクの整合を検証する。
5. 画面で少なくとも「海 → 生き物 → 森・川」「外に出て観察する → 実在の情報」を確認する。
6. ビルドしてプレビュー。本番反映は公開担当者が行う。

個人のメモ、実在する生徒の情報、APIキーをこのJSONに入れない。すべて公開配信される。任意の画像URLや写真は今回の仕様に入れない。
