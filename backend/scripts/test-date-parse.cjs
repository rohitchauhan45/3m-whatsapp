const XLSX = require("xlsx");
const { normalizeSheetDate } = require("../src/libraries/util/Task/readfromxl");
const { getUTCDateParts } = require("../src/libraries/util/Task/istDate");

function check(label, raw, expectedDay) {
    const d = normalizeSheetDate(raw);
    const p = getUTCDateParts(d);
    const ok = p.d === expectedDay && p.m === 6 && p.y === 2026;
    console.log(
        ok ? "PASS" : "FAIL",
        label,
        "expected day",
        expectedDay,
        "got",
        `${p.d}/${p.m}/${p.y}`,
        d.toISOString()
    );
    if (!ok) process.exitCode = 1;
}

check("DMY string", "19-06-2026", 19);

for (let s = 45000; s <= 47000; s++) {
    const p = XLSX.SSF.parse_date_code(s);
    if (p && p.y === 2026 && p.m === 6 && p.d === 19) {
        check("Excel serial " + s, s, 19);
        break;
    }
}

// Simulate cellDates:false — date cell as number in sheet
const serial2026 = (() => {
    for (let s = 45000; s <= 47000; s++) {
        const p = XLSX.SSF.parse_date_code(s);
        if (p && p.y === 2026 && p.m === 6 && p.d === 19) return s;
    }
    throw new Error("serial for 2026-06-19 not found");
})();
const ws = XLSX.utils.aoa_to_sheet([
    ["date", "name", "number", "task", "start", "end", "managerName", "manager mobile"],
    [serial2026, "User", "9999999999", "Task1", 0.375, 0.5, "Mgr", "8888888888"],
]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
const { readAssignTaskExcelSheetRows, groupAssignTaskSheetRows } = require("../src/libraries/util/Task/readfromxl");
const sheet = readAssignTaskExcelSheetRows(buf);
if (!sheet.ok) {
    console.log("FAIL sheet read", sheet.message);
    process.exit(1);
}
const groups = groupAssignTaskSheetRows(sheet.rows);
check("from xlsx file", groups[0].dateRaw, 19);
