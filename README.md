# CloudWatch OmniでLambdaのログを調査する

手動で実行するLambdaから正常・警告・エラーのJSONログを出し、CloudWatch Omniで調べる最小ハンズオン。

CloudWatch Omniは、CloudWatchのテレメトリーを専用UIやAIアシスタントで調べるための利用体験。サービスの概要、CDKの対応範囲、料金、公式資料は[調査メモ](docs/research.md)にまとめた。

```text
手動Invoke → Lambda → CloudWatch Logs → CloudWatch Dataset → Omni Explore / Omni agent
             └──── CDKで作る範囲 ────┘   └── コンソールで事前設定 ──┘
```

**このスタックをdeployするだけではOmniの初期設定は完了しない。** 同じAWSアカウント・リージョンにOmniのDomain／Space／Dataset連携が必要。初期設定では既存ログも取り扱うので、機密データのない検証アカウントを使うと進めやすい。

## 作るもの

- Node.js 24のLambda 1個。外部依存、公開URL、自動実行なし。
- 専用CloudWatch Logsロググループ1個。Standard、7日保持、削除時に元ロググループも削除。
- そのロググループへの書込だけを許可するLambda実行ロール。
- タイムアウト5秒、メモリ128MB。予約済み同時実行数は設定せず、アカウントの共有枠を使用。

既定リージョンは東京（`ap-northeast-1`）。[2026-10-19のAWS発表](https://aws.amazon.com/about-aws/whats-new/2026/10/amazon-cloudwatch-omni-8-regions/)で東京のOmni対応を確認した。

## 1. ローカルの準備

Node.js 24.20.0、npm、AWS CLIを用意する。`.nvmrc`を使う環境なら`nvm use`で切り替える。デプロイとサンプル実行のコマンドは、リポジトリのルートで実行する。

```bash
npm ci --ignore-scripts
export PATH="$PWD/node_modules/.bin:$PATH"
export AWS_REGION=ap-northeast-1
export AWS_DEFAULT_REGION="$AWS_REGION"
npm run check
```

`npm run check`は型検査、handlerとCDKのテスト、CDK synthを行う。AWSリソースは作成しない。生成物は`cdk.out/`へ出るがGit管理から除外している。

cdkdで事前生成済みのCloud Assemblyを読めることも確認する。

```bash
cdkd synth --app cdk.out CloudWatchOmniHandsonStack
```

通常の`cdkd synth`はSTSやcontext lookupを利用する場合がある。外部通信を拒否して行ったローカル検証の詳細は[検証メモ](docs/verification.md)を参照。

## 2. AWS認証とcdkdの準備

利用する検証アカウントの認証を有効にする。名前付きプロファイルなら`AWS_PROFILE`を設定する。SSOの場合はAWS CLI v2の`aws sso login --profile <設定済みプロファイル名>`を実行する。

```bash
aws sts get-caller-identity
```

ここで表示されるアカウントIDとARNは、記事やコミットに含めない。Lambda、IAM、Logsの作成とcdkdの管理ストレージにアクセスできる実行者権限が必要。

cdkdをそのアカウント・リージョンで初めて使う場合は、次を実行する。**これはAWS上へS3／ECR等の管理リソースを作成する操作。今回の検証環境では、既存stateバケットを再利用して東京向けbootstrapを実行済み。** 別アカウントで試す場合は準備状態を確認する。

```bash
cdkd bootstrap
```

cdkd用のstate／assetストレージと、ハンズオンのロググループは別のリソース。cdkdはCloudFormationを介さずAWS APIで管理するため、後の確認に`aws cloudformation describe-stacks`は使わない。[cdkd公式導入手順](https://github.com/go-to-k/cdkd/blob/main/docs/getting-started.md)

## 3. Omniを初期設定する

既存のOmni Spaceを利用できる場合は、同じアカウント・東京リージョンか確認し、必要なアクセス権を管理者から受け取る。

初めて使う場合は、[CloudWatchのOmni設定画面](https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#settings:/omni)で次を行う。

1. `Get started`から`Account domain`を選ぶ。
2. 公開URLの一部になるDomain名を決め、権限設定を確認する。個人情報や社内固有情報をDomain名に含めない。
3. 続けてSpaceを作り、アカウントとリージョンがLambdaの配置先に一致することを確認する。
4. CloudWatch Dataset連携が有効になり、利用者がSpaceへアクセスできることを確認する。
5. ログ調査には不要なAIエージェント評価や外部連携を追加しない。追加機能の設定画面では料金と権限を確認する。

IdPを接続しない場合もIAMロール等からサインインできる。SSOを使う場合にはIdentity CenterとDomainのリージョン条件がある。[公式初期設定手順](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-set-up-omni-for-a-single-account.html)

初期設定はアカウント・リージョン単位のテレメトリーを扱う。このLambdaのロググループだけがOmniに見える設定とは限らない。Spaceに入る利用者の権限と、他のログに機密情報がないことを確認する。

## 4. ここでデプロイ前の準備完了

前提は、`npm run check`成功、対象アカウントへの認証、cdkd bootstrap済み、対象リージョンのOmni SpaceとDataset連携が利用可能なこと。今回確認できた範囲と残る前提条件は[検証メモ](docs/verification.md)に記録している。

**次が実際にリソースを作成するコマンド。今回の作業では実行していない。**

```bash
cdkd deploy CloudWatchOmniHandsonStack
```

cdkdの出力から`FunctionName`と`LogGroupName`を控える。認証や設定を変えた場合も、LambdaとOmni Spaceが同じアカウント・リージョンにあることを確認する。

## 5. デプロイ後にログを出す

次は利用者がdeployした後の手順。`FUNCTION_NAME`には出力された`FunctionName`を設定する。

```bash
export FUNCTION_NAME='デプロイ出力のFunctionName'
mkdir -p .local
aws lambda invoke --function-name "$FUNCTION_NAME" --payload fileb://events/success.json .local/success-response.json
aws lambda invoke --function-name "$FUNCTION_NAME" --payload fileb://events/warning.json .local/warning-response.json
aws lambda invoke --function-name "$FUNCTION_NAME" --payload fileb://events/error.json .local/error-response.json
```

| scenario | アプリログ | Lambdaの実行結果 |
| --- | --- | --- |
| success | INFO: order_started → order_completed | 成功 |
| warning | INFO: order_started → WARN: inventory_low → INFO: order_completed | 成功 |
| error | INFO: order_started → ERROR: order_failed | 意図的に例外で失敗 |

エラーのInvokeもAWS CLIの終了コードが0になる場合がある。レスポンスの`FunctionError`と`.local/error-response.json`を確認する。非同期Invokeや自動再試行は設定していない。

サンプルの注文・在庫・決済は架空。入力イベント本文、メールアドレス、トークン等はログへ出さない。Node.jsのJSONログ形式では、`console.info({...})`のオブジェクトが`message`へ入り、外側に`timestamp`、`level`、`requestId`が付く。[Lambdaログ形式](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs-logformat.html)

## 6. Omniで調べる

既存の任意のLambdaを使う場合も、そのログが同じアカウント・リージョンのCloudWatch Logsへ届き、Dataset連携の転送対象になっていれば、同じ調査手順を使える。その場合は対象ロググループと、実際に出力されるログのフィールドへクエリを合わせる。

1. 先に通常のCloudWatch Logsで、出力の`LogGroupName`にログが到着したことを確認する。
2. Omniの同じSpaceに入り、`Explore logs`を開く。
3. 時間範囲を直近15分にし、対象ロググループを選ぶ。反映を待って再検索する。
4. [Omni SQL例](queries/omni.sql)のロググループ名を置き換え、最初の生レコード確認クエリを1つだけ実行する。
5. Browseで実際のフィールドを確認し、ERROR抽出と`requestId`での前後追跡を試す。ネストの解釈が例と異なる場合は、Builderでフィールドを選んで生成された式を使う。

Omni SQL例は公式の構文をもとに作った未実機検証の例。CloudWatch Logs Insights QLの`fields | filter`はOmni SQLへそのまま貼れない。比較用に[従来のLogs Insights例](queries/logs-insights.ql)も置いた。

Omni agentには、例えば次のように質問する。対象ロググループ名も添えると絞りやすい。

> 直近15分のomni-handson-ordersのログで、ERRORが出たリクエストを探して。そのrequestIdの開始から失敗までを時系列で示し、原因を説明して。

回答の根拠となる`order_failed`と`PAYMENT_SIMULATED_FAILURE`を原文で確認する。この例の原因は意図的な決済失敗であり、実際の決済サービスを呼び出していない。自然言語の回答内容や日本語での応答品質は実機検証が必要。

ログだけの構成なので、アプリケーションマップ、トレース表示、AIエージェント評価の成功は確認対象に含めない。次の段階で試すなら、[公式Lambdaテレメトリー手順](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-send-application-telemetry-from-aws-lambda.html)に従って計装を追加する。

## ログが見えないとき

| 確認箇所 | 確認すること |
| --- | --- |
| Lambda Invoke | FunctionNameとリージョン、Invoke実行権限 |
| 通常のCloudWatch Logs | 対象ロググループ、Lambdaの書込権限、ログレベル |
| Omni Space | アカウント・リージョン一致、Dataset連携、アクセス権 |
| Explore | 時間範囲、ロググループ名、フィルター、到着までの待ち時間 |
| SQL | まず生レコードを表示し、Browseでフィールドを確認 |
| Lambda作成時の同時実行数エラー | 旧コードの`reservedConcurrentExecutions: 1`を削除した版へ更新する。予約には未予約枠を少なくとも100残す必要があるため、今回は予約を行わない |

## 7. 後片付け

```bash
cdkd destroy CloudWatchOmniHandsonStack
```

Lambda、実行ロール、元のCloudWatch Logsロググループが対象。**ロググループの保持期間7日は「最低7日残る」ではなく、destroyで元ロググループ内のログも削除する。** 記事用に残す場合も、匿名化したサンプルだけを扱う。

**Omni Datasetへ転送済みのレコードは別に扱う。** 転送を停止しても既存レコードはDatasetの保持期限まで残る。元ロググループの削除が、転送済みレコードの即時削除になるとは扱わない。[公式のDataset転送仕様](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-send-telemetry.html)

OmniのDomain／Space／Dataset連携や、cdkdのbootstrap用ストレージはこのスタックの管理外。利用者が今回作成したものだけを公式の管理手順で片付ける。共有のSpaceや管理ストレージを消さない。

## 費用と公開時の注意

Lambda実行、CloudWatchのログ取り込み・保持、Omniの照会、bootstrapストレージ等の料金が発生し得る。[Omni料金](https://aws.amazon.com/cloudwatch/omni/pricing/)を確認し、時間範囲と件数を絞って調査する。無料クレジットの適用は前提にしない。

`.local/`、`cdk.out/`、認証ファイル、実ログ、デプロイ出力は公開しない。AIへの質問にも秘密情報を含めない。画面キャプチャを記事へ貼る場合は、アカウントID、ARN、Domain URL、利用者、実際の業務ログをマスクする。

主なコードは[CDKスタック](lib/cloudwatch-omni-handson-stack.ts)と[Lambda handler](lambda/index.js)。設計は[設計メモ](docs/superpowers/specs/2026-11-01-cloudwatch-omni-design.md)にある。
