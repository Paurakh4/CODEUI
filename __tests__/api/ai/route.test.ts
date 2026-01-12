import { POST, PUT } from '@/app/api/ai/route';
import { NextRequest } from 'next/server';

// Mock auth
const authMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}));

// Mock ai-models
vi.mock('@/lib/ai-models', () => ({
  getModelsRecord: () => ({ 'test-model': {} }),
  isModelEnabled: () => true,
  getDefaultModelId: () => 'test-model',
}));

// Mock prompts
vi.mock('@/lib/prompts/frontend-design', () => ({
  getCombinedSystemPrompt: () => 'system prompt',
}));

describe('AI API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset fetch mock
        global.fetch = vi.fn();
        process.env.OPENROUTER_API_KEY = 'test-key';
    });

    it('POST returns 401 if user is not authenticated', async () => {
        authMock.mockResolvedValue(null);
        
        const req = new NextRequest('http://localhost:3000/api/ai', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test' }),
        });

        const res = await POST(req);
        
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('POST proceeds if user is authenticated', async () => {
        authMock.mockResolvedValue({ user: { id: 'user-id' } });
        (global.fetch as any).mockResolvedValue({
            ok: true,
            body: {
                getReader: () => ({
                    read: () => Promise.resolve({ done: true, value: undefined }),
                }),
            },
        });

        const req = new NextRequest('http://localhost:3000/api/ai', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test' }),
        });

        const res = await POST(req);
        
        expect(res.status).toBe(200);
    });

    it('PUT returns 401 if user is not authenticated', async () => {
        authMock.mockResolvedValue(null);
        
        const req = new NextRequest('http://localhost:3000/api/ai', {
            method: 'PUT',
            body: JSON.stringify({ prompt: 'test' }),
        });

        const res = await PUT(req);
        
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe('Unauthorized');
    });
});
