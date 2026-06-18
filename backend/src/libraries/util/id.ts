const CUID_REGEX = /^c[0-9a-z]{5,}$/i;

const isCuid = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }
  return CUID_REGEX.test(value);
};

export { isCuid };

