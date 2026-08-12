import type { Metadata } from 'next';
import { DesignSystemShowcase } from '../design-system-showcase/design-system-showcase';

export const metadata: Metadata = { title: 'Design System · Media Runtime Lab', description: 'Production design tokens, primitives, states, and product usage.' };

export default function DesignSystemPage() { return <DesignSystemShowcase />; }