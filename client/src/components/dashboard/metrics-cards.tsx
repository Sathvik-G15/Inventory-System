import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, AlertTriangle, TrendingUp, Clock } from "lucide-react";

export function MetricsCards({ metrics, isLoading }: { metrics: any; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-6">
              <Skeleton className="h-16 w-full bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Products",
      value: metrics?.totalProducts?.toLocaleString() || "0",
      change: "+12% from last month",
      changeType: "positive",
      icon: Package,
      bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
      iconColor: "text-blue-600 dark:text-blue-400",
      borderColor: "border-blue-500/20 dark:border-blue-500/30",
    },
    {
      title: "Low Stock Alerts",
      value: metrics?.lowStock?.toString() || "0",
      change: "5 new alerts",
      changeType: "warning",
      icon: AlertTriangle,
      bgColor: "bg-amber-500/10 dark:bg-amber-500/20",
      iconColor: "text-amber-600 dark:text-amber-400",
      borderColor: "border-amber-500/20 dark:border-amber-500/30",
    },
    {
      title: "Revenue Forecast",
      value: `$${(metrics?.totalRevenue || 0).toLocaleString()}`,
      change: metrics?.revenueGrowth != null ? `${metrics.revenueGrowth}% predicted growth` : "",
      changeType: "positive",
      icon: TrendingUp,
      bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      borderColor: "border-emerald-500/20 dark:border-emerald-500/30",
    },
    {
      title: "Expiring Soon",
      value: metrics?.expiringSoon?.toString() || "0",
      change: "Within next 7 days",
      changeType: "danger",
      icon: Clock,
      bgColor: "bg-red-500/10 dark:bg-red-500/20",
      iconColor: "text-red-600 dark:text-red-400",
      borderColor: "border-red-500/20 dark:border-red-500/30",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, index) => {
        const Icon = card.icon;
        
        return (
          <Card key={index} className="bg-card border border-border hover:border-border/80 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`w-12 h-12 ${card.bgColor} border ${card.borderColor} rounded-lg flex items-center justify-center`}>
                    <Icon className={`${card.iconColor} w-6 h-6`} />
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1" data-testid={`metric-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {card.value}
                  </p>
                  <p className={`text-sm mt-1 ${
                    card.changeType === 'positive' 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : card.changeType === 'warning'
                      ? 'text-amber-600 dark:text-amber-400'
                      : card.changeType === 'danger'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                  }`}>
                    {card.change}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
