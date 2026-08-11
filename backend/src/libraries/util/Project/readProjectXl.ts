import XLSX from "xlsx";

export type ProjectImportRow = {
    startRow: number;
    code: string;
    name: string;
    assigneeName: string;
    durationDays: number | null;
    plannedStart: Date | null;
    plannedEnd: Date | null;
    actualStart: Date | null;
    actualEnd: Date | null;
    totalQty: number | null;
    completedQty: number | null;
    completionPct: number | null;
};

type ColumnKey =
    | "code"
    | "name"
    | "assignee"
    | "duration"
    | "startDate"
    | "endDate"
    | "totalQty"
    | "progress"
    | "completion";

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
    code: ["s.no.", "s.no", "sno", "code"],
    name: ["taskname", "task name", "name"],
    assignee: ["assignee"],
    duration: ["duration"],
    startDate: ["start date (sch/actual)", "start date"],
    endDate: ["end date (sch/actual)", "end date"],
    totalQty: ["total qty", "total quantity"],
    progress: ["progress"],
    completion: ["% completion", "completion", "% complete"],
};

const MONTH_MAP: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
};

function normalizeHeader(value: unknown): string {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function detectColumns(headerRow: unknown[]): Partial<Record<ColumnKey, number>> {
    const columns: Partial<Record<ColumnKey, number>> = {};

    headerRow.forEach((cell, index) => {
        const normalized = normalizeHeader(cell);
        if (!normalized) return;

        for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [ColumnKey, string[]][]) {
            if (aliases.includes(normalized)) {
                columns[key] = index;
            }
        }
    });

    return columns;
}

function cleanCellText(value: unknown): string {
    return String(value ?? "")
        .replace(/\r/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function cleanTaskName(value: unknown): string {
    return String(value ?? "")
        .replace(/\r/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function parseOryxDateToken(raw: string): Date | null {
    const token = raw.trim();
    if (!token || token === "-" || token === "/") return null;

    const match = token.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = MONTH_MAP[match[2].toLowerCase()];
    const yearPart = Number(match[3]);
    if (!month || !Number.isFinite(day) || !Number.isFinite(yearPart)) return null;

    const year = yearPart < 100 ? 2000 + yearPart : yearPart;
    const date = new Date(Date.UTC(year, month, day));
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseSchActualDates(raw: unknown): {
    planned: Date | null;
    actual: Date | null;
} {
    const text = String(raw ?? "").replace(/\r/g, "").trim();
    if (!text || text === "-") {
        return { planned: null, actual: null };
    }

    const slashIndex = text.indexOf("/");
    const scheduledPart = slashIndex === -1 ? text : text.slice(0, slashIndex).trim();
    const actualPart =
        slashIndex === -1
            ? ""
            : text
                  .slice(slashIndex + 1)
                  .split("\n")
                  .map((line) => line.trim())
                  .find((line) => line && line !== "-") ?? "";

    return {
        planned: parseOryxDateToken(scheduledPart),
        actual: parseOryxDateToken(actualPart),
    };
}

function parseDurationDays(raw: unknown): number | null {
    const text = cleanCellText(raw).toLowerCase();
    if (!text || text === "-") return null;

    const match = text.match(/(\d+)\s*days?/);
    if (match) return Number(match[1]);

    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : null;
}

function parseDecimalQty(raw: unknown): number | null {
    const text = cleanCellText(raw);
    if (!text || text === "-") return null;

    const numeric = Number(text.replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
}

function parseCompletionPct(raw: unknown): number | null {
    const text = cleanCellText(raw);
    if (!text || text === "-") return null;

    if (text.endsWith("%")) {
        const numeric = Number(text.slice(0, -1).trim());
        return Number.isFinite(numeric) ? numeric : null;
    }

    const numeric = Number(text);
    if (!Number.isFinite(numeric)) return null;
    if (numeric <= 1) return numeric * 100;
    return numeric;
}

function parentCode(code: string): string | null {
    const lastDot = code.lastIndexOf(".");
    if (lastDot === -1) return null;
    return code.slice(0, lastDot);
}

export function isValidProjectTaskCode(code: string): boolean {
    return /^\d+(?:\.\d+)*$/.test(code);
}

export function getParentProjectTaskCode(code: string): string | null {
    return parentCode(code);
}

export function readProjectProgressExcelRows(buffer: Buffer): ProjectImportRow[] {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new Error("Excel file has no sheets");
    }

    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
    });

    if (matrix.length === 0) {
        throw new Error("Excel sheet is empty");
    }

    const headerIndex = matrix.findIndex((row) =>
        row.some((cell) => normalizeHeader(cell).includes("taskname")),
    );
    if (headerIndex === -1) {
        throw new Error("Could not find header row with TaskName column");
    }

    const columns = detectColumns(matrix[headerIndex] ?? []);
    if (columns.code == null || columns.name == null) {
        throw new Error("Required columns missing: S.No. and TaskName");
    }

    const rows: ProjectImportRow[] = [];

    for (let rowIndex = headerIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
        const row = matrix[rowIndex] ?? [];
        const code = cleanCellText(row[columns.code]);
        const name = cleanTaskName(row[columns.name]);

        if (!code && !name) continue;
        if (!code) {
            throw new Error(`Row ${rowIndex + 1}: missing task code`);
        }
        if (!isValidProjectTaskCode(code)) {
            throw new Error(`Row ${rowIndex + 1}: invalid task code "${code}"`);
        }
        if (!name) {
            throw new Error(`Row ${rowIndex + 1}: missing task name`);
        }

        const startDates = parseSchActualDates(columns.startDate != null ? row[columns.startDate] : "");
        const endDates = parseSchActualDates(columns.endDate != null ? row[columns.endDate] : "");

        rows.push({
            startRow: rowIndex + 1,
            code,
            name,
            assigneeName: columns.assignee != null ? cleanCellText(row[columns.assignee]) : "",
            durationDays: parseDurationDays(columns.duration != null ? row[columns.duration] : ""),
            plannedStart: startDates.planned,
            plannedEnd: endDates.planned,
            actualStart: startDates.actual,
            actualEnd: endDates.actual,
            totalQty: parseDecimalQty(columns.totalQty != null ? row[columns.totalQty] : ""),
            completedQty: parseDecimalQty(columns.progress != null ? row[columns.progress] : ""),
            completionPct: parseCompletionPct(columns.completion != null ? row[columns.completion] : ""),
        });
    }

    if (rows.length === 0) {
        throw new Error("No task rows found in Excel file");
    }

    return rows;
}
