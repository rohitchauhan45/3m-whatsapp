import bcrypt from "bcryptjs";
import { prisma, connectWithDatabase, disconnectFromDatabase } from "../src/libraries/db";
import logger from "../src/libraries/log/logger";

async function seedUsers() {
  try {
    await connectWithDatabase();

    // Check if users already exist
    const existingAdmin = await prisma.user.findUnique({
      where: { email: "chauhanrohith.3277@gmail.com" },
    });

    // Create admin user
    if (!existingAdmin) {
      const adminPassword = await bcrypt.hash("secure9306", 10);
      const admin = await prisma.user.create({
        data: {
          username: "rohit",
          email: "chauhanrohith.3277@gmail.com",
          emailVerified: true,
          password: adminPassword,
          name: "Rohit chauhan",
          number: "917698489306",
          role: "admin",
          provider: "local",
        },
      });
      logger.info("Admin user created:", {
        id: admin.id,
        username: admin.username,
        email: admin.email,
      });
      console.log("\n✅ Admin user created:");
    } else {
      logger.info("Admin user already exists");
      console.log("\n⚠️  Admin user already exists");
    }

    // Create normal user
    // if (!existingUser) {
    //   const userPassword = await bcrypt.hash("user123", 10);
    //   const user = await prisma.user.create({
    //     data: {
    //       username: "user",
    //       email: "user@example.com",
    //       password: userPassword,
    //       name: "Normal User",
    //       role: "user",
    //     },
    //   });
    //   logger.info("Normal user created:", {
    //     id: user.id,
    //     username: user.username,
    //     email: user.email,
    //   });
    //   console.log("\n✅ Normal user created:");
    //   console.log("   Email: user@example.com");
    //   console.log("   Username: user");
    //   console.log("   Password: user123");
    // } else {
    //   logger.info("Normal user already exists");
    //   console.log("\n⚠️  Normal user already exists");
    // }

    // Seed default cronjobs (id and name both start with "default_")
    const defaultCronjobs = [
      { id: "default_task_assign_time", name: "default_task_assign_time", time: "0 21 * * *" },
      { id: "default_task_followup_time", name: "default_task_followup_time", time: "0 10 * * *" },
      { id: "default_task_ontrack_time", name: "default_task_ontrack_time", time: "0 7 * * *" }
    ];

    for (const cj of defaultCronjobs) {
      const existing = await prisma.cron.findUnique({ where: { id: cj.id } });
      if (!existing) {
        const admin = await prisma.user.findFirst({ where: { role: "admin", deletedAt: null } });
        if (admin) {
          await prisma.cron.create({
            data: { id: cj.id, name: cj.name, time: cj.time, updateById: admin.id },
          });
          console.log(`✅ Cronjob created: ${cj.name} → ${cj.time}`);
        }
      } else {
        console.log(`⚠️  Cronjob already exists: ${cj.name}`);
      }
    }

  } catch (error) {
    logger.error("Error seeding users:", error);
    console.error("Error seeding users:", error);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

seedUsers();


