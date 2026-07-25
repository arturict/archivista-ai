import { HistoryWorkspace } from '@/components/history-workspace';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Documents' };

export default function DocumentsPage() {
  return <HistoryWorkspace view="documents" />;
}
