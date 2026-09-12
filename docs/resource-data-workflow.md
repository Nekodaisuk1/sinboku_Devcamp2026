# 掲載情報の用意と投入

掲載情報は、数を増やすことより「本人が見たときに何ができるか」「なぜ今の興味とつながるか」を説明できることを優先する。検索結果の要約や生成文だけでは公開しない。

## 1. 収集する

公式の該当ページを読み、1つの活動・施設・教材・学校を1リソースにする。トップページだけで個別の募集条件を保証しない。新規収集では、現在0〜2件の学問・種類・地域を先に埋め、全国またはオンラインで利用できる情報を優先する。

確認する項目は次のとおり。

- 中高生本人が実際にできること
- 対象学年、開催地、オンライン可否、費用
- 開催日、申込期限、継続募集か
- 公式の情報源と確認日
- どの興味・関わり方・学問につながるか
- 不明な条件。不明を無料・対象外などに読み替えない

根拠は `docs/research-evidence.md` にID、URL、確認日、裏付ける項目、不明点として残す。原文の長い転載はしない。

## 2. 下書きを作る

投入ファイルはJSON配列、または `{"resources": [...]}` とする。各項目は `data/knowledge.json` の既存リソースと同じ形式で、必ず `"reviewStatus": "draft"` にする。

Build 24 以降は、次の検索用項目も必須になる。

| 項目 | 値 |
| --- | --- |
| `category` | `material` / `place` / `event` / `continuing` / `club` / `school` / `university` |
| `prefecture` | 都道府県名。場所に縛られない場合は `null` |
| `grades` | `j1`〜`j3`, `h1`〜`h3` の配列。公式情報で特定できない場合は `[]` |
| `cost` | 無料と確認済みなら `free`、有料と確認済みなら `paid`、判断できなければ `unknown` |
| `deadline` | 申込期限。ない、または確認できなければ `null` |

## 3. 検証して投入する

最初は書き込まず、全リソースとの重複・参照・日付・URL・分類を検証する。

```bash
npm --prefix wireframe run resources:import -- /absolute/path/to/resources.json
```

問題がなければ `--write` を付ける。既存IDの上書きと、公開状態での一括投入は拒否される。

```bash
npm --prefix wireframe run resources:import -- /absolute/path/to/resources.json --write
```

投入後も下書きは画面や公開ビルドへ出ない。担当者が根拠・文言・タグを1件ずつ確認し、`reviewStatus` を `published` に変える。公開前に次を実行する。

```bash
npm --prefix wireframe run knowledge:check
npm --prefix wireframe run knowledge:build
npm --prefix wireframe run links
npm --prefix wireframe run check
npm --prefix wireframe test
npm --prefix wireframe run build
```

一度公開したIDは変更・削除しない。期限切れやリンク切れは、保存済みマップを壊さないようIDを残して、状態と確認日を更新する。
