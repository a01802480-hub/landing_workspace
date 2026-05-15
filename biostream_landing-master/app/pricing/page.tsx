import type { Metadata } from 'next';
import PricingContent from './pricing-content';

export const metadata: Metadata = {
  title: 'Pricing | BioStream',
  description: 'Choose the perfect plan for your protein analysis needs. Flexible pricing for researchers and teams.',
};

export default function PricingPage() {
  return <PricingContent />;
}