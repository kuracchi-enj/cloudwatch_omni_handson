# CloudWatch Omni Hands-on Implementation Plan

**Goal:** LambdaのサンプルログをOmniで調査できる最小構成を作り、デプロイ前まで準備する。

**Architecture:** CDKがLambdaと専用ロググループ、最小権限の実行ロールを作る。OmniのAccount domain／Space／Dataset連携は公式コンソール手順で設定する。

**Tech Stack:** TypeScript、AWS CDK v2、Node.js 24、cdkd、Node標準テストランナー。

## Global Constraints

- CDKスタックのデプロイ、Omni有効化、Lambda Invokeはこの作業では実行しない。deploy前の準備に必要なcdkd bootstrapは対象リージョンで行う。
- 既定リージョンはap-northeast-1。認証情報や実アカウント情報を公開しない。
- デプロイ操作はcdkdを使う。オフライン検証は事前synthしたCloud Assemblyを読む。
- ログ保持7日、削除時DESTROY、公開入口や自動起動なし。

## Task 1: サンプルログとCDK構成

Files: `lambda/index.js`, `lib/cloudwatch-omni-handson-stack.ts`, `bin/app.ts`, `test/handler.test.mjs`, `test/stack.test.ts`, `package.json`, `cdk.json`, `tsconfig.json`。

- [x] 正常・警告・例外シナリオと秘密情報の非記録を検証するテストを先に作成する。
- [x] `node --test test/handler.test.mjs`で未実装の失敗を確認する。
- [x] `handler(event, context)`を実装し、`scenario`以外の任意入力を記録しない。
- [x] CDKのログ配送先と権限制限、公開入口の不在を検証するテストを作成する。
- [x] テストの失敗確認後に`CloudWatchOmniHandsonStack`を実装する。
- [x] `npm run check`で型検査・テスト・synthを実行する。

## Task 2: 手順と調査メモ

Files: `README.md`, `docs/research.md`, `docs/verification.md`, `events/*.json`, `queries/omni.sql`, `.gitignore`。

- [x] サービス概要、CloudFormation/CDKの対応範囲、対応リージョン、費用、プライバシーを一次資料付きで記載する。
- [x] Omni初期設定、cdkd bootstrap、deploy、手動Invoke、Exploreと自然言語の調査例、削除を順番に記載する。
- [x] Omni SQLとCloudWatch Logs Insights QLを混同せず、未実行のクエリを明示する。

## Task 3: デプロイ前検証とGitHub保管

- [x] Node.js 24で依存を固定し、`npm audit`を確認する。
- [x] `cdkd synth --app cdk.out CloudWatchOmniHandsonStack`を外部接続を拒否する環境で実行する。
- [x] 利用者指定プロファイルでAWS認証とcdkd bootstrapを確認する。東京用assetsが未作成なら、既存stateを再利用してbootstrapする。結果のアカウント値は公開しない。
- [x] 公開対象ファイルに認証情報・実アカウントID・生成物が混ざっていないことを確認する。
- [x] GitHub MCPで指定リポジトリに保存し、公開された内容を確認する。
