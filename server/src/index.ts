import app from "./app.js";
import { storageDriver } from "./storage.js";

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`Vocab server listening on http://localhost:${PORT}`);
  console.log(
    storageDriver === "local"
      ? "PDF storage: local disk (server/uploads) — set FIREBASE_STORAGE_BUCKET to switch to Firebase Storage."
      : "PDF storage: Firebase Storage"
  );
});
