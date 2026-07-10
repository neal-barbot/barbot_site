import { createFileRoute } from '@tanstack/react-router'; import { AiSupportWorkspacePage } from '@/components/ai-support-workspace';
export const Route = createFileRoute('/settings/chatbots/$chatbotId/knowledge/text-snippets')({ component: () => <AiSupportWorkspacePage chatbotId={Route.useParams().chatbotId} page="text-snippets" /> });
