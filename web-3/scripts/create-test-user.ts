#!/usr/bin/env tsx

import { db } from "~/server/db";
import { hashPassword } from "~/lib/auth/password";

async function createTestUser() {
  try {
    const email = "test@example.com";
    const password = "testpassword123";
    
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      console.log("Test user already exists:", email);
      return;
    }
    
    // Create test user
    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name: "Test User",
        emailVerified: new Date(), // Mark as verified for testing
        role: "USER",
      },
    });
    
    console.log("Test user created successfully!");
    console.log("Email:", email);
    console.log("Password:", password);
    console.log("User ID:", user.id);
  } catch (error) {
    console.error("Error creating test user:", error);
  } finally {
    await db.$disconnect();
  }
}

createTestUser();