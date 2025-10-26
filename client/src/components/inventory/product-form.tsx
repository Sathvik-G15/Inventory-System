import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { insertProductSchema } from "@shared/mongodb-schema";
import { z } from "zod";

// Client-side form schema validating the actual form fields
// We use categoryId/locationId here and map them to category/location on submit
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  locationId: z.string().optional(),
  supplierId: z.string().optional(),
  price: z.number().positive("Price must be greater than 0"),
  cost: z.number().optional(),
  stockLevel: z.number().min(0),
  minStockLevel: z.number().min(0),
  maxStockLevel: z.number().min(0),
  expiryDate: z.string().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

export function ProductForm({ product = null, onSuccess }: { product?: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const isEditing = !!product;
  const queryClient = useQueryClient();
  const getId = (x: any) => x?.id || x?._id;
  const normalizeId = (val: any) => {
    if (!val) return undefined as any;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return getId(val);
    return undefined as any;
  };

  const getDefaultSupplierId = () => {
    if (!product) return undefined;
    
    // Check all possible locations for the supplier ID
    const supplierId = 
      (product as any)?.supplierId || 
      (product as any)?.supplier?._id || 
      (product as any)?.supplier?.id;
      
    return supplierId ? String(supplierId) : undefined;
  };

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: product?.name || "",
      sku: product?.sku || "",
      description: product?.description || "",
      categoryId: normalizeId((product as any)?.category) || (product as any)?.categoryId || undefined,
      price: product?.price || 0,
      cost: product?.cost || 0,
      stockLevel: product?.stockLevel || 0,
      minStockLevel: product?.minStockLevel || 10,
      maxStockLevel: product?.maxStockLevel || 1000,
      expiryDate: product?.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : "",
      locationId: normalizeId((product as any)?.location) || (product as any)?.locationId || undefined,
      supplierId: getDefaultSupplierId(),
      imageUrl: product?.imageUrl || "",
      isActive: product?.isActive ?? true,
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["/api/locations"],
  });

  const { data: suppliers = [] } = useQuery<Array<{
    _id: string;
    name: string;
    contactPerson?: string;
    email: string;
    phone?: string;
    address?: string;
    isActive: boolean;
  }>>({
    queryKey: ["/api/suppliers"],
  });

  const createProductMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/products", data),
    onSuccess: () => {
      toast({
        title: "Product created",
        description: "Product has been successfully created.",
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Create failed",
        description: error.message || "Failed to create product. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: (data: any) => {
      const productId = (product as any)?.id || (product as any)?._id;
      return apiRequest("PUT", `/api/products/${productId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Product updated",
        description: "Product has been successfully updated.",
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update product. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = async (data: any) => {
    try {
      // Find the selected supplier to get its details
      const selectedSupplier = suppliers.find((s: any) => getId(s) === data.supplierId);
      
      const formData = {
        ...data,
        // map to server schema field names
        category: data.categoryId || undefined,
        location: data.locationId || undefined,
        // Map supplier fields to the format expected by the server
        supplier: selectedSupplier ? {
          name: selectedSupplier.name,
          contact: selectedSupplier.contactPerson || '',
          email: selectedSupplier.email
        } : undefined,
        price: parseFloat(data.price) || 0,
        cost: parseFloat(data.cost) || 0,
        stockLevel: parseInt(data.stockLevel) || 0,
        minStockLevel: parseInt(data.minStockLevel) || 10,
        maxStockLevel: parseInt(data.maxStockLevel) || 1000,
        expiryDate: data.expiryDate ? new Date(data.expiryDate).toISOString() : undefined,
      } as any;

      // remove client-only fields to satisfy zod
      delete (formData as any).categoryId;
      delete (formData as any).locationId;
      delete (formData as any).supplierId;

      if (isEditing) {
        await updateProductMutation.mutateAsync(formData);
      } else {
        await createProductMutation.mutateAsync(formData);
      }
    } catch (error) {
      // Error handling is done in the mutation callbacks
    }
  };

  const handleQuickAddCategory = async () => {
    const name = window.prompt("New category name?")?.trim();
    if (!name) return;
    try {
      const res = await apiRequest("POST", "/api/categories", { name });
      const created = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      const newId = (created && (created.id || created._id)) as string | undefined;
      if (newId) {
        form.setValue("categoryId", newId);
      }
      toast({ title: "Category added", description: `Added \"${name}\"` });
    } catch (error: any) {
      toast({ title: "Add failed", description: error?.message || "Failed to add category", variant: "destructive" });
    }
  };

  // Update form values when product data changes
  useEffect(() => {
    if (isEditing && product) {
      const catId = normalizeId((product as any)?.category) || (product as any)?.categoryId;
      const locId = normalizeId((product as any)?.location) || (product as any)?.locationId;
      const supId = getDefaultSupplierId();
      
      // Only update values if they exist and are different from current values
      const updates: any = {};
      
      if (catId && form.getValues('categoryId') !== catId) {
        updates.categoryId = catId;
      }
      
      if (locId && form.getValues('locationId') !== locId) {
        updates.locationId = locId;
      }
      
      if (supId && form.getValues('supplierId') !== supId) {
        updates.supplierId = supId;
      }
      
      if (Object.keys(updates).length > 0) {
        form.reset({
          ...form.getValues(),
          ...updates
        });
      }
    }
  }, [isEditing, product, form]);

  const generateSku = () => {
    const name = form.getValues("name");
    if (name) {
      const sku = name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .substring(0, 6) + "-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      form.setValue("sku", sku);
    }
  };

  const isPending = createProductMutation.isPending || updateProductMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Product Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product Name *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Enter product name" 
                    {...field} 
                    data-testid="input-product-name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* SKU */}
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU *</FormLabel>
                <div className="flex space-x-2">
                  <FormControl>
                    <Input 
                      placeholder="Enter SKU" 
                      {...field} 
                      data-testid="input-product-sku"
                    />
                  </FormControl>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={generateSku}
                    data-testid="button-generate-sku"
                  >
                    Generate
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter product description" 
                  {...field} 
                  data-testid="textarea-product-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category */}
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-product-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(categories as any[]).map((category: any) => (
                      <SelectItem key={getId(category)} value={getId(category)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleQuickAddCategory} data-testid="button-quick-add-category">
                    Add new category
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Location */}
          <FormField
            control={form.control}
            name="locationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-product-location">
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={undefined as any}>None</SelectItem>
                    {(locations as any[]).map((location: any) => (
                      <SelectItem key={getId(location)} value={getId(location)}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Supplier */}
          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => {
              // Ensure the value is always a string or undefined
              const value = field.value ? String(field.value) : undefined;
              
              return (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={value}
                    defaultValue={value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-product-supplier">
                        <SelectValue placeholder="Select a supplier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={undefined as any}>None</SelectItem>
                      {(suppliers as any[])?.map((supplier: any) => {
                        const id = String(getId(supplier));
                        return (
                          <SelectItem key={id} value={id}>
                            {supplier.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Price */}
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    data-testid="input-product-price"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Cost */}
          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cost</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    data-testid="input-product-cost"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Stock Level */}
          <FormField
            control={form.control}
            name="stockLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock Level *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="0" 
                    {...field} 
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    data-testid="input-product-stock-level"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Min Stock Level */}
          <FormField
            control={form.control}
            name="minStockLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min Stock Level</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="0" 
                    {...field} 
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    data-testid="input-product-min-stock"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Max Stock Level */}
          <FormField
            control={form.control}
            name="maxStockLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Stock Level</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1" 
                    {...field} 
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1000)}
                    data-testid="input-product-max-stock"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Expiry Date */}
          <FormField
            control={form.control}
            name="expiryDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expiry Date</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    {...field} 
                    data-testid="input-product-expiry-date"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Image URL */}
          <FormField
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Image URL</FormLabel>
                <FormControl>
                  <Input 
                    type="url" 
                    placeholder="https://example.com/image.jpg" 
                    {...field} 
                    data-testid="input-product-image-url"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Active Status */}
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active Product</FormLabel>
                <div className="text-sm text-slate-600">
                  Enable this product for sale and inventory tracking
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-product-active"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => onSuccess?.()}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-submit-product"
          >
            {isPending 
              ? (isEditing ? "Updating..." : "Creating...") 
              : (isEditing ? "Update Product" : "Create Product")
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}
