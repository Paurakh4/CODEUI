import { describe, it, expect, vi, beforeEach } from 'vitest';
import NextAuth from 'next-auth';

vi.mock('next-auth', () => {
  const mockFn = vi.fn().mockReturnValue({
      handlers: {},
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
  });
  return { default: mockFn };
});

vi.mock('next-auth/providers/google', () => ({
  default: vi.fn((config) => ({ id: 'google', name: 'Google', ...config })),
}));

vi.mock('@/lib/db', () => ({
  default: vi.fn(),
}));

vi.mock('@/lib/models/User', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
  },
}));

// Import the module under test.
// import '@/lib/auth'; // Commenting out static import to use dynamic import for control

describe('Auth Configuration', () => {
  let config: any;

  beforeAll(async () => {
    vi.clearAllMocks();
    await import('@/lib/auth');
    // Capture the config passed to NextAuth
    // Ensure NextAuth was called
    if (vi.isMockFunction(NextAuth) && NextAuth.mock.calls.length > 0) {
        config = NextAuth.mock.calls[0][0];
    } else {
        throw new Error('NextAuth was not called');
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes NextAuth with Google provider', () => {
    // Check providers
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0].id).toBe('google');
  });

  it('configures custom pages', () => {
     expect(config.pages.signIn).toBe('/auth/signin');
     expect(config.pages.error).toBe('/auth/error');
  });

  it('configures session strategy to jwt', () => {
     expect(config.session.strategy).toBe('jwt');
  });

  describe('callbacks', () => {
      it('signIn creates new user if not found', async () => {
          const { signIn } = config.callbacks;
          const mockUser = { email: 'test@example.com', name: 'Test', image: 'img', id: '123' };
          const mockAccount = { provider: 'google' };
          const mockProfile = { sub: 'google-123' };
          
          const User = (await import('@/lib/models/User')).default;
          // @ts-ignore
          User.findOne.mockResolvedValue(null);
          // @ts-ignore
          User.create.mockResolvedValue({ _id: 'new-id', ...mockUser });

          const result = await signIn({ user: mockUser, account: mockAccount, profile: mockProfile });
          
          expect(result).toBe(true);
          expect(User.findOne).toHaveBeenCalledWith({ googleId: 'google-123' });
          expect(User.create).toHaveBeenCalled();
          expect(mockUser.id).toBe('new-id');
      });

      it('signIn updates existing user', async () => {
        const { signIn } = config.callbacks;
        const mockUser = { email: 'test@example.com', name: 'New Name', image: 'new-img', id: '123' };
        const mockAccount = { provider: 'google' };
        const mockProfile = { sub: 'google-123' };
        
        const existingUser = {
            _id: 'existing-id',
            name: 'Old Name',
            image: 'old-img',
            save: vi.fn(),
        };

        const User = (await import('@/lib/models/User')).default;
        // @ts-ignore
        User.findOne.mockResolvedValue(existingUser);

        const result = await signIn({ user: mockUser, account: mockAccount, profile: mockProfile });
        
        expect(result).toBe(true);
        expect(User.create).not.toHaveBeenCalled();
        expect(existingUser.name).toBe('New Name');
        expect(existingUser.save).toHaveBeenCalled();
        expect(mockUser.id).toBe('existing-id');
      });

      it('jwt callback adds user id on sign in', async () => {
          const { jwt } = config.callbacks;
          const token = {};
          const user = { id: 'user-id' };
          const account = { access_token: 'token' };
          
          const result = await jwt({ token, user, account });
          
          expect(result.id).toBe('user-id');
          expect(result.accessToken).toBe('token');
      });

      it('session callback populates user from token', () => {
          const { session } = config.callbacks;
          const token = { id: 'user-id', subscription: 'pro', credits: 100 };
          const sessionObj = { user: {} };
          
          const result = session({ session: sessionObj, token });
          
          expect(result.user.id).toBe('user-id');
          expect(result.user.subscription).toBe('pro');
          expect(result.user.credits).toBe(100);
      });

      it('authorized callback protects routes', () => {
          const { authorized } = config.callbacks;
          
          // Public route
          expect(authorized({ auth: null, request: { nextUrl: { pathname: '/' } } })).toBe(true);
          
          // Protected route, no auth
          const response = authorized({ auth: null, request: { nextUrl: { pathname: '/api/projects' } } });
          expect(response).not.toBe(true); 
          
          // Protected route, with auth
          expect(authorized({ auth: { user: {} }, request: { nextUrl: { pathname: '/api/projects' } } })).toBe(true);
      });
  });
});
