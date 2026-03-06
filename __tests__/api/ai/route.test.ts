import { POST } from '@/app/api/ai/route';
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
    findByIdAndUpdate: vi.fn(),
  },
  UsageLog: {
    create: vi.fn(),
  },
}));

const aiModelMocks = vi.hoisted(() => ({
  getModelFallbackChain: vi.fn(),
}));

vi.mock('@/lib/models', () => ({
  User: mocks.User,
  UsageLog: mocks.UsageLog,
}));

// Mock ai-models
vi.mock('@/lib/ai-models', () => ({
  getModelsRecord: () => ({ 'test-model': {} }),
  isModelEnabled: () => true,
  getDefaultModelId: () => 'test-model',
  getModelById: () => ({ contextLength: 64000 }),
  getModelFallbackChain: (primary: string) => aiModelMocks.getModelFallbackChain(primary),
}));

// Mock prompts
vi.mock('@/lib/prompts/frontend-design', () => ({
  getCombinedSystemPrompt: () => 'system prompt',
}));
vi.mock('@/lib/prompts/reprompt-system', () => ({
  FOLLOW_UP_SYSTEM_PROMPT: 'follow up prompt',
}));

describe('AI API Route Credit System', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, OPENROUTER_API_KEY: 'test-key' };
    aiModelMocks.getModelFallbackChain.mockReturnValue(['test-model']);
    
    // Default auth mock
    authMock.mockResolvedValue({ user: { id: 'user-id', email: 'test@example.com' } });
    
    // Mock fetch for OpenRouter
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: () => Promise.resolve({ done: true, value: undefined }),
        }),
      },
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 403 if user has no credits', async () => {
    mocks.User.findById.mockResolvedValue({
      _id: 'user-id',
      email: 'test@example.com',
      monthlyCredits: 0,
      topupCredits: 0,
      subscription: { tier: 'free' },
    });

    const req = new NextRequest('http://localhost:3000/api/ai', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test prompt' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('No credits remaining');
    expect(mocks.User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('should deduct from monthly credits first', async () => {
    mocks.User.findById.mockResolvedValue({
      _id: 'user-id',
      email: 'test@example.com',
      monthlyCredits: 5,
      topupCredits: 10,
      subscription: { tier: 'free' },
    });

    const req = new NextRequest('http://localhost:3000/api/ai', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test prompt' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify deduction
    expect(mocks.User.findByIdAndUpdate).toHaveBeenCalledWith('user-id', expect.objectContaining({
      $inc: expect.objectContaining({
        monthlyCredits: -1,
        topupCredits: -0,
        totalCreditsUsed: 1
      })
    }));

    // Verify logging
    expect(mocks.UsageLog.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-id',
      creditsFromMonthly: 1,
      creditsFromTopup: 0,
    }));
  });

  it('should deduct from topup credits if monthly is 0', async () => {
    mocks.User.findById.mockResolvedValue({
      _id: 'user-id',
      email: 'test@example.com',
      monthlyCredits: 0,
      topupCredits: 10,
      subscription: { tier: 'free' },
    });

    const req = new NextRequest('http://localhost:3000/api/ai', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test prompt' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mocks.User.findByIdAndUpdate).toHaveBeenCalledWith('user-id', expect.objectContaining({
      $inc: expect.objectContaining({
        monthlyCredits: -0,
        topupCredits: -1,
      })
    }));
  });

  it('should bypass credit check for staff users', async () => {
    process.env.STAFF_CREDITS = 'staff@example.com:1000';
    
    authMock.mockResolvedValue({ user: { id: 'staff-id', email: 'staff@example.com' } });
    
    mocks.User.findById.mockResolvedValue({
      _id: 'staff-id',
      email: 'staff@example.com',
      monthlyCredits: 0,
      topupCredits: 0,
      subscription: { tier: 'free' },
    });

    const req = new NextRequest('http://localhost:3000/api/ai', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test prompt' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Should NOT deduct credits, but should increment usage
    // Wait, the implementation says:
    // creditDeduction = { fromMonthly: 1, fromTopup: 0 }
    // await User.findByIdAndUpdate(userId, { $inc: { totalCreditsUsed: 1 } })
    // It does NOT deduct from monthlyCredits for staff in the code I read?
    // Let me check lines 112-114 of app/api/ai/route.ts
    
    expect(mocks.User.findByIdAndUpdate).toHaveBeenCalledWith('staff-id', expect.objectContaining({
      $inc: { totalCreditsUsed: 1 }
    }));
    
    // Ensure we didn't deduct credits
    const updateCall = mocks.User.findByIdAndUpdate.mock.calls[0][1];
    expect(updateCall.$inc.monthlyCredits).toBeUndefined();
    expect(updateCall.$inc.topupCredits).toBeUndefined();
  });

  it('should bypass credit check for admin users', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';

    authMock.mockResolvedValue({ user: { id: 'admin-id', email: 'admin@example.com' } });

    mocks.User.findById.mockResolvedValue({
      _id: 'admin-id',
      email: 'admin@example.com',
      monthlyCredits: 0,
      topupCredits: 0,
      subscription: { tier: 'free' },
    });

    const req = new NextRequest('http://localhost:3000/api/ai', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test prompt' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mocks.User.findByIdAndUpdate).toHaveBeenCalledWith('admin-id', expect.objectContaining({
      $inc: { totalCreditsUsed: 1 }
    }));

    const updateCall = mocks.User.findByIdAndUpdate.mock.calls[0][1];
    expect(updateCall.$inc.monthlyCredits).toBeUndefined();
    expect(updateCall.$inc.topupCredits).toBeUndefined();
  });

  it('should include enhanced prompt instructions when enabled', async () => {
    mocks.User.findById.mockResolvedValue({
      _id: 'user-id',
      email: 'test@example.com',
      monthlyCredits: 5,
      topupCredits: 0,
      subscription: { tier: 'free' },
    });

    const req = new NextRequest('http://localhost:3000/api/ai', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Build a hero section',
        enhancedPrompts: true,
        primaryColor: 'emerald',
        secondaryColor: 'zinc',
        theme: 'light',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const fetchOptions = (global.fetch as any).mock.calls[0][1];
    const requestBody = JSON.parse(fetchOptions.body);
    const userMessage = requestBody.messages.find((m: any) => m.role === 'user')?.content;

    expect(userMessage).toContain('ENHANCED PROMPT MODE: ENABLED');
    expect(userMessage).toContain('Preferred theme direction: light');
    expect(userMessage).toContain('Preferred primary color family: emerald');
    expect(userMessage).toContain('Preferred secondary color family: zinc');
  });

  it('should use full-document recovery branch when recoveryMode is enabled', async () => {
    mocks.User.findById.mockResolvedValue({
      _id: 'user-id',
      email: 'test@example.com',
      monthlyCredits: 5,
      topupCredits: 0,
      subscription: { tier: 'free' },
    });

    const req = new NextRequest('http://localhost:3000/api/ai', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Update hero section copy',
        isFollowUp: true,
        recoveryMode: 'full-document',
        currentHtml: '<!DOCTYPE html><html><body><main>old</main></body></html>',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const fetchOptions = (global.fetch as any).mock.calls[0][1];
    const requestBody = JSON.parse(fetchOptions.body);
    const systemMessage = requestBody.messages.find((m: any) => m.role === 'system')?.content;
    const userMessage = requestBody.messages.find((m: any) => m.role === 'user')?.content;

    expect(systemMessage).toBe('system prompt');
    expect(userMessage).toContain('Recovery instructions: Return one COMPLETE HTML document');
    expect(userMessage).toContain('User Request: Update hero section copy');
  });

  it('should include trimmed conversation history in follow-up requests', async () => {
    mocks.User.findById.mockResolvedValue({
      _id: 'user-id',
      email: 'test@example.com',
      monthlyCredits: 5,
      topupCredits: 0,
      subscription: { tier: 'free' },
    });

    const req = new NextRequest('http://localhost:3000/api/ai', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Update the secondary CTA to match the hero button',
        isFollowUp: true,
        currentHtml: '<!DOCTYPE html><html><body><button>Buy</button></body></html>',
        conversationHistory: [
          { role: 'user', content: 'Create a pricing page' },
          { role: 'assistant', content: 'Built the pricing page with two CTAs.' },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const fetchOptions = (global.fetch as any).mock.calls[0][1];
    const requestBody = JSON.parse(fetchOptions.body);

    expect(requestBody.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'Create a pricing page' }),
        expect.objectContaining({ role: 'assistant', content: 'Built the pricing page with two CTAs.' }),
      ])
    );
  });

  it('should skip credit deduction for recovery requests', async () => {
    mocks.User.findById.mockResolvedValue({
      _id: 'user-id',
      email: 'test@example.com',
      monthlyCredits: 5,
      topupCredits: 0,
      subscription: { tier: 'free' },
    });

    const req = new NextRequest('http://localhost:3000/api/ai', {
      method: 'POST',
      headers: { 'x-codeui-recovery': '1' },
      body: JSON.stringify({
        prompt: 'Recover the update',
        isFollowUp: true,
        recoveryMode: 'full-document',
        currentHtml: '<!DOCTYPE html><html><body><main>old</main></body></html>',
        isRecoveryRequest: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mocks.User.findByIdAndUpdate).not.toHaveBeenCalledWith('user-id', expect.objectContaining({
      $inc: expect.objectContaining({ monthlyCredits: -1 })
    }));
    expect(mocks.UsageLog.create).toHaveBeenCalledWith(expect.objectContaining({
      creditsCost: 0,
      creditsFromMonthly: 0,
      creditsFromTopup: 0,
    }));
  });

  it('should reset monthly credits if reset date has passed', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday

    mocks.User.findById.mockResolvedValue({
      _id: 'user-id',
      email: 'test@example.com',
      monthlyCredits: 0,
      topupCredits: 0,
      creditsResetDate: pastDate,
      subscription: { tier: 'free' },
    });

    const req = new NextRequest('http://localhost:3000/api/ai', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test prompt' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Reset + deduction + automatic refund because the mocked stream emits no content
    expect(mocks.User.findByIdAndUpdate).toHaveBeenCalledTimes(3);
    
    // First call: Reset credits
    expect(mocks.User.findByIdAndUpdate).toHaveBeenNthCalledWith(1, 'user-id', expect.objectContaining({
      $set: expect.objectContaining({
        monthlyCredits: 20, // Free tier
      })
    }));

    // Second call: Deduct credit
    expect(mocks.User.findByIdAndUpdate).toHaveBeenNthCalledWith(2, 'user-id', expect.objectContaining({
      $inc: expect.objectContaining({
        monthlyCredits: -1,
      })
    }));
  });

  it('should fail over to fallback model when primary model has recoverable upstream error', async () => {
    aiModelMocks.getModelFallbackChain.mockReturnValue(['test-model', 'fallback-model']);

    mocks.User.findById.mockResolvedValue({
      _id: 'user-id',
      email: 'test@example.com',
      monthlyCredits: 5,
      topupCredits: 0,
      subscription: { tier: 'free' },
    });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue('primary temporarily unavailable'),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
          }),
        },
      });

    const req = new NextRequest('http://localhost:3000/api/ai', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test prompt' }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    const secondBody = JSON.parse((global.fetch as any).mock.calls[1][1].body);

    expect(firstBody.model).toBe('test-model');
    expect(secondBody.model).toBe('fallback-model');
    expect(res.headers.get('x-codeui-model-used')).toBe('fallback-model');
  });
});
