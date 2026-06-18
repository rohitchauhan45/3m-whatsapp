import { startWebServer } from "./server";
import { startCronJobs } from "./scheduler";

const start = async (): Promise<void> => {
  await startWebServer();
  await startCronJobs();
};

start()
  .then(() => {
    console.log("Done");
  })
  .catch((error) => {
    console.error(error);
  });
