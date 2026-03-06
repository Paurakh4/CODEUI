import { GET, POST } from '@/app/api/projects/[id]/versions/route';
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}));

vi.mock('@/lib/db', () => ({
  default: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  Project: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  },
  Checkpoint: {
    find: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/models', () => ({
  Project: mocks.Project,
  Checkpoint: mocks.Checkpoint,
}));

describe('Project Versions API (Checkpoint-backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-id' } });
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/projects/p1/versions');
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });

    expect(res.status).toBe(401);
  });

  it('returns checkpoint versions when available', async () => {
    const projectLean = vi.fn().mockResolvedValue({ versions: [{ htmlContent: '<html>old</html>' }] });
    mocks.Project.findOne.mockReturnValue({ lean: projectLean });

    const checkpoints = [
      {
        _id: '507f1f77bcf86cd799439011',
        seq: 2,
        htmlContent: '<html>new</html>',
        description: 'AI-generated update',
        createdAt: new Date().toISOString(),
      },
    ];
    const checkpointLean = vi.fn().mockResolvedValue(checkpoints);
    const checkpointSort = vi.fn().mockReturnValue({ lean: checkpointLean });
    mocks.Checkpoint.find.mockReturnValue({ sort: checkpointSort });

    const req = new NextRequest('http://localhost:3000/api/projects/p1/versions');
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.versions).toEqual(checkpoints);
    expect(mocks.Checkpoint.find).toHaveBeenCalledWith({
      projectId: 'p1',
      userId: 'user-id',
    });
  });

  it('falls back to embedded versions when checkpoints are empty', async () => {
    const embeddedVersions = [{ _id: 'v1', htmlContent: '<html>embedded</html>' }];
    const projectLean = vi.fn().mockResolvedValue({ versions: embeddedVersions });
    mocks.Project.findOne.mockReturnValue({ lean: projectLean });

    const checkpointLean = vi.fn().mockResolvedValue([]);
    const checkpointSort = vi.fn().mockReturnValue({ lean: checkpointLean });
    mocks.Checkpoint.find.mockReturnValue({ sort: checkpointSort });

    const req = new NextRequest('http://localhost:3000/api/projects/p1/versions');
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.versions).toEqual(embeddedVersions);
  });

  it('creates checkpoint with defaults and prunes old ones', async () => {
    const updatedProjectLean = vi.fn().mockResolvedValue({ checkpointCount: 12 });
    mocks.Project.findOneAndUpdate.mockReturnValue({ lean: updatedProjectLean });
    mocks.Project.updateOne.mockResolvedValue({ acknowledged: true });

    const createdCheckpoint = {
      _id: '507f1f77bcf86cd799439099',
      projectId: 'p1',
      seq: 12,
      htmlContent: '<html>saved</html>',
      description: 'Manual checkpoint',
      kind: 'manual',
      trigger: 'manual-save',
    };
    mocks.Checkpoint.create.mockResolvedValue(createdCheckpoint);

    const staleItems = [{ _id: '507f1f77bcf86cd7994390aa' }];
    const staleLean = vi.fn().mockResolvedValue(staleItems);
    const staleSelect = vi.fn().mockReturnValue({ lean: staleLean });
    const staleSkip = vi.fn().mockReturnValue({ select: staleSelect });
    const staleSort = vi.fn().mockReturnValue({ skip: staleSkip });
    mocks.Checkpoint.find.mockReturnValue({ sort: staleSort });

    const req = new NextRequest('http://localhost:3000/api/projects/p1/versions', {
      method: 'POST',
      body: JSON.stringify({
        htmlContent: '<html>saved</html>',
        description: 'Manual checkpoint',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.version).toEqual(createdCheckpoint);
    expect(mocks.Checkpoint.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p1',
        userId: 'user-id',
        seq: 12,
        kind: 'manual',
        trigger: 'manual-save',
      })
    );
    expect(mocks.Checkpoint.deleteMany).toHaveBeenCalledWith({
      _id: { $in: ['507f1f77bcf86cd7994390aa'] },
    });
  });
});
