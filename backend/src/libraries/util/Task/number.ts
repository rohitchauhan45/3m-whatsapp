import { normalizeWhatsAppNumber } from "../../../domains/whtsapp/sendWhatsApp";

export const INDIAN_MOBILE_10_ERROR =
    "number must be exactly 10 digits starting with 6, 7, 8, or 9 (without country code 91)";

export const digitsOnlyPhone = (raw: string): string => raw.replace(/\D/g, "");

export const isValidIndianMobile10 = (digits: string): boolean =>
    /^[6-9]\d{9}$/.test(digits);

/** Returns normalized 10-digit mobile or null if invalid. */
export const parseIndianMobile10 = (raw: string): string | null => {
    const digits = digitsOnlyPhone(raw);
    return isValidIndianMobile10(digits) ? digits : null;
};

/** Store as 91 + 10-digit mobile (validated separately). */
export const toStoredIndianWhatsAppNumber = (tenDigitMobile: string): string =>
    `91${tenDigitMobile}`;

/** WhatsApp `from` may be 10 or 12 digits — match against stored `User.number`. */
export const numberLookupVariants = (fromDigits: string): string[] => {
    const d = normalizeWhatsAppNumber(fromDigits);
    const set = new Set<string>();
    if (d) set.add(d);
    if (d.length === 12 && d.startsWith("91")) set.add(d.slice(2));
    if (d.length === 10) set.add(`91${d}`);
    return [...set];
};
