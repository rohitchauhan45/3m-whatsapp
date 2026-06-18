import { TaskStaus } from "@prisma/client";
import { onTrackStatus } from "@prisma/client";

type taskchoice = "inprogress" | "remark" | "done"
type dailyTaskChoice = "ontrack" | "no"
type startChoice = "start" | "taskquery"


export const normalizeChoiceforTaskfollowUp = (choice: taskchoice) => {
    if (choice === "inprogress") {
        return TaskStaus.inProgress
    }
    if (choice === "remark") {
        return TaskStaus.remark
    }
    if (choice === "done") {
        return TaskStaus.completed
    }
}

export const normlizeChoiceforDaily = (choice: dailyTaskChoice) => {
    switch (choice) {
        case "ontrack":
            return onTrackStatus.onTrack

        case "no":
            return onTrackStatus.remark
    }
}

export const normlizeChiocestartChoice = (choice: startChoice) => {
    if (choice === "start") {
        return TaskStaus.onTrack
    }
    if (choice === "taskquery") {
        return TaskStaus.remark
    }
}