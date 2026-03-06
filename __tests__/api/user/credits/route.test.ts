import { GET } from '@/app/api/user/credits/route';
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock auth
const authMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}));

// Mock db
vi.mock('@/lib/db', () => ({
  default: vi.fn(),
}));

// Mock models
const mocks = vi.hoisted(() => ({
  User: {
    findById: vi.fn(),
  },
  UsageLog: {
    find: vi.fn(),
  },
}));

vi.mock('@/lib/models', () => ({
  User: mocks.User,
  UsageLog: mocks.UsageLog,
}));

describe('User Credits API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-id', email: 'test@example.com' } });
  });

  it('should return 401 if not authenticated', async () => {
    authMock.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:3000/api/user/credits');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('should return user credits', async () => {
    // Mock select chain
    const mockUser = {
      _id: 'user-id',
      email: 'test@example.com',
      monthlyCredits: 15,
      topupCredits: 5,
      creditsResetDate: new Date('2024-02-01'),
      totalCreditsUsed: 10,
      subscription: { tier: 'pro' },
      credits: 20,
      creditsUsedThisMonth: 5,
    };

    const mockSelect = vi.fn().mockResolvedValue(mockUser);
    mocks.User.findById.mockReturnValue({ select: mockSelect });

    const req = new NextRequest('http://localhost:3000/api/user/credits');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(expect.objectContaining({
      monthlyCredits: 15,
      topupCredits: 5,
      totalCredits: 20,
      tier: 'pro',
      tierName: 'Pro',
      monthlyAllowance: 120, // Pro tier has 120
    }));
  });

  it('should return usage history if requested', async () => {
    const mockUser = {
      _id: 'user-id',
      email: 'test@example.com',
      subscription: { tier: 'free' },
    };
    mocks.User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(mockUser) });

    const mockUsage = [
      { timestamp: new Date(), aiModel: 'test', promptType: 'initial', creditsCost: 1 }
    ];

    // Mock UsageLog chain: find().select().sort().limit().lean()
    const mockLean = vi.fn().mockResolvedValue(mockUsage);
    const mockLimit = vi.fn().mockReturnValue({ lean: mockLean });
    const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ sort: mockSort });
    mocks.UsageLog.find.mockReturnValue({ select: mockSelect });

    const req = new NextRequest('http://localhost:3000/api/user/credits?history=true');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.recentUsage).toHaveLength(1);
    expect(mocks.UsageLog.find).toHaveBeenCalled();
  });
});
