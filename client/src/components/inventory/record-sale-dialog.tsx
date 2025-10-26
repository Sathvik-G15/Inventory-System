"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { IProduct } from "@shared/mongodb-schema"

interface ILocation {
  _id: string;
  name: string;
  type?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface RecordSaleDialogProps {
  product: IProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RecordSaleDialog({
  product,
  open,
  onOpenChange,
}: RecordSaleDialogProps) {
  const [quantity, setQuantity] = useState(1)
  const [fromLocation, setFromLocation] = useState('')
  const [toLocation, setToLocation] = useState('')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // Fetch from locations (warehouses)
  const { data: fromLocations, isLoading: isLoadingFromLocations } = useQuery<ILocation[]>({
    queryKey: ['/api/locations', { type: 'warehouse' }],
    queryFn: async () => {
      const response = await fetch('/api/locations?type=warehouse');
      if (!response.ok) {
        throw new Error('Failed to fetch warehouse locations');
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Fetched warehouse locations:', data);
      if (data?.length > 0 && !fromLocation) {
        setFromLocation(data[0]._id);
      }
    },
    onError: (error) => {
      console.error('Error fetching warehouse locations:', error);
      toast({
        title: "Error",
        description: "Failed to load warehouse locations. Please try again later.",
        variant: "destructive",
      });
    },
  });

  // Fetch to locations (shops/marts)
  const { data: toLocations, isLoading: isLoadingToLocations } = useQuery<ILocation[]>({
    queryKey: ['/api/locations', { type: 'shop' }],
    queryFn: async () => {
      const response = await fetch('/api/locations?type=shop');
      if (!response.ok) {
        throw new Error('Failed to fetch shop locations');
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Fetched shop locations:', data);
      if (data?.length > 0 && !toLocation) {
        setToLocation(data[0]._id);
      }
    },
    onError: (error) => {
      console.error('Error fetching shop locations:', error);
      toast({
        title: "Error",
        description: "Failed to load shop locations. Please try again later.",
        variant: "destructive",
      });
    },
  });
  
  // Set default locations when dialog opens
  useEffect(() => {
    if (open && fromLocations && fromLocations.length > 0) {
      console.log('Available from locations:', fromLocations);
      
      // Only set defaults if not already set
      if (!fromLocation && fromLocations.length > 0) {
        // Set first location as default from
        setFromLocation(fromLocations[0]._id);
        console.log('Setting default from location:', fromLocations[0].name);
      }
    }
    
    if (open && toLocations && toLocations.length > 0) {
      console.log('Available to locations:', toLocations);
      
      // Only set defaults if not already set
      if (!toLocation && toLocations.length > 0) {
        // Set first location as default to
        setToLocation(toLocations[0]._id);
        console.log('Setting default to location:', toLocations[0].name);
      }
    }
  }, [open, fromLocations, toLocations])
  
  // If no product is provided, don't render anything
  if (!product) {
    return null;
  }

  const isLoadingLocations = isLoadingFromLocations || isLoadingToLocations;

  const recordSaleMutation = useMutation({
    mutationFn: async (saleData: { 
      productId: string; 
      quantity: number; 
      price: number;
      fromLocation: string;
      toLocation: string;
    }) => {
      console.log('Sending sale data to API:', saleData); // Debug log
      
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: saleData.productId,
          quantity: Number(saleData.quantity),
          price: saleData.price,
          fromLocation: saleData.fromLocation, // Changed from sourceLocation
          toLocation: saleData.toLocation,     // Changed from destinationLocation
          date: new Date().toISOString(),
        })
      });
      
      const data = await response.json()
      
      if (!response.ok) {
        const error = new Error(data.message || "Failed to record sale")
        // @ts-ignore
        error.response = data
        throw error
      }
      
      return data
    },
    onSuccess: (data) => {
      console.log('Sale recorded successfully:', data);
      
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/products'] })
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] })
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] })
      
      // Reset form
      setQuantity(1)
      
      toast({
        title: "Sale recorded",
        description: `${quantity} ${product.name}(s) have been marked as sold.`,
        variant: "default"
      });
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Sale error:", error)
      
      // Handle specific error cases
      if (error.response?.availableStock !== undefined) {
        toast({
          title: "Insufficient stock",
          description: `Only ${error.response.availableStock} units available.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error recording sale",
          description: error.message || "An unexpected error occurred. Please try again.",
          variant: "destructive",
        })
      }
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('Form submitted with values:', {
      productId: product?._id,
      productName: product?.name,
      quantity,
      fromLocation,
      toLocation,
      fromLocations: fromLocations?.map(l => ({
        _id: l._id, 
        name: l.name, 
        type: l.type
      })),
      toLocations: toLocations?.map(l => ({
        _id: l._id, 
        name: l.name, 
        type: l.type
      }))
    })
    
    if (!quantity || quantity <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid quantity greater than 0.",
        variant: "destructive",
      })
      return
    }
    
    // Check if locations are loaded
    if (!fromLocations || fromLocations.length === 0 || !toLocations || toLocations.length === 0) {
      toast({
        title: "Locations not loaded",
        description: "Unable to load locations. Please try again.",
        variant: "destructive",
      })
      return
    }
    
    // Validate location selections
    if (!fromLocation || !toLocation) {
      console.error('Missing locations:', { fromLocation, toLocation })
      toast({
        title: "Location required",
        description: `Please select both from and to locations.\nFrom: ${fromLocation ? 'Selected' : 'Missing'}\nTo: ${toLocation ? 'Selected' : 'Missing'}`,
        variant: "destructive",
      })
      return
    }
    
    if (!product?._id) {
      console.error('Invalid product data:', product);
      toast({
        title: "Error",
        description: "Invalid product information. Please refresh the page and try again.",
        variant: "destructive",
      })
      return
    }
    
    // Use the product's current price or prompt for it
    const salePrice = product.price || 0
    
    try {
      await recordSaleMutation.mutateAsync({
        productId: product._id,
        quantity,
        price: salePrice,
        fromLocation, // Changed from sourceLocation
        toLocation,   // Changed from destinationLocation
      });
    } catch (error) {
      console.error('Error in recordSaleMutation:', error);
      // The error will be handled by the mutation's onError handler
      return;
    }
  }

  if (!product) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Record Sale</DialogTitle>
          <DialogDescription>
            Record a sale for {product.name}
          </DialogDescription>
        </DialogHeader>
        
        {isLoadingLocations && (
          <div className="flex items-center justify-center py-4">
            <p>Loading locations...</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={product.stockLevel}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fromLocation" className="text-right">
                From (Warehouse)
              </Label>
              <div className="col-span-3">
                <Select 
                  value={fromLocation} 
                  onValueChange={setFromLocation}
                  disabled={isLoadingFromLocations}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select from warehouse">
                      {fromLocation ? 
                        fromLocations?.find(loc => loc._id === fromLocation)?.name : 
                        'Select from warehouse'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {fromLocations?.map((location) => (
                      <SelectItem key={`from-${location._id}`} value={location._id}>
                        {location.name}
                      </SelectItem>
                    ))}
                    {!isLoadingFromLocations && (!fromLocations || fromLocations.length === 0) && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No warehouses found. Please add a warehouse location first.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select the warehouse where the product is coming from
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="toLocation" className="text-right">
                To (Shop)
              </Label>
              <div className="col-span-3">
                <Select 
                  value={toLocation} 
                  onValueChange={setToLocation}
                  disabled={isLoadingToLocations}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select to shop">
                      {toLocation ? 
                        toLocations?.find(loc => loc._id === toLocation)?.name : 
                        'Select to shop'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {toLocations?.map((location) => (
                      <SelectItem key={`to-${location._id}`} value={location._id}>
                        {location.name}
                      </SelectItem>
                    ))}
                    {!isLoadingToLocations && (!toLocations || toLocations.length === 0) && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No shops found. Please add a shop location first.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select the shop where the product is being sold
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">
                Unit Price
              </Label>
              <div className="col-span-3 text-sm">
                ${product.price?.toFixed(2) || '0.00'}
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">
                Total
              </Label>
              <div className="col-span-3 text-sm font-medium">
                ${((product.price || 0) * quantity).toFixed(2)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={recordSaleMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={recordSaleMutation.isPending}>
              {recordSaleMutation.isPending ? "Recording..." : "Record Sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}