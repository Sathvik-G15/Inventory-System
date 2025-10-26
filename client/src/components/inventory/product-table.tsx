import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProductForm } from "./product-form";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { type ColumnDef } from "@tanstack/react-table";
import { type IProduct } from "@shared/mongodb-schema";
import { RecordSaleDialog } from "./record-sale-dialog";

export function ProductTable({ products = [], isLoading = false, showPagination = true }: { products: IProduct[]; isLoading: boolean; showPagination: boolean }) {
  const [editingProduct, setEditingProduct] = useState<IProduct | null>(null);
  const [sellingProduct, setSellingProduct] = useState<IProduct | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof IProduct>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const itemsPerPage = 10;
  const { toast } = useToast();
  const [salesData, setSalesData] = useState<Record<string, {totalSold: number, last30Days: number}>>({});

  // Fetch sales data for products
  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const response = await apiRequest("GET", "/api/sales");
        const salesMap: Record<string, {totalSold: number, last30Days: number}> = {};
        
        response.forEach((sale: any) => {
          const productId = sale.productId;
          if (!salesMap[productId]) {
            salesMap[productId] = { totalSold: 0, last30Days: 0 };
          }
          salesMap[productId].totalSold += sale.quantity;
          
          // Check if sale was in the last 30 days
          const saleDate = new Date(sale.date || sale.createdAt);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          if (saleDate > thirtyDaysAgo) {
            salesMap[productId].last30Days += sale.quantity;
          }
        });
        
        setSalesData(salesMap);
      } catch (error) {
        console.error("Error fetching sales data:", error);
      }
    };
    
    fetchSalesData();
  }, [products]);

  // Resolve product id whether it comes as `id` (virtual) or `_id` (Mongo JSON)
  const getProductId = (p: any) => p?.id || p?._id;

  // Helper: derive category display name regardless of backend shape
  const getCategoryName = (p: any): string => {
    return p?.categoryName || p?.category?.name || "";
  };

  const deleteProductMutation = useMutation({
    mutationFn: (productId: string) => apiRequest("DELETE", `/api/products/${productId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product deleted",
        description: "Product has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete product. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSort = (field: keyof IProduct) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const columns: ColumnDef<IProduct>[] = [
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex items-center">
            {product.imageUrl ? (
              <img 
                src={product.imageUrl} 
                alt={product.name}
                className="h-10 w-10 rounded-lg object-cover mr-4"
              />
            ) : (
              <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center mr-4">
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-foreground" data-testid={`text-product-name-${getProductId(product)}`}>
                {product.name}
              </div>
              <div className="text-sm text-muted-foreground" data-testid={`text-product-sku-${getProductId(product)}`}>
                SKU: {product.sku}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "categoryName",
      header: "Category",
      cell: ({ row }) => {
        const product = row.original as any;
        const name = getCategoryName(product);
        return (
          <div className="text-sm text-foreground" data-testid={`text-category-${product.id}`}>
            {name || "Unknown"}
          </div>
        );
      },
    },
    {
      accessorKey: "supplier",
      header: "Supplier",
      cell: ({ row }) => {
        const product = row.original as any;
        const supplierName = product.supplier?.name || 'No Supplier';
        return (
          <div className="text-sm text-foreground" data-testid={`text-supplier-${getProductId(product)}`}>
            {supplierName}
          </div>
        );
      },
    },
    {
      accessorKey: "stockInfo",
      header: "Stock & Sales",
      cell: ({ row }) => {
        const product = row.original;
        const productId = getProductId(product);
        const stockLevel = product.stockLevel || 0;
        const minStockLevel = product.minStockLevel || 10;
        const maxStockLevel = product.maxStockLevel || 100;
        const stockPercentage = Math.min(100, (stockLevel / maxStockLevel) * 100);
        const isLowStock = stockLevel <= minStockLevel;
        const sales = salesData[productId] || { totalSold: 0, last30Days: 0 };

        return (
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Current Stock:</span>
                <span className={cn(isLowStock ? "text-red-600 font-medium" : "text-foreground")}>
                  {stockLevel}
                </span>
              </div>
              <Progress value={stockPercentage} className="h-2 mt-1" />
              {isLowStock && (
                <p className="text-xs text-red-500">
                  Low stock (min: {minStockLevel})
                </p>
              )}
            </div>
            
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Total Sold:</span>
                  <span className="font-medium">{sales.totalSold}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last 30 Days:</span>
                  <span className="font-medium">{sales.last30Days}</span>
                </div>
              </div>
            </div>
            
            <div className="pt-1">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="xs" 
                  className="text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingProduct(product);
                  }}
                >
                  Update
                </Button>
                <Button 
                  variant="default"
                  size="xs" 
                  className="text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSellingProduct(product);
                  }}
                  disabled={!product.stockLevel || product.stockLevel <= 0}
                >
                  Sell
                </Button>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="text-sm text-foreground" data-testid={`text-price-${getProductId(product)}`}>
            ${Number(product.price as any).toFixed(2)}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const product = row.original;
        return (
          <Badge className={getStockStatus(product).color} data-testid={`badge-status-${getProductId(product)}`}>
            {getStockStatus(product).label}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setEditingProduct(product)}
                data-testid={`button-edit-${getProductId(product)}`}>
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const sortedProducts = [...products].sort((a: any, b: any) => {
    let aValue: any;
    let bValue: any;

    if (sortField === "categoryId") {
      aValue = getCategoryName(a).toLowerCase();
      bValue = getCategoryName(b).toLowerCase();
    } else if (sortField === "stockLevel" || sortField === "price") {
      aValue = parseFloat((a as any)[sortField]) || 0;
      bValue = parseFloat((b as any)[sortField]) || 0;
    } else {
      aValue = String((a as any)[sortField] || "").toLowerCase();
      bValue = String((b as any)[sortField] || "").toLowerCase();
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = showPagination 
    ? sortedProducts.slice(startIndex, startIndex + itemsPerPage)
    : sortedProducts;

  const getStockStatus = (product: IProduct) => {
    const level = product.stockLevel;
    const minLevel = product.minStockLevel || 10;
    
    if (level === 0) return { label: "Out of Stock", color: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50" };
    if (level <= minLevel) return { label: "Low Stock", color: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50" };
    if (level <= minLevel * 2) return { label: "Medium Stock", color: "bg-yellow-100 dark:bg-amber-900/30 text-yellow-600 dark:text-amber-400 border-yellow-200 dark:border-amber-800/50" };
    return { label: "In Stock", color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/50" };
  };

  const getStockProgress = (product: IProduct) => {
    const maxLevel = product.maxStockLevel || 100;
    return Math.min((product.stockLevel / maxLevel) * 100, 100);
  };

  // Removed mock AI score/trend

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 bg-card rounded-lg border">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[100px]" />
            </div>
            <Skeleton className="h-4 w-[80px]" />
            <Skeleton className="h-4 w-[60px]" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
          <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No products found</h3>
        <p className="text-muted-foreground">Get started by adding your first product to the inventory.</p>
      </div>
    );
  }

  return (
    <>
      {sellingProduct && (
        <RecordSaleDialog 
          product={sellingProduct} 
          open={!!sellingProduct} 
          onOpenChange={(open) => !open && setSellingProduct(null)} 
        />
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead 
                className="cursor-pointer hover:bg-muted/80 transition-colors text-foreground font-medium pl-6"
                onClick={() => handleSort("name")}
                data-testid="header-product-name"
              >
                <div className="flex items-center">
                  Product
                  {sortField === "name" && (
                    sortDirection === "asc" ? "↑" : "↓"
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/80 transition-colors text-foreground font-medium text-center pl-2"
                onClick={() => handleSort("categoryId")}
                data-testid="header-category"
              >
                Category
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/80 transition-colors text-foreground font-medium text-center pl-2"
                onClick={() => handleSort("stockLevel")}
                data-testid="header-stock-level"
              >
                <div className="flex items-center">
                  Stock Level
                  {sortField === "stockLevel" && (
                    sortDirection === "asc" ? "↑" : "↓"
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/80 transition-colors text-foreground font-medium text-center pl-2"
                onClick={() => handleSort("price")}
                data-testid="header-price"
              >
                <div className="flex items-center">
                  Price
                  {sortField === "price" && (
                    sortDirection === "asc" ? "↑" : "↓"
                  )}
                </div>
              </TableHead>
              <TableHead className="text-foreground text-center pl-2">Status</TableHead>
              <TableHead className="text-foreground text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.map((product) => {
              const status = getStockStatus(product);
              
              return (
                <TableRow key={getProductId(product)} className="hover:bg-muted/50" data-testid={`row-product-${getProductId(product)}`}>
                  <TableCell>
                    <div className="flex items-center">
                      {product.imageUrl ? (
                        <img 
                          src={product.imageUrl} 
                          alt={product.name}
                          className="h-10 w-10 rounded-lg object-cover mr-4 border"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center mr-4">
                          <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-foreground" data-testid={`text-product-name-${getProductId(product)}`}>
                          {product.name}
                        </div>
                        <div className="text-sm text-muted-foreground" data-testid={`text-product-sku-${getProductId(product)}`}>
                          SKU: {product.sku}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-sm text-foreground text-center" data-testid={`text-category-${getProductId(product)}`}>
                    {product.categoryName || "Unknown"}
                  </TableCell>
                  
                  <TableCell className="text-center">
                    <div className="flex items-center space-x-3">
                      <div className="text-sm font-medium text-foreground" data-testid={`text-stock-level-${getProductId(product)}`}>
                        {product.stockLevel}
                      </div>
                      <div className="w-16 bg-muted rounded-full h-1.5">
                        <div 
                          className="bg-primary h-1.5 rounded-full transition-all duration-300" 
                          style={{ width: `${getStockProgress(product)}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-sm text-foreground text-center" data-testid={`text-price-${getProductId(product)}`}>
                    ${Number(product.price).toFixed(2)}
                  </TableCell>
                  
                  
                  
                  <TableCell className="text-center">
                    <Badge className={status.color} data-testid={`badge-status-${getProductId(product)}`}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSellingProduct(product)}
                        disabled={!product.stockLevel || product.stockLevel <= 0}
                        data-testid={`button-sell-${getProductId(product)}`}
                      >
                        Sell
                      </Button>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingProduct(product)}
                            data-testid={`button-edit-${product.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Edit Product</DialogTitle>
                          </DialogHeader>
                          {editingProduct && (
                            <ProductForm 
                              product={editingProduct}
                              onSuccess={() => setEditingProduct(null)}
                              onCancel={() => setEditingProduct(null)}
                            />
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-delete-${getProductId(product)}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Delete Product</DialogTitle>
                          </DialogHeader>
                          <div className="py-4">
                            <p className="text-sm text-slate-600">Are you sure you want to delete this product? This action cannot be undone.</p>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => {
                              const closeButton = document.querySelector('[data-state=open]')?.querySelector('button[aria-label=Close]') as HTMLButtonElement | null;
                              closeButton?.click();
                            }}>Cancel</Button>
                            <Button 
                              variant="destructive" 
                              onClick={async () => {
                                try {
                                  await deleteProductMutation.mutateAsync(getProductId(product));
                                  const closeButton = document.querySelector('[data-state=open]')?.querySelector('button[aria-label=Close]') as HTMLButtonElement | null;
                                  closeButton?.click();
                                } catch (error) {
                                  console.error('Failed to delete product:', error);
                                }
                              }}
                              disabled={deleteProductMutation.isPending}
                            >
                              {deleteProductMutation.isPending ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-700 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              data-testid="button-prev-mobile"
              className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600 hover:text-white"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              data-testid="button-next-mobile"
              className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600 hover:text-white"
            >
              Next
            </Button>
          </div>
          
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-300">
                Showing{" "}
                <span className="font-medium" data-testid="text-pagination-from">
                  {startIndex + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium" data-testid="text-pagination-to">
                  {Math.min(startIndex + itemsPerPage, sortedProducts.length)}
                </span>{" "}
                of{" "}
                <span className="font-medium" data-testid="text-pagination-total">
                  {sortedProducts.length}
                </span>{" "}
                results
              </p>
            </div>
            
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev"
                  className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={currentPage === pageNum 
                        ? "bg-blue-600 text-white hover:bg-blue-700" 
                        : "bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600 hover:text-white"}
                      data-testid={`button-page-${pageNum}`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next"
                  className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600 hover:text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
