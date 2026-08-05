export type CreateTaskResult = {
    success: boolean;
    status: number;
    message: string;
    processed: number;
    failedRows: { row: number; reason: string }[];
};

export type EditTask = {
    name?: string;
    start?: string;
    end?: string;
};

export type EditTaskResult = {
    success: boolean;
    status: number;
    message?: string;
    error?: string;
    data?: {
        id: string;
        name: string;
        rawStartTime: string;
        rawEndTime: string;
        startAt: Date;
        endAt: Date;
    };
};

export type TaskImportRow = {
    startRow: number;
    date: string;
    name: string;
    number: string;
    email?: string;
    managerName: string;
    managerMobile: string;
    taskName: string;
    rawStartTime: string;
    rawEndTime: string;
};

export type PreviewTaskResult = {
    success: boolean;
    status: number;
    message: string;
    rows: TaskImportRow[];
    failedRows: { row: number; reason: string }[];
};

export type TaskResult = {
    success: boolean;
    status: number;
    message: string;
    sent: number;
    skippedNoPhone: number;
    skippedNoTasks: number;
    failedSends: number;
    managerSummarySent: boolean;
};

export type RemainingStatusResult = {
    success: boolean;
    message: string;
    sent: number;
    skippedNoPhone: number;
    skippedNoRemaining: number;
    failedSends: number;
};

export type FinalDecisionResult = {
    success: boolean;
    message: string;
    sent: number;
    skippedNoPhone: number;
    skippedNoTasks: number;
    failedSends: number;
};

export type SendWelcomeMsgResult = {
    success: boolean;
    status: number;
    message: string;
    userSent: number;
    managerSent: number;
    userFailed: number;
    managerFailed: number;
};