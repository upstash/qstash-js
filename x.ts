const delays: number[] = [];
const sum: number[] = [];
for (let r = 0; r < 10; r++) {
  const d = Math.exp(r) * 50;
  delays.push(Math.round(d));
  sum.push(delays.reduce((acc, x) => acc + x, 0));
}

console.log(delays);
console.log(sum);
