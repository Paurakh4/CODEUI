import { render, screen } from '@testing-library/react';
import { AuthSessionProvider } from '@/components/session-provider';
import { vi, describe, it, expect } from 'vitest';

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  ),
}));

describe('AuthSessionProvider', () => {
  it('renders children wrapped in SessionProvider', () => {
    render(
      <AuthSessionProvider>
        <div data-testid="child">Child</div>
      </AuthSessionProvider>
    );
    
    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
