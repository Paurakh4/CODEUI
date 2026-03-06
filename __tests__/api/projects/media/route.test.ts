import { DELETE } from '@/app/api/projects/[id]/media/[mediaId]/route';
import { GET, POST } from '@/app/api/projects/[id]/media/route';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}));

vi.mock('@/lib/db', () => ({
  default: vi.fn(),
}));

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: fsMocks.mkdir,
  writeFile: fsMocks.writeFile,
  unlink: fsMocks.unlink,
  default: {
    mkdir: fsMocks.mkdir,
    writeFile: fsMocks.writeFile,
    unlink: fsMocks.unlink,
  },
}));

const mocks = vi.hoisted(() => ({
  Project: {
    exists: vi.fn(),
  },
  MediaAsset: {
    find: vi.fn(),
    create: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
}));

vi.mock('@/lib/models', () => ({
  Project: mocks.Project,
  MediaAsset: mocks.MediaAsset,
}));

describe('Project Media API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.Project.exists.mockResolvedValue({ _id: 'p1' });
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/projects/p1/media');
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });

    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid media kind filter', async () => {
    const req = new NextRequest('http://localhost:3000/api/projects/p1/media?kind=doc');
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });

    expect(res.status).toBe(400);
  });

  it('lists media assets for a project', async () => {
    const items = [
      {
        _id: 'm1',
        projectId: 'p1',
        kind: 'image',
        originalName: 'hero.png',
        mimeType: 'image/png',
        size: 1234,
        url: '/uploads/user-id/p1/images/hero.png',
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        updatedAt: new Date('2026-03-01T10:00:00.000Z'),
      },
    ];

    const lean = vi.fn().mockResolvedValue(items);
    const sort = vi.fn().mockReturnValue({ lean });
    mocks.MediaAsset.find.mockReturnValue({ sort });

    const req = new NextRequest('http://localhost:3000/api/projects/p1/media');
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.media).toHaveLength(1);
    expect(data.media[0]).toEqual(
      expect.objectContaining({
        id: 'm1',
        kind: 'image',
        originalName: 'hero.png',
      })
    );
  });

  it('uploads a valid media file', async () => {
    const createdAsset = {
      _id: 'media-1',
      projectId: 'p1',
      kind: 'image',
      originalName: 'banner.png',
      mimeType: 'image/png',
      size: 6,
      url: '/uploads/user-id/p1/images/generated.png',
      createdAt: new Date('2026-03-01T12:00:00.000Z'),
      updatedAt: new Date('2026-03-01T12:00:00.000Z'),
    };

    mocks.MediaAsset.create.mockResolvedValue(createdAsset);

    const formData = new FormData();
    const uploadFile = new File(['123456'], 'banner.png', { type: 'image/png' });
    if (typeof uploadFile.arrayBuffer !== 'function') {
      Object.defineProperty(uploadFile, 'arrayBuffer', {
        value: vi.fn().mockResolvedValue(new TextEncoder().encode('123456').buffer),
      });
    }
    formData.append('file', uploadFile);

    const req = {
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as Request;

    const res = await POST(req, { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(fsMocks.mkdir).toHaveBeenCalled();
    expect(fsMocks.writeFile).toHaveBeenCalled();
    expect(mocks.MediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        projectId: 'p1',
        kind: 'image',
      })
    );
    expect(data.asset).toEqual(
      expect.objectContaining({
        id: 'media-1',
        kind: 'image',
      })
    );
  });

  it('deletes media asset and removes stored file', async () => {
    const deletedAsset = {
      _id: 'media-1',
      storagePath: 'uploads/user-id/p1/images/file.png',
    };

    mocks.MediaAsset.findOneAndDelete.mockReturnValue({
      lean: vi.fn().mockResolvedValue(deletedAsset),
    });

    const req = new NextRequest('http://localhost:3000/api/projects/p1/media/media-1', {
      method: 'DELETE',
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ id: 'p1', mediaId: 'media-1' }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(fsMocks.unlink).toHaveBeenCalled();
    expect(data).toEqual({ success: true });
  });
});
