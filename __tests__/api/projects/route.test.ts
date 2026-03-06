import { POST } from '@/app/api/projects/route';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}));

vi.mock('@/lib/db', () => ({
  default: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  User: {
    findById: vi.fn(),
  },
  Project: {
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/models', () => ({
  User: mocks.User,
  Project: mocks.Project,
}));

describe('Projects API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-id', email: 'test@example.com' } });

    mocks.User.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          subscription: { tier: 'free' },
        }),
      }),
    });

    mocks.Project.countDocuments.mockResolvedValue(0);
    mocks.Project.create.mockResolvedValue({
      _id: 'project-id',
      name: 'Untitled Project',
      emoji: '🎨',
      htmlContent: '',
      isPrivate: true,
      views: 0,
      likes: 0,
      createdAt: new Date('2026-03-03T00:00:00.000Z'),
      updatedAt: new Date('2026-03-03T00:00:00.000Z'),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      body: JSON.stringify({ id: 'p1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('blocks free users at 4 active projects', async () => {
    mocks.Project.countDocuments.mockResolvedValue(4);

    const req = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      body: JSON.stringify({ id: 'p1' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('FREE_PROJECT_LIMIT_REACHED');
    expect(mocks.Project.create).not.toHaveBeenCalled();
  });

  it('allows pro users regardless of project count', async () => {
    mocks.User.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          subscription: { tier: 'pro' },
        }),
      }),
    });
    mocks.Project.countDocuments.mockResolvedValue(99);

    const req = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      body: JSON.stringify({ id: 'p2', name: 'Pro Project' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mocks.Project.create).toHaveBeenCalled();
    expect(mocks.Project.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pro Project' })
    );
  });

  it('allows admin users on free tier regardless of project count', async () => {
    process.env.ADMIN_EMAILS = 'test@example.com';

    mocks.Project.countDocuments.mockResolvedValue(99);

    const req = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      body: JSON.stringify({ id: 'p-admin', name: 'Admin Project' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mocks.Project.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Admin Project' })
    );

    delete process.env.ADMIN_EMAILS;
  });

  it('derives project name from prompt when name is not provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        id: 'p3',
        prompt: 'Create a modern analytics dashboard with charts and KPIs.',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mocks.Project.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Modern Analytics Dashboard' })
    );
  });
});
