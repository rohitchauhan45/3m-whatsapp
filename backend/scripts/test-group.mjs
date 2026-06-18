import fs from "fs";
import { readAssignTaskExcelSheetRows, groupAssignTaskSheetRows, normalizeSheetDate } from "../src/libraries/util/Task/readfromxl.ts";
import { parseTimeOnDate } from "../src/libraries/util/Task/timing.ts";

const buf = fs.readFileSync("src/cursor supporter/assignTask.xlsx");
const r = readAssignTaskExcelSheetRows(buf);
if (!r.ok) {
  console.log("FAIL", r.message);
  process.exit(1);
}
const groups = groupAssignTaskSheetRows(r.rows);
console.log("groups", groups.length);
for (const g of groups) {
  const d = normalizeSheetDate(g.dateRaw);
  console.log(g.name, "date", d ? "ok" : "MISSING", "tasks", g.tasks.length, "mgr", g.managerName || "MISSING");
}
