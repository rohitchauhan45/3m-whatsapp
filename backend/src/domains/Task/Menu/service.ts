import logger from "../../../libraries/log/logger";
import { notifyAdminError } from "../../../libraries/util/notifyAdminError";
import { sendWhatsAppButtons } from "../../whtsapp/sendWhatsApp";
import { sendMorningOnTrackButtonsToUser } from "../Assign/service";
import { handlePendigTaskUpdateText } from "../Previous/service";

const MENU_MESSAGE = "What you want to do ?";

export async function handleMenuText(number: string): Promise<void> {
    try {
        await sendWhatsAppButtons({
            number,
            message: MENU_MESSAGE,
            buttons: [
                { id: "menu_morning", title: "Morning on track" },
                { id: "menu_update", title: "Update" },
            ],
        });
    } catch (error) {
        logger.error("error while send the menu button", error);
        await notifyAdminError("send the menu button (update ,....)");
    }
}

export async function handleMenuButton(number: string, choice: string): Promise<void> {
    try {
        if (choice === "morning") {
            await sendMorningOnTrackButtonsToUser(number);
            return;
        }

        if (choice === "update") {
            await handlePendigTaskUpdateText(number);
        }
    } catch (error) {
        logger.error("Error while handle the Menu button : ", error);
        await notifyAdminError("error while handle the menu button");
    }
}
