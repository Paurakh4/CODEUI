import { render, screen, fireEvent } from '@testing-library/react';
import { UserMenu } from '@/components/user-menu';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as nextAuthReact from 'next-auth/react';

// Mock next-auth/react
const useSessionMock = vi.fn();
const signOutMock = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
  signOut: () => signOutMock(),
}));

// Mock SignInDialog
vi.mock('@/components/sign-in-dialog', () => ({
  SignInDialog: ({ open, onOpenChange }: any) => open ? <div data-testid="signin-dialog">Dialog</div> : null,
}));

// Mock UI components
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: any) => <div data-testid="trigger">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div>{children}</div>,
  AvatarImage: ({ src, alt }: any) => <img src={src} alt={alt} />,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

describe('UserMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

  it('renders loading state', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'loading' });
    const { container } = render(<UserMenu />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders sign in button when unauthenticated', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<UserMenu />);
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('opens sign in dialog when sign in clicked', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<UserMenu />);
    fireEvent.click(screen.getByText('Sign In'));
    expect(screen.getByTestId('signin-dialog')).toBeInTheDocument();
  });

  it('renders user avatar when authenticated', () => {
    useSessionMock.mockReturnValue({ 
        data: { user: { name: 'Test User', email: 'test@example.com', image: 'img.jpg' } }, 
        status: 'authenticated' 
    });
    render(<UserMenu />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'img.jpg');
    // Dropdown content rendered in mock
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
  
  it('calls signOut when sign out clicked', () => {
    useSessionMock.mockReturnValue({ 
        data: { user: { name: 'Test User' } }, 
        status: 'authenticated' 
    });
    render(<UserMenu />);
    fireEvent.click(screen.getByText('Sign Out'));
    expect(signOutMock).toHaveBeenCalled();
  });
});
