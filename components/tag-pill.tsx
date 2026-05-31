import type { ComponentProps } from 'react';

import { Chip } from '@/components/ui/chip';

type Props = {
  tag: string;
  category: ComponentProps<typeof Chip>['category'];
  onPress: () => void;
};

// Thin wrapper kept for backwards compatibility with existing TagPanel callers.
// Forwards to the themed Chip primitive so colors flow from the design system.
export function TagPill({ tag, category, onPress }: Props) {
  return <Chip label={tag} category={category} onPress={onPress} mode="selectable" />;
}
