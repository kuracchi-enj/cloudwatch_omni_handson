# CloudWatch Omni調査メモ

調査日: 2026-11-01。公式情報をもとにした記事準備用のメモ。AWS上の実機検証結果は含まない。

## 何をするものか

CloudWatch Omniは、アプリケーションとAIエージェントの状態を調べるためのCloudWatchの新しい利用体験。組織専用のWeb UIやIDE拡張から、ログ・メトリクス・トレースを調べる。Omni agentへ自然言語で質問してクエリを作成したり、関連する情報を調べたりできる。OpenTelemetryを基盤とし、既存のCloudWatchへの送信経路も利用できる。[公式概要](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch-omni.html)

入口となるDomain、その中で作業するSpace、テレメトリーを横断して照会するCloudWatch Datasetという単位がある。Spaceのアカウントとリージョンの境界を意識する。Omni単体が他アカウント・他リージョンのデータを自動収集するわけではなく、必要ならCloudWatchの集約設定を別に行う。[構成とCloudWatchとの関係](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch-omni.html)

## 従来のCloudWatchとどう違うか

| 観点 | 従来の利用方法 | Omniでの利用方法 |
| --- | --- | --- |
| 入口 | AWS Management Console、API | 専用Web UI、IDE拡張 |
| 主な調査の進め方 | サービスごとの画面やクエリ | 同じ調査画面で複数シグナルをたどる |
| ログ・トレースの照会 | Logs Insightsなど | Omni SQL |
| メトリクスの照会 | CloudWatchメトリクスなど | PromQL |
| AIによる支援 | 各既存機能に応じた支援 | Omni agentによる自然言語調査 |

既存のロググループ、保持期間、送信設定を引き続き管理する。ログの送信先を「Omni専用ロググループ」に置き換えるという理解ではない。ExploreではログとトレースにSQL、メトリクスにPromQLを使う。[Exploreの公式手順](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-explore-and-query-your-telemetry.html)

## 初期設定とアクセス権

単一アカウントでは、CloudWatchコンソールでAccount domainとSpaceを作る。Dataset連携がログやトレースを照会可能にする。ログだけのハンズオンでもこの設定は必要。既存のSpaceを使う場合はアカウントとリージョン、利用者のアクセス権を確認する。

初回有効化では最大7日分の既存ログ・トレースがバックフィル対象になり、カスタマー管理KMSキーで暗号化されたデータはバックフィル対象外。初期設定は既存テレメトリーにも関わるので、検証アカウントが扱いやすい。IdPを接続しないIAMロール等でのサインイン経路もある。[単一アカウント設定](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-set-up-omni-for-a-single-account.html)

Spaceの利用ロールには照会だけでなく複数の管理権限も含まれる。Lambdaの実行ロールと人がOmniを利用する権限は別物。サンプルLambdaへOmni管理権限を付与する必要はない。[OmniのIAMポリシー](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-iam-policies-to-use-cloudwatch-omni.html)

## 対応リージョンと資料の差

2026-10-19のAWS発表で、東京を含む8リージョンが追加された。今回は`ap-northeast-1`を既定にする。FAQやクロスリージョン推論の表には、当初の3リージョンだけを載せた記述も残っていた。利用可否は新しい対応拡大発表を根拠にし、推論先についてはその表から東京の動作を推測しない。[AWSの対応拡大発表](https://aws.amazon.com/about-aws/whats-new/2026/10/amazon-cloudwatch-omni-8-regions/)

## CDKで何を記述するか

| 対象 | 記述方法／扱い |
| --- | --- |
| ロググループ、保持期間、削除方針 | `aws_logs.LogGroup` |
| Lambdaのログ送信先、JSON形式、レベル | `aws_lambda.Function`の`logGroup`, `loggingFormat`, `applicationLogLevelV2`, `systemLogLevelV2` |
| Lambda実行権限 | `aws_iam.Role`と`logGroup.grantWrite(role)` |
| メトリクス、アラーム、従来のダッシュボード | 必要なら`aws_cloudwatch`。今回のログ調査には追加しない |
| OmniのDomain・Space・Dataset連携 | 今回は公式コンソール手順。CDKスタックには含めない |

ロググループのL2はCloudFormationの`AWS::Logs::LogGroup`に対応する。JSONのLambdaログはNode.jsの`console.info/warn/error`を利用でき、ログ内容は`message`に格納される。[CDK LogGroup](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_logs.LogGroup.html)、[Lambdaログ形式](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs-logformat.html)

`AWS::CloudWatch::Space`のCloudFormation個別リファレンスは存在する。必須プロパティは`Name`、`DomainId`、`DataAccessRoleArn`など。一方で、CloudWatchのリソース一覧やCDK参照には反映差があり、これだけでDomainからDataset連携までの自動化が完成するとは判断できない。「Omniは一切IaC非対応」とは結論しない。今回の依存バージョンに含まれる`CfnSpace`の有無はローカル検証メモに記録する。[CloudFormation Space](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cloudwatch-space.html)

cdkdの公式対応表にはLambda Function、Logs LogGroup、IAM Role／PolicyのSDK providerが載っている。新しいプロパティはCloud Controlに経路が変わる場合があり、ローカルsynthは実際のプロバイダー動作の証明ではない。cdkdは開発・検証環境向けとされている。[cdkd対応リソース](https://github.com/go-to-k/cdkd/blob/main/docs/supported-resources.md)、[cdkd導入手順](https://github.com/go-to-k/cdkd/blob/main/docs/getting-started.md)

## ログだけで試せること、追加設定が必要なこと

今回は、固定サービス名とrequestIdを持つJSONログを出し、正常処理・警告・失敗を調べる。自然言語でエラーの説明を求め、原文のログに戻って根拠を確認する。

サービスマップ、REDメトリクス、分散トレースとログの相関まで試す場合は、Active tracing、ADOT／OpenTelemetry、Transaction Searchなどを別途設定する。今回のLambdaにはそれらを付けないため、ログが出たことをサービスマップやトレース表示の証明にしない。[Lambdaテレメトリーの公式手順](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-send-application-telemetry-from-aws-lambda.html)

## 料金とプライバシー

元のCloudWatch Logsロググループの保持・削除と、Omni Datasetに転送済みのレコードの保持は区別する。転送対象を外しても、既存のDatasetレコードは保持期限まで残る。本スタックの`DESTROY`は元ロググループの削除を指定するもので、転送済みレコードの即時削除を保証しない。[Dataset転送の仕様](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-send-telemetry.html)

ログの取り込みと保持には通常のCloudWatch料金がかかる。Omniのログ・トレースの照会はスキャン量に関する料金と含有枠があり、PromQLやエージェント評価にもそれぞれの料金体系がある。Lambda、cdkd bootstrap用ストレージ、任意で有効化した追加機能も考慮する。無料クレジットは適用条件があるため無料とは断定しない。[Omni料金](https://aws.amazon.com/cloudwatch/omni/pricing/)

OmniのAI機能へはテレメトリーや自然言語入力が渡る。保存先と推論処理先を区別し、選択するモデルによっても処理先が変わり得る。認証情報や個人情報は最初からログへ出さない。記事へ貼る画面ではアカウントID、ARN、DomainのURL、利用者、実ログをマスクする。[クロスリージョン推論](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/omni-cross-region-inference-in-cloudwatch-omni.html)

## Qiita記事にする際の流れ

1. 「既存のCloudWatchログをOmniで調査する」という目的を示す。
2. Domain／Space／Datasetの役割と、CDKで作る範囲を説明する。
3. 最小のCDKコードを紹介し、Omniを初期設定する。
4. 正常・警告・エラーを各1回実行し、JSONログを確認する。
5. ExploreとOmni agentで同じ失敗を調べ、根拠のログを示す。
6. ローカル検証と実機で確認できた結果、未検証の範囲を分ける。
7. 後片付けと追加で発生する可能性のある費用を示す。
