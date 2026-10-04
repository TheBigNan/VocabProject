import "dotenv/config";
import { db } from "./firebase.js";
import { clearPreviousSeedData } from "./seed.js";

async function unseed() {
  await clearPreviousSeedData();
  await db
    .collection("stats")
    .doc("summary")
    .set({ visits: 0, downloads: 0 }, { merge: true });
  console.log("Stats reset to 0 visits, 0 downloads.");
  console.log("Done.");
}

unseed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Unseeding failed:", err);
    process.exit(1);
  });
