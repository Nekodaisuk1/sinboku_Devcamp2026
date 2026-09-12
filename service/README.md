# シンボク サービス基盤（Build 26）

Cloudflare WorkersでWebとAPIを配信し、Supabase Auth/PostgreSQLを正本にする最初のサービス実装です。既存のプロトタイプは `wireframe/` に残し、Build 27から個人の地図を段階的に移します。

Node.js 22以上が必要です。

## ローカル起動

```sh
cp .dev.vars.example .dev.vars
# Supabase Dashboard > Settings > API の Project URL と publishable/anon key を設定
npm install
npm run dev
```

`http://localhost:8787` で、ゲスト導線とメールリンク認証の状態を確認できます。メールリンクを使うにはSupabase AuthのRedirect URLsへ `http://localhost:8787/` と本番URLを登録します。

## DB

Docker Desktopを起動した上で、リポジトリのルートから実行します。

```sh
npm --prefix service install
npm --prefix service run catalog:seed
npx supabase start
npx supabase db reset
npx supabase test db
```

`supabase/seed.sql` は既存の公開済みカタログから生成します。seedは冪等で、既存の公開情報を上書きしません。本番へ適用する前にステージングへ migration と seed を適用し、RLSテストを通してください。

## Cloudflareへの配備

`SUPABASE_URL` と `SUPABASE_ANON_KEY` はCloudflare Workerの環境変数として設定します。service role keyは設定・配布しません。

```sh
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npm run build
npx wrangler deploy
```

## Production workflow

GitHubの `production` environmentへ次のSecretsを設定すると、`Deploy production` workflowを手動実行できます。

- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

workflowはテスト後に本番DBへmigrationとseedを適用し、Worker Secretsを登録してからWorkerを配備します。`production` environmentにはrequired reviewersを設定してください。
