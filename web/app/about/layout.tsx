import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About SETU-DRR | Relocation & Hazard Decision Support',
  description:
    'Building safer decisions for a changing world. We turn complex disaster data into clear, actionable decisions — helping communities prepare, adapt, and find safer places to call home.',
  openGraph: {
    title: 'About SETU-DRR | Relocation & Hazard Decision Support',
    description:
      'Building safer decisions for a changing world. We turn complex disaster data into clear, actionable decisions.',
    images: ['/images/about/about-backdrop.jpg'],
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
