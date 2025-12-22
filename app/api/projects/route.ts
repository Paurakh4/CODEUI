import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Example: Fetch user's projects
  const projects = [
    { id: "1", name: "My First Project", userId: session.user.id },
    { id: "2", name: "My Second Project", userId: session.user.id },
  ];

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();

  // Example: Create a new project
  const newProject = {
    id: Date.now().toString(),
    name: body.name,
    userId: session.user.id,
    createdAt: new Date().toISOString(),
  };

  return NextResponse.json({ project: newProject }, { status: 201 });
}
