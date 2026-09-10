// One CSV cell (semicolon separated, UTF-8). Text that a spreadsheet would run as a formula
// (=, +, -, @ at the start) gets a leading apostrophe; numbers are never touched.
function csvCell(v) {
  if (typeof v === "number") return String(v);
  let t = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}
module.exports = { csvCell };
