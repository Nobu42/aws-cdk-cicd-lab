export { }; // 他の練習ファイルと変数名が衝突するのを防ぐ

// let: 後から値を変更できる
let age: number = 25;
age = 32;
console.log('年齢:', age);

// const: 後から値を変更できない
const fullName: string = '堀内 信英';
console.log('名前:', fullName);

// boolean: true または false の値を持つ
let checked: boolean = true;
checked = false;
console.log('チェック:', checked);

// number: 整数や小数などの数値を持つ
let price: number = 100;
const tax: number = 0.1;
console.log('税込み価格:', price * (1 + tax));

// string: 文字列を持つ
const pretectture = '東京都';
console.log(`私は${fullName}です。出身は${pretectture}です。`);

// リテラル型：指定した値だけを許可する
let city: '東京都' = '東京都';
console.log('都道府県:', city);

// 共用体型：指定した型のどちらかを許可する
let month: number | string = 12;
console.log('月（数値）:', month);
month = 'December';
console.log('月（文字列）:', month);

// 型エイリアス：型に名前を付ける
type Size = 'Short' | 'Tall' | 'Grande' | 'Venti';
const size: Size = 'Tall';
console.log('サイズ:', size);
