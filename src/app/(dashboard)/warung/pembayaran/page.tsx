import { redirect } from 'next/navigation';

// Rent payment instructions and proof submission live with the tenant's lease.
export default function LegacyWarungPaymentPage(): never {
  redirect('/warung/sewa');
}
