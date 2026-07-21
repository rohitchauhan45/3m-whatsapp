import { TaskStaus, TaskFinalStatus, onTrackStatus } from "@prisma/client";

type taskchoice = "inprogress" | "remark" | "done"
type dailyTaskChoice = "ontrack" | "no" | "absent"
type startChoice = "start" | "taskquery" | "delay"

export const normalizeChoiceforTaskfollowUp = (choice: taskchoice) => {
    if (choice === "inprogress") {
        return TaskStaus.inProgress
    }
    if (choice === "remark") {
        return TaskStaus.remark
    }
    if (choice === "done") {
        return TaskFinalStatus.completed
    }
}

export const normlizeChoiceforDaily = (choice: dailyTaskChoice) => {
    switch (choice) {
        case "ontrack":
            return onTrackStatus.onTrack

        case "no":
            return onTrackStatus.remark

        case "absent":
            return onTrackStatus.absent
    }
}

export const normlizeChiocestartChoice = (choice: startChoice) => {
    if (choice === "start") {
        return TaskStaus.inProgress
    }
    if (choice === "taskquery") {
        return TaskStaus.remark
    }
    if (choice === "delay") {
        return TaskStaus.pending
    }
}
