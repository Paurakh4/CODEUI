import { render, screen, fireEvent } from '@testing-library/react';
import { SignInDialog } from '@/components/sign-in-dialog';
import { vi, describe, it, expect } from 'vitest';
import * as nextAuthReact from 'next-auth/react';

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

// Mock ui components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h1>{children}</h1>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

describe('SignInDialog', () => {
  it('renders when open', () => {
    render(<SignInDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Welcome to CodeUI')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<SignInDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('calls signIn with google when button clicked', () => {
    render(<SignInDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Continue with Google'));
    expect(nextAuthReact.signIn).toHaveBeenCalledWith('google', { callbackUrl: '/' });
  });
});
