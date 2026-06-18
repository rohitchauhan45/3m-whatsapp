import { User } from "@prisma/client";
import bcrypt from "bcryptjs";
import logger from "../../libraries/log/logger";
import { prisma } from "../../libraries/db";
import { AppError } from "../../libraries/error-handling/AppError";

const model = "user";

interface UserInput {
  username: string;
  email: string;
  password?: string;
  role_name: string;
  name?: string;
  number:string;
}

interface PaginationResult {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const isRecordNotFound = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: string }).code === "P2025";

const create = async (data: UserInput): Promise<User> => {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
        ],
      },
    });

    if (existingUser) {
      throw new AppError(
        "User already exists",
        existingUser.email === data.email ? "Email already registered" : "Username already taken",
        409,
      );
    }

    // Hash password if provided
    const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : undefined;
    if (!hashedPassword) {
      throw new AppError("Password is required", "Password is required for new users", 400);
    }

    const saved = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: hashedPassword,
        name: data.name,
        number:data.number
      },
    });
    logger.info(`create(): ${model} created`, {
      id: saved.id,
    });
    return saved;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error(`create(): Failed to create ${model}`, error);
    throw new AppError(`Failed to create ${model}`, error.message);
  }
};

const search = async (
  query: { page?: number; limit?: number; search?: string } = {},
): Promise<PaginationResult> => {
  try {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const searchTerm = query.search || "";
    const where = searchTerm
      ? {
          OR: [
            { username: { contains: searchTerm, mode: "insensitive" as const } },
            { email: { contains: searchTerm, mode: "insensitive" as const } },
            { name: { contains: searchTerm, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.info("search(): filter and count", {
      filter: where ?? {},
      count: users.length,
      total,
    });

    return {
      users: users as User[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error: any) {
    logger.error(`search(): Failed to search ${model}`, error);
    throw new AppError(`Failed to search ${model}`, error.message, 400);
  }
};

const getById = async (id: string): Promise<User | null> => {
  try {
    const item = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    logger.info(`getById(): ${model} fetched`, { id });
    return item as User | null;
  } catch (error: any) {
    logger.error(`getById(): Failed to get ${model}`, error);
    throw new AppError(`Failed to get ${model}`, error.message);
  }
};

const updateById = async (
  id: string,
  data: Partial<UserInput>,
): Promise<User | null> => {
  try {
    // If password is provided, hash it
    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    if (data.role_name) {
      updateData.role = data.role_name;
      delete updateData.role_name;
    }

    const item = await prisma.user.update({
      where: { id },
      data: updateData,
    });
    logger.info(`updateById(): ${model} updated`, { id });
    return item;
  } catch (error: any) {
    if (isRecordNotFound(error)) {
      return null;
    }
    logger.error(`updateById(): Failed to update ${model}`, error);
    throw new AppError(`Failed to update ${model}`, error.message);
  }
};

const deleteById = async (id: string): Promise<boolean> => {
  try {
    await prisma.user.delete({ where: { id } });
    logger.info(`deleteById(): ${model} deleted`, { id });
    return true;
  } catch (error: any) {
    if (isRecordNotFound(error)) {
      return false;
    }
    logger.error(`deleteById(): Failed to delete ${model}`, error);
    throw new AppError(`Failed to delete ${model}`, error.message);
  }
};

export { create, search, getById, updateById, deleteById };


