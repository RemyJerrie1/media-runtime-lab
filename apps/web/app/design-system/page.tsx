import type { Metadata } from 'next';
import { DesignSystemShowcase } from '../design-system-showcase/design-system-showcase';

export const metadata: Metadata = {
  title: '設計系統 · 媒體運行實驗室',
  description: '影音營運後台採用的色彩、字級、元件狀態與無障礙規範。',
};

export default function DesignSystemPage() {
  return <DesignSystemShowcase />;
}
