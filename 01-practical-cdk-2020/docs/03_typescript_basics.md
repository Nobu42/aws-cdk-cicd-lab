# 第3章 TypeScript入門

[書籍README](../README.md) / [全体README](../../README.md) / [Vim設定](../../tools/vim/README.md)

記録日: 2026-09-27。書籍の例を写経し、型チェックと実行結果の違いを確認した。AWSへの操作は不要。

## 1. 編集・チェック・実行の流れ

```bash
cd "$HOME/aws-cdk-cicd-lab/01-practical-cdk-2020/sample"
vim practice/ch03/04_objects.ts
npm run build && npx tsx practice/ch03/04_objects.ts
```

| 操作 | 意味・理由 |
| --- | --- |
| vim | TypeScriptのコードを編集する。保存して終了する操作はEsc、`:wq` |
| npm run build | package.jsonのbuildに登録されたtscで型チェックする |
| && | 型チェックが成功した場合だけ次へ進む |
| npx tsx | TypeScriptを実行する。型チェックは行わない |

今回のtsconfig.jsonには`noEmit: true`があるため、buildでJavaScriptファイルは出力されない。
TypeScriptからJavaScriptへの変換はコンパイルの一種で、トランスパイルとも呼ぶ。tsxは実行に必要な変換を行う。

ch03ディレクトリ内にいる場合は、実行パスを短くする。

```bash
npm run build && npx tsx 04_objects.ts
```

`npx run build`は誤り。npmスクリプトは`npm run build`で実行する。
buildはプロジェクト内の他の練習ファイルもチェックするため、NG例はコメントアウトしておく。

## 2. 練習ファイル

| ファイル | 内容 |
| --- | --- |
| [01_message.ts](../sample/practice/ch03/01_message.ts) | console.logによる表示 |
| [02_types.ts](../sample/practice/ch03/02_types.ts) | let、const、基本型、リテラル型、共用体型 |
| [03_literal.ts](../sample/practice/ch03/03_literal.ts) | 必須項目と省略可能な項目、型エラーの確認 |
| [04_objects.ts](../sample/practice/ch03/04_objects.ts) | オブジェクト、型ガード、関数、Map、Set等 |
| [05_classes.ts](../sample/practice/ch03/05_classes.ts) | クラス、継承、アクセス修飾子 |

04_objects.tsは本人の実行ログで型チェック・実行成功を確認済み。05_classes.tsはコード作成を確認済みで、本人からの実行結果は未共有。
抽象クラス・クラスへのimplements・ジェネリクスは書籍の説明を確認した段階であり、以下の短い例は復習用とする。

## 3. 変数と基本型

| 記述 | 意味 |
| --- | --- |
| `let age: number = 25` | 数値の変数。再代入可能 |
| `const name = '山田'` | 再代入不可。初期値からstring型を推論 |
| `boolean` | trueまたはfalse |
| `number` | 整数・小数 |
| `string` | 文字列 |
| `undefined` | 未設定の値などを表す |
| `null` | 値がないことを明示する際などに使う |

constが禁止するのは変数への再代入。オブジェクトの項目や配列の要素まで読み取り専用になるわけではない。

```typescript
const name = '山田';
console.log(`私は${name}です。`);
```

`${...}`で値を埋め込む場合はバッククォートで囲む。シングルクォートでは`${name}`がそのまま表示される。
`100 * (1 + 0.1)`が`110.00000000000001`になるのは小数の表現誤差。整数への四捨五入は`Math.round(...)`で行うが、金額計算では業務の端数処理ルールに合わせる。

## 4. 値の候補を型で限定する

```typescript
let city: '東京都' = '東京都';
let month: number | string = 12;
month = 'December';
type Size = 'Short' | 'Tall' | 'Grande' | 'Venti';
const size: Size = 'Tall';
```

- リテラル型（literal）: 指定した値だけを許可する。
- 共用体型（union）: `|`で型や値の候補を列挙する。
- 型エイリアス: `type`で型に別名を付ける。
- 列挙型（enum）: 名前付きの値をまとめる。数値enumは指定しなければ0から始まる。今回は実行記録なし。

## 5. オブジェクトと省略可能な項目

```typescript
let user: { name: string; age: number | undefined; married?: boolean };
user = { name: '山田', age: undefined }; // OK
// user = { name: '田中', married: true }; // NG: ageがない
```

| 宣言 | ageという項目 | 値 |
| --- | --- | --- |
| `age: number` | 必須 | 数値 |
| `age: number \| undefined` | 必須 | 数値またはundefined |
| `age?: number` | 省略可能 | 指定する場合は数値。undefinedの明示代入可否はコンパイラ設定による |

書籍のNG行を残してtsxだけで実行すると、代入は実行される。型エラーは実行時に代入を取り消す仕組みではない。
書籍の「前に代入した人物が残る」という出力例は、そのNG行を除外した場合の結果であり、掲載コードをそのまま実行した結果とは一致しない。

## 6. 型ガード・インタフェース・交差型

```typescript
if (typeof user.age === 'number') {
    console.log(user.age + 1);
}
```

型ガードは値の型を調べ、条件内で使える型を絞り込む。上記ではundefinedを除外して数値として計算する。

```typescript
interface IPerson { name: string; age: number; }
interface ISkill { canDrive: boolean; }
type IEngineer = IPerson & ISkill;
```

interfaceはオブジェクトの形を定義する。`&`の交差型は両方の条件を満たす型。
名前の先頭の`I`はInterfaceを示す命名習慣であり、「私」の意味でも必須の構文でもない。

## 7. 配列・タプル・関数

```typescript
const values: number[] = [10, 20];
const pair: [string, number] = ['山田', 25];
pair[1] = 28;
```

配列は要素の型を指定する。タプルは位置ごとに型を指定する。
`[true, 100, 'tokyo']`は通常`(boolean | number | string)[]`と推論される。書籍の「any型になる」という説明とは異なる。

```typescript
interface IProps { x: number; y: number; }
function addProps(props: IProps): number {
    return props.x + props.y;
}
console.log(addProps({ x: 2, y: 3 })); // 5
```

`IProps`は型の名前、`props`は引数の名前。propsはpropertiesの略で、特別なキーワードではない。上記のpropsは`{ x: 2, y: 3 }`を受け取る。
戻り値に使う値がない関数には`void`を指定する。console.logだけの関数をさらにconsole.logで囲むと、戻り値のundefinedも表示される。

## 8. Map・Set・any

| 項目 | 操作と意味 |
| --- | --- |
| Map | キーと値の組。setで登録、getで取得。同じキーへのsetは上書き |
| Mapのget | キーが存在しなければundefined |
| Set | 重複しない値の集まり。addで追加、hasで存在確認、sizeで件数確認 |
| any | 型チェックを緩める。何でも代入できるが、誤りも見逃しやすいため多用しない |

## 9. クラスと継承

```typescript
class Shape {
    constructor(public width: number, protected height: number) {}
}
class Rectangle extends Shape {
    area(): number {
        return this.width * this.height;
    }
}
const rect = new Rectangle(5, 10);
console.log(rect.area()); // 50
```

| 言葉 | 意味 |
| --- | --- |
| class | データと処理をまとめた型を定義 |
| new | クラスからインスタンスを生成 |
| constructor | 生成時の初期化処理 |
| this | そのインスタンス自身 |
| extends | 親クラスを継承 |
| super(width, height) | 親のコンストラクタを呼ぶ。子でconstructorを省略した場合は引数が親へ渡される |
| public | 外からアクセス可能。省略時の既定 |
| protected | クラス内部と継承先からアクセス可能 |
| private | 宣言したクラス内部からアクセス可能 |
| readonly | 型チェック上、初期化後の代入を禁止 |
| static | インスタンスではなくクラス自体に所属するメンバー |

コンストラクタの引数にpublic等を付けると、プロパティの宣言と代入をまとめて記述できる。
書籍の例はheightがprivateのまま子クラスから参照しているため、サンプルではprotectedに変更した。
TypeScriptのprivateやreadonlyは主に型チェックによる制約であり、実行時の保護と同じではない。
CDKの`class SampleStack extends Stack`も継承を使っている。

## 10. 抽象クラス・implements・ジェネリクス

- abstract class: 直接newできない親クラス。abstractメソッドの実装は、具体的な子クラスで必要となる。
- implements: クラスがインタフェースの条件を満たすことをチェックする。実装そのものは引き継がない。
- generics: 型を引数のように渡し、共通処理を複数の型に使う。

```typescript
class Pair<T> {
    constructor(private x: T, private y: T) {}
    swap(): void {
        [this.x, this.y] = [this.y, this.x];
    }
    print(): void {
        console.log(`x=${this.x}, y=${this.y}`);
    }
}
const pair = new Pair<number>(3, 5);
pair.swap();
pair.print(); // x=5, y=3
```

`T`は型の仮の名前。numberなら数値、stringなら文字列の組を扱う。上記は復習用の独立した例であり、既存の同名変数と同じスコープへ重ねて貼らない。

## 11. 今回つまずいた点

| 症状 | 原因と対処 |
| --- | --- |
| npmが実行コマンドを特定できない | npx run buildではなくnpm run buildを使う |
| ファイルが見つからない | ch03内なら04_objects.ts、sample内ならpractice/ch03/04_objects.ts |
| 別ファイルの型エラーで止まる | buildは他の練習ファイルも対象。NG例はコメントアウト |
| addPropsが見つからない | 関数定義と呼び出しの名前をそろえる |
| 変数名が他の練習と衝突する | 各独立した練習ファイルの先頭にexport {}を付けてモジュールにする |
| 型エラーの行も動いてしまう | tsx単独では型チェックしない。build成功後に実行する |

## 12. 参照先

- [TypeScript公式・基本の型](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript公式・型の絞り込み](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript公式・クラス](https://www.typescriptlang.org/docs/handbook/2/classes.html)
- [Vim設定の保管先と補完操作](../../tools/vim/README.md)
