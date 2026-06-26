import { envConfigs } from '@/config';
import { workspaceDir } from './workspace';

interface Project {
  id: string;
  name: string;
  path: string;
}

interface ProjectsResponse {
  projects: Project[];
}

export async function ensureAgentProject(userId: string): Promise<{ workspaceId: string }> {
  const docsPath = `${workspaceDir(userId)}/docs`;
  const baseUrl = envConfigs.pi_agent_web_url;

  const listRes = await fetch(`${baseUrl}/api/projects`);
  if (!listRes.ok) {
    throw new Error(`pi-agent-web project list failed: ${listRes.status}`);
  }
  const { projects } = (await listRes.json()) as ProjectsResponse;
  const existing = projects.find((p) => p.path === docsPath);
  if (existing) {
    return { workspaceId: `u_${userId}` };
  }

  const createRes = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: `User ${userId}`, path: docsPath }),
  });
  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    throw new Error(`pi-agent-web project create failed: ${createRes.status} ${text}`);
  }

  return { workspaceId: `u_${userId}` };
}
