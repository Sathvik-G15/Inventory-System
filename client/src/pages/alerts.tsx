import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, Clock, Package, CheckCircle, RefreshCw, Calendar } from "lucide-react";

export default function Alerts() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["/api/alerts"],
  });

  // Add debugging and error handling for low stock products
  const { 
    data: lowStockProducts = [], 
    isLoading: lowStockLoading, 
    error: lowStockError,
    refetch: refetchLowStock 
  } = useQuery({
    queryKey: ["/api/products/alerts/low-stock"],
    onSuccess: (data) => {
      console.log('Low stock products data:', data);
    },
    onError: (error: any) => {
      console.error('Error fetching low stock products:', error);
      if (error?.status === 401) {
        toast({
          title: "Authentication required",
          description: "Please log in to view alerts",
          variant: "destructive",
        });
      }
    }
  });

  const { 
    data: expiringProducts = [], 
    isLoading: expiringLoading,
    error: expiringError 
  } = useQuery({
    queryKey: ["/api/products/alerts/expiring"],
  });

  const generateAlertsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/alerts/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/alerts/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/alerts/expiring"] });
      toast({
        title: "Alerts refreshed",
        description: "System alerts have been updated with current data.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to refresh alerts",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: (alertId: string) => apiRequest("PUT", `/api/alerts/${alertId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert marked as read",
        description: "The alert has been acknowledged.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to mark alert as read",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
      case 'low': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return Package;
      case 'expiry': return Calendar;
      default: return AlertTriangle;
    }
  };

  const unreadAlerts = (alerts as any[]).filter((alert: any) => !alert.isRead);
  const criticalAlerts = (alerts as any[]).filter((alert: any) => alert.severity === 'critical');

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) return 'Today';
      if (diffInDays === 1) return 'Tomorrow';
      if (diffInDays < 0) return `${Math.abs(diffInDays)} days ago`;
      return `in ${diffInDays} days`;
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Debug info
  console.log('Alerts page state:', {
    user: user,
    lowStockProducts: lowStockProducts,
    lowStockCount: (lowStockProducts as any[]).length,
    lowStockError: lowStockError,
    expiringProducts: expiringProducts,
    expiringCount: (expiringProducts as any[]).length,
    alerts: alerts,
    alertsCount: (alerts as any[]).length
  });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <Header 
          title="Expiry & Stock Alerts" 
          subtitle="Monitor critical inventory alerts for low stock and expiring products"
        />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pt-24 lg:pt-20">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Alerts</p>
                    <p className="text-2xl font-bold text-foreground">{(alerts as any[]).length}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Unread</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{unreadAlerts.length}</p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Critical</p>
                    <p className="text-2xl font-bold text-destructive">{criticalAlerts.length}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Low Stock Items</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{(lowStockProducts as any[]).length}</p>
                  </div>
                  <Package className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-foreground">Alert Management</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  refetchLowStock();
                  queryClient.invalidateQueries({ queryKey: ["/api/products/alerts/expiring"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
                }}
                disabled={lowStockLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${lowStockLoading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
              <Button
                onClick={() => generateAlertsMutation.mutate()}
                disabled={generateAlertsMutation.isPending}
              >
                {generateAlertsMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Generate Alerts
              </Button>
            </div>
          </div>

          <Tabs defaultValue="all" className="space-y-6">
            <TabsList>
              <TabsTrigger value="all">All Alerts</TabsTrigger>
              <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
              <TabsTrigger value="expiring">Expiring Products</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle>System Alerts</CardTitle>
                  <CardDescription>
                    All active alerts requiring your attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="bg-muted rounded-lg h-16 animate-pulse" />
                      ))}
                    </div>
                  ) : (alerts as any[]).length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No active alerts</h3>
                      <p className="text-muted-foreground mb-4">
                        All systems are running normally. Check back later for updates.
                      </p>
                      <Button onClick={() => generateAlertsMutation.mutate()}>
                        Generate Alerts
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(alerts as any[]).map((alert: any) => {
                        const Icon = getAlertIcon(alert.type);
                        return (
                          <div
                            key={alert._id || alert.id}
                            className={`border rounded-lg p-4 ${alert.isRead ? 'opacity-60' : ''} hover:border-blue-300 dark:hover:border-blue-700 transition-colors`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <Icon className="w-5 h-5 text-orange-600 mt-0.5" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-foreground">{alert.title}</h4>
                                    <Badge className={getSeverityColor(alert.severity)}>
                                      {alert.severity}
                                    </Badge>
                                    {!alert.isRead && (
                                      <Badge variant="secondary" className="text-xs">
                                        New
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-muted-foreground text-sm mb-2">{alert.message}</p>
                                  <p className="text-xs text-muted-foreground/70">
                                    {new Date(alert.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              
                              {!alert.isRead && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markAsReadMutation.mutate(alert._id || alert.id)}
                                  disabled={markAsReadMutation.isPending}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Mark Read
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="low-stock">
              <Card>
                <CardHeader>
                  <CardTitle>Low Stock Products</CardTitle>
                  <CardDescription>
                    Products that need immediate restocking attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {lowStockLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="bg-muted rounded-lg h-16 animate-pulse" />
                      ))}
                    </div>
                  ) : lowStockError ? (
                    <div className="text-center py-12">
                      <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Error loading low stock products</h3>
                      <p className="text-muted-foreground mb-4">
                        {lowStockError?.message || 'Failed to fetch low stock data. Please try again.'}
                      </p>
                      <Button onClick={() => refetchLowStock()}>
                        Retry
                      </Button>
                    </div>
                  ) : (lowStockProducts as any[]).length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">All products well stocked</h3>
                      <p className="text-muted-foreground">No low stock alerts at this time.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(lowStockProducts as any[]).map((product: any) => (
                        <div
                          key={product._id || product.id}
                          className="border border-orange-200 dark:border-orange-800 rounded-lg p-4 bg-orange-50 dark:bg-orange-900/20 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Package className="w-5 h-5 text-orange-600" />
                              <div>
                                <h4 className="font-medium text-foreground">{product.name}</h4>
                                <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                                {product.minStockLevel && (
                                  <p className="text-xs text-muted-foreground">
                                    Minimum stock: {product.minStockLevel} units
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Current Stock</p>
                              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                                {product.stockLevel} units
                              </p>
                              {product.minStockLevel && (
                                <p className="text-xs text-muted-foreground">
                                  {product.stockLevel <= product.minStockLevel ? 'Below minimum' : 'Low stock'}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="expiring">
              <Card>
                <CardHeader>
                  <CardTitle>Expiring Products</CardTitle>
                  <CardDescription>
                    Products approaching their expiry dates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {expiringLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="bg-muted rounded-lg h-16 animate-pulse" />
                      ))}
                    </div>
                  ) : expiringError ? (
                    <div className="text-center py-12">
                      <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Error loading expiring products</h3>
                      <p className="text-muted-foreground mb-4">
                        {expiringError?.message || 'Failed to fetch expiring products. Please try again.'}
                      </p>
                      <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/products/alerts/expiring"] })}>
                        Retry
                      </Button>
                    </div>
                  ) : (expiringProducts as any[]).length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No expiring products</h3>
                      <p className="text-muted-foreground">All products are within safe expiry ranges.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(expiringProducts as any[]).map((product: any) => {
                        const daysUntilExpiry = product.expiryDate ? 
                          Math.ceil((new Date(product.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                        
                        return (
                          <div
                            key={product._id || product.id}
                            className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                              daysUntilExpiry <= 3 ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' : 
                              daysUntilExpiry <= 7 ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20' : 
                              'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Calendar className={`w-5 h-5 ${
                                  daysUntilExpiry <= 3 ? 'text-red-600 dark:text-red-400' : 
                                  daysUntilExpiry <= 7 ? 'text-orange-600 dark:text-orange-400' : 
                                  'text-yellow-600 dark:text-yellow-400'
                                }`} />
                                <div>
                                  <h4 className="font-medium text-foreground">{product.name}</h4>
                                  <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                                  {product.expiryDate && (
                                    <p className="text-xs text-muted-foreground">
                                      Expiry: {new Date(product.expiryDate).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Expires</p>
                                <p className={`text-lg font-bold ${
                                  daysUntilExpiry <= 3 ? 'text-red-600 dark:text-red-400' : 
                                  daysUntilExpiry <= 7 ? 'text-orange-600 dark:text-orange-400' : 
                                  'text-yellow-600 dark:text-yellow-400'
                                }`}>
                                  {formatDate(product.expiryDate)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {daysUntilExpiry <= 0 ? 'Expired' : `${daysUntilExpiry} days left`}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}