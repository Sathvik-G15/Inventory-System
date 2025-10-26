import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { MoreHorizontal } from "lucide-react";

// Color palette that works well in both light and dark modes
const COLORS = [
  'hsl(var(--primary))', // primary
  'hsl(var(--secondary))', // secondary
  'hsl(var(--destructive))', // destructive
  'hsl(var(--chart-3))', // warning
  'hsl(var(--chart-4))', // success
  'hsl(var(--chart-5))', // info
  'hsl(var(--chart-1))', // chart-1
  'hsl(var(--chart-2))', // chart-2
];

export function CategoryChart() {
  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: salesData = [] } = useQuery({
    queryKey: ["/api/sales", { days: 30 }],
  });

  // Calculate revenue by category
  const categoryRevenue: any = {};
  
  // Initialize category revenues
  (categories as any[]).forEach((category: any) => {
    categoryRevenue[category.id] = {
      name: category.name,
      revenue: 0,
    };
  });

  // Sum revenue by category
  (salesData as any[]).forEach((sale: any) => {
    const product = (products as any[]).find((p: any) => p.id === sale.productId);
    if (product && product.categoryId && categoryRevenue[product.categoryId]) {
      categoryRevenue[product.categoryId].revenue += parseFloat(sale.revenue);
    }
  });

  // Convert to chart data
  const chartData = Object.values(categoryRevenue)
    .filter((category: any) => category.revenue > 0)
    .map((category: any, index: number) => ({
      ...category,
      color: COLORS[index % COLORS.length],
      percentage: 0, // Will be calculated after we have total
    }));

  const totalRevenue = chartData.reduce((sum: number, category: any) => sum + category.revenue, 0);
  
  // Calculate percentages
  chartData.forEach((category: any) => {
    category.percentage = totalRevenue > 0 ? (category.revenue / totalRevenue * 100) : 0;
  });

  const CustomTooltip = ({ active, payload }: { active: any; payload: any }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover p-3 border border-border rounded-lg shadow-xl">
          <p className="font-medium text-popover-foreground">{data.name}</p>
          <p className="text-primary">${data.revenue.toLocaleString()}</p>
          <p className="text-muted-foreground">{data.percentage.toFixed(1)}% of total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Category Performance</CardTitle>
            <CardDescription className="text-muted-foreground">
              Revenue distribution by product category
            </CardDescription>
          </div>
          <button 
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="More options"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {chartData.map((entry: any, index: number) => (
                    <linearGradient 
                      key={`gradient-${index}`} 
                      id={`gradient-${index}`} 
                      x1="0" 
                      y1="0" 
                      x2="0" 
                      y2="1"
                    >
                      <stop offset="0%" stopColor={entry.color} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="revenue"
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                >
                  {chartData.map((entry: any, index: number) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`url(#gradient-${index})`} 
                      stroke="hsl(var(--border))"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: '0.75rem',
                    paddingLeft: '1rem',
                  }}
                  formatter={(value, entry: any, index) => (
                    <span className="text-foreground text-sm">
                      {value} ({chartData[index]?.percentage.toFixed(1)}%)
                    </span>
                  )}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium mb-2">No sales data</p>
                <p className="text-sm">Category performance will appear when sales are recorded</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
