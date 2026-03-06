import { GET } from '@/app/api/cron/reset-credits/route';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock db
vi.mock('@/lib/db', () => ({
  default: vi.fn(),
}));

// Mock models
const mocks = vi.hoisted(() => ({
  User: {
    find: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock('@/lib/models', () => ({
  User: mocks.User,
}));

describe('Credit Reset Cron Job', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 401 if unauthorized', async () => {
    const req = new Request('http://localhost:3000/api/cron/reset-credits');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('should process users due for reset', async () => {
    const req = new Request('http://localhost:3000/api/cron/reset-credits', {
      headers: { Authorization: 'Bearer test-secret' },
    });

    const mockUsers = [
      {
        _id: 'user-1',
        email: 'user1@example.com',
        subscription: { tier: 'free' },
        creditsResetDate: new Date('2024-01-01'),
      },
      {
        _id: 'user-2',
        email: 'user2@example.com',
        subscription: { tier: 'pro' },
        creditsResetDate: new Date('2024-01-01'),
      },
    ];

    const mockSelect = vi.fn().mockResolvedValue(mockUsers);
    mocks.User.find.mockReturnValue({ select: mockSelect });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.usersReset).toBe(2);

    // Verify updates
    expect(mocks.User.findByIdAndUpdate).toHaveBeenCalledTimes(2);

    // User 1 (Free) -> 20 credits
    expect(mocks.User.findByIdAndUpdate).toHaveBeenCalledWith('user-1', expect.objectContaining({
      $set: expect.objectContaining({
        monthlyCredits: 20,
      })
    }));

    // User 2 (Pro) -> 120 credits
    expect(mocks.User.findByIdAndUpdate).toHaveBeenCalledWith('user-2', expect.objectContaining({
      $set: expect.objectContaining({
        monthlyCredits: 120,
      })
    }));
  });

  it('should handle errors gracefully', async () => {
    const req = new Request('http://localhost:3000/api/cron/reset-credits', {
      headers: { Authorization: 'Bearer test-secret' },
    });

    const mockUsers = [
      {
        _id: 'user-1',
        email: 'user1@example.com',
        subscription: { tier: 'free' },
      },
    ];

    mocks.User.find.mockReturnValue({ select: vi.fn().mockResolvedValue(mockUsers) });
    mocks.User.findByIdAndUpdate.mockRejectedValue(new Error('DB Error'));

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200); // Should still return 200 overall
    expect(data.usersReset).toBe(0);
    expect(data.errors).toBe(1);
  });
});
