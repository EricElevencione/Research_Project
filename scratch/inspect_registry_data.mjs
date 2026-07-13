import { getRsbsaSubmissions } from "../src/api.ts";

async function main() {
  try {
    const res = await getRsbsaSubmissions();
    const records = res.data || [];
    const targets = records.filter(r => ['37', '40'].includes(String(r.id)));
    console.log("=== API returned records for ID 37 and 40 ===");
    console.log(JSON.stringify(targets, null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
