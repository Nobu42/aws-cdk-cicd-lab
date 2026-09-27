# 第4章 Step Functions入門

[書籍README](../README.md) / [全体README](../../README.md)

記録日: 2026-09-27。書籍の4.1〜4.3を読んだ内容の整理。今回は概要の理解のみで、AWSリソースの作成・実行は行っていない。

## 1. Step Functionsとは

複数の処理を、順番や条件に従って実行するワークフローサービス。
インフラ運用でいうジョブネットの考え方に近い。

```text
入力を確認 → データを加工 → 結果を保存 → 通知
```

Step Functionsが順序・分岐・待機・再試行などを管理し、Lambdaなどが個々の処理を担当する。
Webコンソールは流れを視覚的に確認するための画面であり、単なる図の表示サービスではない。

Lambdaとの組み合わせは代表例だが、Lambda専用ではない。SNS、SQS、DynamoDB、ECSなどとも連携できる。
単独の処理ならLambdaだけで足りる場合もあり、Lambdaを使うためにStep Functionsが必須というわけではない。

## 2. 用語を区別する

| 用語 | 意味 |
| --- | --- |
| ステートマシン | ワークフロー全体の定義 |
| ステート | 処理・分岐・待機などの一段階 |
| 遷移 | 次のステートへ進むこと |
| ASL | Amazon States Language。ステートとその関係・設定を記述するJSONベースの言語 |
| 実行（Execution） | 定義したステートマシンを実際に動かす一回分 |

ASLは遷移ルールだけでなく、実行するタスクや入出力も含めて定義する。
定義したステートマシンと、その実行履歴は別物として区別する。

## 3. StandardとExpress

| タイプ | 主な用途の考え方 |
| --- | --- |
| Standard（標準） | 長い処理や、実行履歴を追跡しながら進める業務ワークフロー |
| Express | 短時間・高頻度のイベント処理やデータ処理 |

書籍では頻度を選択の目安としているが、実際には実行時間、再実行時の影響、履歴の記録方法、連携機能、料金も確認する。
第4章ではタイプの存在を理解するまでとし、実装時に要件に合わせて選ぶ。

参考: [AWS公式・ワークフロータイプの選択](https://docs.aws.amazon.com/step-functions/latest/dg/choosing-workflow-type.html)

## 4. ステートの種類

| 種類 | 役割 | 例 |
| --- | --- | --- |
| Task | サービスや処理を呼び出す | Lambda実行、SNS通知 |
| Choice | 条件によって次の処理を選ぶ | 処理結果が正常かどうかで分岐 |
| Parallel | 複数の処理の流れを並列に進める | 保存と別の計算を並列実行 |
| Map | 配列の各要素に対して処理する | 複数の入力データを一件ずつ処理 |
| Pass | 入力を渡す、またはデータを加工する | 次の処理用のデータを用意 |
| Wait | 時間・時刻を指定して待つ | 再確認まで待機 |
| Succeed | 成功として終了する | 正常終了 |
| Fail | 失敗として終了する | 異常終了 |

Parallelは各ブランチの完了を待って次へ進む。未処理のエラーがブランチで発生した場合、Parallel全体が失敗となる。RetryやCatchを設ければ、再試行やエラー処理も組み込める。
Succeedはワークフロー全体だけでなく、ParallelのブランチやMap内の処理の終了にも使える。

参考: [AWS公式・ステートの共通フィールド](https://docs.aws.amazon.com/ja_jp/step-functions/latest/dg/statemachine-structure.html#state-type)

## 5. ASLの読み方

書籍の例を整理すると、次のようになる。説明用の例であり、実行には実在するLambdaと呼び出し権限が必要。

```json
{
  "Comment": "Example workflow",
  "StartAt": "firstState",
  "TimeoutSeconds": 10,
  "States": {
    "firstState": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ap-northeast-1:123456789012:function:ExampleFunction",
      "Next": "secondState"
    },
    "secondState": {
      "Type": "Succeed"
    }
  }
}
```

```text
StartAtでfirstStateへ → Lambdaを実行 → NextでsecondStateへ → 成功終了
```

| キー | 意味 |
| --- | --- |
| Comment | 説明 |
| StartAt | 最初に実行するステート名 |
| TimeoutSeconds | ワークフロー実行の制限時間。ここでは10秒 |
| States | ステートの定義一覧 |
| Type | ステートの種類 |
| Resource | Taskで呼び出すリソースや連携先 |
| Next | 次に進むステート名 |

JSON内で上から書いた順に実行されるのではない。StartAt、Next、分岐条件などで順序が決まる。
ARN内のアカウントIDは説明用のダミーであり、そのまま実行しない。

### 書籍の貼り付け例から修正した点

- 小文字の`next`を`Next`に変更した。キー名の大文字・小文字は区別される。
- Succeedから`End: true`を削除した。Succeed自体が終了状態のため、NextやEndは指定しない。
- 崩れていた改行・括弧を整理した。

参考: [AWS公式・ASLの構造](https://docs.aws.amazon.com/ja_jp/step-functions/latest/dg/statemachine-structure.html)、[Succeed](https://docs.aws.amazon.com/ja_jp/step-functions/latest/dg/state-succeed.html)

## 6. 処理間のデータの受け渡し

各ステートはJSONの入力を受け取り、処理結果を次へ渡す。

```text
入力JSON → Task A → 出力JSON → Task B
```

ただし、サービスの戻り値がそのまま次へ渡るとは限らない。連携方式や入出力設定によって、結果を取り出したり元の入力と結合したりする。

### DynamoDB向けに形を整える例

前の処理の結果が次の形だったとする。

```json
{
  "jobId": "job-001",
  "result": "positive"
}
```

DynamoDBのPutItemへ渡すには、例えば以下の形に整える。

```json
{
  "TableName": "MyTable",
  "Item": {
    "JobId": { "S": "job-001" },
    "Result": { "S": "positive" }
  }
}
```

`S`はDynamoDBの文字列型の指定。これは完成後のデータの例であり、このJSON自体が入力を動的変換するルールではない。
次のサービスが求める形式に合わせるため、ASL側に値の取り出し・組み立ての設定を記述する。
書籍で扱う入出力設定と、現在のJSONataによる記法は混在させず、使用する方式を確認する。

## 7. 実行を開始する方法

- WebコンソールやAWS CLIから手動で開始する。
- アプリケーションからAWS SDKで呼び出す。
- API Gatewayなどから連携する。
- イベントを契機に開始する。書籍ではCloudWatch Eventsという名称が使われているため、実装時に現在のEventBridge側の設定と照合する。

開始方法を選ぶだけでなく、呼び出し元とステートマシンの実行ロールに必要な権限も用意する。

## 8. CDKとの関係と次の作業

CDKはワークフローや関連リソースをコードで定義・デプロイする側、Step Functionsはデプロイされたワークフローを実行する側。

```text
CDKで定義 → CloudFormationで構築 → Step Functionsで実行
```

第4章ではコマンド実行・デプロイ・動作確認は行っていない。次は第5章の感情分析システムで、これらの概念を実装に結び付ける。
