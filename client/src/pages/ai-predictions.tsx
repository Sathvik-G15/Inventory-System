import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bot, TrendingUp, TrendingDown, Target, DollarSign, Package, MapPin, Calendar, RefreshCw } from "lucide-react";

export default function AiPredictions() {
  const { toast } = useToast();
  
  const { data: predictions = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/ai/predictions"],
  });

  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
  });

  // Location Insights controls
  const [days, setDays] = useState<number>(30);
  const [sortBy, setSortBy] = useState<'potential' | 'confidence' | 'growth' | 'revenue'>("potential");
  const [enrich, setEnrich] = useState<boolean>(true);

  const { data: locationInsights = [], isLoading: isLoadingLocations } = useQuery({
    queryKey: [`/api/ai/location-insights?days=${days}&enrich=${enrich ? '1' : '0'}&sort=${sortBy}`],
  });

  const generatePredictionsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/generate-predictions"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/predictions"] });
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey?.[0] === 'string' && (q.queryKey[0] as string).startsWith('/api/ai/location-insights') });
      toast({
        title: "Predictions generated",
        description: "AI predictions have been updated with latest data.",
      });
    }
  });

  // Get only the latest prediction for each product and type
  const { latestDemandPredictions, latestPricePredictions, lastGeneratedDate } = useMemo(() => {
    if (!predictions.length) {
      return { latestDemandPredictions: [], latestPricePredictions: [], lastGeneratedDate: null };
    }

    // Group predictions by productId and type, then get the latest one for each
    const predictionsByProductAndType = predictions.reduce((acc, prediction) => {
      const key = `${prediction.productId}-${prediction.predictionType}`;
      const existing = acc[key];
      
      if (!existing || new Date(prediction.createdAt) > new Date(existing.createdAt)) {
        acc[key] = prediction;
      }
      
      return acc;
    }, {});

    // Separate by type
    const demandPredictions = Object.values(predictionsByProductAndType)
      .filter((p: any) => p.predictionType === 'demand');
    
    const pricePredictions = Object.values(predictionsByProductAndType)
      .filter((p: any) => p.predictionType === 'price');

    // Find the most recent generation date
    const allDates = predictions.map(p => new Date(p.createdAt));
    const latestDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : null;

    return {
      latestDemandPredictions: demandPredictions,
      latestPricePredictions: pricePredictions,
      lastGeneratedDate: latestDate
    };
  }, [predictions]);

  const getId = (x: any) => x?.id || x?._id;
  const productIndex = new Map((products as any[]).map((p: any) => [getId(p), p]));
  const resolveProduct = (prediction: any) => {
    const pid = prediction.productId || getId(prediction.product);
    return productIndex.get(pid) 
      || (products as any[]).find((p: any) => getId(p) === pid)
      || prediction.product 
      || null;
  };
  const resolveProductName = (prediction: any) => {
    const p = resolveProduct(prediction);
    return p?.name || prediction.productName || "Unknown Product";
  };

  const getConfidenceColor = (confidence: any) => {
    const conf = parseFloat(confidence);
    if (conf >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (conf >= 60) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  };

  const getConfidenceLabel = (confidence: any) => {
    const conf = parseFloat(confidence);
    if (conf >= 80) return "High";
    if (conf >= 60) return "Medium";
    return "Low";
  };

  // Helper for safe arrays
  const asArr = (x: any) => Array.isArray(x) ? x : [];

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <Header title="AI Predictions" subtitle="Smart insights powered by machine learning" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pt-24 lg:pt-20">
          {/* Header actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-muted-foreground">
                <Bot className="w-5 h-5 mr-2 text-primary" />
                {lastGeneratedDate ? (
                  <span>Last generated: {formatDate(lastGeneratedDate)}</span>
                ) : (
                  <span>No predictions generated yet</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                onClick={() => generatePredictionsMutation.mutate()}
                disabled={generatePredictionsMutation.isPending}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-generate-predictions"
              >
                <Bot className="w-4 h-4 mr-2" />
                {generatePredictionsMutation.isPending ? "Generating..." : "Generate New Predictions"}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="demand" className="space-y-6">
            <TabsList>
              <TabsTrigger value="demand">
                Demand Forecasting
                {latestDemandPredictions.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {latestDemandPredictions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="pricing">
                Price Optimization
                {latestPricePredictions.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {latestPricePredictions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="locations">Location Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="demand" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Latest Demand Forecasts</h3>
                  <p className="text-sm text-muted-foreground">
                    Showing the most recent predictions for each product
                  </p>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {latestDemandPredictions.length} products
                </Badge>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {latestDemandPredictions.length === 0 && !isLoading ? (
                  <div className="col-span-full">
                    <Card className="bg-card">
                      <CardContent className="text-center py-12">
                        <Bot className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">No Demand Predictions Available</h3>
                        <p className="text-muted-foreground mb-4">
                          Generate AI predictions to see the latest demand forecasts for your products.
                        </p>
                        <Button 
                          onClick={() => generatePredictionsMutation.mutate()}
                          className="bg-primary hover:bg-primary/90"
                        >
                          Generate Predictions
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  latestDemandPredictions.map((prediction: any) => {
                    const product = resolveProduct(prediction);
                    const confidence = Number(prediction.confidence);
                    const currentValue = Number(prediction.currentValue);
                    const predictedValue = Number(prediction.predictedValue);
                    const trend = predictedValue > currentValue ? 'up' : 'down';
                    const changePercent = currentValue > 0 ? ((predictedValue - currentValue) / currentValue * 100) : 0;

                    return (
                      <Card key={`${prediction.productId}-${prediction.createdAt}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{resolveProductName(prediction)}</CardTitle>
                            <Badge className={getConfidenceColor(prediction.confidence)}>
                              {getConfidenceLabel(prediction.confidence)}
                            </Badge>
                          </div>
                          <CardDescription className="text-muted-foreground">
                            7-day demand forecast
                            {prediction.createdAt && (
                              <span className="block text-xs mt-1">
                                Generated: {formatDate(new Date(prediction.createdAt))}
                              </span>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Current 7-day total</span>
                              <span className="font-semibold text-foreground">
                                {Number.isFinite(currentValue) ? currentValue : '-'} units
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Predicted next 7 days</span>
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-foreground">
                                  {Number.isFinite(predictedValue) ? predictedValue : '-'} units
                                </span>
                                {trend === 'up' ? (
                                  <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Confidence</span>
                                <span className="font-medium text-foreground">{confidence.toFixed(0)}%</span>
                              </div>
                              <Progress value={confidence} className="h-2" />
                            </div>

                            <div className="pt-2 border-t border-border">
                              <div className={`text-sm font-medium ${trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {Number.isFinite(changePercent) ? `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% change expected` : '-'}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Based on sales history and seasonality
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Latest Price Recommendations</h3>
                  <p className="text-sm text-muted-foreground">
                    Showing the most recent pricing optimizations for each product
                  </p>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {latestPricePredictions.length} products
                </Badge>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {latestPricePredictions.length === 0 && !isLoading ? (
                  <div className="col-span-full">
                    <Card>
                      <CardContent className="text-center py-12">
                        <DollarSign className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Price Predictions</h3>
                        <p className="text-slate-600 mb-4">
                          Generate AI predictions to see the latest pricing optimization recommendations.
                        </p>
                        <Button onClick={() => generatePredictionsMutation.mutate()}>
                          Generate Predictions
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  latestPricePredictions.map((prediction: any) => {
                    const product = resolveProduct(prediction);
                    const confidence = Number(prediction.confidence);
                    const currentPrice = Number(prediction.currentValue);
                    const optimizedPrice = Number(prediction.predictedValue);
                    const priceDiff = Number.isFinite(currentPrice) && Number.isFinite(optimizedPrice)
                      ? optimizedPrice - currentPrice
                      : NaN;
                    const changePercent = Number.isFinite(currentPrice) && currentPrice !== 0
                      ? (priceDiff / currentPrice * 100)
                      : NaN;

                    return (
                      <Card key={`${prediction.productId}-${prediction.createdAt}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{resolveProductName(prediction)}</CardTitle>
                            <Badge className={getConfidenceColor(prediction.confidence)}>
                              {getConfidenceLabel(prediction.confidence)}
                            </Badge>
                          </div>
                          <CardDescription>
                            Price optimization recommendation
                            {prediction.createdAt && (
                              <span className="block text-xs mt-1">
                                Generated: {formatDate(new Date(prediction.createdAt))}
                              </span>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-600">Current price</span>
                              <span className="font-semibold">
                                ${Number.isFinite(currentPrice) ? currentPrice.toFixed(2) : '-'}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-600">Optimized price</span>
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold">
                                  ${Number.isFinite(optimizedPrice) ? optimizedPrice.toFixed(2) : '-'}
                                </span>
                                {Number.isFinite(priceDiff) && priceDiff > 0 ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-600" />
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">Confidence</span>
                                <span className="font-medium">
                                  {Number.isFinite(confidence) ? confidence.toFixed(0) : '-'}%
                                </span>
                              </div>
                              <Progress value={confidence} className="h-2" />
                            </div>

                            <div className="pt-2 border-t">
                              <div className={`text-sm font-medium ${Number.isFinite(priceDiff) && priceDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {Number.isFinite(priceDiff) ? 
                                  `${priceDiff > 0 ? '+' : ''}$${Math.abs(priceDiff).toFixed(2)} (${Number.isFinite(changePercent) ? (changePercent > 0 ? '+' : '') + changePercent.toFixed(1) : '-'}%)` 
                                  : '-'
                                }
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                Based on demand elasticity and competition
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </TabsContent>

            <TabsContent value="locations" className="space-y-6">
              {/* Controls and content remain the same */}
              <div className="flex flex-wrap items-center gap-4 justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="days" className="text-sm text-muted-foreground">Days</Label>
                    <Select
                      value={days.toString()}
                      onValueChange={(value) => setDays(parseInt(value))}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Days" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="sort" className="text-sm text-muted-foreground">Sort by</Label>
                    <Select
                      value={sortBy}
                      onValueChange={(value) => setSortBy(value as any)}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="potential">Potential</SelectItem>
                        <SelectItem value="confidence">Confidence</SelectItem>
                        <SelectItem value="growth">Growth</SelectItem>
                        <SelectItem value="revenue">Revenue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enrich"
                    checked={enrich}
                    onChange={(e) => setEnrich(e.target.checked)}
                    className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-primary"
                  />
                  <label htmlFor="enrich" className="text-sm text-muted-foreground">
                    Enrich with external data
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {asArr(locationInsights).length === 0 && !isLoadingLocations ? (
                  <div className="col-span-full">
                    <Card>
                      <CardContent className="text-center py-12">
                        <MapPin className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Location Insights</h3>
                        <p className="text-slate-600">Generate sales data to see location insights.</p>
                      </CardContent>
                    </Card>
                  </div>
                ) : asArr(locationInsights).map((insight: any, index: number) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center">
                          <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                          {insight.locationName || insight.location || 'Unknown'}
                        </CardTitle>
                        <Badge className={getConfidenceColor(insight.confidence || 0)}>
                          {getConfidenceLabel(insight.confidence || 0)}
                        </Badge>
                      </div>
                      <CardDescription>{insight.opportunity || 'Market overview'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Market potential</span>
                          <span className="font-semibold text-green-600">{insight.potential || `$${(insight.totalRevenue || 0).toLocaleString()}`}</span>
                        </div>

                        {Number.isFinite(Number(insight.growth)) && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">7d growth</span>
                            <span className={`font-semibold ${insight.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {insight.growth > 0 ? '+' : ''}{(Number(insight.growth) * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Confidence</span>
                            <span className="font-medium">{Number.isFinite(Number(insight.confidence)) ? Number(insight.confidence).toFixed(0) : '-'}%</span>
                          </div>
                          <Progress value={Number(insight.confidence) || 0} className="h-2" />
                        </div>

                        <div className="pt-2 border-t">
                          <div className="text-sm font-medium text-slate-900 mb-2">Top products:</div>
                          <div className="flex flex-wrap gap-1">
                            {asArr(insight.topProducts || insight.products).map((product: any, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {product}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {(insight.geo || insight.weather) && (
                          <div className="pt-2 border-t text-xs text-slate-600">
                            {insight.geo?.displayName && (
                              <div>Area: {insight.geo.displayName}</div>
                            )}
                            {(Number.isFinite(insight.weather?.avgTemp) || Number.isFinite(insight.weather?.totalPrecip)) && (
                              <div>
                                Weather: {Number.isFinite(insight.weather?.avgTemp) ? `Avg temp ${insight.weather.avgTemp.toFixed(1)}°C` : ''}
                                {Number.isFinite(insight.weather?.avgTemp) && Number.isFinite(insight.weather?.totalPrecip) ? ' · ' : ''}
                                {Number.isFinite(insight.weather?.totalPrecip) ? `Precip ${insight.weather.totalPrecip.toFixed(1)}mm` : ''}
                              </div>
                            )}
                          </div>
                        )}

                        <Button className="w-full mt-4" variant="outline">
                          <Target className="w-4 h-4 mr-2" />
                          Explore Market
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}