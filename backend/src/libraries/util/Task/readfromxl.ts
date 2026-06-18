import * as XLSX from "xlsx";

export function normalizeHeader(h: string): string {
    return String(h).trim().toLowerCase().replace(/\s+/g, "");
}

/** Excel trailing blank columns become __EMPTY, __EMPTY_1, … */
function isIgnorableSheetColumn(header: string): boolean {
    const raw = String(header).trim();
    if (!raw) return true;
    if (/^__EMPTY/i.test(raw)) return true;
    const nk = normalizeHeader(raw);
    return !nk || nk === "empty" || nk.startsWith("empty");
}

function hasCellValue(raw: unknown): boolean {
    if (raw === undefined || raw === null) return false;
    if (raw instanceof Date) return !Number.isNaN(raw.getTime());
    return String(raw).trim().length > 0;
}

export function stringCell(v: unknown): string {
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
    if (v === null || v === undefined) return "";
    return String(v).trim();
}

/** Excel time cells are often serial numbers or Date objects; normalize to strings like `9am`. */
export function formatSheetTimeCell(raw: unknown): string {
    if (raw === undefined || raw === null || raw === "") return "";
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        let hour = raw.getHours();
        const minute = raw.getMinutes();
        const period = hour >= 12 ? "pm" : "am";
        if (hour > 12) hour -= 12;
        if (hour === 0) hour = 12;
        if (minute > 0) {
            return `${hour}:${String(minute).padStart(2, "0")}${period}`;
        }
        return `${hour}${period}`;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
        const p = XLSX.SSF.parse_date_code(raw);
        if (p) {
            let hour = p.H ?? 0;
            const minute = p.M ?? 0;
            const period = hour >= 12 ? "pm" : "am";
            if (hour > 12) hour -= 12;
            if (hour === 0) hour = 12;
            if (minute > 0) {
                return `${hour}:${String(minute).padStart(2, "0")}${period}`;
            }
            return `${hour}${period}`;
        }
    }
    return stringCell(raw);
}

export function rowToMap(row: Record<string, unknown>): Map<string, string> {
    const m = new Map<string, string>();
    for (const [k, v] of Object.entries(row)) {
        if (isIgnorableSheetColumn(k)) continue;
        m.set(normalizeHeader(k), stringCell(v));
    }
    return m;
}

/** Only exact header keys after normalize (e.g. `manager mobile` → `managermobile`). */
export function mapGetExact(map: Map<string, string>, key: string): string {
    const k = normalizeHeader(key);
    return map.get(k) ?? "";
}

export function getRawByHeader(row: Record<string, unknown>, header: string): unknown {
    for (const [k, v] of Object.entries(row)) {
        if (isIgnorableSheetColumn(k)) continue;
        if (normalizeHeader(k) === normalizeHeader(header)) return v;
    }
    return undefined;
}

export function parseSheetDateString(s: string): Date | null {
    const t = s.trim();
    const m = t.match(
        /^(\d{4})-(\d{2})-(\d{2})[,\s]+(\d{1,2})[.:](\d{2})[.:](\d{2})$/
    );
    if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const h = Number(m[4]);
        const mi = Number(m[5]);
        const se = Number(m[6]);
        const dt = new Date(y, mo - 1, d, h, mi, se);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const fallback = new Date(t);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function normalizeSheetDate(raw: unknown): Date | null {
    if (raw === undefined || raw === null || raw === "") return null;
    if (raw instanceof Date) {
        return Number.isNaN(raw.getTime()) ? null : raw;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
        const p = XLSX.SSF.parse_date_code(raw);
        if (p) return new Date(p.y, p.m - 1, p.d, p.H ?? 0, p.M ?? 0, p.S ?? 0);
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof raw === "string" && raw.trim()) {
        const s = raw.trim();
        const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (dmy) {
            const dt = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
            return Number.isNaN(dt.getTime()) ? null : dt;
        }
        return parseSheetDateString(s);
    }
    return null;
}

export type AssignTaskSheetGroup = {
    startRow: number;
    name: string;
    number: string;
    /** Optional column `email` on the anchor row only. */
    email: string;
    dateRaw: unknown;
    tasks: { name: string; rawStartTime: string; rawEndTime: string }[];
    managerName: string;
    managerMobile: string;
};

/** Normalized keys allowed in assignTask.xlsx (no aliases like `names` or `username`). */
const ALLOWED_HEADER_KEYS = new Set([
    "date",
    "name",
    "number",
    "task",
    "start",
    "end",
    "managername",
    "managermobile",
    "email",
]);

/**
 * Validates the first data row's keys (sheet headers). Returns an error message or null if ok.
 */
export function validateAssignTaskSheetHeaders(sampleRow: Record<string, unknown>): string | null {
    const keys = Object.keys(sampleRow);
    if (keys.length === 0) {
        return "Sheet has no column headers";
    }
    const required = ["date", "name", "number", "task", "start", "end", "managername", "managermobile"] as const;
    const seen = new Set<string>();
    for (const k of keys) {
        if (isIgnorableSheetColumn(k)) continue;
        const nk = normalizeHeader(k);
        if (!ALLOWED_HEADER_KEYS.has(nk)) {
            return `Unknown column "${String(k).trim()}". Use only: date, name, number, task, start, end, managerName, manager mobile, and optional email.`;
        }
        seen.add(nk);
    }
    for (const r of required) {
        if (!seen.has(r)) {
            const label =
                r === "managermobile"
                    ? "manager mobile"
                    : r === "start"
                      ? "start"
                      : r === "end"
                        ? "end"
                        : r === "date"
                          ? "date"
                      : r === "managername"
                        ? "managerName"
                        : r;
            return `Missing required column "${label}".`;
        }
    }
    return null;
}

/** True when the row is completely empty (spacer row between users for clarity). */
function rowIsBlank(row: Record<string, unknown>): boolean {
    for (const [k, v] of Object.entries(row)) {
        if (isIgnorableSheetColumn(k)) continue;
        if (hasCellValue(v)) return false;
    }
    return true;
}

/**
 * assignTask.xlsx layout:
 * - `date` is usually filled once at the top; all users/tasks on the sheet use that same date.
 * - First row of a user block: name, number, task, start, end, managerName, manager mobile.
 * - Next rows: only extra tasks (+ start/end) until blank row or next name+number.
 * - Empty rows between users are ignored (visual separators only).
 */
export function groupAssignTaskSheetRows(rows: Record<string, unknown>[]): AssignTaskSheetGroup[] {
    const groups: AssignTaskSheetGroup[] = [];
    let current: AssignTaskSheetGroup | null = null;
    /** Carried from the first non-empty `date` cell in the sheet. */
    let sheetDateRaw: unknown;
    let sheetManagerName = "";
    let sheetManagerMobile = "";

    const normalizePhone = (raw: string) => raw.replace(/\D/g, "");

    for (let i = 0; i < rows.length; i++) {
        const dateFromRow = getRawByHeader(rows[i], "date");
        if (hasCellValue(dateFromRow)) {
            sheetDateRaw = dateFromRow;
        }

        if (rowIsBlank(rows[i])) {
            if (current && current.tasks.length > 0) {
                groups.push(current);
            }
            current = null;
            continue;
        }

        const map = rowToMap(rows[i]);

        const name = mapGetExact(map, "name");
        const number = normalizePhone(mapGetExact(map, "number"));
        const taskCell = mapGetExact(map, "task");
        const rawStartTime = formatSheetTimeCell(getRawByHeader(rows[i], "start"));
        const rawEndTime = formatSheetTimeCell(getRawByHeader(rows[i], "end"));
        const rowManagerName = mapGetExact(map, "managerName");
        const rowManagerMobile = normalizePhone(mapGetExact(map, "manager mobile"));
        if (rowManagerName) sheetManagerName = rowManagerName;
        if (rowManagerMobile) sheetManagerMobile = rowManagerMobile;
        const hasAnchor = name.length > 0 && number.length > 0;

        if (hasAnchor) {
            if (current && current.tasks.length > 0) {
                groups.push(current);
            }
            current = {
                startRow: i + 2,
                name,
                number,
                email: mapGetExact(map, "email"),
                dateRaw: hasCellValue(dateFromRow) ? dateFromRow : sheetDateRaw,
                tasks: taskCell.trim() ? [{ name: taskCell.trim(), rawStartTime, rawEndTime }] : [],
                managerName: rowManagerName || sheetManagerName,
                managerMobile: rowManagerMobile || sheetManagerMobile,
            };
        } else if (current && taskCell.trim()) {
            current.tasks.push({ name: taskCell.trim(), rawStartTime, rawEndTime });
        }
    }

    if (current && current.tasks.length > 0) {
        groups.push(current);
    }

    return groups;
}

export type ReadAssignTaskSheetResult =
    | { ok: true; rows: Record<string, unknown>[] }
    | { ok: false; message: string; status: number };

export function readAssignTaskExcelSheetRows(buffer: Buffer): ReadAssignTaskSheetResult {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
        return { ok: false, message: "Workbook has no sheets", status: 400 };
    }
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
        return { ok: false, message: "Missing sheet", status: 400 };
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rawRows.length === 0) {
        return {
            ok: false,
            message: "No data rows (add rows under the header row)",
            status: 400,
        };
    }

    const headerErr = validateAssignTaskSheetHeaders(rawRows[0]);
    if (headerErr) {
        return { ok: false, message: headerErr, status: 400 };
    }

    return { ok: true, rows: rawRows };
}
