import type { Metadata } from 'next';
import DocsContent from './docs-content';

export const metadata: Metadata = {
  title: 'Documentation | BioStream',
  description: 'Comprehensive guides and API references for BioStream protein analysis platform.',
};

export default function DocsPage() {
  return <DocsContent />;
}