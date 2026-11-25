import { getWarungMenuPageData } from '@/server/actions/warung.actions';
import { MenuClient } from './menu-client';

export default async function WarungMenuPage() {
  const { menus, inventory, recipes } = await getWarungMenuPageData();

  return (
    <MenuClient
      initialMenus={menus}
      inventory={inventory}
      initialRecipes={recipes}
    />
  );
}
