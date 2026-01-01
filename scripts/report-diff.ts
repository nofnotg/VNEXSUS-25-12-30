import fs from "fs";

const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));
const diff = (a: any, b: any, path: string[] = [], out: string[] = []) => {
  if (typeof a !== typeof b) {
    out.push(`${path.join(".")}: type mismatch`);
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      diff(a[i], b[i], path.concat(String(i)), out);
    }
    return out;
  }
  if (a && b && typeof a === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      diff(a?.[k], b?.[k], path.concat(k), out);
    }
    return out;
  }
  if (a !== b) out.push(`${path.join(".")}: '${a}' != '${b}'`);
  return out;
};

const main = () => {
  const f1 = process.argv[2];
  const f2 = process.argv[3];
  const a = read(f1);
  const b = read(f2);
  const out: string[] = [];
  diff(a, b, [], out);
  console.log(out.join("\n"));
};

main();

