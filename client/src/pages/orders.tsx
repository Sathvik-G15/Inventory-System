import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Plus, Package, Truck, CheckCircle, Clock, AlertCircle, Search, RefreshCw, Download, Activity, Box, MoreHorizontal, Check, X } from "lucide-react";

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface PurchaseOrder {
  _id: string;
  poNumber?: string;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled' | 'approved';
  orderDate: string;
  expectedDeliveryDate?: string;
  supplierId: string;
  supplierName: string;
  items: OrderItem[];
  totalAmount: number;
}

export default function Orders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("");
  const [expectedDelivery, setExpectedDelivery] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [items, setItems] = useState<{ productId: string; quantity: number; }[]>([]);
  // Add Supplier form state
  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const { toast } = useToast();

  // Suppliers
  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({ queryKey: ["/api/suppliers"] });

  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (payload: { name: string; email: string; contactPerson?: string; phone?: string; address?: string; }) => {
      const res = await apiRequest("POST", "/api/suppliers", payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Supplier added" });
      setShowAddSupplier(false);
      setSupplierName("");
      setSupplierEmail("");
      setSupplierContact("");
      setSupplierPhone("");
      setSupplierAddress("");
      refetchSuppliers();
    },
    onError: (err: any) => {
      toast({ title: "Failed to add supplier", description: String(err?.message || err), variant: "destructive" });
    }
  });

  const { data: lowStockProducts = [] } = useQuery({
    queryKey: ["/api/products/alerts/low-stock"],
  });

  // Purchase orders with manual refetch
  const { data: purchaseOrders = [], refetch: refetchOrders } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
    // Force refetch on mount to ensure fresh data
    refetchOnMount: true,
  });
  
  // Refetch products when orders change to update inventory counts
  const { refetch: refetchProducts } = useQuery({
    queryKey: ["/api/products"],
    enabled: false, // Don't fetch on mount, we'll trigger it manually
  });

  // Status update state and mutation
  const [updatingStatus, setUpdatingStatus] = useState<{orderId: string, status: string} | null>(null);
  
  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string, status: string }) => {
      // For shipped status, we'll update the status and create inventory movements
      const res = await apiRequest("PUT", `/api/purchase-orders/${orderId}`, { status });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to update status');
      }
      try {
        return await res.json();
      } catch (e) {
        // If response is not JSON but request was successful, return success
        return { success: true };
      }
    },
    onSuccess: async (data, { status }) => {
      // Invalidate all queries to force refetch
      await Promise.all([
        refetchOrders(),
        refetchProducts(),
        queryClient.invalidateQueries({ queryKey: ['/api/products/alerts/low-stock'] })
      ]);
      
      toast({ 
        title: `Order marked as ${status}`,
        description: status === 'shipped' 
          ? 'The order has been marked as shipped and inventory movements have been recorded.' 
          : status === 'delivered'
            ? 'The order has been marked as delivered and inventory has been updated.'
            : 'The order status has been updated.'
      });
      setUpdatingStatus(null);
    },
    onError: (err: any) => {
      toast({ 
        title: "Failed to update order status", 
        description: err?.message?.includes('<!DOCTYPE') 
          ? 'Server error occurred' 
          : String(err?.message || err), 
        variant: "destructive" 
      });
      setUpdatingStatus(null);
    }
  });
  
  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending': return 'shipped';
      case 'shipped': return 'delivered';
      default: return null;
    }
  };
  
  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const createOrderMutation = useMutation({
    mutationFn: async (payload: { supplierId: string; items: { productId: string; quantity: number }[]; expectedDeliveryDate?: string; notes?: string; }) => {
      const res = await apiRequest("POST", "/api/purchase-orders", payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Purchase order created" });
      setShowCreateOrder(false);
      setSupplierId("");
      setExpectedDelivery("");
      setItems([]);
      refetchOrders();
    },
    onError: (err: any) => {
      toast({ title: "Failed to create order", description: String(err?.message || err), variant: "destructive" });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'approved': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      case 'shipped': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
      case 'delivered': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'cancelled': return 'text-destructive bg-destructive/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return Clock;
      case 'shipped': return Truck;
      case 'delivered': return CheckCircle;
      case 'cancelled': return AlertCircle;
      default: return Package;
    }
  };

  const normalizedOrders = useMemo(() => {
    return (purchaseOrders as any[]).map((po) => ({
      id: po.poNumber || po._id,
      supplier: po.supplierName,
      status: po.status,
      orderDate: po.orderDate,
      expectedDelivery: po.expectedDeliveryDate,
      totalAmount: po.totalAmount,
      items: po.items || [],
    }));
  }, [purchaseOrders]);

  const filteredOrders = normalizedOrders.filter((order) => {
    const matchesSearch =
      search === "" ||
      String(order.id).toLowerCase().includes(search.toLowerCase()) ||
      String(order.supplier || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = useMemo(() => {
    const orders = purchaseOrders || [];
    const pending = orders.filter((o) => o.status === 'pending').length;
    const shipped = orders.filter((o) => o.status === 'shipped').length;
    const delivered = orders.filter((o) => o.status === 'delivered').length;
    const cancelled = orders.filter((o) => o.status === 'cancelled').length;

    return {
      total: orders.length,
      pending,
      shipped,
      delivered,
      cancelled,
    };
  }, [purchaseOrders]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <Header 
          title="Purchase Orders" 
          subtitle="Manage purchase orders and supplier relationships for inventory restocking"
        />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pt-24 lg:pt-20">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  </div>
                  <ShoppingCart className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">In Transit</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.shipped}</p>
                  </div>
                  <Truck className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Delivered</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.delivered}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="orders" className="space-y-6">
            <TabsList>
              <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
              <TabsTrigger value="restock">Restock Suggestions</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            </TabsList>

            {/* Global Create Order Dialog (available from any tab) */}
            <Dialog open={showCreateOrder} onOpenChange={(open) => {
              setShowCreateOrder(open);
              if (!open) {
                setSupplierId("");
                setExpectedDelivery("");
                setItems([]);
                setSelectedProductId("");
                setSelectedQuantity(1);
              }
            }}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Purchase Order</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="supplier">Supplier</Label>
                      <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger id="supplier">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {(suppliers as any[]).map((s) => (
                            <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="expectedDelivery">Expected Delivery</Label>
                      <Input id="expectedDelivery" type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Order Items</Label>
                    <div className="border rounded-lg p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-2 items-end">
                        <div>
                          <Label>Product</Label>
                          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {(products as any[]).map((p) => (
                                <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label>Qty</Label>
                            <Input type="number" min={1} value={selectedQuantity} onChange={(e) => setSelectedQuantity(parseInt(e.target.value || '1'))} />
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (!selectedProductId) return;
                              setItems((prev) => [...prev, { productId: selectedProductId, quantity: Math.max(1, selectedQuantity || 1) }]);
                              setSelectedProductId("");
                              setSelectedQuantity(1);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" /> Add
                          </Button>
                        </div>
                      </div>
                      {items.length > 0 && (
                        <div className="pt-2 space-y-1 text-sm">
                          {items.map((it, idx) => {
                            const prod = (products as any[]).find((p) => p._id === it.productId);
                            return (
                              <div key={idx} className="flex justify-between">
                                <span>{prod?.name || it.productId} × {it.quantity}</span>
                                <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, i) => i !== idx))}>Remove</Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowCreateOrder(false)}>
                      Cancel
                    </Button>
                    <Button
                      disabled={!supplierId || items.length === 0 || createOrderMutation.isPending}
                      onClick={() => {
                        createOrderMutation.mutate({
                          supplierId,
                          items,
                          expectedDeliveryDate: expectedDelivery || undefined,
                        });
                      }}
                    >
                      {createOrderMutation.isPending ? 'Creating…' : 'Create Order'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <TabsContent value="orders">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Search orders or suppliers..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full sm:w-auto" onClick={() => setShowCreateOrder(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Order
                </Button>
                </div>

            
              {/* Orders List */}
              <Card>
                <CardHeader>
                  <CardTitle>Purchase Orders</CardTitle>
                  <CardDescription>
                    Track and manage all purchase orders from suppliers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingCart className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-900 mb-2">
                        {search || statusFilter !== "all" ? "No orders found" : "No purchase orders yet"}
                      </h3>
                      <p className="text-slate-600 mb-4">
                        {search || statusFilter !== "all" 
                          ? "Try adjusting your search or filter criteria."
                          : "Create your first purchase order to start managing inventory restocking."
                        }
                      </p>
                      {(!search && statusFilter === "all") && (
                        <Button onClick={() => setShowCreateOrder(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create First Order
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredOrders.map((order) => {
                        const StatusIcon = getStatusIcon(order.status);
                        
                        return (
                          <div
                            key={order.id}
                            className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-start gap-3">
                                <StatusIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1" />
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-foreground">{order.id}</h4>
                                    <Badge className={getStatusColor(order.status)}>
                                      {order.status}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    <p>Ordered: {new Date(order.orderDate).toLocaleDateString()}</p>
                                    {order.expectedDelivery && (
                                      <p>Expected: {new Date(order.expectedDelivery).toLocaleDateString()}</p>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{order.supplier || 'No supplier'}</p>
                                </div>
                              </div>
                              
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground mb-2">Order Total</p>
                                <p className="font-medium text-foreground">
                                  ${Number(order.totalAmount || 0).toLocaleString()}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            
                            <div className="border-t pt-3">
                              <p className="text-sm font-medium text-muted-foreground mb-2">Order Items:</p>
                              <div className="space-y-1">
                                {order.items.map((item: any, index: number) => (
                                  <div key={index} className="flex justify-between text-sm">
                                    <span>{item.productName} (×{item.quantity})</span>
                                    <span>${(item.quantity * item.unitPrice).toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            <div className="mt-4 flex justify-end gap-2">
                              {getNextStatus(order.status) && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setUpdatingStatus({ orderId: order.id, status: getNextStatus(order.status)! })}
                                >
                                  Mark as {getStatusLabel(getNextStatus(order.status)!)}
                                </Button>
                              )}
                              {order.status === 'pending' && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                  onClick={() => setUpdatingStatus({ orderId: order.id, status: 'cancelled' })}
                                >
                                  <X className="w-4 h-4 mr-1.5" />
                                  Cancel Order
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

            {/* Status Update Confirmation Dialog */}
            <Dialog open={!!updatingStatus} onOpenChange={(open) => !open && setUpdatingStatus(null)}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Update Order Status</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-foreground mb-4">
                    Are you sure you want to mark order <span className="font-semibold">{updatingStatus?.orderId}</span> as <span className="font-semibold">{updatingStatus?.status}</span>?
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setUpdatingStatus(null)}
                      disabled={updateOrderStatus.isPending}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="default"
                      onClick={() => updatingStatus && updateOrderStatus.mutate(updatingStatus)}
                      disabled={updateOrderStatus.isPending}
                    >
                      {updateOrderStatus.isPending ? 'Updating...' : 'Confirm'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <TabsContent value="restock">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Restock Suggestions</CardTitle>
                      <CardDescription>
                        AI-powered recommendations for optimal inventory management
                      </CardDescription>
                    </div>
                    <div className="flex gap-2
                    ">
                      <Button variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh Analysis
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(lowStockProducts as any[]).length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <p className="text-muted-foreground">All products are well-stocked</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(lowStockProducts as any[]).map((product: any) => {
                        // AI-generated insights (mock data - in real app, this would come from your backend)
                        const salesVelocity = Math.floor(Math.random() * 20) + 5; // units/day
                        const leadTime = 7; // days
                        const daysOfStockLeft = Math.floor(product.stockLevel / salesVelocity);
                        const suggestedOrderQty = Math.max(
                          Math.ceil(salesVelocity * leadTime * 1.5), // 1.5x lead time coverage
                          product.minStockLevel * 2 // At least 2x min stock
                        );
                        const urgency = daysOfStockLeft < leadTime * 1.5 ? 'high' : 'medium';
                        
                        return (
                          <div
                            key={product.id}
                            className="border rounded-lg p-4 bg-background hover:shadow-md transition-shadow"
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-md bg-blue-100 dark:bg-blue-900/30 flex-shrink-0 flex items-center justify-center">
                                  <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-foreground">{product.name}</h4>
                                    <Badge variant={urgency === 'high' ? 'destructive' : 'secondary'}>
                                      {urgency === 'high' ? 'Urgent' : 'Monitor'}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                                  
                                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                    <div className="flex items-center gap-2">
                                      <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span className="font-medium">{salesVelocity}</span>
                                      <span className="text-muted-foreground">units/day</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span className="text-muted-foreground">Lead time:</span>
                                      <span className="font-medium">{leadTime} days</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span className="text-muted-foreground">Stock left:</span>
                                      <span className={`font-medium ${daysOfStockLeft < 5 ? 'text-red-500' : 'text-amber-500'}`}>
                                        {daysOfStockLeft} days
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Box className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span className="text-muted-foreground">Current:</span>
                                      <span className="font-medium">{product.stockLevel} units</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-3 min-w-[200px]">
                                <div className="text-right">
                                  <p className="text-sm text-muted-foreground">Suggested order</p>
                                  <p className="text-lg font-bold text-foreground">{suggestedOrderQty} units</p>
                                  <p className="text-xs text-muted-foreground">~{Math.ceil(suggestedOrderQty / salesVelocity)} days of stock</p>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant={urgency === 'high' ? 'default' : 'outline'}
                                    onClick={() => {
                                      setShowCreateOrder(true);
                                      const pid = (product as any)._id ?? product.id;
                                      setSelectedProductId(pid);
                                      setSelectedQuantity(suggestedOrderQty);
                                      setItems((prev) => {
                                        if (prev.some(p => p.productId === pid)) return prev;
                                        return [...prev, { productId: pid, quantity: suggestedOrderQty }];
                                      });
                                    }}
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Order {suggestedOrderQty} units
                                  </Button>
                                  <Button size="sm" variant="outline" className="px-2">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </div>
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

            <TabsContent value="suppliers">
              <Card>
                <CardHeader>
                  <CardTitle>Supplier Management</CardTitle>
                  <CardDescription>
                    Manage supplier relationships and contact information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total suppliers</p>
                      <p className="text-2xl font-bold">{(suppliers as any[]).length}</p>
                    </div>
                    <Dialog open={showAddSupplier} onOpenChange={(open) => {
                      setShowAddSupplier(open);
                      if (!open) {
                        setSupplierName("");
                        setSupplierEmail("");
                        setSupplierContact("");
                        setSupplierPhone("");
                        setSupplierAddress("");
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="w-4 h-4 mr-2" /> Add Supplier
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Add Supplier</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-3">
                          <div>
                            <Label>Name</Label>
                            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Acme Corp" />
                          </div>
                          <div>
                            <Label>Email</Label>
                            <Input type="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} placeholder="orders@example.com" />
                          </div>
                          <div>
                            <Label>Contact Person</Label>
                            <Input value={supplierContact} onChange={(e) => setSupplierContact(e.target.value)} placeholder="Jane Doe" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Phone</Label>
                              <Input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} placeholder="+1 555 123 4567" />
                            </div>
                            <div>
                              <Label>Address</Label>
                              <Input value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} placeholder="City, Country" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setShowAddSupplier(false)}>Cancel</Button>
                            <Button
                              disabled={!supplierName || !supplierEmail || createSupplierMutation.isPending}
                              onClick={() => createSupplierMutation.mutate({
                                name: supplierName,
                                email: supplierEmail,
                                contactPerson: supplierContact || undefined,
                                phone: supplierPhone || undefined,
                                address: supplierAddress || undefined,
                              })}
                            >
                              {createSupplierMutation.isPending ? 'Saving…' : 'Save Supplier'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {(suppliers as any[]).length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No suppliers yet</h3>
                      <p className="text-muted-foreground mb-4">Add your first supplier to start creating purchase orders.</p>
                      <Button onClick={() => setShowAddSupplier(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Add Supplier
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(suppliers as any[]).map((s) => (
                        <div key={s._id} className="border rounded-lg p-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{s.name}</p>
                            <p className="text-sm text-muted-foreground">{s.email}{s.contactPerson ? ` • ${s.contactPerson}` : ''}</p>
                            <p className="text-xs text-muted-foreground">{s.phone || '-'}{s.address ? ` • ${s.address}` : ''}</p>
                          </div>
                          <Badge variant="secondary">Active</Badge>
                        </div>
                      ))}
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