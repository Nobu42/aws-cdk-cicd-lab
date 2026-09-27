# 第5章 感情分析システム Osenchi 構築手順

[書籍READMEへ戻る](../README.md)

## 0. この手順の範囲

『実践 AWS CDK』（2020年）第5章の構成を、CDK v2・AWS SDK for JavaScript v3で実装する。
書籍のコードをそのまま転載するのではなく、旧API・欠落箇所・入力検証を修正した実行用の完全版を掲載する。
説明とソースの配置先をこの文書にまとめる。文書の作成だけでは、実際のソースファイルやAWS環境は変更されない。

### 現在の到達点

| 項目 | 状態 |
| --- | --- |
| Node.js 24の選択 | 実行済み。`v24.21.0` |
| `osenchi`の作成・`cdk init app` | 実行済み |
| Lambda用ディレクトリの作成 | 実行済み |
| SDK v3・esbuildの追加 | 実行済み |
| 雛形の`npm run build` | 成功 |
| `npx esbuild --version` | `0.28.2`を確認 |
| 本文の完成コードを実際のプロジェクトへ配置 | 未実施 |
| Osenchiのデプロイ・AWSでの動作確認 | 未実施 |

**再開位置は「3. ソースコードを配置する」。作成済みのディレクトリで`cdk init`を再実行しない。**

### 作るもの

```text
入力ファイル(JSON Lines)
  |
  v
入力S3 -- PutObject --> CloudTrail -- APIイベント --> EventBridge
                          |                             |
                          v                             v
                       ログ用S3                    Step Functions
                                                   Parallel(1分岐)
                                                     |
                                              DetectSentiment Lambda
                                                | S3から読み込み
                                                | Comprehendで分析
                                                | 出力S3へ保存
                                                     |
                                               DeleteObject Lambda
                                                | 入力S3の対象を削除
                                                     |
                                                SNS成功メール

                  Parallel内の失敗 --> SNSエラーメール --> Fail
```

`Parallel`は並列化のためではなく、3つの処理をまとめて例外処理するために使う。
入力を削除するのは、分析と出力S3への保存が成功した後だけである。
SNSメールには処理結果の保存先などを載せる。各文章の感情スコア本体は出力S3で確認する。

### 書籍からの変更点

| 書籍 | この手順 | 理由 |
| --- | --- | --- |
| `@aws-cdk/core`、サービス別パッケージ | `aws-cdk-lib`と`constructs` | CDK v2へ対応 |
| Node.js 12、SDK v2の`aws-sdk` | Node.js 24、SDK v3の個別クライアント | 古いランタイム・SDKを使わない |
| `Function`とコンパイル済みJSの配置 | `NodejsFunction`とesbuild | 現在の`tsconfig.json`は`noEmit: true`のため |
| `sfn.Task`、`InvokeFunction`、`PublishToTopic` | `LambdaInvoke`、`SnsPublish` | CDK v2のAPIへ対応 |
| `definition` | `definitionBody` | 現在のAPIでステートマシンを定義 |
| メールアドレスをソースに直接記入 | デプロイ時のCloudFormationパラメータ | Gitへアドレスを登録しない |
| SNS/Lambdaの固定名 | CDKの自動命名 | 他の学習環境との衝突を防ぐ |
| エラーメールで終了 | メール後に`Fail` | 処理失敗を実行履歴でも失敗として残す |
| Comprehendの成功結果だけを処理 | `ErrorList`も確認 | 一部失敗した入力を削除しない |
| 管理イベントも記録し得る設定 | この証跡は入力S3の書き込みデータイベントだけ | 学習に必要な範囲へ限定 |

CloudTrail経由の連携は書籍に合わせて残す。S3からEventBridgeへの直接通知へは変更しない。
参照: [CDK v2への移行](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/migrating-v2.html)、[SDK v2サポート終了](https://aws.amazon.com/blogs/developer/announcing-end-of-support-for-aws-sdk-for-javascript-v2/)、[Lambdaランタイム](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/lambda-runtimes.html)

### 実行前の注意

- 学習用アカウント・東京リージョン・`learning`プロファイルで実行する。
- 新規の3バケットだけを使う。別リポジトリの既存S3や業務環境には接続しない。
- 入力は非機密の短文を使う。分析のために文章がAmazon Comprehendへ送信される。
- 成功時に入力S3のファイルが削除される。手元の原本は残す。
- 同じキーへ上書きしない。毎回新しいキーを使い、1ファイルずつ確認する。
- 通知は即時到着を保証しない。CloudTrail・EventBridgeの配信や再配信の影響を受ける。
- CloudTrailデータイベント、Comprehend、Step Functions、Lambda、SNS、S3、ログ保存には利用料金が発生し得る。無料と見なさず、検証後に片付ける。
- 本例は学習用であり、重複実行対策、同一キーの並行更新、DLQなどは未実装である。

## 1. 配置場所を確認する

プロジェクトの絶対パス:

```text
/Users/nobu/aws-cdk-cicd-lab/01-practical-cdk-2020/osenchi
```

この文書の絶対パス:

```text
/Users/nobu/aws-cdk-cicd-lab/01-practical-cdk-2020/docs/05_osenchi_runbook.md
```

完成時の配置:

```text
01-practical-cdk-2020/
├── docs/
│   └── 05_osenchi_runbook.md       # この手順書
├── sample/                       # 第2・3章。変更しない
└── osenchi/                      # 以降のコマンド実行場所
    ├── bin/
    │   └── osenchi.ts            # AppとStackの起動
    ├── lib/
    │   └── osenchi-stack.ts      # AWSリソースとワークフロー
    ├── functions/
    │   ├── detect-sentiment/
    │   │   ├── index.ts          # 感情分析Lambdaの入口
    │   │   └── job-executor.ts   # 読み込み・分析・保存
    │   └── delete-object/
    │       ├── index.ts          # 削除Lambdaの入口
    │       └── job-executor.ts   # S3オブジェクト削除
    ├── test/
    │   └── osenchi.test.ts       # リソース定義のテスト
    ├── testdata/                 # ローカルのテスト入力
    ├── cdk.json                  # cdk initで作成済み
    ├── package.json              # コマンドと依存関係
    ├── package-lock.json         # 依存バージョンの記録
    ├── tsconfig.json             # TypeScriptの型検査設定
    ├── jest.config.js            # テスト設定
    └── .gitignore
```

以下のソース欄のパスはすべて`osenchi`からの相対パスである。
`lib/osenchi-stack.ts`は、絶対パスでは`/Users/nobu/aws-cdk-cicd-lab/01-practical-cdk-2020/osenchi/lib/osenchi-stack.ts`となる。

## 2. ディレクトリと依存パッケージを準備する

### 2.1 Node.jsを選ぶ

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
hash -r
node --version
```

意味: HomebrewのNode.js 24を優先し、Bashが記憶しているコマンドの場所を再検索させる。
確認: `v24.`で始まること。新しいターミナルではPATHの設定を再確認する。

### 2.2 プロジェクトを新規作成する【実行済み・再実行不要】

```bash
cd "$HOME/aws-cdk-cicd-lab/01-practical-cdk-2020" &&
mkdir osenchi &&
cd osenchi &&
npx --package=aws-cdk@2.1143.0 cdk init app --language typescript
```

意味: 空の`osenchi`を作成し、指定版のCDK CLIでTypeScript用の雛形を生成する。
理由: 書籍ごとの依存関係を分離し、第2章の`sample`を上書きしないためである。
`&&`は前の処理が成功した場合だけ次へ進める。`mkdir`を`mkdir -p`に変えて既存プロジェクトを初期化し直さない。
参照: [cdk init](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/ref-cli-cmd-init.html)

### 2.3 再開時は既存プロジェクトへ移動する

```bash
cd "$HOME/aws-cdk-cicd-lab/01-practical-cdk-2020/osenchi"
pwd
mkdir -p functions/detect-sentiment functions/delete-object testdata
```

意味: Lambdaごとのコード配置先とテスト入力の置き場を作る。
理由: ハンドラと処理本体を分けて、関数単位で読める構成にするためである。
`mkdir -p`は既存ディレクトリを削除・初期化しない。

### 2.4 パッケージを追加する【SDK・esbuildは実行済み】

```bash
npm install @aws-sdk/client-s3 @aws-sdk/client-comprehend
npm install -D esbuild
npm run build
npx esbuild --version
```

意味: S3・ComprehendのSDKと、Lambda用コードをまとめるesbuildを追加する。
`-D`は開発用依存関係への登録である。CDK v2は初期化済みの`aws-cdk-lib`を使うため、`@aws-cdk/aws-s3`などを追加しない。

確認済みの環境: CDK CLI `2.1143.0`、`aws-cdk-lib` `2.270.0`、SDKクライアント `3.1141.0`、esbuild `0.28.2`。
今後同じ依存関係で復元する場合は、コミット済みの`package-lock.json`を使って`npm ci`を実行する。
`npm warn install-scripts`は、すべてのパッケージが動作不能という意味ではない。確認済みなのは型検査とesbuildのバージョン表示までであり、後続の`synth`で実際のバンドルも確認する。

### 2.5 自動生成された設定を確認する

`package.json`のscriptsは次のままでよい。これは確認用の抜粋であり、ファイル全体を上書きしない。

```json
{
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "test": "jest",
    "cdk": "cdk"
  }
}
```

`cdk.json`の`app`は`npx tsc && npx tsx bin/osenchi.ts`である。既存のcontext設定を消さない。
現在の`tsconfig.json`は`noEmit: true`のため、`npm run build`は型検査だけを行う。
Lambdaへ送るJavaScriptは、次の`NodejsFunction`が`synth`/`deploy`時にesbuildで生成する。
ESLint・Prettierはこの手順では追加しない。書籍の古い設定をそのまま混ぜない。

## 3. ソースコードを配置する

**以下の7ファイルをすべて配置してから、4節の型検査・テストへ進む。**
途中の状態ではimport先が存在せず、型検査に失敗しても不自然ではない。

### 3.1 `bin/osenchi.ts` — アプリの起動

既存ファイルを開く:

```bash
vim bin/osenchi.ts
```

既存内容を次の全コードへ置き換える。

<!-- file: bin/osenchi.ts -->
```typescript
#!/usr/bin/env node
// ファイル: bin/osenchi.ts
// CDK CLIが最初に実行するファイル。ここでAppにStackを登録する。
import * as cdk from 'aws-cdk-lib';
import { OsenchiStack } from '../lib/osenchi-stack';

// AppはCDKアプリ全体の入れ物であり、AWSリソースそのものではない。
const app = new cdk.App();

// CLIが選択したアカウント・リージョンをスタックへ渡す。
// AWS操作時は --profile learning を付け、対象を取り違えない。
new OsenchiStack(app, 'OsenchiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
```

### 3.2 `lib/osenchi-stack.ts` — リソースと処理順序

```bash
vim lib/osenchi-stack.ts
```

<!-- file: lib/osenchi-stack.ts -->
```typescript
// ファイル: lib/osenchi-stack.ts
// AWSリソース、実行権限、イベント連携、ワークフローをまとめて定義する。
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';

export class OsenchiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // メールアドレスはデプロイ時に受け取る。ソースへ直接記入しない。
    // noEchoはCloudFormationのパラメータ表示をマスクする設定であり、
    // SNSサブスクリプション上のアドレスまで秘密にする機能ではない。
    const email = new cdk.CfnParameter(this, 'NotificationEmail', {
      type: 'String',
      noEcho: true,
      description: 'Email address for Osenchi notifications',
      allowedPattern: '[^\\s@]+@[^\\s@]+\\.[^\\s@]+',
    });

    // バケット名は自動生成する。公開アクセスを拒否し、TLS通信に限定する。
    // RETAINによりdestroy後もデータを残す。空のバケットも自動削除しない。
    const bucketProps: s3.BucketProps = {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    };
    const inputBucket = new s3.Bucket(this, 'OsenchiInputBucket', bucketProps);
    const outputBucket = new s3.Bucket(this, 'OsenchiOutputBucket', bucketProps);
    const logBucket = new s3.Bucket(this, 'LogBucket', bucketProps);

    const emailTopic = new sns.Topic(this, 'Topic');
    emailTopic.addSubscription(new subscriptions.EmailSubscription(email.valueAsString));

    // 書籍と同じCloudTrail経由の連携を使う。
    // この学習用証跡では管理イベントを無効にし、入力S3の書き込みだけ記録する。
    // 既存の監査用証跡を変更・停止する処理ではない。
    const trail = new cloudtrail.Trail(this, 'Trail', {
      bucket: logBucket,
      isMultiRegionTrail: false,
      includeGlobalServiceEvents: false,
      managementEvents: cloudtrail.ReadWriteType.NONE,
    });
    trail.addS3EventSelector([{ bucket: inputBucket }], {
      readWriteType: cloudtrail.ReadWriteType.WRITE_ONLY,
      includeManagementEvents: false,
    });

    // Lambdaの実行ログは1週間保持する。スタック削除後も調査用に残す。
    const detectionLogs = new logs.LogGroup(this, 'DetectionLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const deletionLogs = new logs.LogGroup(this, 'DeletionLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // __dirnameはこのファイルがあるlibを指す。..でosenchi直下へ戻る。
    // NodejsFunctionはentryのTypeScriptとimport先をesbuildでまとめる。
    // bundleAwsSDKで、導入済みのSDK v3も成果物へ含める。
    const projectRoot = path.join(__dirname, '..');
    const detectionFunc = new nodejs.NodejsFunction(this, 'DetectionFunc', {
      entry: path.join(projectRoot, 'functions/detect-sentiment/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      logGroup: detectionLogs,
      depsLockFilePath: path.join(projectRoot, 'package-lock.json'),
      bundling: { bundleAwsSDK: true },
      environment: {
        SOURCE_BUCKET: inputBucket.bucketName,
        DEST_BUCKET: outputBucket.bucketName,
      },
    });
    const deletionFunc = new nodejs.NodejsFunction(this, 'DeletionFunc', {
      entry: path.join(projectRoot, 'functions/delete-object/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      timeout: cdk.Duration.seconds(30),
      logGroup: deletionLogs,
      depsLockFilePath: path.join(projectRoot, 'package-lock.json'),
      bundling: { bundleAwsSDK: true },
      environment: { SOURCE_BUCKET: inputBucket.bucketName },
    });

    // CDKのgrantで各関数に必要なバケット操作を割り当てる。
    // 分析関数には入力の削除権限を与えず、削除関数へ分離する。
    inputBucket.grantRead(detectionFunc);
    outputBucket.grantPut(detectionFunc);
    inputBucket.grantDelete(deletionFunc);
    detectionFunc.addToRolePolicy(new iam.PolicyStatement({
      actions: ['comprehend:BatchDetectSentiment'],
      resources: ['*'],
    }));

    // payloadResponseOnlyによりLambdaのreturn値だけを次のステートへ渡す。
    // 分析関数が返したsrcBucket/objectKeyを削除関数がそのまま利用する。
    const sentimentTask = new tasks.LambdaInvoke(this, 'DetectSentiment', {
      lambdaFunction: detectionFunc,
      payloadResponseOnly: true,
    });
    const deleteTask = new tasks.LambdaInvoke(this, 'DeleteObject', {
      lambdaFunction: deletionFunc,
      payloadResponseOnly: true,
    });

    // $はステート入力の全体を表す。SNSへ渡す前にJSONを文字列へ変換する。
    // 本文はジョブ情報であり、分析文章本体ではない。
    const successTask = new tasks.SnsPublish(this, 'SendSuccessMail', {
      topic: emailTopic,
      subject: 'Osenchi Success',
      message: sfn.TaskInput.fromText(sfn.JsonPath.jsonToString(sfn.JsonPath.objectAt('$'))),
      resultPath: sfn.JsonPath.DISCARD,
    });
    const errorTask = new tasks.SnsPublish(this, 'SendErrorMail', {
      topic: emailTopic,
      subject: 'Osenchi Error',
      message: sfn.TaskInput.fromText(sfn.JsonPath.jsonToString(sfn.JsonPath.objectAt('$'))),
      resultPath: sfn.JsonPath.DISCARD,
    });

    // 1本の処理列をParallelで囲い、失敗通知の処理を共通化する。
    // 分析・出力保存が失敗した場合はDeleteObjectへ進まない。
    const mainFlow = sentimentTask.next(deleteTask).next(successTask);
    const parallel = new sfn.Parallel(this, 'Parallel');
    parallel.branch(mainFlow);
    errorTask.next(new sfn.Fail(this, 'WorkflowFailed', {
      error: 'OsenchiWorkflowFailed',
      cause: 'See the execution history and error notification.',
    }));
    parallel.addCatch(errorTask, { resultPath: '$.error' });

    const stateMachine = new sfn.StateMachine(this, 'OsenchiStateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(parallel),
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: cdk.Duration.minutes(30),
    });

    // S3の書き込みイベントすべてではなく、指定バケットのPutObject成功だけを起点にする。
    // SDKのPutObjectを使うテストに限定し、マルチパートアップロードは対象にしない。
    const rule = new events.Rule(this, 'EventRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['s3.amazonaws.com'],
          eventName: ['PutObject'],
          errorCode: [{ exists: false }],
          requestParameters: { bucketName: [inputBucket.bucketName] },
        },
      },
    });
    rule.addTarget(new targets.SfnStateMachine(stateMachine));
    rule.node.addDependency(trail);

    // 自動生成名を手順書へ固定記載せず、デプロイ結果から取得する。
    new cdk.CfnOutput(this, 'InputBucketName', { value: inputBucket.bucketName });
    new cdk.CfnOutput(this, 'OutputBucketName', { value: outputBucket.bucketName });
    new cdk.CfnOutput(this, 'LogBucketName', { value: logBucket.bucketName });
    new cdk.CfnOutput(this, 'NotificationTopicArn', { value: emailTopic.topicArn });
    new cdk.CfnOutput(this, 'StateMachineArn', { value: stateMachine.stateMachineArn });
    new cdk.CfnOutput(this, 'DetectionLogGroupName', { value: detectionLogs.logGroupName });
    new cdk.CfnOutput(this, 'DeletionLogGroupName', { value: deletionLogs.logGroupName });
  }
}
```

`new Xxx(this, 'ID', {設定})`は、現在のスタック内にConstructを定義する書き方である。
ここで書いた時点ではAWS上にリソースを作らない。`synth`でテンプレートへ変換し、`deploy`で反映する。
`BatchDetectSentiment`は対象リソースARNで絞る操作ではないため、アクションを限定し`Resource: *`で許可する。

参照: [NodejsFunctionとバンドル](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs-readme.html)、[Trail](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudtrail.Trail.html)、[CloudTrail経由のEventBridge連携](https://docs.aws.amazon.com/ja_jp/eventbridge/latest/userguide/eb-service-event-cloudtrail.html)、[LambdaInvoke](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_stepfunctions_tasks.LambdaInvoke.html)、[JSONの文字列変換](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_stepfunctions.JsonPath.html)、[ComprehendのIAMアクション](https://docs.aws.amazon.com/service-authorization/latest/reference/list_comprehend.html)

### 3.3 `functions/detect-sentiment/index.ts` — 分析の入口

```bash
vim functions/detect-sentiment/index.ts
```

<!-- file: functions/detect-sentiment/index.ts -->
```typescript
// ファイル: functions/detect-sentiment/index.ts
// CloudTrail形式のEventBridgeイベントを受け取り、処理本体へ渡す。
import { JobExecutor, IJobParameter } from './job-executor';

// イベント全体ではなく、この関数で読む項目だけを型として定義する。
export interface IStateRequest {
  id: string;
  detail: {
    requestParameters: { bucketName: string; key: string };
  };
}

export async function handler(event: IStateRequest): Promise<IJobParameter> {
  const sourceBucket = process.env.SOURCE_BUCKET;
  const destBucket = process.env.DEST_BUCKET;
  const request = event.detail?.requestParameters;

  // TypeScriptの型は実行時に消えるため、外部入力は実行時にも検証する。
  // 想定外のバケットを入力にできないよう、環境変数と一致させる。
  if (!sourceBucket || !destBucket) {
    throw new Error('SOURCE_BUCKET or DEST_BUCKET is not configured');
  }
  if (request?.bucketName !== sourceBucket ||
      typeof request?.key !== 'string' || request.key.length === 0 ||
      typeof event.id !== 'string' || event.id.length === 0) {
    throw new Error('Invalid input bucket, object key, or event ID');
  }

  // 本手順のテストキーは英数字・ハイフン・スラッシュ・ピリオドのみを使う。
  // CloudTrailのキーをS3通知のキーと混同し、無条件にURLデコードしない。
  const job: IJobParameter = {
    id: event.id,
    srcBucket: sourceBucket,
    objectKey: request.key,
    destBucket,
  };

  // awaitは分析と保存の完了を待つ。失敗時は例外をStep Functionsへ返す。
  await JobExecutor.execute(job);

  // 大量の分析結果ではなく、次の削除処理に必要な場所の情報だけを返す。
  return job;
}
```

### 3.4 `functions/detect-sentiment/job-executor.ts` — 読み込み・分析・保存

```bash
vim functions/detect-sentiment/job-executor.ts
```

<!-- file: functions/detect-sentiment/job-executor.ts -->
```typescript
// ファイル: functions/detect-sentiment/job-executor.ts
// SDK v3では、ClientへCommandをsendしてAWS APIを呼び出す。
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  BatchDetectSentimentCommand,
  ComprehendClient,
  LanguageCode,
} from '@aws-sdk/client-comprehend';

// クライアントはハンドラ外で作り、Lambdaの実行環境再利用時にも使う。
// 認証情報はコードへ書かず、Lambdaの実行ロールから取得する。
const s3 = new S3Client({});
const comprehend = new ComprehendClient({});
const BATCH_SIZE = 25;
const MAX_TEXT_BYTES = 5000;
const MAX_FILE_BYTES = 1024 * 1024; // 学習用に入力全体を1 MiB以下へ制限する。
const SUPPORTED_LANGUAGES = new Set<string>([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ar', 'hi', 'ja', 'ko', 'zh', 'zh-TW',
]);

export interface IJobParameter {
  id: string;
  srcBucket: string;
  objectKey: string;
  destBucket: string;
}

// 入力1行の形式。sentimentとscoreは分析成功後に追加する。
export interface IComprehend {
  id: string;
  topic: string;
  language: LanguageCode;
  content: string;
  sentiment?: string;
  score?: { positive: number; negative: number; neutral: number; mixed: number };
}

export class JobExecutor {
  // staticメソッドのため、newせずJobExecutor.execute(job)で呼び出せる。
  public static async execute(job: IJobParameter): Promise<void> {
    const items = await JobExecutor.getItems(job.srcBucket, job.objectKey);
    const groups = JobExecutor.divideByLanguage(items);

    // 同一API呼び出しでは言語を統一する。言語ごとに順番に処理する。
    for (const [language, group] of groups) {
      await JobExecutor.detectSentiment(language, group);
    }

    // すべての分析が成功してから保存する。途中失敗時はここへ到達しない。
    await JobExecutor.putJsonLines(job.destBucket, job.objectKey, items);
  }

  private static async getItems(bucket: string, key: string): Promise<IComprehend[]> {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body) {
      throw new Error('Input object has no body');
    }
    if ((response.ContentLength ?? 0) > MAX_FILE_BYTES) {
      throw new Error('Input file exceeds the 1 MiB learning limit');
    }

    // SDK v3のBodyはストリームであり、単純なtoString()では本文にならない。
    const text = await response.Body.transformToString('utf-8');
    if (Buffer.byteLength(text, 'utf8') > MAX_FILE_BYTES) {
      throw new Error('Input file exceeds the 1 MiB learning limit');
    }

    const items: IComprehend[] = [];
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (line.trim() === '') continue;

      // JSON Linesは1行に1つのJSONを置く形式である。
      // unknownで受け、型アサーションだけで正しいデータと決めつけない。
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        throw new Error(`Line ${index + 1}: invalid JSON`);
      }
      items.push(JobExecutor.validateItem(value, index + 1));
    }
    if (items.length === 0) throw new Error('Input file contains no records');
    return items;
  }

  private static validateItem(value: unknown, line: number): IComprehend {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`Line ${line}: a JSON object is required`);
    }
    const item = value as Record<string, unknown>;
    const { id, topic, language, content } = item;
    if (typeof id !== 'string' || id.trim() === '' ||
        typeof topic !== 'string' || topic.trim() === '' ||
        typeof language !== 'string' || !SUPPORTED_LANGUAGES.has(language) ||
        typeof content !== 'string' || content.trim() === '') {
      throw new Error(`Line ${line}: invalid id, topic, language, or content`);
    }

    // 日本語は1文字が複数バイトになる。文字数ではなくUTF-8のバイト数で判定する。
    if (Buffer.byteLength(content, 'utf8') > MAX_TEXT_BYTES) {
      throw new Error(`Line ${line}: content exceeds ${MAX_TEXT_BYTES} UTF-8 bytes`);
    }
    return { id, topic, language: language as LanguageCode, content };
  }

  private static divideByLanguage(items: IComprehend[]): Map<LanguageCode, IComprehend[]> {
    const groups = new Map<LanguageCode, IComprehend[]>();
    for (const item of items) {
      const group = groups.get(item.language) ?? [];
      group.push(item);
      groups.set(item.language, group);
    }
    return groups;
  }

  private static async detectSentiment(language: LanguageCode, items: IComprehend[]): Promise<void> {
    // APIの上限に合わせ、同じ言語の文章を25件ずつ取り出す。
    for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
      const batch = items.slice(offset, offset + BATCH_SIZE);
      const response = await comprehend.send(new BatchDetectSentimentCommand({
        LanguageCode: language,
        TextList: batch.map(item => item.content),
      }));

      // HTTP呼び出し自体が成功しても、個別の文章が失敗している場合がある。
      // ErrorListを無視すると未分析のまま入力削除へ進むため、必ず失敗扱いにする。
      if (response.ErrorList && response.ErrorList.length > 0) {
        throw new Error(`Comprehend returned ${response.ErrorList.length} record error(s)`);
      }
      const results = response.ResultList ?? [];
      if (results.length !== batch.length) {
        throw new Error('Comprehend returned an incomplete result');
      }

      const seen = new Set<number>();
      for (const result of results) {
        const index = result.Index;
        const score = result.SentimentScore;
        if (index === undefined || !Number.isInteger(index) ||
            index < 0 || index >= batch.length || seen.has(index) ||
            !result.Sentiment ||
            typeof score?.Positive !== 'number' ||
            typeof score?.Negative !== 'number' ||
            typeof score?.Neutral !== 'number' ||
            typeof score?.Mixed !== 'number') {
          throw new Error('Comprehend returned an invalid result');
        }
        seen.add(index);

        // Indexはファイル全体の行番号ではなく、この25件内の位置である。
        // groupとbatchは元のオブジェクトを参照するため、itemsにも結果が反映される。
        const item = batch[index];
        item.sentiment = result.Sentiment;
        item.score = {
          positive: score.Positive,
          negative: score.Negative,
          neutral: score.Neutral,
          mixed: score.Mixed,
        };
      }
    }
  }

  private static async putJsonLines(bucket: string, key: string, items: IComprehend[]): Promise<void> {
    // 入力と同じキーで別バケットへ保存する。元の行順序も維持する。
    const body = items.map(item => JSON.stringify(item)).join('\n') + '\n';
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/x-ndjson',
    }));
  }
}
```

`async`関数はPromiseを返し、`await`でAPIの完了を待つ。`throw`した例外はハンドラへ伝わり、Step FunctionsのCatchへ進む。
API上限は1回25文章・各文章5 KBである。この実装は保守的に各文章5,000バイト以下とする。
`MAX_FILE_BYTES`の1 MiBはAWSの上限ではなく、学習用に追加した制限である。
参照: [BatchDetectSentimentの入力・結果・エラー](https://docs.aws.amazon.com/ja_jp/comprehend/latest/APIReference/API_BatchDetectSentiment.html)、[SDK v3のS3操作例](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html)

### 3.5 `functions/delete-object/index.ts` — 削除の入口

```bash
vim functions/delete-object/index.ts
```

<!-- file: functions/delete-object/index.ts -->
```typescript
// ファイル: functions/delete-object/index.ts
// 分析関数が返したジョブ情報を受け、入力バケットの対象だけを削除する。
import { JobExecutor } from './job-executor';

export interface IStateInfo {
  id: string;
  srcBucket: string;
  objectKey: string;
  destBucket: string;
}

export async function handler(event: IStateInfo): Promise<IStateInfo> {
  const sourceBucket = process.env.SOURCE_BUCKET;
  if (!sourceBucket || event.srcBucket !== sourceBucket ||
      typeof event.objectKey !== 'string' || event.objectKey.length === 0) {
    throw new Error('Invalid deletion target');
  }

  // 入力の1オブジェクトだけを削除する。出力・ログバケットには触れない。
  await JobExecutor.execute(sourceBucket, event.objectKey);

  // 次のSNS成功通知へ保存先やキーを引き継ぐ。
  return event;
}
```

### 3.6 `functions/delete-object/job-executor.ts` — S3削除処理

```bash
vim functions/delete-object/job-executor.ts
```

<!-- file: functions/delete-object/job-executor.ts -->
```typescript
// ファイル: functions/delete-object/job-executor.ts
// ハンドラからAWS操作を分離し、削除対象と処理内容を小さく保つ。
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({});

export class JobExecutor {
  public static async execute(bucketName: string, objectKey: string): Promise<void> {
    // DeleteObjectは指定キーだけを削除する。バケット削除や一括削除ではない。
    // 本例の入力バケットはバージョニングを有効にしていないため、原本を手元に残す。
    await s3.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }));
  }
}
```

参照: [Lambdaのベストプラクティス](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/best-practices.html)

### 3.7 `test/osenchi.test.ts` — リソース定義の確認

生成直後のテストは処理が空なので、次の全コードへ置き換える。
このテストはAWSへ接続せず、生成テンプレートの設定を検証する。実際の配信や分析の成功を証明するテストではない。

```bash
vim test/osenchi.test.ts
```

<!-- file: test/osenchi.test.ts -->
```typescript
// ファイル: test/osenchi.test.ts
// テンプレートの検査だけを行い、AWSへのデプロイは行わない。
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { OsenchiStack } from '../lib/osenchi-stack';

// ダミーのアカウントを使う。個人のアカウントIDをテストへ記録しない。
const app = new cdk.App();
const stack = new OsenchiStack(app, 'TestOsenchi', {
  env: { account: '123456789012', region: 'ap-northeast-1' },
});
const template = Template.fromStack(stack);

test('入力・出力・証跡用の3バケットを保持する', () => {
  template.resourceCountIs('AWS::S3::Bucket', 3);
  const buckets = template.findResources('AWS::S3::Bucket');
  for (const bucket of Object.values(buckets)) {
    expect(bucket.DeletionPolicy).toBe('Retain');
    expect(bucket.Properties.PublicAccessBlockConfiguration).toEqual({
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    });
  }
});

test('Lambdaは2関数でNode.js 24を使う', () => {
  template.resourceCountIs('AWS::Lambda::Function', 2);
  const functions = template.findResources('AWS::Lambda::Function');
  for (const fn of Object.values(functions)) {
    expect(fn.Properties.Runtime).toBe('nodejs24.x');
  }
});

test('証跡は入力S3の書き込みデータイベントを記録する', () => {
  template.hasResourceProperties('AWS::CloudTrail::Trail', {
    IsLogging: true,
    IsMultiRegionTrail: false,
    EventSelectors: Match.arrayWith([Match.objectLike({
      ReadWriteType: 'WriteOnly',
      IncludeManagementEvents: false,
      DataResources: Match.arrayWith([Match.objectLike({ Type: 'AWS::S3::Object' })]),
    })]),
  });
});

test('EventBridgeはPutObjectを検出する', () => {
  template.hasResourceProperties('AWS::Events::Rule', {
    EventPattern: Match.objectLike({
      source: ['aws.s3'],
      'detail-type': ['AWS API Call via CloudTrail'],
      detail: Match.objectLike({ eventName: ['PutObject'] }),
    }),
  });
});

test('ワークフローとメール通知を作る', () => {
  template.resourceCountIs('AWS::StepFunctions::StateMachine', 1);
  template.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'email' });
  const machines = template.findResources('AWS::StepFunctions::StateMachine');
  const definition = JSON.stringify(Object.values(machines)[0].Properties.DefinitionString);
  expect(definition).toContain('States.JsonToString');
  expect(definition).toContain('WorkflowFailed');
});
```

参照: [CDKアプリのテスト](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/testing.html)

## 4. ローカルで確認する

### 4.1 型検査・テスト・合成

実行場所は`osenchi`直下である。

```bash
npm run build &&
npm run test -- --runInBand &&
npx cdk synth OsenchiStack --profile learning
```

| コマンド | 意味 | 実行する理由 |
| --- | --- | --- |
| `npm run build` | `tsc`で型検査 | import漏れ・誤ったプロパティ・型の不一致を発見 |
| `npm run test -- --runInBand` | Jestでテストを順番に実行 | リソース数・重要設定を確認 |
| `npx cdk synth` | CloudFormationテンプレートとLambda資産を生成 | API定義とバンドルの問題をデプロイ前に確認 |

`synth`はスタックをデプロイしない。ただし一般にCDKの合成でAWSへの参照が発生する場合があるため、プロファイルは明示する。
本例は既存VPCなどのlookupを使わない。

確認するもの:

- 型検査にエラーがない。
- テスト5件が成功する。
- esbuildが2関数のコードをバンドルできる。
- `cdk.out/OsenchiStack.template.json`が生成される。
- S3が3個、Lambdaが2個、証跡・EventBridgeルール・ステートマシン・SNSが定義される。
- 生成ASLの流れが`DetectSentiment → DeleteObject → SendSuccessMail`である。
- Catch先が`SendErrorMail → WorkflowFailed`である。

`node_modules`と`cdk.out`はGitへ登録しない。
参照: [cdk synth](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/ref-cli-cmd-synth.html)

### 4.2 差分と権限を確認する

```bash
npx cdk diff OsenchiStack --profile learning --method=template
```

意味: デプロイ済みテンプレートとの違いを表示する。初回は新規作成リソースが表示される。
理由: 想定外の削除、既存バケットの参照、権限の拡大がないかを確認するためである。
`--method=template`は変更セットを作らず比較する指定である。置換判定の精度が必要な更新時は既定方式でも確認する。

## 5. AWSへデプロイする

### 5.1 アカウント・リージョンを確認する

```bash
aws sts get-caller-identity --profile learning --no-cli-pager
aws configure get region --profile learning
```

理由: 意図した学習用アカウントと`ap-northeast-1`を使っていることを直前に確認するためである。
実際のアカウントIDやARNを公開READMEへ貼り付けない。

第2章と同じアカウント・リージョンはbootstrap済みなので、通常は追加のbootstrapは不要である。
別環境で未実施の場合だけ、次を実行する。

```bash
npx cdk bootstrap --profile learning
```

### 5.2 通知先を入力してデプロイする

以下はBash用である。入力したメールアドレスはGitへ保存しない。

```bash
read -r -p "SNS通知先メールアドレス: " NOTIFICATION_EMAIL
npx cdk deploy OsenchiStack --profile learning \
  --parameters "OsenchiStack:NotificationEmail=$NOTIFICATION_EMAIL"
unset NOTIFICATION_EMAIL
```

意味: 入力した通知先をCloudFormationパラメータとして渡してデプロイする。
確認: IAM変更などを読み、想定範囲であることを確認してから`y`を入力する。
シェル変数を消しても、SNSなどAWS側の設定からアドレスが消えるわけではない。

参照: [cdk deploy](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/ref-cli-cmd-deploy.html)

### 5.3 SNSサブスクリプションを確認する

1. 通知先に届く`AWS Notification - Subscription Confirmation`を開く。
2. 自分が作成した通知設定であることを確認し、`Confirm subscription`をクリックする。
3. SNSコンソールの対象トピックで、メールのサブスクリプションが確認済みになったことを確認する。

未確認のままでは、SNSへのPublishが成功してもメールを受信できない。
サブスクリプション確認URLや購読解除URLをGitHubへ載せない。

### 5.4 コンソールで設定を確認する

| サービス | 確認場所・内容 |
| --- | --- |
| CloudFormation | `OsenchiStack`の「リソース」「出力」。作成名とOutputsを確認 |
| S3 | 入力・出力・証跡用の3バケット。パブリックアクセスがブロックされていること |
| CloudTrail | このスタックの証跡。記録中、入力S3の書き込みデータイベントが対象であること |
| EventBridge | デフォルトイベントバスの対象ルール。PutObjectと入力バケット、ターゲットのステートマシン |
| Step Functions | 対象ステートマシンの定義。正常系・異常系の順序 |
| Lambda | 2関数のランタイム・環境変数・実行ロール |
| SNS | 対象トピックと確認済みのメールサブスクリプション |

CloudTrailの「イベント履歴」だけではS3オブジェクトのデータイベント確認にならない。
証跡のデータイベント設定と、証跡用S3のログ・実行結果を確認する。
参照: [CloudTrailのデータイベント](https://docs.aws.amazon.com/ja_jp/awscloudtrail/latest/userguide/logging-data-events-with-cloudtrail.html)

## 6. 正常系を試す

### 6.1 テスト入力を作る

配置先: `osenchi/testdata/input-ja.jsonl`。

```bash
vim testdata/input-ja.jsonl
```

次の2行を記入する。**各レコードを1行にする。JSON配列にはしない。**

```jsonl
{"id":"sample-001","topic":"cdk-lab","language":"ja","content":"今日は作業が順調に進み、とてもうれしい。"}
{"id":"sample-002","topic":"cdk-lab","language":"ja","content":"予定が大幅に遅れてしまい、残念に感じている。"}
```

理由: 書籍の最初の整形済みJSONは説明用であり、実際の読み取り処理はJSON Lines形式を前提とするためである。

### 6.2 デプロイ結果からバケット名を取得する

```bash
INPUT_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name OsenchiStack --profile learning --region ap-northeast-1 \
  --query "Stacks[0].Outputs[?OutputKey=='InputBucketName'].OutputValue | [0]" \
  --output text --no-cli-pager)
OUTPUT_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name OsenchiStack --profile learning --region ap-northeast-1 \
  --query "Stacks[0].Outputs[?OutputKey=='OutputBucketName'].OutputValue | [0]" \
  --output text --no-cli-pager)
printf 'INPUT_BUCKET=%s\nOUTPUT_BUCKET=%s\n' "$INPUT_BUCKET" "$OUTPUT_BUCKET"
```

意味: CloudFormationのOutputsを読み、シェル変数へ格納する。
確認: 空文字・`None`ではなく、このスタックのバケット名であること。取得に失敗した場合は次へ進まない。
これらの変数は現在のターミナル内だけで有効である。

### 6.3 PutObjectでアップロードする

```bash
OBJECT_KEY="tests/$(date -u +%Y%m%dT%H%M%SZ)-$(uuidgen).jsonl"
aws s3api put-object \
  --bucket "$INPUT_BUCKET" \
  --key "$OBJECT_KEY" \
  --body testdata/input-ja.jsonl \
  --content-type application/x-ndjson \
  --profile learning --region ap-northeast-1 --no-cli-pager
printf '今回のキー: %s\n' "$OBJECT_KEY"
```

理由: イベント条件と一致する`PutObject`を明示的に使うためである。
日時とUUIDでキーを変え、処理中のファイルを上書きしない。

### 6.4 処理結果を確認する

1. Step Functionsで新しい実行が開始されたことを確認する。
2. `DetectSentiment → DeleteObject → SendSuccessMail`が成功していることを確認する。
3. 件名`Osenchi Success`のメールを確認する。
4. 出力バケットに同じキーのファイルがあることを確認する。
5. 入力バケットから対象キーが削除されたことを確認する。

出力の取得:

```bash
aws s3api get-object \
  --bucket "$OUTPUT_BUCKET" --key "$OBJECT_KEY" \
  --profile learning --region ap-northeast-1 --no-cli-pager \
  testdata/output-ja.jsonl
cat testdata/output-ja.jsonl
```

入力削除の確認:

```bash
aws s3api head-object \
  --bucket "$INPUT_BUCKET" --key "$OBJECT_KEY" \
  --profile learning --region ap-northeast-1 --no-cli-pager
```

対象が削除済みなら、適切な閲覧権限のある実行者には`404 / Not Found`が返る。
`403 / AccessDenied`は削除成功の証拠ではない。権限を確認する。

出力の確認項目:

- 入力と同じ`id`・`topic`・`language`・`content`がある。
- 各行に`sentiment`と`score`が追加されている。
- 入力2行に対し、出力も2行である。
- スコアや判定はサービスの分析結果なので、書籍と完全一致する必要はない。

## 7. 異常系を試す

### 7.1 不正なJSONを用意する

配置先: `osenchi/testdata/invalid.jsonl`。

```bash
vim testdata/invalid.jsonl
```

内容は次の1行とする。意図的にJSONではない文字列を使う。

```text
not-json
```

### 7.2 別のキーでアップロードする

```bash
ERROR_KEY="tests/error-$(date -u +%Y%m%dT%H%M%SZ)-$(uuidgen).jsonl"
aws s3api put-object \
  --bucket "$INPUT_BUCKET" --key "$ERROR_KEY" \
  --body testdata/invalid.jsonl \
  --profile learning --region ap-northeast-1 --no-cli-pager
```

### 7.3 期待結果を確認する

- `DetectSentiment`が失敗する。
- `DeleteObject`と`SendSuccessMail`は実行されない。
- `SendErrorMail`を経て`WorkflowFailed`で終了し、実行ステータスが失敗になる。
- `Osenchi Error`メールが届く。
- 入力S3には不正なファイルが残り、出力S3には同じキーが存在しない。

今回の異常系は「分析開始前の入力エラー」を確認するものである。Comprehendの一部失敗やSNS通知障害など、すべての失敗パターンを網羅するテストではない。
SNS自体の通知に失敗した場合はエラーメールも保証されないため、Step FunctionsとLambdaログで確認する。
成功メールの送信だけが失敗した場合、分析結果は保存済みで入力も削除済みとなり得る。「エラーメールが届いたら必ず入力が残る」と一般化しない。

## 8. 動かないときの確認順序

| 症状 | 確認するもの |
| --- | --- |
| `cdk: command not found` | `osenchi`で`npx cdk`を使っているか |
| 型検査でimportエラー | 7ファイルの配置先・名前・保存漏れ |
| `esbuild`実行エラー | `npx esbuild --version`、プロジェクトの依存インストール状態 |
| Lambdaで`Runtime.ImportModuleError` | `NodejsFunction`でバンドルしたか。古い`Code.fromAsset`を混ぜていないか |
| ワークフローが始まらない | 対象アカウント/リージョン、証跡の記録状態、S3データイベント、ルールのPutObject条件 |
| メールだけ届かない | SNSサブスクリプション確認、迷惑メール、タスク履歴 |
| `AccessDenied` | 該当Lambdaの実行ロール、対象バケット、Comprehendアクション |
| `invalid JSON` | 1行1JSONか。複数行に整形していないか |
| 分析成功後に別実行が失敗 | 同じキーを上書きしていないか。イベントが重複配信されていないか |

Lambdaの「モニタリング」からCloudWatchログを開き、Step Functionsの実行時刻と照合する。
通常の動作確認でLambdaを直接実行するとワークフロー外の処理になるため、最初はS3アップロードから一連の流れを確認する。

## 9. 後片付け

### 9.1 残す情報を確認する

CloudFormationの「出力」から3バケット名と2ロググループ名を控える。
必要な分析結果をダウンロードし、実行履歴・メールの確認結果を記録する。
公開GitにはアカウントID、通知先アドレス、購読URL、個人情報を含むログを載せない。

### 9.2 スタックを削除する

新規アップロードを止め、実行中のワークフローがないことを確認してから実行する。

```bash
npx cdk destroy OsenchiStack --profile learning
```

意味: このスタックが管理するリソースを削除する。対象名を確認して`y`を入力する。

| リソース | このコードでの扱い |
| --- | --- |
| Lambda・SNS・EventBridgeルール・Step Functions・CloudTrail証跡・関連ロール | スタック削除の対象 |
| 入力・出力・証跡用S3バケット | `RETAIN`のため残る |
| 2つのLambdaロググループ | `RETAIN`のため残る。ログ保持期間は1週間 |
| CDKToolkit | 別スタックなので残る |
| CDKToolkitのS3/ECRに置かれた資産 | `OsenchiStack`削除だけでは消えない |
| ローカルのコード・testdata・cdk.out | AWSのdestroyでは消えない |

### 9.3 保持したリソースを片付ける

1. スタック削除完了後、控えた名前と一致する学習用3バケットだけを確認する。
2. 不要になったバケットはS3コンソールで空にしてから削除する。保持する場合は保存費用が継続し得る。
3. 不要な2ロググループをCloudWatchコンソールから削除する。
4. CDKToolkitは後続章でも使うため、この章では削除しない。

削除対象を誤らないよう、アカウント内のバケットをまとめて空にするコマンドは使わない。
保持したバケットは、次回デプロイ時に自動で再利用されるわけではない。
参照: [CDKの削除ポリシー](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.RemovalPolicy.html)

## 10. Gitへ記録する

```bash
cd "$HOME/aws-cdk-cicd-lab"
git status --short
git diff --stat
git diff
```

ソース・設定・ロックファイル・非機密のテスト入力・手順を確認してからコミットする。
実行結果の貼り付け前に、個人情報やAWS識別子が入っていないかを確認する。
この手順書の作成時点ではAWSの動作確認は未実施である。次の欄は実行後に記入する。

| 確認項目 | 結果・日付・補足 |
| --- | --- |
| 実プロジェクトへの7ファイル配置 | 未実施 |
| 実プロジェクトでbuild・test・synth | 未実施 |
| デプロイ | 未実施 |
| SNSサブスクリプション確認 | 未実施 |
| 正常系: 分析・結果保存・入力削除・メール | 未実施 |
| 異常系: 失敗終了・入力保持・メール | 未実施 |
| destroy・残存リソース確認 | 未実施 |

## 付録: 掲載コードの事前検証

手順書の7つのコードブロックを一時ディレクトリへ抽出し、実プロジェクトと同じ依存関係で検証した。
学習中の`osenchi`のソースには反映していない。

| 検証 | 結果 |
| --- | --- |
| TypeScript型検査 | 成功 |
| 掲載したJestテスト5件 | 成功 |
| 2つのLambdaのesbuildバンドル | 成功 |
| CDK Appからのオフライン合成 | 成功。CloudFormationテンプレートと資産を生成 |
| SDKを模擬した処理確認 | 言語分割、25件分割、結果保存、不正入力、一部API失敗、削除対象の制限を確認 |
| 実AWSでのデプロイ・メール・Comprehend呼び出し | 未実施 |

検証環境の制約で`tsx` CLIのIPC用ソケットを作れなかったため、オフライン合成はNode.jsから`--import tsx`でAppを起動した。
これはローカル生成処理の検証であり、利用者の`npx cdk deploy`や実AWSの連携まで成功確認したという意味ではない。

更新日: 2026-09-28。
