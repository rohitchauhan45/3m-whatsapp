import logger from "../../libraries/log/logger";
import { prisma } from "../../libraries/db";
import { notifyAdminError } from "../../libraries/util/notifyAdminError";
import { AppError } from "../../libraries/error-handling/AppError";
import { Role } from "@prisma/client";
import type { AssignSiteUsersInput, CreateSiteInput } from "./request";

export type SiteRecord = {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radius: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
};  

export type SiteAssignedUser = {
    id: string;
    userId: string;
    name: string;
    number: string;
    assignedAt: Date;
};

export type SiteDetailRecord = SiteRecord & {
    addedby: {
        id: string;
        name: string;
        number: string;
    };
    users: SiteAssignedUser[];
};

export type AssignableSiteUser = {
    id: string;
    name: string;
    number: string;
};

type ServiceResult<T> = {
    success: boolean;
    status: number;
    message: string;
    data?: T;
    error?: string;
};

export async function reverseGeocodeSiteAddress(
    latitude: number,
    longitude: number,
): Promise<ServiceResult<{ address: string }>> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) {
        return {
            success: false,
            status: 500,
            message: "Google Maps API key is not configured on the server",
            error: "GOOGLE_MAPS_API_KEY missing",
        };
    }

    try {
        const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
        url.searchParams.set("latlng", `${latitude},${longitude}`);
        url.searchParams.set("key", apiKey);

        const response = await fetch(url.toString());
        if (!response.ok) {
            return {
                success: false,
                status: 502,
                message: "Could not resolve address for this location",
                error: `Geocode HTTP ${response.status}`,
            };
        }

        const payload = (await response.json()) as {
            status: string;
            results?: Array<{ formatted_address?: string }>;
        };

        if (payload.status !== "OK" || !payload.results?.length) {
            return {
                success: false,
                status: 404,
                message: "No address found for this location",
                error: payload.status,
            };
        }

        const address = payload.results[0].formatted_address?.trim() ?? "";
        if (!address) {
            return {
                success: false,
                status: 404,
                message: "No address found for this location",
            };
        }

        return {
            success: true,
            status: 200,
            message: "Address resolved",
            data: { address },
        };
    } catch (error) {
        logger.error("Error in reverse geocode site address", error);
        await notifyAdminError("reverse geocode site address");
        throw new AppError("Error resolving address", (error as Error).message);
    }
}

export async function listSites(): Promise<ServiceResult<SiteRecord[]>> {
    try {
        const sites = await prisma.site.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                radius: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return {
            success: true,
            status: 200,
            message: "Sites fetched",
            data: sites,
        };
    } catch (error) {
        logger.error("Error listing sites", error);
        await notifyAdminError("list sites");
        throw new AppError("Error listing sites", (error as Error).message);
    }
}

export async function createSite(
    data: CreateSiteInput,
    adminId: string,
): Promise<ServiceResult<SiteRecord>> {
    try {
        const result = await prisma.site.create({
            data: {
                name: data.name,
                address: data.address,
                latitude: data.latitude,
                longitude: data.longitude,
                addedbyId: adminId,
            },
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                radius: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return {
            success: true,
            status: 201,
            message: "Site created successfully",
            data: result,
        };
    } catch (error) {
        logger.error("Error creating site", error);
        await notifyAdminError("create site");
        throw new AppError("Error creating site", (error as Error).message);
    }
}

export async function getSiteById(siteId: string): Promise<ServiceResult<SiteDetailRecord>> {
    try {
        const site = await prisma.site.findFirst({
            where: { id: siteId, deletedAt: null },
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                radius: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                addedby: {
                    select: {
                        id: true,
                        name: true,
                        number: true,
                    },
                },
                users: {
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        createdAt: true,
                        user: {
                            select: {
                                id: true,
                                name: true,
                                number: true,
                            },
                        },
                    },
                },
            },
        });

        if (!site) {
            return {
                success: false,
                status: 404,
                message: "Site not found",
            };
        }

        const data: SiteDetailRecord = {
            id: site.id,
            name: site.name,
            address: site.address,
            latitude: site.latitude,
            longitude: site.longitude,
            radius: site.radius,
            status: site.status,
            createdAt: site.createdAt,
            updatedAt: site.updatedAt,
            addedby: site.addedby,
            users: site.users.map((row) => ({
                id: row.id,
                userId: row.user.id,
                name: row.user.name,
                number: row.user.number,
                assignedAt: row.createdAt,
            })),
        };

        return {
            success: true,
            status: 200,
            message: "Site fetched",
            data,
        };
    } catch (error) {
        logger.error("Error fetching site", error);
        await notifyAdminError("get site by id");
        throw new AppError("Error fetching site", (error as Error).message);
    }
}

export async function listAssignableSiteUsers(
    siteId: string,
): Promise<ServiceResult<AssignableSiteUser[]>> {
    try {
        const site = await prisma.site.findFirst({
            where: { id: siteId, deletedAt: null },
            select: { id: true },
        });

        if (!site) {
            return {
                success: false,
                status: 404,
                message: "Site not found",
            };
        }

        const users = await prisma.user.findMany({
            where: {
                role: Role.user,
                deletedAt: null,
                sitelocations: {
                    none: { siteId },
                },
            },
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                number: true,
            },
        });

        return {
            success: true,
            status: 200,
            message: "Assignable users fetched",
            data: users,
        };
    } catch (error) {
        logger.error("Error listing assignable site users", error);
        await notifyAdminError("list assignable site users");
        throw new AppError("Error listing assignable users", (error as Error).message);
    }
}

export async function assignUsersToSite(
    siteId: string,
    data: AssignSiteUsersInput,
): Promise<ServiceResult<{ assignedCount: number }>> {
    try {
        const site = await prisma.site.findFirst({
            where: { id: siteId, deletedAt: null },
            select: { id: true },
        });

        if (!site) {
            return {
                success: false,
                status: 404,
                message: "Site not found",
            };
        }

        const uniqueUserIds = [...new Set(data.userIds)];

        const eligibleUsers = await prisma.user.findMany({
            where: {
                id: { in: uniqueUserIds },
                role: Role.user,
                deletedAt: null,
                sitelocations: {
                    none: { siteId },
                },
            },
            select: { id: true },
        });

        if (eligibleUsers.length === 0) {
            return {
                success: false,
                status: 400,
                message: "No eligible users selected for assignment",
            };
        }

        await prisma.userSite.createMany({
            data: eligibleUsers.map((user) => ({
                userId: user.id,
                siteId,
            })),
            skipDuplicates: true,
        });

        return {
            success: true,
            status: 200,
            message: `${eligibleUsers.length} user(s) assigned to site`,
            data: { assignedCount: eligibleUsers.length },
        };
    } catch (error) {
        logger.error("Error assigning users to site", error);
        await notifyAdminError("assign users to site");
        throw new AppError("Error assigning users to site", (error as Error).message);
    }
}
