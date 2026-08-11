import fs from "fs";
import path from "path";
import crypto from "crypto";

import logger from "../../log/logger";
import { notifyAdminError } from "../notifyAdminError";

export type PhotoFileMode = "remark" | "completed";

function extensionFromMime(mimeType: string): string {
    if (mimeType.toLowerCase().includes("png")) return ".png";
    return ".jpg";
}

export async function saveTaskPhotoBuffer(
    buffer: Buffer,
    mimeType: string,
    mode: PhotoFileMode,
): Promise<string> {
    const uploadDir = path.join(process.cwd(), "public", "upload", mode);

    await fs.promises.mkdir(uploadDir, { recursive: true });

    const extension = extensionFromMime(mimeType);
    const date = new Date().toISOString().split("T")[0];
    const randomString = crypto.randomBytes(4).toString("hex");
    const filename = `${mode}_${date}_${randomString}${extension}`;
    const filepath = path.join(uploadDir, filename);

    await fs.promises.writeFile(filepath, buffer);

    return `/upload/${mode}/${filename}`;
}

export const saveFileMulter = async (
    file: Express.Multer.File,
    mode: PhotoFileMode,
): Promise<string> => {
    try {
        return await saveTaskPhotoBuffer(file.buffer, file.mimetype, mode);
    } catch (error) {
        logger.error("Error while save file ", error);
        await notifyAdminError("while save remark/completed file");
        throw error;
    }
};
