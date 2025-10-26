import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Plus, Building, Package } from "lucide-react";

export default function Locations() {
  const [search, setSearch] = useState("");
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [newLocation, setNewLocation] = useState({
    name: "",
    type: "warehouse", // Default to warehouse
    address: "",
    city: "",
    state: "",
    country: "",
    manager: "",
    capacity: 0,
  });
  const { toast } = useToast();

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["/api/locations"],
  });

  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
  });

  const createLocationMutation = useMutation({
    mutationFn: async (locationData: any) => {
      console.log('Sending location data to server:', locationData);
      const response = await apiRequest("POST", "/api/locations", locationData);
      console.log('Server response:', response);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setShowAddLocation(false);
      setNewLocation({
        name: "",
        type: "warehouse",
        address: "",
        city: "",
        state: "",
        country: "",
        manager: "",
        capacity: 0,
      });
      toast({
        title: "Location added",
        description: "New location has been created successfully.",
      });
    }
  });

  const filteredLocations = useMemo(() =>
    (locations as any[]).filter((location: any) =>
      (location.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (location.city || "").toLowerCase().includes(search.toLowerCase())
    ), [locations, search]);

  const getId = (x: any) => x?.id || x?._id;

  const getProductsAtLocation = (locationId: string) => {
    return (products as any[]).filter((product: any) => {
      // products API populates 'location', so compare by populated object id or raw string
      const loc = (product as any).location;
      const locId = typeof loc === 'string' ? loc : loc?.id || loc?._id;
      return locId === locationId;
    });
  };

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting location with type:', newLocation.type); // Debug log
    
    // Build payload matching backend insertLocationSchema
    const payload = {
      name: newLocation.name,
      type: newLocation.type, // Use the selected type directly
      address: newLocation.address || undefined,
      city: newLocation.city || undefined,
      state: newLocation.state || undefined,
      country: newLocation.country || undefined,
      manager: newLocation.manager || undefined,
      capacity: newLocation.capacity ? Number(newLocation.capacity) : undefined,
    };
    
    console.log('Location payload:', payload); // Debug log
    createLocationMutation.mutate(payload);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <Header 
          title="Location Insights" 
          subtitle="Monitor inventory performance across all warehouse and distribution locations"
        />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pt-24 lg:pt-20">
          {/* Summary Cards: show only real metric (Total Locations) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Locations</p>
                    <p className="text-2xl font-bold text-foreground">{(locations as any[]).length}</p>
                  </div>
                  <Building className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex-1 max-w-md">
              <Input
                type="text"
                placeholder="Search locations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Location
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Location</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddLocation} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Location Name *</Label>
                      <Input
                        id="name"
                        value={newLocation.name}
                        onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="type">Location Type *</Label>
                      <select
                        id="type"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={newLocation.type}
                        onChange={(e) => setNewLocation({...newLocation, type: e.target.value as 'warehouse' | 'shop'})}
                        required
                      >
                        <option value="warehouse">Warehouse</option>
                        <option value="shop">Shop/Store</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={newLocation.address}
                      onChange={(e) => setNewLocation({...newLocation, address: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={newLocation.city}
                        onChange={(e) => setNewLocation({...newLocation, city: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={newLocation.state}
                        onChange={(e) => setNewLocation({...newLocation, state: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={newLocation.country}
                      onChange={(e) => setNewLocation({...newLocation, country: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="capacity">Capacity (optional)</Label>
                      <Input
                        id="capacity"
                        type="number"
                        placeholder="e.g. 1000"
                        value={newLocation.capacity || ''}
                        onChange={(e) => setNewLocation({...newLocation, capacity: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="manager">Manager</Label>
                      <Input
                        id="manager"
                        value={newLocation.manager}
                        onChange={(e) => setNewLocation({...newLocation, manager: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowAddLocation(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createLocationMutation.isPending}
                    >
                      {createLocationMutation.isPending ? "Adding..." : "Add Location"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Removed mock performance cards */}

          {/* Locations List */}
          <Card>
            <CardHeader>
              <CardTitle>All Locations</CardTitle>
              <CardDescription>
                Manage and monitor all warehouse and distribution locations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-muted rounded-lg h-16 animate-pulse" />
                  ))}
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No locations found</h3>
                  <p className="text-muted-foreground">
                    {search ? 'Try a different search term' : 'Add your first location to get started'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredLocations.map((location: any) => {
                    const productsAtLocation = getProductsAtLocation(getId(location));
                    
                    return (
                      <div
                        key={getId(location)}
                        className="border border-muted-foreground rounded-lg p-4 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                            <MapPin className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground mb-1">{location.name}</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              {[location.address, location.city, location.state, location.country].filter(Boolean).join(", ")}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={location.type === 'warehouse' ? 'default' : 'secondary'}> 
                                {location.type === 'warehouse' ? 'Warehouse' : 
                                 location.type === 'shop' ? 'Shop/Store' : 'Other'}
                              </Badge>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {location.city && location.country 
                                    ? `${location.city}, ${location.country}`
                                    : location.city || location.country || 'No location set'}
                                </span>
                              </div>
                              {location.manager && (
                                <Badge variant="outline">
                                  Manager: {location.manager}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="ml-4">
                            <Button size="sm" variant="outline" onClick={() => { setSelectedLocation(location); setShowDetails(true); }}>
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location Details Dialog */}
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Location Details</DialogTitle>
              </DialogHeader>
              {selectedLocation && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{selectedLocation.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedLocation.city}, {selectedLocation.country}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedLocation.manager && (
                        <Badge variant="outline">Manager: {selectedLocation.manager}</Badge>
                      )}
                      {typeof selectedLocation.capacity === 'number' && (
                        <Badge variant="outline">Capacity: {selectedLocation.capacity}</Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-foreground mb-2">Products at this location</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {getProductsAtLocation(getId(selectedLocation)).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No products found at this location.</p>
                      ) : (
                        getProductsAtLocation(getId(selectedLocation)).map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between border border-border rounded p-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">{p.name}</p>
                              <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-foreground">Stock: {p.stockLevel}</p>
                              <p className="text-xs text-muted-foreground">Min: {p.minStockLevel} • Max: {p.maxStockLevel}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}