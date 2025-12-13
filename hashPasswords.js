import bcrypt from "bcrypt";

async function main() {
  const passwords = ["admin123", "cashier123"];

  for (const p of passwords) {
    const hash = await bcrypt.hash(p, 10);
    console.log(`Password: ${p} => Hash: ${hash}`);
  }
}

main();
