import { normalizeWhatsAppNumber } from "../../../domains/whtsapp/sendWhatsApp";

export const ensureIndiaCountryCode91 = (raw: string): string => {
    let d = normalizeWhatsAppNumber(raw);
    if (!d) return "";
    if (d.startsWith("0") && d.length === 11) {
        d = d.slice(1);
    }
    if (d.startsWith("91") && d.length >= 12) {
        return d;
    }
    if (d.length === 10) {
        return `91${d}`;
    }
    return d;
}

/** WhatsApp `from` may be 10 or 12 digits — match against stored `User.number`. */
export const numberLookupVariants = (fromDigits: string): string[] => {
    const d = normalizeWhatsAppNumber(fromDigits);
    const set = new Set<string>();
    if (d) set.add(d);
    if (d.length === 12 && d.startsWith("91")) set.add(d.slice(2));
    if (d.length === 10) set.add(`91${d}`);
    return [...set];
}