import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { AiRecommendations } from "@/components/dashboard/ai-recommendations";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ProductTable } from "@/components/inventory/product-table";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products"],
  });

  const { data: salesData = [] } = useQuery({
    queryKey: ["/api/sales/metrics"],
  });

  // Add AI recommendations query
  const { data: aiRecommendations = [], isLoading: aiLoading } = useQuery({
    queryKey: ["/api/ai/recommendations"],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <Header title="Dashboard" subtitle="Monitor your inventory performance and AI insights" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pt-24 lg:pt-20 bg-background">
          {/* Key Metrics Cards */}
          <MetricsCards metrics={metrics} isLoading={metricsLoading} />
          
          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <SalesChart />
            <CategoryChart />
          </div>
          
          {/* AI Insights and Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <AiRecommendations 
              recommendations={aiRecommendations}
              isLoading={aiLoading}
            />
            <QuickActions />
          </div>
          
          {/* Recent Inventory */}
          <div className="bg-card rounded-lg shadow-lg border border-border">
            <div className="px-6 py-4 border-b border-border bg-card">
              <h3 className="text-lg font-semibold text-foreground">Recent Inventory</h3>
              <p className="text-sm text-muted-foreground">Latest product updates and stock levels</p>
            </div>
            <div className="bg-background">
              <ProductTable 
                products={(products as any[])?.slice(0, 5) || []} 
                isLoading={productsLoading} 
                showPagination={false} 
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}