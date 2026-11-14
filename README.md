# Teacher Lesson AI

日本の教員向けに、児童・生徒を特定できる情報を扱わず、授業準備を支援するサービスを検討するための開発中の試作です。

**実用サービスではありません。** 小学5年・算数の授業案のたたき台を、固定テンプレートの **mock** で作り、教員が確認・編集・コピーする流れだけを試せます。AI 生成・保存・認証・決済は未実装です。詳しくは [mock 試作メモ](docs/mock-mvp.md) と [保留事項](docs/pending-decisions.md) を参照してください。

## 開発

Node.js 24 LTS または 26、npm を使用します。

```sh
npm ci
cp .env.example .env.local
npm run dev
```

http://localhost:3000 を開きます。API キーは不要です。

```sh
npm run check
npm run build
npm start
```

`check` は整形確認、ESLint、TypeScript、単体テストを実行します。ブラウザでの E2E は `npm run e2e`（Playwright・Chromium。初回は `npx playwright install chromium`）で実行します。E2E は CI に含めていません。

## 構成

- `src/app/`: Next.js App Router の画面と API。`/api/health` と mock API（`/api/mock/goal-candidates`、`/api/mock/lesson-plan`）。
- `src/components/`: 画面の UI コンポーネント。
- `src/lib/`: 共通定義。`src/lib/lesson/` に入力検証、mock 生成、スキーマ検証、時間配分チェック、コピー用整形。
- `src/server/`: 将来のサーバー専用処理の配置先。
- `tests/`: 単体テスト（node:test）。
- `e2e/`: ブラウザ E2E（Playwright）。
- `docs/`: スコープと安全設計上の確認事項。

## 最初の対象

最初の試作対象は小学5年の算数です（#6）。単元の仮候補は出典未確認で、網羅性も保証しません（#7）。実 AI の選定は保留中です（#9）。

児童生徒の名簿・成績・行動記録、教材ファイルアップロード、決済、外部 AI への送信は初期スコープに含めません。

## 安全性と権利

個人情報を入力しないことだけで、学校業務での利用が認められるわけではありません。所属組織の端末・アカウント・クラウド利用規則、教材の利用権、生成結果の検証などを確認する必要があります。詳細は [安全設計チェックリスト](docs/safety.md) を参照してください。

秘密鍵や API キー、実際の児童生徒情報、私的なインタビュー記録をコミットしないでください。

## 公開とライセンス

ソースコードの公開のみです。サービスのデプロイは行っていません。現時点でオープンソースライセンスは付与していません。依存パッケージには各パッケージのライセンスが適用されます。

## 依存関係の補足

`minimatch` は公開時点の既知の DoS 脆弱性を避けるため、修正版 11.0.1 に override しています。更新時は lint・型検査・テスト・ビルドを再確認してください。CI は Node.js 24 で同じチェックを実行します。

## 開発運用

通常の作業は `develop` から Issue ごとのブランチを作り、PR で統合します。詳細は [CONTRIBUTING.md](CONTRIBUTING.md)、[リリース手順](docs/releasing.md)、[公開・情報管理](docs/publication.md) を参照してください。ブランチ保護の GitHub 設定は文書とは別に管理します。
