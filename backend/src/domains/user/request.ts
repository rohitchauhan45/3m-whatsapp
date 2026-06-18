import { z } from "zod";
import { isCuid } from "../../libraries/util/id";

const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be less than 50 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role_name: z.string().min(1, "Role is required"),
  name: z.string().max(100, "Name must be less than 100 characters").optional(),
});

const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role_name: z.string().optional(),
  name: z.string().max(100).optional(),
});

const idSchema = z.object({
  id: z.string().refine((value) => isCuid(value), {
    message: "Invalid CUID format",
  }),
});

const querySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  search: z.string().optional(),
});

export { createUserSchema, updateUserSchema, idSchema, querySchema };


