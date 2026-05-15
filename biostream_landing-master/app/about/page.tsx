import type { Metadata } from 'next';
import AboutContent from './about-content';

export const metadata: Metadata = {
  title: 'About | BioStream',
  description: 'Learn about our mission to revolutionize protein analysis and meet the team behind BioStream.',
};

export default function AboutPage() {
  return <AboutContent />;
}