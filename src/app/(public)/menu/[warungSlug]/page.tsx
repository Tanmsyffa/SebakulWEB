import { notFound } from 'next/navigation';

// SEBAKUL has no customer role or customer ordering/catalog flow.
export default function PublicMenuPage(): never {
  notFound();
}
