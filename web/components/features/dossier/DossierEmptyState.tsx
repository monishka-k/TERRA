import { EmptyState } from '@/components/common/EmptyState';

export interface DossierEmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export const DossierEmptyState = ({
  title = 'No cell selected',
  description = 'Click a hexagon on the map to open its dossier: score, coverage provenance, and the inundation, HAND, slope and cropland drivers behind it.',
  className = '',
}: DossierEmptyStateProps) => (
  <EmptyState title={title} description={description} className={className} />
);
