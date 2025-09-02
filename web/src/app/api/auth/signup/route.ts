import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '~/lib/db';
import { z } from 'zod';

const signUpSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6),
  name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const result = signUpSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, username, password, name } = result.data;

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { 
          error: existingUser.email === email 
            ? 'Email already registered' 
            : 'Username already taken' 
        },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with default lists and preferences
    const user = await db.user.create({
      data: {
        email,
        username,
        passwordHash,
        name,
        // Create default lists for the user
        userLists: {
          create: [
            { name: 'Saved', type: 'saved' },
            { name: 'Starred', type: 'starred' },
            { name: 'Liked', type: 'liked' },
            { name: 'Blocked', type: 'blocked' },
          ],
        },
        // Create default preferences
        preferences: {
          create: {},
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}