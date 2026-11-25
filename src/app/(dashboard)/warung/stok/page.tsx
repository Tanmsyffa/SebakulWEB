import { getWarungInventory, getWarungInventoryMovements, getWarungPurchasingData } from '@/server/actions/warung.actions';
import { StokClient } from './stok-client';

export default async function WarungStokPage() {
  const [inventory, purchasing, movements] = await Promise.all([getWarungInventory(), getWarungPurchasingData(), getWarungInventoryMovements()]);

  return <StokClient initialInventory={inventory} initialSuppliers={purchasing.suppliers} initialPurchases={purchasing.purchases} initialMovements={movements} />;
}
