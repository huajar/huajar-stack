import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "statechart-test-"));
for (const name of ["TMPDIR", "TEMP", "TMP"]) process.env[name] = root;
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 400 }));
