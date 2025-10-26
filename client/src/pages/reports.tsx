import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from 'date-fns';
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRange } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from "recharts";
import { Download, TrendingUp, Package, DollarSign, Calendar, PackageX } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SalesData {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  revenue: number;
  date: string;
  previousStock: number;
  newStock: number;
  currentStock: number;
  stockLevel: number;
}

interface Product {
  id: string;
  _id?: string;
  name: string;
  stockLevel: number;
  price: number;
  category: string;
  categoryName?: string;
  sku: string;
  minStockLevel: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  stockValue?: number;
}

interface SalesMetrics {
  totalRevenue: number;
  totalQuantity: number;
  totalOrders: number;
  avgOrderValue: number;
  topSellingProduct: {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  } | null;
  totalInventoryValue: number;
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}

// Fetch sales data from API
const fetchSalesData = async (): Promise<SalesData[]> => {
  const response = await fetch('/api/sales');
  if (!response.ok) {
    throw new Error('Failed to fetch sales data');
  }
  return response.json();
};

// Fetch products data from API
const fetchProductsData = async (): Promise<Product[]> => {
  const response = await fetch('/api/products');
  if (!response.ok) {
    throw new Error('Failed to fetch products data');
  }
  const products = await response.json();
  return products.map((p: any) => ({
    id: p._id || p.id,
    name: p.name,
    stockLevel: p.stockLevel || 0,
    price: p.price || 0,
    category: p.category?.name || p.categoryName || 'Uncategorized',
    sku: p.sku,
    minStockLevel: p.minStockLevel || 10,
    status: p.stockLevel <= (p.minStockLevel || 10) ? 'Low Stock' : 'In Stock'
  }));
};

export default function Reports() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(2024, 0, 1),
    to: new Date(),
  });
  const [reportType, setReportType] = useState("overview");

  const { toast } = useToast();
  
  // Fetch sales and products data
  const { data: salesData = [], isLoading: isSalesLoading, error: salesError } = useQuery<SalesData[]>({
    queryKey: ['/api/sales'],
    queryFn: fetchSalesData,
  });

  const { data: productsData = [], isLoading: isProductsLoading, error: productsError } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    queryFn: fetchProductsData,
  });

  const isLoading = isSalesLoading || isProductsLoading;
  const error = salesError || productsError;

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  // Create a map of productId to product for quick lookup
  const productsMap = useMemo(() => {
    const map = new Map<string, any>();
    productsData.forEach((product: any) => {
      map.set(product._id, {
        id: product._id,
        name: product.name,
        category: product.category?.name || 'Uncategorized',
        price: product.price || 0,
        stockLevel: product.stockLevel || 0
      });
    });
    return map;
  }, [productsData]);

  // Transform and filter sales data based on date range
  const salesHistory = useMemo(() => {
    if (!salesData || !Array.isArray(salesData)) return [];
    
    return salesData
      .filter(sale => {
        const saleDate = new Date(sale.date);
        const from = dateRange.from ? new Date(dateRange.from) : null;
        const to = dateRange.to ? new Date(dateRange.to) : null;
        
        if (from && saleDate < from) return false;
        if (to) {
          // Include the entire end date
          const endOfDay = new Date(to);
          endOfDay.setHours(23, 59, 59, 999);
          if (saleDate > endOfDay) return false;
        }
        return true;
      })
      .map(sale => {
        const product = productsMap.get(sale.productId) || {
          name: sale.productName,
          category: 'Uncategorized'
        };
        
        return {
          ...sale,
          date: new Date(sale.date),
          productName: product.name,
          category: product.category
        };
      });
  }, [salesData, dateRange, productsMap]);

  // Process products data with calculated values
  const processedProducts = useMemo(() => {
    return (productsData || []).map((product: any) => {
      const stockLevel = product.stockLevel || 0;
      const minStockLevel = product.minStockLevel || 10;
      const price = product.price || 0;
      const stockValue = price * stockLevel;
      
      let status: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
      if (stockLevel <= 0) {
        status = 'Out of Stock';
      } else if (stockLevel <= minStockLevel) {
        status = 'Low Stock';
      }
      
      return {
        ...product,
        id: product._id || product.id,
        name: product.name,
        stockLevel,
        price,
        category: product.category?.name || product.categoryName || 'Uncategorized',
        sku: product.sku || '',
        minStockLevel,
        stockValue,
        status
      };
    });
  }, [productsData]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const filteredSales = (salesData || []).filter((sale: SalesData) => {
      const saleDate = new Date(sale.date);
      const from = dateRange.from ? new Date(dateRange.from) : null;
      const to = dateRange.to ? new Date(dateRange.to) : null;
      
      if (from && saleDate < from) return false;
      if (to) {
        const endOfDay = new Date(to);
        endOfDay.setHours(23, 59, 59, 999);
        if (saleDate > endOfDay) return false;
      }
      return true;
    });

    const totalRevenue = filteredSales.reduce((sum: number, sale: SalesData) => sum + (sale.revenue || 0), 0);
    const totalQuantity = filteredSales.reduce((sum: number, sale: SalesData) => sum + (sale.quantity || 0), 0);
    const totalOrders = new Set(filteredSales.map((sale: SalesData) => sale.id)).size;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate inventory metrics from products data
    const totalInventoryValue = processedProducts.reduce((sum: number, product: Product) => 
      sum + (product.stockValue || 0), 0);
    const lowStockProducts = processedProducts.filter((p: Product) => p.status === 'Low Stock').length;
    const outOfStockProducts = processedProducts.filter((p: Product) => p.status === 'Out of Stock').length;

    // Find top selling product
    const productSales = filteredSales.reduce((acc: Record<string, { id: string; name: string; quantity: number; revenue: number }>, sale: SalesData) => {
      const productId = sale.productId || '';
      acc[productId] = acc[productId] || { 
        id: productId, 
        name: sale.productName || 'Unknown Product', 
        quantity: 0, 
        revenue: 0 
      };
      acc[productId].quantity += sale.quantity || 0;
      acc[productId].revenue += sale.revenue || 0;
      return acc;
    }, {});

    const topSellingProduct = Object.values(productSales).sort((a, b) => (b?.revenue || 0) - (a?.revenue || 0))[0] || null;

    return {
      totalRevenue,
      totalQuantity,
      totalOrders,
      avgOrderValue,
      topSellingProduct,
      totalInventoryValue,
      totalProducts: processedProducts.length,
      lowStockProducts,
      outOfStockProducts
    };
  }, [salesData, processedProducts, dateRange]);

  const exportReport = (type: string) => {
    const date = format(new Date(), 'yyyy-MM-dd');
    let csvContent = 'Product Name,Quantity,Price,Revenue,Date\n';
    
    // Add sales data to CSV
    salesHistory.forEach(sale => {
      csvContent += `"${sale.productName}",${sale.quantity},${sale.price},${sale.revenue},${format(sale.date, 'yyyy-MM-dd')}\n`;
    });
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 lg:pl-64 pt-16">
        <Header 
          title="Reports & Analytics" 
          subtitle="Comprehensive business intelligence and performance analytics"
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Tabs defaultValue="overview" className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Label htmlFor="dateRange" className="text-sm font-medium">Date Range</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="date"
                    value={dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : undefined;
                      setDateRange({
                        ...dateRange,
                        from: date
                      });
                    }}
                    className="flex-1"
                    max={dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined}
                  />
                  <div className="flex items-center px-2">to</div>
                  <Input
                    type="date"
                    value={dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : undefined;
                      setDateRange({
                        ...dateRange,
                        to: date
                      });
                    }}
                    className="flex-1"
                    min={dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined}
                  />
                </div>
              </div>
              
              <div className="w-full lg:w-1/3">
                <Label htmlFor="reportType" className="text-sm font-medium">Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overview">Overview</SelectItem>
                    <SelectItem value="sales">Sales Report</SelectItem>
                    <SelectItem value="inventory">Inventory Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  className="flex items-center gap-2"
                  onClick={() => exportReport(reportType)}
                >
                  <Download className="w-4 h-4" />
                  Export Report
                </Button>
              </div>
            </div>
            
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sales">Sales Report</TabsTrigger>
              <TabsTrigger value="inventory">Inventory Report</TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sales Report</CardTitle>
                  <CardDescription>Detailed sales data for the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border
                  ">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesData.length > 0 ? (
                          salesData
                            .filter(sale => {
                              const saleDate = new Date(sale.date);
                              const from = dateRange.from ? new Date(dateRange.from) : null;
                              const to = dateRange.to ? new Date(dateRange.to) : null;
                              
                              if (from && saleDate < from) return false;
                              if (to) {
                                const endOfDay = new Date(to);
                                endOfDay.setHours(23, 59, 59, 999);
                                if (saleDate > endOfDay) return false;
                              }
                              return true;
                            })
                            .map((sale) => (
                              <TableRow key={sale.id}>
                                <TableCell className="font-medium">
                                  {format(new Date(sale.date), 'MMM dd, yyyy')}
                                </TableCell>
                                <TableCell>{sale.productName}</TableCell>
                                <TableCell className="text-right">{sale.quantity}</TableCell>
                                <TableCell className="text-right">
                                  ${sale.price.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right">
                                  ${sale.revenue.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4">
                              {isLoading ? 'Loading sales data...' : 'No sales data available'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ${metrics.totalRevenue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {metrics.totalOrders} total orders
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Products in Stock</p>
                        <p className="text-2xl font-bold text-foreground">
                          {metrics.totalProducts - metrics.outOfStockProducts}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          of {metrics.totalProducts} total products
                        </p>
                      </div>
                      <Package className="w-8 h-8 text-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Units Sold</p>
                        <p className="text-2xl font-bold text-foreground">
                          {metrics.totalQuantity.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {metrics.topSellingProduct ? 
                            `Top: ${metrics.topSellingProduct.name}` : 'No sales data'}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Avg Order Value</p>
                        <p className="text-2xl font-bold text-foreground">
                          ${metrics.avgOrderValue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Sales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {salesHistory.slice(0, 5).map((sale) => (
                        <div key={sale.id} className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">{sale.productName}</p>
                            <p className="text-sm text-muted-foreground">{sale.category}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">${sale.revenue.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">
                              {sale.quantity} units
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Low Stock Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {processedProducts
                        .filter((p: Product) => p.status === 'Low Stock' || p.status === 'Out of Stock')
                        .sort((a, b) => a.stockLevel - b.stockLevel)
                        .slice(0, 5)
                        .map((product: Product) => (
                          <div key={product.id} className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-medium leading-none">{product.name}</p>
                              <p className="text-sm text-muted-foreground">{product.category}</p>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${product.status === 'Out of Stock' ? 'text-red-500' : 'text-amber-500'}`}>
                                {product.stockLevel} in stock
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {product.status}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-blue-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        Total Inventory Value
                      </CardTitle>
                      <DollarSign className="h-4 w-4 text-blue-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${metrics.totalInventoryValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Across {metrics.totalProducts} products
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-amber-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        Low Stock Items
                      </CardTitle>
                      <Package className="h-4 w-4 text-amber-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-500">
                      {metrics.lowStockProducts}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics.totalProducts > 0 ? 
                        Math.round((metrics.lowStockProducts / metrics.totalProducts) * 100) : 0}% of inventory
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-red-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        Out of Stock
                      </CardTitle>
                      <PackageX className="h-4 w-4 text-red-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-500">
                      {metrics.outOfStockProducts}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics.totalProducts > 0 ? 
                        Math.round((metrics.outOfStockProducts / metrics.totalProducts) * 100) : 0}% of inventory
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-green-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        Healthy Stock
                      </CardTitle>
                      <Package className="h-4 w-4 text-green-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-500">
                      {metrics.totalProducts - metrics.lowStockProducts - metrics.outOfStockProducts}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics.totalProducts > 0 ? 
                        100 - Math.round(((metrics.lowStockProducts + metrics.outOfStockProducts) / metrics.totalProducts) * 100) : 0}% of inventory
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6">
                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Inventory Health</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
                          In Stock
                        </span>
                        <span className="flex items-center">
                          <span className="w-3 h-3 rounded-full bg-amber-500 mr-1"></span>
                          Low Stock
                        </span>
                        <span className="flex items-center">
                          <span className="w-3 h-3 rounded-full bg-red-500 mr-1"></span>
                          Out of Stock
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { 
                                name: 'In Stock', 
                                value: metrics.totalProducts - metrics.lowStockProducts - metrics.outOfStockProducts, 
                                color: '#10B981' 
                              },
                              { 
                                name: 'Low Stock', 
                                value: metrics.lowStockProducts, 
                                color: '#F59E0B' 
                              },
                              { 
                                name: 'Out of Stock', 
                                value: metrics.outOfStockProducts, 
                                color: '#EF4444' 
                              },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {[
                              { name: 'In Stock', color: '#10B981' },
                              { name: 'Low Stock', color: '#F59E0B' },
                              { name: 'Out of Stock', color: '#EF4444' },
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="border-b">
                    <CardTitle className="text-lg">Top Valuable Items</CardTitle>
                    <p className="text-sm text-muted-foreground">By total inventory value</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[...processedProducts]
                        .sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0))
                        .slice(0, 5)
                        .map((product: Product) => (
                          <div key={product.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-medium leading-none">{product.name}</p>
                                <p className="text-xs text-muted-foreground">{product.category}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">
                                ${(product.stockValue || 0).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {product.stockLevel} units
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}