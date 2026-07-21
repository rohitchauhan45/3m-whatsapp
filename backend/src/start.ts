import { startWebServer } from "./server";
import { startCronJobs } from "./scheduler";
import { notifyAdminError } from "./libraries/util/notifyAdminError";

const start = async (): Promise<void> => {
  await startWebServer();
  await startCronJobs();
};

start()
  .then(() => {
    console.log("Done");
  })
  .catch(async (error) => {
    console.error(error);
    await notifyAdminError("server startup");
  });
