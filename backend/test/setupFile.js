const { beforeAll, afterAll } = require("@jest/globals");
const {
  connectWithDatabase,
  disconnectFromDatabase,
  prisma,
} = require("../src/libraries/db");

beforeAll(async () => {
  await connectWithDatabase();
});

afterAll(async () => {
  await disconnectFromDatabase();
});

describe("Prisma connection", () => {
  it("responds to a basic query", async () => {
    const result = await prisma.$queryRaw`SELECT 1`;
    expect(result).toBeDefined();
  });
});
