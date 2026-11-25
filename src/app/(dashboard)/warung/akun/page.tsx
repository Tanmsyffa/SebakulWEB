import { redirect } from 'next/navigation';

// This route remains only as a safe redirect for old bookmarks. SEBAKUL has
// three application roles and no separate staff account role.
export default function LegacyStaffRoute() {
  redirect('/warung');
}
