const fs = require("node:fs");
const path = require("node:path");
// Local text logs never grow without limit: past 1 MB the file is moved to "<name>.anterior"
// (the previous one is replaced) and a fresh file starts. Failures to log are ignored.
const MAX_LOG_BYTES = 1_000_000;
function appendLog(file, line, max = MAX_LOG_BYTES) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size > max)
      fs.renameSync(file, file + ".anterior");
    fs.appendFileSync(
      file,
      new Date().toISOString() + " " + String(line).slice(0, 2000) + "\n",
    );
  } catch {}
}
module.exports = { appendLog, MAX_LOG_BYTES };
