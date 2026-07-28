import { apiError, ApiError, requireApiUser } from '@/lib/server/auth';
import { manualBackendRequest } from '@/lib/server/manual-backend';
import { workspaceFor } from '@/lib/server/workspace';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const response = await manualBackendRequest(request, '/manual/options');
    if (!response.ok) return response;
    const options = await response.json() as {
      correspondents?: Array<{ id?: number; name?: string }>;
      documentTypes?: Array<{ id?: number; name?: string }>;
      users?: Array<{ id?: number; username?: string }>;
    };
    return Response.json({
      correspondents: options.correspondents || [],
      documentTypes: options.documentTypes || [],
      users: options.users || [],
      canMutate: workspaceFor(user).role !== 'viewer'
    });
  } catch (error) {
    return apiError(error instanceof ApiError ? error : new ApiError(502, 'Paperless options are unavailable.'));
  }
}
