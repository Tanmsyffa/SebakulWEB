import { getWarungDashboard } from '@/server/actions/warung.actions';
import { requireAuth } from '@/server/guards/auth-guard';
import { WarungDashboardClient } from './warung-dashboard-client';

function getWibGreetingTime(): string {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    hour12: false,
  }).format(new Date());
  const currentHour = Number(hourStr) % 24;

  if (currentHour >= 11 && currentHour < 15) return 'siang';
  if (currentHour >= 15 && currentHour < 18) return 'sore';
  if (currentHour >= 18 || currentHour < 4) return 'malam';
  return 'pagi';
}

export default async function WarungDashboardPage() {
  const [authUser, data] = await Promise.all([requireAuth(), getWarungDashboard()]);

  const fullName = authUser.user_metadata?.full_name;
  const displayName = typeof fullName === 'string' && fullName.trim() ? fullName.trim() : 'Juragan';

  return (
    <WarungDashboardClient
      warungName={data.warung?.name || 'Warung Saya'}
      isOpenToday={data.warung?.isOpenToday ?? true}
      greetingTime={getWibGreetingTime()}
      displayName={displayName}
      todayIncome={data.todayIncome}
      todayExpense={data.todayExpense}
      todayProfit={data.todayProfit}
      cashflowChart={data.cashflowChart}
      lowStockItems={data.lowStockItems.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        unit: item.unit,
        currentStock: item.currentStock,
        minThreshold: item.minThreshold,
      }))}
      inventoryCount={data.inventoryCount}
    />
  );
}
