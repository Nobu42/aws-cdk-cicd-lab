let user: { name: string, age: number | undefined, married?: boolean };
user = { name: '堀内信英', age: undefined, married: false };
user = { name: '堀内信英', age: 25 };
console.log(user.married);
// user = { name: '青木千恵子', married: true };
console.log(typeof user);
console.log(user);
