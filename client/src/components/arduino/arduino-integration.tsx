import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Cpu, 
  Wifi, 
  WifiOff, 
  Thermometer, 
  Weight, 
  Radio, 
  Eye, 
  Droplets,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Settings,
  Plus,
  Trash2,
  Edit,
  Activity,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ArduinoSensor {
  _id: string;
  sensorId: string;
  productId?: string;
  sensorType: 'weight' | 'proximity' | 'temperature' | 'humidity' | 'rfid';
  value: number;
  unit: string;
  timestamp: string;
  location?: string;
  isValid: boolean;
  productName?: string;
  locationName?: string;
}

interface Product {
  _id: string;
  name: string;
  sku: string;
  arduinoSensorId?: string;
}

interface Location {
  _id: string;
  name: string;
}

export function ArduinoIntegration() {
  const { toast } = useToast();
  const [selectedSensor, setSelectedSensor] = useState<string>("");
  const [showAddSensor, setShowAddSensor] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  // Fetch Arduino sensor data
  const { data: sensorData = [], isLoading, refetch } = useQuery<ArduinoSensor[]>({
    queryKey: ['/api/arduino/sensors'],
    refetchInterval: 5000, // Refetch every 5 seconds for real-time data
  });

  // Fetch products for sensor assignment
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Fetch locations
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['/api/locations'],
  });

  // Get historical data for selected sensor
  const { data: sensorHistory = [] } = useQuery({
    queryKey: ['/api/arduino/sensors', selectedSensor, 'history'],
    enabled: !!selectedSensor,
  });

  // Add new Arduino sensor
  const addSensorMutation = useMutation({
    mutationFn: async (data: {
      sensorId: string;
      sensorType: string;
      productId?: string;
      location?: string;
    }) => {
      const res = await apiRequest("POST", "/api/arduino/sensors", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/arduino/sensors'] });
      setShowAddSensor(false);
      toast({
        title: "Arduino sensor added",
        description: "The sensor has been successfully registered.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add Arduino sensor.",
        variant: "destructive",
      });
    }
  });

  // Update sensor configuration
  const updateSensorMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const res = await apiRequest("PUT", `/api/arduino/sensors/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/arduino/sensors'] });
      toast({
        title: "Sensor updated",
        description: "The sensor configuration has been updated.",
      });
    }
  });

  // Simulate Arduino connection
  const toggleConnection = () => {
    if (connectionStatus === 'disconnected') {
      setConnectionStatus('connecting');
      setTimeout(() => {
        setConnectionStatus('connected');
        setIsConnected(true);
        toast({
          title: "Arduino Connected",
          description: "Successfully connected to Arduino devices.",
        });
      }, 2000);
    } else {
      setConnectionStatus('disconnected');
      setIsConnected(false);
      toast({
        title: "Arduino Disconnected",
        description: "Disconnected from Arduino devices.",
      });
    }
  };

  // Get sensor icon
  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'weight': return Weight;
      case 'temperature': return Thermometer;
      case 'humidity': return Droplets;
      case 'proximity': return Eye;
      case 'rfid': return Radio;
      default: return Cpu;
    }
  };

  // Get sensor status color
  const getSensorStatusColor = (sensor: ArduinoSensor) => {
    const now = new Date().getTime();
    const sensorTime = new Date(sensor.timestamp).getTime();
    const timeDiff = now - sensorTime;
    
    if (timeDiff > 60000) return 'destructive'; // More than 1 minute
    if (timeDiff > 30000) return 'default'; // More than 30 seconds
    return 'secondary'; // Recent
  };

  // Format sensor value
  const formatSensorValue = (sensor: ArduinoSensor) => {
    return `${sensor.value} ${sensor.unit}`;
  };

  // Group sensors by type
  const sensorsByType = sensorData.reduce((acc, sensor) => {
    if (!acc[sensor.sensorType]) {
      acc[sensor.sensorType] = [];
    }
    acc[sensor.sensorType].push(sensor);
    return acc;
  }, {} as Record<string, ArduinoSensor[]>);

  useEffect(() => {
    // Simulate periodic sensor data updates
    if (isConnected) {
      const interval = setInterval(() => {
        refetch();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [isConnected, refetch]);

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Cpu className="w-5 h-5" />
                <span>Arduino Integration</span>
              </CardTitle>
              <CardDescription>
                Monitor and manage connected Arduino sensors for real-time inventory tracking
              </CardDescription>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge 
                variant={connectionStatus === 'connected' ? 'secondary' : 'destructive'}
                className="flex items-center space-x-1"
              >
                {connectionStatus === 'connected' ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    <span>Connected</span>
                  </>
                ) : connectionStatus === 'connecting' ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Connecting</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    <span>Disconnected</span>
                  </>
                )}
              </Badge>
              
              <Button
                onClick={toggleConnection}
                variant={isConnected ? "destructive" : "default"}
                size="sm"
              >
                {isConnected ? "Disconnect" : "Connect"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sensor Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sensors</p>
                <p className="text-2xl font-bold text-foreground">{sensorData.length}</p>
              </div>
              <Cpu className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Sensors</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {sensorData.filter(s => s.isValid).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Offline Sensors</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {sensorData.filter(s => !s.isValid).length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Connected Products</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {sensorData.filter(s => s.productId).length}
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sensor Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sensor Management</CardTitle>
            <Button onClick={() => setShowAddSensor(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Sensor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="weight">Weight Sensors</TabsTrigger>
              <TabsTrigger value="temperature">Temperature</TabsTrigger>
              <TabsTrigger value="proximity">Proximity</TabsTrigger>
              <TabsTrigger value="rfid">RFID</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4">
                {sensorData.map((sensor) => {
                  const Icon = getSensorIcon(sensor.sensorType);
                  return (
                    <Card key={sensor._id} className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedSensor(sensor.sensorId)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            <div>
                              <p className="font-medium text-foreground">
                                {sensor.sensorId}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {sensor.sensorType} • {formatSensorValue(sensor)}
                              </p>
                              {sensor.productName && (
                                <p className="text-xs text-muted-foreground/70">
                                  Connected to: {sensor.productName}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Badge variant={getSensorStatusColor(sensor)}>
                              {sensor.isValid ? 'Online' : 'Offline'}
                            </Badge>
                            <p className="text-xs text-muted-foreground/70">
                              {new Date(sensor.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {Object.entries(sensorsByType).map(([type, sensors]) => (
              <TabsContent key={type} value={type} className="space-y-4">
                <div className="grid gap-4">
                  {sensors.map((sensor) => {
                    const Icon = getSensorIcon(sensor.sensorType);
                    return (
                      <Card key={sensor._id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                              <div>
                                <p className="font-medium text-foreground">
                                  {sensor.sensorId}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Current: {formatSensorValue(sensor)}
                                </p>
                                {sensor.productName && (
                                  <p className="text-xs text-muted-foreground/70">
                                    Product: {sensor.productName}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Button size="sm" variant="outline">
                                <Settings className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <BarChart3 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Historical Data Chart */}
      {selectedSensor && sensorHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sensor History: {selectedSensor}</CardTitle>
            <CardDescription>
              Real-time data from the selected Arduino sensor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sensorHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Sensor Modal */}
      <Dialog open={showAddSensor} onOpenChange={setShowAddSensor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Arduino Sensor</DialogTitle>
            <DialogDescription>
              Register a new Arduino sensor for inventory monitoring
            </DialogDescription>
          </DialogHeader>
          
          <form className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  addSensorMutation.mutate({
                    sensorId: formData.get('sensorId') as string,
                    sensorType: formData.get('sensorType') as string,
                    productId: formData.get('productId') as string || undefined,
                    location: formData.get('location') as string || undefined,
                  });
                }}>
            
            <div>
              <Label htmlFor="sensorId">Sensor ID</Label>
              <Input 
                id="sensorId"
                name="sensorId"
                placeholder="e.g., ARD_SENSOR_001"
                required
              />
            </div>

            <div>
              <Label htmlFor="sensorType">Sensor Type</Label>
              <Select name="sensorType" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select sensor type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight">Weight Sensor</SelectItem>
                  <SelectItem value="temperature">Temperature Sensor</SelectItem>
                  <SelectItem value="humidity">Humidity Sensor</SelectItem>
                  <SelectItem value="proximity">Proximity Sensor</SelectItem>
                  <SelectItem value="rfid">RFID Reader</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="productId">Associated Product (Optional)</Label>
              <Select name="productId">
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product._id} value={product._id}>
                      {product.name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="location">Location (Optional)</Label>
              <Select name="location">
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location._id} value={location._id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowAddSensor(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addSensorMutation.isPending}>
                {addSensorMutation.isPending ? "Adding..." : "Add Sensor"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}