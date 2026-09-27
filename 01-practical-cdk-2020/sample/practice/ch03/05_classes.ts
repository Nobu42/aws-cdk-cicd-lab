export {};

// 親クラス：幅と高さを持つ
class Shape {
    // newしたときに呼ばれる
    constructor(
        public width: number,
        protected height: number
    ) {}

    showWidth(): void {
        console.log(this.width);
    }

    showHeight(): void {
        console.log(this.height);
    }
}

// 子クラス：Shapeを継承し、面積の計算を追加する
class Rectangle extends Shape {
    constructor(width: number, height: number) {
        super(width, height); // 親のconstructorを呼ぶ
    }

    area(): number {
        return this.width * this.height;
    }
}

// 幅5、高さ10のインスタンスを作る
const rect = new Rectangle(5, 10);

rect.showWidth();          // 5
rect.showHeight();         // 10
console.log(rect.area());  // 50

// publicなので外から変更できる
rect.width = 20;
console.log(rect.area());  // 200

// protectedなので外から直接は変更できない
// rect.height = 30; // 型エラー
