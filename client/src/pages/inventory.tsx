import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ProductTable } from "@/components/inventory/product-table";
import { ProductForm } from "@/components/inventory/product-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Filter, Download, Upload } from "lucide-react";

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const { toast } = useToast();

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products", { search, categoryId: selectedCategory }],
    queryFn: () => fetch(`/api/products?${new URLSearchParams({
      ...(search && { search }),
      ...(selectedCategory !== "all" && { categoryId: selectedCategory }),
      _t: Date.now().toString() // Add timestamp to prevent caching
    })}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }).then(res => res.json()),
    staleTime: 0,
    gcTime: 0
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ["/api/locations"],
  });

  const tableLoading = productsLoading || categoriesLoading || locationsLoading;

  // Derive display names so table never shows Unknown even if backend returns only IDs
  const derivedProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    const categoryIndex = new Map(Array.isArray(categories) ? categories.map((c: any) => [c.id, c]) : []);
    const locationIndex = new Map(Array.isArray(locations) ? locations.map((l: any) => [l.id, l]) : []);
    return products.map((p: any) => {
      const categoryIdFromAny = typeof p?.category === 'string' ? p.category : p?.categoryId;
      const locationIdFromAny = typeof p?.location === 'string' ? p.location : p?.locationId;
      return {
        ...p,
        categoryName: p?.category?.name || p?.categoryName || categoryIndex.get(categoryIdFromAny)?.name || categoryIndex.get(p?.categoryId)?.name || "",
        locationName: p?.location?.name || p?.locationName || locationIndex.get(locationIdFromAny)?.name || locationIndex.get(p?.locationId)?.name || "",
      };
    });
  }, [products, categories, locations]);

  const exportMutation = useMutation({
    mutationFn: async () => {
      // Create CSV content
      const csvContent = [
        "Name,SKU,Category,Price,Stock Level,Status",
        ...(Array.isArray(products) ? products : []).map((p: any) => {
          const categoryName = p?.category?.name || p?.categoryName || (categories as any[]).find((c: any) => c.id === p.categoryId)?.name || "Unknown";
          return [
            p.name,
            p.sku,
            categoryName,
            p.price,
            p.stockLevel,
            p.stockLevel <= (p.minStockLevel || 10) ? "Low Stock" : "In Stock"
          ].join(",");
        })
      ].join("\n");

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "Export successful",
        description: "Inventory data has been exported to CSV.",
      });
    }
  });

  const importProductsMutation = useMutation({
    mutationFn: async (products: any[]) => {
      const response = await apiRequest('POST', '/api/products/import', { products });
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all product-related queries
      queryClient.invalidateQueries({ 
        queryKey: ['/api/products'],
        refetchType: 'all'
      });
      
      // Force refetch the current products list
      queryClient.refetchQueries({
        queryKey: ['/api/products', { search, categoryId: selectedCategory }]
      });
      
      toast({
        title: 'Import successful',
        description: `Successfully imported ${data?.count || 0} products!`,
      });
    },
    onError: (error: any) => {
      console.error('Import error:', error);
      toast({
        title: 'Import failed',
        description: error.message || 'Failed to import products',
        variant: 'destructive',
      });
    },
  });

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split("\n").filter(line => line.trim() !== '');
        
        // Parse CSV data
        const importedData = lines.slice(1).map((line: string) => {
          // Handle quoted values that might contain commas
          const values = line.split(',').reduce((acc: string[], value) => {
            if (value.startsWith('"') && !value.endsWith('"')) {
              // Start of quoted value
              acc.push(value.substring(1));
            } else if (value.endsWith('"') && !value.startsWith('"')) {
              // End of quoted value
              acc[acc.length - 1] += ',' + value.substring(0, value.length - 1);
            } else if (acc.length > 0 && !acc[acc.length - 1].startsWith('"') && acc[acc.length - 1].includes(',')) {
              // Middle of quoted value
              acc[acc.length - 1] += ',' + value;
            } else {
              // Regular value
              acc.push(value);
            }
            return acc;
          }, []);
          
          // Map CSV columns to product fields based on the header row
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          const product: any = {
            name: values[headers.indexOf('name')]?.trim() || '',
            sku: values[headers.indexOf('sku')]?.trim() || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            description: values[headers.indexOf('description')]?.trim() || '',
            category: values[headers.indexOf('category')]?.trim() || 'default',
            price: values[headers.indexOf('price')] ? parseFloat(values[headers.indexOf('price')].trim()) : 0,
            cost: values[headers.indexOf('cost')] ? parseFloat(values[headers.indexOf('cost')].trim()) : undefined,
            stockLevel: values[headers.indexOf('stocklevel')] ? parseInt(values[headers.indexOf('stocklevel')].trim()) : 0,
            minStockLevel: values[headers.indexOf('minstocklevel')] ? parseInt(values[headers.indexOf('minstocklevel')].trim()) : 5,
            maxStockLevel: values[headers.indexOf('maxstocklevel')] ? parseInt(values[headers.indexOf('maxstocklevel')].trim()) : undefined,
            barcode: values[headers.indexOf('barcode')]?.trim(),
            qrCode: values[headers.indexOf('qrcode')]?.trim(),
            rfidTag: values[headers.indexOf('rfidtag')]?.trim(),
            arduinoSensorId: values[headers.indexOf('arduinosensorid')]?.trim(),
            weight: values[headers.indexOf('weight')] ? parseFloat(values[headers.indexOf('weight')].trim()) : undefined,
            supplierName: values[headers.indexOf('suppliername')]?.trim(),
            supplierContact: values[headers.indexOf('suppliercontact')]?.trim(),
            supplierEmail: values[headers.indexOf('supplieremail')]?.trim(),
            expiryDate: values[headers.indexOf('expirydate')]?.trim()
          };
          
          return product;
        }).filter(product => product.name); // Filter out any empty rows

        console.log("Parsed products:", importedData);
        
        if (importedData.length === 0) {
          toast({
            title: "No valid products found",
            description: "The CSV file doesn't contain any valid product data.",
            variant: "destructive",
          });
          return;
        }

        // Show confirmation dialog
        if (window.confirm(`Import ${importedData.length} products?`)) {
          toast({
            title: "Importing products...",
            description: `Processing ${importedData.length} products...`,
          });
          
          // Send data to server
          await importProductsMutation.mutateAsync(importedData);
        }
      } catch (error) {
        toast({
          title: "Import failed",
          description: "Failed to parse CSV file. Please check the format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
<div className="lg:pl-64 flex flex-col flex-1">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pt-24 lg:pt-20">
          <div className="bg-card rounded-lg shadow-sm border border-border">
            {/* Header with controls */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Product Inventory</h3>
                  <p className="text-sm text-muted-foreground">
                    {Array.isArray(products) ? (
                      <>{products.length} products • {products.filter((p: any) => p?.stockLevel <= (p?.minStockLevel || 10)).length} low stock</>
                    ) : (
                      'Loading products...'
                    )}
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search products..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 w-64 bg-background"
                      data-testid="input-search-products"
                    />
                  </div>
                  
                  {/* Category filter */}
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-48" data-testid="select-category-filter">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {(categories as any[]).map((category: any) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => exportMutation.mutate()}
                      disabled={exportMutation.isPending}
                      data-testid="button-export"
                      className="bg-background hover:bg-accent"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('file-import')?.click()}
                      data-testid="button-import"
                      className="bg-background hover:bg-accent"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </Button>
                    
                    <input
                      id="file-import"
                      type="file"
                      accept=".csv"
                      onChange={handleFileImport}
                      className="hidden"
                    />
                    
                    <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
                      <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-product">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Product
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Add New Product</DialogTitle>
                        </DialogHeader>
                        <ProductForm 
                          onSuccess={() => {
                            setShowAddProduct(false);
                            queryClient.invalidateQueries({ queryKey: ["/api/products"] });
                          }} 
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Product table */}
            <ProductTable products={derivedProducts as any[]} isLoading={tableLoading} showPagination={true} />
          </div>
        </main>
      </div>
    </div>
  );
}
