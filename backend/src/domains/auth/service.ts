import { User, Provider, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import logger from "../../libraries/log/logger";
import { prisma } from "../../libraries/db";
import { AppError } from "../../libraries/error-handling/AppError";
import { sendEmail, sendEmailForResetPassword } from "../../libraries/util/verifyEmail";

const model = "user";

interface LoginInput {
  identifier: string;
  password: string;
}

interface SignupInput {
  username?: string;
  email: string;
  password: string;
  name?: string;
  number: string;
  role?: string;
}

interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    name?: string | null;
  };
}

const generateToken = (userId: string, role: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError("JWT_SECRET is not configured", "Server configuration error", 500);
  }
  return jwt.sign({ userId, role }, jwtSecret, { expiresIn: "7d" });
};

const login = async (data: LoginInput): Promise<AuthResponse> => {
  try {
    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.identifier },
          { username: data.identifier },
        ],
      },
    });

    if (!user) {
      throw new AppError("User not Found", "User not found", 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.password);
    if (!isValidPassword) {
      throw new AppError("Invalid password", "Invalid password", 401);
    }

    // Check if email is verified
    if (!user.emailVerified) {
      logger.info(`login(): Email verification required for user`, { id: user.id, email: user.email });
      throw new AppError("Email not verified", "Email not verified", 401);
    }

    // Generate token
    const token = generateToken(user.id, user.role);

    logger.info(`login(): ${model} logged in`, { id: user.id });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error(`login(): Failed to login ${model}`, error);
    throw new AppError(`Failed to login`, error.message, 500);
  }
};

const signup = async (data: SignupInput): Promise<AuthResponse> => {
  try {
    // Use name as username if username is not provided
    const username = data.username || data.name;

    if (!username) {
      throw new AppError("Username or name is required", "Either username or name must be provided", 400);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: username },
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

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user — local provider defaults to manager role
    const user = await prisma.user.create({
      data: {
        username: username,
        email: data.email,
        password: hashedPassword,
        name: data.name,
        number: data.number,
        role: Role.manager,
        provider: Provider.local,
      },
    });

    // Generate token
    const token = generateToken(user.id, user.role);

    logger.info(`signup(): ${model} created`, { id: user.id });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error(`signup(): Failed to create ${model}`, error);
    throw new AppError(`Failed to create ${model}`, error.message, 500);
  }
};

const getMe = async (userId: string): Promise<User | null> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
    logger.info(`getMe(): ${model} fetched`, { id: userId });
    return user as User | null;
  } catch (error: any) {
    logger.error(`getMe(): Failed to get ${model}`, error);
    throw new AppError(`Failed to get ${model}`, error.message);
  }
};

const sendVerificationMail = async (email: string) => {
  try {
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" })

    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`

    const isEmailSent = await sendEmail(email, verificationLink)
    if (isEmailSent) {
      return true
    } else {
      return false
    }

  } catch (error) {
    logger.error(`sendVerificationMeail(): Failed to send verification email`, error);
    throw new AppError(`Failed to send verification email`, error.message);
  }
};

const verifyEmail = async (token: string) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded) {
      throw new AppError(`Invalid token`, "Invalid token", 401)
    }
    const user = await prisma.user.findUnique({ where: { email: (decoded as { email: string }).email } })
    if (!user) {
      throw new AppError(`User not found`, "User not found", 404)
    }
    user.emailVerified = true
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } })
    return {
      message: "Email verified successfully",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
      }
    }
  } catch (error: any) {
    logger.error(`verifyEmail(): Failed to verify email`, error);
    throw new AppError(`Failed to verify email`, error.message);
  }
}


// Forget password
const forgetPassword = async (email: string) => {
  try {

    if (!email) {
      throw new AppError("Email is required", "Email is required", 400)
    }

    let user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } })

    if (!user) {
      throw new AppError("User not found", "User not found", 404)
    }

    const otp = Math.floor(100000 + Math.random() * 900000)

    const emailSent = await sendEmailForResetPassword(email, otp as number)

    if (!emailSent) {
      throw new AppError("Error sending email", "Error sending email", 500)
    }

    const token = jwt.sign(
      { otp, email, userId: user.id, userRole: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    )

    return {
      message: "Email sent successfully",
      success: true,
      token
    }
  } catch (error) {
    console.error("Forget password error:", error)
    throw new AppError("Error forgetting password", "Error forgetting password", 500)
  }
}

// Reset password
const resetPassword = async (token: string, password: string) => {
  try {

    if (!token || !password) {
      throw new AppError("Token, otp and password are required", "Token, otp and password are required", 400)
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { otp: number, email: string, userId: string, userRole: string }

    const hashedPassword = await bcrypt.hash(password, 10)

    const { userId, userRole } = decoded


    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      throw new AppError("User not found", "User not found", 404)
    }

    await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } })

    return {
      message: "Password reset successfully",
      success: true
    }
  } catch (error) {
    throw new AppError("Error resetting password", "Error resetting password", 500)
  }
}

// verify otp 
const verifyOtp = async (token: string, otp: number) => {
  try {

    if (!token || !otp) {
      throw new AppError("Token and otp are required", "Token and otp are required", 400)
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { otp: number, email: string, userId: string, userRole: string }

    if (!decoded) {
      throw new AppError("Invalid token", "Invalid token", 400)
    }

    if (Number(decoded.otp) !== Number(otp)) {
      throw new AppError("Invalid otp", "Invalid otp", 400)
    }

    return {
      message: "Otp verified successfully",
      success: true,
      userId: decoded.userId,
      userRole: decoded.userRole,
      email: decoded.email
    }
  } catch (error) {
    throw new AppError("Error verifying otp", "Error verifying otp", 500)
  }
}


/** New WhatsApp user under a manager (optional Prisma transaction client). */
async function createUserWhatsApp(input: {
    name: string;
    number: string;
    email?: string;
    parentId: string;
    tx?: any;
}) {
    const db = input.tx ?? prisma;
    return db.user.create({
        data: {
            name: input.name,
            username: input.number,
            number: input.number,
            role: Role.user,
            provider: Provider.whatsapp,
            parentId: input.parentId,
            ...(input.email ? { email: input.email } : {}),
        },
    });
}

export { login, signup, getMe, sendVerificationMail, verifyEmail, forgetPassword, resetPassword, verifyOtp, createUserWhatsApp };
