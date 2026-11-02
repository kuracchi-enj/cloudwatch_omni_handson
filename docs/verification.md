# 検証結果

初回検証日: 2026-11-01。2026-11-03のデプロイ失敗と修正を末尾に追記。実装・ローカル検証・AWSで行った事前準備を分けて記録する。アカウントID、実ARN、プロファイル名、管理リソース名、実行ログは公開しない。

## ツールと依存

| ツール | バージョン |
| --- | --- |
| Node.js | 24.20.0 |
| npm | 11.19.0 |
| TypeScript | 7.0.2 |
| aws-cdk-lib | 2.275.0 |
| AWS CDK CLI | 2.1147.0 |
| constructs | 10.8.1 |
| cdkd | 0.312.0 |

直接依存を固定し、`package-lock.json`で解決結果も保存した。インストール時には`--ignore-scripts`を使用した。

## 2026-11-01にローカルで確認したこと

| 検証 | 結果 |
| --- | --- |
| TypeScript `tsc --noEmit` | 成功 |
| Lambda handlerテスト | 4件成功。正常、警告、例外、任意入力の非記録 |
| CDK assertions | 2件成功。ログ配送先と最小書込権限、公開入口・自動起動・Omni設定の不在 |
| CDK synth `--no-lookups` | 成功 |
| cdkd synth `--app cdk.out` | 成功。1スタック、4リソース、3 Outputs、Lambdaコードassetあり |
| CloudFormationスキーマ検証（cfn-lint、東京） | エラー0件、警告1件 |

cfn-lintの警告は`W3005`。CDKが生成したLambdaのRoleへの`DependsOn`と、`Role`プロパティの`Fn::GetAtt`による依存が重複するという内容。生成された依存関係を手作業で書き換えていない。CDK CLIは未設定feature flagの案内も出力した。

生成されたリソースは以下の4種類だけ。

```text
AWS::Logs::LogGroup
AWS::IAM::Role
AWS::IAM::Policy
AWS::Lambda::Function
```

ロググループは7日保持、`DeletionPolicy: Delete`。Lambdaの`LoggingConfig.LogGroup`はこのグループを参照する。実行ロールの許可は、同グループへの`logs:CreateLogStream`と`logs:PutLogEvents`。権限リソースの`*`指定や広いAWS managed policyを追加していない。

`aws-cdk-lib@2.275.0`の`aws-cloudwatch`に、Domain／Space／Datasetを作る`CfnDomain`／`CfnSpace`／Dataset型は見つからなかった。CloudFormation Spaceの個別ドキュメントが存在することとは区別する。Omniの初期設定を汎用`CfnResource`やCustom Resourceで補う実装は行っていない。

### オフライン確認の条件

実際のAWSプロファイルと一時トークンを外し、設定ファイルを`/dev/null`に置き換え、ダミー認証とループバックプロキシを使って、`npm run check`と事前生成済みCloud Assemblyの読込を実行した。

```bash
env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE -u AWS_SESSION_TOKEN \
  AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null \
  AWS_ACCESS_KEY_ID=offline AWS_SECRET_ACCESS_KEY=offline \
  AWS_REGION=ap-northeast-1 AWS_DEFAULT_REGION=ap-northeast-1 \
  AWS_EC2_METADATA_DISABLED=true AWS_MAX_ATTEMPTS=1 \
  CDK_DISABLE_CLI_TELEMETRY=true CDK_DISABLE_VERSION_CHECK=true \
  HTTP_PROXY=http://127.0.0.1:9 HTTPS_PROXY=http://127.0.0.1:9 \
  NO_PROXY=127.0.0.1,localhost npm run check
```

同じ環境変数の条件で、次を実行した。

```bash
./node_modules/.bin/cdkd synth --app cdk.out CloudWatchOmniHandsonStack
```

この結果はテンプレート生成とcdkdによる読込の証拠。Lambda作成、ログ配送、Dataset転送、Omni上でのクエリ成功の証拠ではない。

## 2026-11-01にAWSで確認・準備したこと

- 利用者指定のプロファイルで、東京リージョンのSTS認証を確認した。
- 既存のcdkd stateバケットにアクセスできることを確認した。
- 東京のcdkd asset用S3／ECRが未作成だったため、`cdkd bootstrap`を実行し、終了コード0を確認した。既存stateを再利用し、`--force`や削除オプションは使っていない。
- bootstrap後に東京のasset用S3／ECRへのアクセスを再確認した。asset用S3では4種類のPublic Access Blockとサーバー側暗号化が有効だった。
- 公式SDKの`ListSpaces`で、東京に既存Omni Spaceがないことを確認した。利用者がDomain／Spaceを初期設定する必要がある。

bootstrapの出力はGit管理外のローカルファイルに保存した。公開用の記録に実リソース名やアカウント値は含めていない。bootstrapの管理用S3／ECRはハンズオンのスタックとは別に残る。

## 依存監査

`npm audit --json`の結果は、moderate 6件、high 0件、critical 0件。6件は同じminimatchのDoS advisory（`GHSA-g3hv-75wg-m249`）から影響が伝わる依存パッケージの件数。CDK内にbundleされた`minimatch@10.2.6`と、cdkd → archiver → readdir-glob経由のminimatchが対象。

公開時点で確認した最新版のCDK／cdkdを使っているが、この指摘は残る。修正版の範囲は`minimatch >=11.0.1`で、bundleされた依存を利用者の通常のoverrideで置き換えることはできない。`npm audit fix --force`が提示するcdkdの大幅なダウングレードは適用していない。

これらは開発・デプロイ用のツール依存。Lambdaの配布assetは`index.js`と`package.json`のみで、node_modulesを含まない。ただし、ツールを実行する側への影響がないという意味ではない。信頼できないプロジェクトやglob入力を処理せず、修正版が出たら監査と互換性確認のうえ更新する。

## レビューで修正した点

CloudWatch Logsの元ロググループを削除しても、Omni Datasetに転送済みのレコードまで即座に消えるとは限らない。公式の保持仕様を確認し、READMEと調査メモで両者を区別した。

## 公開対象の確認

公開対象22ファイルに対し、AWSアクセスキー形式、秘密鍵、主要トークン形式、12桁のアカウント値、ローカルの絶対パス、利用者指定プロファイル名を確認し、検出0件だった。`.local/`、`node_modules/`、`cdk.out/`はGit管理から除外した。これは特定パターンの確認結果であり、任意の秘密情報を完全に検出できるという意味ではない。

## 2026-11-01時点の未実施事項

1. CloudWatchコンソールで、東京のAccount domain／SpaceとDataset連携、利用者のアクセスを設定する。
2. `cdkd deploy CloudWatchOmniHandsonStack`を実行する。
3. サンプルLambdaをInvokeし、CloudWatch Logsへの配送を確認する。
4. OmniでSQL／自然言語の調査を試す。SQL例のフィールド解釈と日本語応答はここで初めて実機確認する。
5. 利用後、スタックと今回作ったOmni側の設定を、それぞれ管理範囲を確認して片付ける。

`cdkd deploy`、asset publish、Lambda Invoke、Omni有効化、照会、destroyは実行していない。実環境での権限、同時実行数クォータ、プロバイダー互換性、データ到着の成否はデプロイ後の確認が必要。

## 2026-11-03: 初回デプロイ失敗と予約済み同時実行数の修正

利用者から、OmniのSpaceへアクセスできたことと、初回の`cdkd deploy`結果が共有された。ロググループとIAM Role／Policyの作成後、Lambdaの`PutFunctionConcurrency`で`InvalidParameterValueException`になり、cdkdが作成済み3リソースをロールバックした。出力には、部分作成したLambdaも削除したと記録されている。これは利用者が共有した実行結果であり、こちらで再デプロイして再現したものではない。

原因確認として、指定済みプロファイルで東京の`GetAccountSettings`を読み取り実行した。同時実行数上限は10、未予約枠も10だった。AWSの仕様では予約設定後も未予約枠を少なくとも100残す必要があり、`reservedConcurrentExecutions: 1`を設定できない。IAM伝播のリトライ回数が表示されていても、この予約容量の制約は待機では解消しない。

https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html

手動で実行するハンズオンには予約容量が不要なので、スタックの`reservedConcurrentExecutions`を削除した。Lambdaはアカウントの共有枠を使用し、この関数単独の同時実行数上限1は設定しない。公開URLや自動起動は引き続き追加しない。

生成テンプレートに`ReservedConcurrentExecutions`がないことを確認する回帰テストを追加し、変更前のコードで失敗することを確認した。修正後は型検査、handlerの4テストとCDKの3テスト、CDK synth、cdkdによる事前生成済みCloud Assemblyの読込がすべて成功した。実際のテンプレートから予約設定がなくなったことも確認した。

ロールバック後の`cdkd state show`を読み取り確認したところ、管理リソースは0件、ロックはなかった。これはcdkd stateの確認結果であり、アカウント全体のAWSリソースがすべて削除済みという意味ではない。追加のrollbackや再デプロイは実行していない。

修正直後の時点では、再デプロイ、Lambda Invoke、Omniでのログ検索は未確認だった。その後の進捗は以下に追記する。

## 2026-11-03: デプロイ成功とInvoke対象名の設定

利用者から修正後のデプロイ成功が共有された。cdkd stateを読み取り確認し、管理リソース4件と`FunctionName`、`LogGroupName`、`DeploymentRegion`のOutputsを確認した。

続いて、説明用の文字列を`FUNCTION_NAME`にそのまま設定したInvokeが、関数名の形式チェックで拒否された。これは関数が処理を開始する前の入力エラー。その後、利用者から実際の関数名を指定すると呼び出せたことが共有された。

READMEとART.mdの手順を、cdkd stateの`state.outputs.FunctionName`から関数名を取得する形へ変更した。READMEから設定コマンドをそのまま取り出してzshで読み取り実行し、有効な関数名を取得できたことを確認した。公開用のコードに実環境の関数名は含めない。エージェントは今回Lambda Invokeを実行していない。

シナリオごとの戻り値、CloudWatch Logsへのログ到着、Dataset転送、Omniでの検索結果はまだ確認していない。
