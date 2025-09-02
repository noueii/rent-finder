import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { 
  hashPassword, 
  validatePassword, 
  generateVerificationCode 
} from "~/lib/auth/password";
import { UserRepository } from "~/server/repositories/implementations/user.repository";

export interface IAuthService {
  register(email: string, password: string, name?: string): Promise<{
    success: boolean;
    message: string;
    userId: string;
    email: string;
    verificationCode?: string;
  }>;
  
  verifyEmail(email: string, code: string): Promise<{
    success: boolean;
    message: string;
  }>;
  
  requestPasswordReset(email: string): Promise<{
    success: boolean;
    message: string;
    resetCode?: string;
  }>;
  
  resetPassword(email: string, token: string, newPassword: string): Promise<{
    success: boolean;
    message: string;
  }>;
  
  checkEmailAvailability(email: string): Promise<{
    available: boolean;
  }>;
}

export class AuthService implements IAuthService {
  private userRepository: UserRepository;
  
  constructor(private readonly db: PrismaClient) {
    this.userRepository = new UserRepository(db);
  }
  
  async register(email: string, password: string, name?: string) {
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: passwordValidation.errors.join(", "),
      });
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "User with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await this.userRepository.create({
      email,
      password: hashedPassword,
      name: name ?? null,
      emailVerified: null,
      image: null,
    });

    // Generate verification token
    const verificationCode = generateVerificationCode();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24); // 24 hour expiry

    await this.db.verificationToken.create({
      data: {
        identifier: email,
        token: verificationCode,
        expires,
      },
    });

    // TODO: Send verification email
    // For now, return the code (remove in production)
    return {
      success: true,
      message: "User registered successfully. Please verify your email.",
      userId: user.id,
      email: user.email,
      verificationCode: verificationCode, // Remove in production
    };
  }
  
  async verifyEmail(email: string, code: string) {
    // Find verification token
    const verificationToken = await this.db.verificationToken.findFirst({
      where: {
        identifier: email,
        token: code,
        expires: {
          gte: new Date(),
        },
      },
    });

    if (!verificationToken) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid or expired verification code",
      });
    }

    // Update user email verification status
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    await this.userRepository.update(user.id, {
      emailVerified: new Date(),
    });

    // Delete used verification token
    await this.db.verificationToken.delete({
      where: {
        token: verificationToken.token,
      },
    });

    return {
      success: true,
      message: "Email verified successfully",
    };
  }
  
  async requestPasswordReset(email: string) {
    // Find user
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists
      return {
        success: true,
        message: "If the email exists, a reset link has been sent",
      };
    }

    // Generate reset token
    const resetToken = generateVerificationCode();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour expiry

    await this.db.verificationToken.create({
      data: {
        identifier: `reset:${email}`,
        token: resetToken,
        expires,
      },
    });

    // TODO: Send password reset email
    // For now, return the code (remove in production)
    return {
      success: true,
      message: "If the email exists, a reset link has been sent",
      resetCode: resetToken, // Remove in production
    };
  }
  
  async resetPassword(email: string, token: string, newPassword: string) {
    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: passwordValidation.errors.join(", "),
      });
    }

    // Find reset token
    const resetToken = await this.db.verificationToken.findFirst({
      where: {
        identifier: `reset:${email}`,
        token,
        expires: {
          gte: new Date(),
        },
      },
    });

    if (!resetToken) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid or expired reset token",
      });
    }

    // Find user
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    await this.userRepository.update(user.id, {
      password: hashedPassword,
    });

    // Delete used reset token
    await this.db.verificationToken.delete({
      where: {
        token: resetToken.token,
      },
    });

    return {
      success: true,
      message: "Password reset successfully",
    };
  }
  
  async checkEmailAvailability(email: string) {
    const user = await this.userRepository.findByEmail(email);
    return {
      available: !user,
    };
  }
}