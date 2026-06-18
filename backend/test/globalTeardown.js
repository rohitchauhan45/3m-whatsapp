module.exports = async function globalTeardown() {
  // Nothing to teardown: Prisma connections are closed via Jest setup hooks.
};
