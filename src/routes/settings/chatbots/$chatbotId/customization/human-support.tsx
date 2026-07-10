import { createFileRoute } from '@tanstack/react-router'; import { AiSupportWorkspacePage } from '@/components/ai-support-workspace';
export const Route = createFileRoute('/settings/chatbots/$chatbotId/customization/human-support')({ component: () => <AiSupportWorkspacePage chatbotId={Route.useParams().chatbotId} page="human-support" /> });
