import bcrypt from "bcryptjs";
import { prisma, connectWithDatabase, disconnectFromDatabase } from "../src/libraries/db";
import logger from "../src/libraries/log/logger";
import { Setting } from "@prisma/client";

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
          number: "917698489305",
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

    const adminsetting = [
      { id: "default_send_ontrack", name: Setting.onTrackmsg }
    ]

    const admin = await prisma.user.findFirst({ where: { role: "admin", deletedAt: null } });

    for (const ase of adminsetting) {
      const existing = await prisma.adminSettings.findUnique({ where: { id: ase.id } })

      if (!existing) {

        if (admin) {
          await prisma.adminSettings.create({
            data: { id: ase.id, name: ase.name, adminId: admin.id }
          })

          console.log(`✅ Admin setting create : ${ase.name}`)
        }
      } else {
        console.log(`⚠️ already exists : ${ase.name}`)
      }
    }

    // Seed default cronjobs (id and name both start with "default_")
    const defaultCronjobs = [
      { id: "default_task_assign_time", name: "default_task_assign_time", time: "0 21 * * *" },
      { id: "default_task_followup_time", name: "default_task_followup_time", time: "0 10 * * *" },
      { id: "default_task_ontrack_time", name: "default_task_ontrack_time", time: "0 7 * * *" },
      { id: "default_remaining_status_delay", name: "default_remaining_status_delay", time: "30" },
      { id: "default_start_task_early", name: "default_start_task_early", time: "10" },
    ];

    for (const cj of defaultCronjobs) {
      const existing = await prisma.cron.findUnique({ where: { id: cj.id } });
      if (!existing) {
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