export {};      // 他のファイルとの変数名の衝突を防ぐ

// オブジェクト:ageは必須, marriedは省略可能
let user: { name: string; age: number | undefined; married?: boolean };
user = { name: '堀内信英', age: undefined, married: false };
console.log(user.age); // undefined
user = { name: '堀内信英', age: 53 };
console.log(user.married); // undefined

// 型ガードを確認してから処理する
if (typeof user.age == 'number') {
    console.log(user.age + 1); // 54
}
user.married = false;
if (typeof user.married == 'boolean') {
    console.log(!user.married); // true
}

// インターフェース:オブジェクトの方に名前をつける
interface IPerson {
    name: string;
    age: number;
    married?: boolean;
}
const person: IPerson = { name: '堀内信英', age: 53 };
console.log(person.name, person.age); // 堀内信英 53

// 交差型:両方の型の条件を満たす
interface ISkill {
    canDrive: boolean;
    canProgramming?: boolean;
}
type IEngineer = IPerson & ISkill;
const engineer: IEngineer = { name: '堀内信英', age: 53, canDrive: true };
console.log(engineer.name, engineer.canDrive);

// 配列:constでも中身への追加は可能
const animals: string[] = ['dog', 'cat'];
animals.push('rabbit');
const amounts: Array<number> = [300, 150];
console.log(animals.length);
const mix = [true, 100, 'tokyo'];

// タプル: 位置ごとに型が決まる
const member: [string, number] = ['堀内信英', 53];
member[1] = 54;
console.log(member[0], member[1]);

// 関数:引数と戻り値に型を指定する
function add(x: number, y: number): number {
    return x + y;
}

interface IProps { x: number; y: number; }

function addProps(props: IProps): number {
    return props.x + props.y;
}
function show(message: string): void {
    console.log(message);
}

console.log(add(1, 2)); // 3
console.log(addProps({ x: 2, y: 3 })); // 5
show('戻り値なし'); // 戻り値なし

// Map：同じキーで登録すると値を上書きする
const prefectures = new Map<string, string>();
prefectures.set('01', '北海道');
prefectures.set('02', '青森県');
console.log(prefectures.get('01')); // 北海道
console.log(prefectures.get('99')); // undefined
prefectures.forEach((value, key) => {
    console.log(`${key}: ${value}`); // 01: 北海道 → 02: 青森県
});

// Set：同じ値を追加しても重複しない
const names = new Set<string>(['dog', 'cat']);
names.add('dog');
console.log(names.size); // 2
console.log(names.has('dog')); // true
console.log(names.has('rabbit')); // false

// any：型のチェックを緩める。原則として多用しない
let anything: any = 9;
console.log(anything); // 9
anything = '富士山';
console.log(anything); // 富士山
