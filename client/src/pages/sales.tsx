import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { DollarSign, Package, Plus, Search, Warehouse, Store, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface ILocation {
  _id: string;
  name: string;
  type: 'warehouse' | 'shop';
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface IProduct {
  _id: string;
  name: string;
  price: number;
  costPrice: number;
  stockLevel: number;
  category?: string;
  sku?: string;
}

type Sale = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  revenue: number;
  date: string;
  fromLocation?: ILocation | string;
  toLocation?: ILocation | string;
  stockAtTimeOfSale: number;
};

type NewSale = {
  productId: string;
  quantity: number;
  price: number;
  date?: string;
  fromLocation?: string;
  toLocation?: string;
};

export default function SalesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch sales data
  const { data: salesData = [], isLoading } = useQuery({
    queryKey: ['/api/sales'],
    queryFn: async () => {
      const response = await fetch('/api/sales');
      const data = await response.json();
      console.log('API Response:', data);
      return data;
    }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddSaleOpen, setIsAddSaleOpen] = useState(false);
  const [newSale, setNewSale] = useState<NewSale>({
    productId: '',
    quantity: 1,
    price: 0,
    fromLocation: '',
    toLocation: ''
  });

  // Fetch locations
  const { data: locations = [] } = useQuery<ILocation[]>({
    queryKey: ['/api/locations'],
  });

  // Fetch products
  const { data: products = [] } = useQuery<IProduct[]>({
    queryKey: ['/api/products'],
    queryFn: async () => {
      const response = await fetch('/api/products');
      return response.json();
    }
  });

  // Create a location map for quick lookup
  const locationMap = useMemo(() => {
    const map = new Map<string, ILocation>();
    locations.forEach(location => {
      map.set(location._id, location);
    });
    return map;
  }, [locations]);

  // Filter locations by type
  const warehouses = useMemo(() => 
    locations.filter(loc => loc.type === 'warehouse'),
    [locations]
  );

  const shops = useMemo(() => 
    locations.filter(loc => loc.type === 'shop'),
    [locations]
  );

  // Get selected product details
  const selectedProduct = useMemo(() => 
    products.find((p: IProduct) => p._id === newSale.productId),
    [products, newSale.productId]
  );

  // Auto-fill price when product is selected
  const handleProductSelect = (productId: string) => {
    const product = products.find((p: IProduct) => p._id === productId);
    if (product) {
      setNewSale(prev => ({
        ...prev,
        productId,
        price: product.price || 0
      }));
    }
  };

  const createSaleMutation = useMutation({
    mutationFn: async (saleData: NewSale) => {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create sale');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Sale created successfully',
        variant: 'default',
      });
      // Refresh sales data
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      // Reset form and close
      setNewSale({
        productId: '',
        quantity: 1,
        price: 0,
        fromLocation: '',
        toLocation: ''
      });
      setIsAddSaleOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create sale',
        variant: 'destructive',
      });
    }
  });

  const handleAddSale = () => {
    // Validate required fields
    if (!newSale.productId || !newSale.quantity || !newSale.price || !newSale.fromLocation || !newSale.toLocation) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields including locations',
        variant: 'destructive',
      });
      return;
    }

    // Validate quantity
    if (newSale.quantity <= 0) {
      toast({
        title: 'Error',
        description: 'Quantity must be greater than 0',
        variant: 'destructive',
      });
      return;
    }

    // Validate price
    if (newSale.price <= 0) {
      toast({
        title: 'Error',
        description: 'Price must be greater than 0',
        variant: 'destructive',
      });
      return;
    }

    // Check if quantity exceeds available stock
    if (selectedProduct && newSale.quantity > selectedProduct.stockLevel) {
      toast({
        title: 'Error',
        description: `Quantity exceeds available stock. Only ${selectedProduct.stockLevel} units available.`,
        variant: 'destructive',
      });
      return;
    }

    // Prepare sale data
    const saleData: NewSale = {
      ...newSale,
      date: new Date().toISOString(),
    };

    console.log('Creating sale:', saleData);
    createSaleMutation.mutate(saleData);
  };

  // Helper function to get location name
  const getLocationName = (locationId: string | ILocation | undefined): string => {
    if (!locationId) return '-';
    
    if (typeof locationId === 'string') {
      const location = locationMap.get(locationId);
      return location ? location.name : 'Unknown Location';
    }
    
    return locationId.name || 'Unknown Location';
  };

  // Transform sales data from API to consistent format
  const sales: Sale[] = useMemo(() => {
    if (!salesData || !Array.isArray(salesData)) {
      console.warn('No sales data or invalid format:', salesData);
      return [];
    }
    
    console.log('Processing sales data:', salesData);
    
    return salesData.map((sale: any): Sale | null => {
      try {
        const quantity = Math.max(0, Number(sale.quantity) || 0);
        const price = Number(sale.price) || 0;
        const revenue = Number(sale.revenue) || price * quantity;
        
        // Get location details - handle both string IDs and populated objects
        let fromLocation: string | ILocation | undefined = sale.fromLocation;
        let toLocation: string | ILocation | undefined = sale.toLocation;
        
        // If locations are string IDs, try to find the location objects
        if (typeof fromLocation === 'string' && fromLocation) {
          const locationObj = locationMap.get(fromLocation);
          if (locationObj) {
            fromLocation = locationObj;
          }
        }
        
        if (typeof toLocation === 'string' && toLocation) {
          const locationObj = locationMap.get(toLocation);
          if (locationObj) {
            toLocation = locationObj;
          }
        }
        
        // Get product ID safely
        let productId = '';
        if (sale.productId) {
          productId = typeof sale.productId === 'object' 
            ? String(sale.productId._id || '') 
            : String(sale.productId || '');
        }
        
        // Get product name with fallback
        const productName = sale.productName || 'Unknown Product';
        
        // Use static stock level at time of sale
        const stockAtTimeOfSale = Number(sale.stockAtTimeOfSale) || 
                                 Number(sale.previousStock) || 
                                 Number(sale.stockLevel) || 
                                 (Number(sale.newStock) + quantity);
        
        // Format date
        const saleDate = sale.date 
          ? new Date(sale.date).toISOString() 
          : new Date().toISOString();
        
        const saleData: Sale = {
          id: String(sale._id || ''),
          productId,
          productName,
          quantity,
          price,
          revenue,
          date: saleDate,
          fromLocation,
          toLocation,
          stockAtTimeOfSale: Math.round(stockAtTimeOfSale * 100) / 100
        };
        
        console.log('Processed sale:', saleData);
        return saleData;
      } catch (error) {
        console.error('Error processing sale:', error, 'Sale data:', sale);
        return null;
      }
    })
    .filter((sale): sale is Sale => sale !== null);
  }, [salesData, locationMap]);

  const totalRevenue = sales.reduce((sum: number, sale: Sale) => sum + (sale.revenue || (sale.price || 0) * (sale.quantity || 0)), 0);
  const totalItemsSold = sales.reduce((sum: number, sale: Sale) => sum + (sale.quantity || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <Header title="Sales History" subtitle="View and manage all sales transactions" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pt-24 lg:pt-20 bg-background">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold">Sales History</h2>
              <p className="text-sm text-muted-foreground">View and manage all sales transactions</p>
            </div>
            <Button onClick={() => setIsAddSaleOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Sale
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">${totalRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">All-time sales</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Items Sold</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{totalItemsSold}</div>
                <p className="text-xs text-muted-foreground">Total units sold</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{sales.length}</div>
                <p className="text-xs text-muted-foreground">Total transactions</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border">
            <div className="px-6 py-4 border-b border-border bg-card">
              <h3 className="text-lg font-semibold text-foreground">Recent Sales</h3>
              <p className="text-sm text-muted-foreground">View and manage all sales transactions</p>
            </div>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Stock at Sale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale: Sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{format(new Date(sale.date), 'MMM d, yyyy HH:mm')}</TableCell>
                      <TableCell className="font-medium">
                        <div className="font-medium">{sale.productName}</div>
                        {sale.productId && (
                          <div className="text-xs text-muted-foreground">
                            ID: {sale.productId.length > 8 
                              ? `${sale.productId.substring(0, 4)}...${sale.productId.substring(sale.productId.length - 4)}`
                              : sale.productId}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{sale.quantity}</TableCell>
                      <TableCell className="text-right">${sale.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${sale.revenue.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{sale.stockAtTimeOfSale}</div>
                        <div className="text-xs text-muted-foreground">
                          Stock when sold
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No sales recorded yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Add Sale Modal */}
          {isAddSaleOpen && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <Card className="bg-card border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Add New Sale</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddSaleOpen(false)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <CardContent className="pt-6">
                  <div className="grid gap-6">
                    {/* Product Selection */}
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="product" className="text-right">
                        Product *
                      </Label>
                      <div className="col-span-3">
                        <Select 
                          value={newSale.productId}
                          onValueChange={handleProductSelect}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product: IProduct) => (
                              <SelectItem key={product._id} value={product._id}>
                                <div className="flex flex-col">
                                  <span>{product.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Price: ${product.price?.toFixed(2)} | Stock: {product.stockLevel || 0}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedProduct && (
                          <div className="mt-2 space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Current stock: <strong>{selectedProduct.stockLevel || 0}</strong> units
                            </p>
                            {selectedProduct.costPrice && (
                              <p className="text-sm text-muted-foreground">
                                Cost price: <strong>${selectedProduct.costPrice.toFixed(2)}</strong>
                              </p>
                            )}
                            {selectedProduct.sku && (
                              <p className="text-sm text-muted-foreground">
                                SKU: <strong>{selectedProduct.sku}</strong>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* From Location */}
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="fromLocation" className="text-right flex items-center gap-2">
                        <Warehouse className="h-4 w-4" /> From *
                      </Label>
                      <div className="col-span-3">
                        <Select
                          value={newSale.fromLocation}
                          onValueChange={(value) => setNewSale({...newSale, fromLocation: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select source location" />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses.map((location) => (
                              <SelectItem key={location._id} value={location._id}>
                                {location.name} ({location.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* To Location */}
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="toLocation" className="text-right flex items-center gap-2">
                        <Store className="h-4 w-4" /> To *
                      </Label>
                      <div className="col-span-3">
                        <Select
                          value={newSale.toLocation}
                          onValueChange={(value) => setNewSale({...newSale, toLocation: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination location" />
                          </SelectTrigger>
                          <SelectContent>
                            {shops.map((location) => (
                              <SelectItem key={location._id} value={location._id}>
                                {location.name} ({location.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Quantity */}
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="quantity" className="text-right">
                        Quantity *
                      </Label>
                      <div className="col-span-3">
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={newSale.quantity}
                          onChange={(e) =>
                            setNewSale({...newSale, quantity: parseInt(e.target.value) || 0})
                          }
                          className="w-full"
                        />
                        {selectedProduct && newSale.quantity > selectedProduct.stockLevel && (
                          <p className="text-sm text-destructive mt-2">
                            Warning: Quantity exceeds available stock! Only {selectedProduct.stockLevel} units available.
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Price - Auto-filled but editable */}
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="price" className="text-right">
                        Price *
                      </Label>
                      <div className="col-span-3">
                        <Input
                          id="price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={newSale.price}
                          onChange={(e) =>
                            setNewSale({...newSale, price: parseFloat(e.target.value) || 0})
                          }
                          className="w-full"
                        />
                        {selectedProduct && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Product price: ${selectedProduct.price?.toFixed(2)}
                            {newSale.price !== selectedProduct.price && (
                              <span className="text-orange-600 ml-2">
                                (Custom price)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Total Calculation */}
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Total</Label>
                      <div className="col-span-3">
                        <p className="text-lg font-semibold text-foreground">
                          ${(newSale.quantity * newSale.price).toFixed(2)}
                        </p>
                        {selectedProduct && selectedProduct.costPrice && (
                          <p className="text-sm text-muted-foreground">
                            Profit: ${(newSale.quantity * (newSale.price - selectedProduct.costPrice)).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setIsAddSaleOpen(false)}
                        disabled={createSaleMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleAddSale}
                        disabled={createSaleMutation.isPending || 
                                 (selectedProduct && newSale.quantity > selectedProduct.stockLevel)}
                      >
                        {createSaleMutation.isPending ? 'Creating...' : 'Add Sale'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}