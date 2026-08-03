import { z } from "zod";
import { isCuid } from "../../libraries/util/id";

const latitudeSchema = z
    .number({ invalid_type_error: "latitude must be a number" })
    .min(-90, "latitude must be between -90 and 90")
    .max(90, "latitude must be between -90 and 90");

const longitudeSchema = z
    .number({ invalid_type_error: "longitude must be a number" })
    .min(-180, "longitude must be between -180 and 180")
    .max(180, "longitude must be between -180 and 180");

export const createSiteSchema = z.object({
    name: z.string().trim().min(1, "name is required").max(200, "name is too long"),
    address: z.string().trim().min(1, "address is required").max(500, "address is too long"),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
});

export const geocodeQuerySchema = z.object({
    latitude: z.coerce.number().pipe(latitudeSchema),
    longitude: z.coerce.number().pipe(longitudeSchema),
});

export const siteIdSchema = z.object({
    id: z.string().refine((value) => isCuid(value), {
        message: "Invalid site id",
    }),
});

export const assignSiteUsersSchema = z.object({
    userIds: z
        .array(
            z.string().refine((value) => isCuid(value), {
                message: "Invalid user id",
            }),
        )
        .min(1, "Select at least one user"),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type AssignSiteUsersInput = z.infer<typeof assignSiteUsersSchema>;
