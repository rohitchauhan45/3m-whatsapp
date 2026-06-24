import * as XLSX from "xlsx";
import { normalizeSheetDate } from "../src/libraries/util/Task/readfromxl.ts";
import {
    getISTCalendarParts,
    istCalendarDateFromParts,
    startOfISTCalendarDay,
} from "../src/libraries/util/Task/istDate.ts";
import { parseTimeOnDate } from "../src/libraries/util/Task/timing.ts";

function assertISTDay(date, expectedDay, label) {
    const { d, m, y } = getISTCalendarParts(date);
    const ok = d === expectedDay && m === 6 && y === 2026;
    console.log(ok ? "PASS" : "FAIL", label, "->", `${d}/${m}/${y}`, date.toISOString());
    if (!ok) process.exitCode = 1;
}

// DMY string 19-06-2026
const fromString = normalizeSheetDate("19-06-2026");
assertISTDay(fromString, 19, "DMY string");

// Excel serial for 19-Jun-2026
const serial = 45827;
const fromSerial = normalizeSheetDate(serial);
assertISTDay(fromSerial, 19, "Excel serial");

// xlsx cellDates-style Date (UTC midnight from serial)
const epoch = new Date(Date.UTC(1899, 11, 30));
const fromXlsxDate = normalizeSheetDate(new Date(epoch.getTime() + serial * 86400000));
assertISTDay(fromXlsxDate, 19, "xlsx Date object");

// dayDate storage
const dayDate = startOfISTCalendarDay(fromString);
assertISTDay(dayDate, 19, "startOfISTCalendarDay");

// 9am on that day stays correct IST time
const startAt = parseTimeOnDate(fromString, "9am");
const st = getISTCalendarParts(startAt);
const time = { hour: new Date(startAt.getTime() + 5.5 * 3600000).getUTCHours() };
console.log(
    startAt.getTime() === fromString.getTime() + 9 * 3600000 ? "PASS" : "FAIL",
    "9am offset",
    startAt.toISOString(),
    "hour IST",
    time.hour
);
