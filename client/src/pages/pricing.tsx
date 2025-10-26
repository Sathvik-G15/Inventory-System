import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, DollarSign, Target, RefreshCw, Search, Calendar, Zap, AlertTriangle, CheckCircle } from "lucide-react";

export default function Pricing() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { toast } = useToast();

  // Fetch predictions and dynamic pricing data
  const { data: predictions = [], isLoading: isLoadingPredictions } = useQuery({
    queryKey: ["/api/ai/predictions"],
  });

  const { data: dynamicPricing = [], isLoading: isLoadingDynamicPricing } = useQuery({
    queryKey: ["/api/ai/dynamic-pricing"],
  });

  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Mutation for generating new predictions
  const generatePredictionsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/generate-predictions"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/dynamic-pricing"] });
      toast({
        title: "Price optimization updated",
        description: "New pricing recommendations have been generated.",
      });
    }
  });

  // Mutation for applying pricing recommendations
  const applyPricingMutation = useMutation({
    mutationFn: ({ productId, newPrice }: { productId: string; newPrice: number }) => 
      apiRequest("POST", `/api/ai/dynamic-pricing/${productId}/apply`, { newPrice }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/predictions"] });
      toast({
        title: "Price updated successfully",
        description: "The product price has been updated based on AI recommendations.",
      });
    }
  });

  // Get latest price predictions and combine with dynamic pricing data
  const { latestPricePredictions, pricingRecommendations, lastGeneratedDate } = useMemo(() => {
    if (!predictions.length && !dynamicPricing.length) {
      return { latestPricePredictions: [], pricingRecommendations: [], lastGeneratedDate: null };
    }

    // Get latest price predictions
    const pricePreds = predictions.filter((p: any) => p.predictionType === 'price');
    const latestPricePreds = Object.values(
      pricePreds.reduce((acc: any, prediction: any) => {
        const key = prediction.productId;
        const existing = acc[key];
        
        if (!existing || new Date(prediction.createdAt) > new Date(existing.createdAt)) {
          acc[key] = prediction;
        }
        
        return acc;
      }, {})
    );

    // Combine with dynamic pricing data
    const combinedRecommendations = latestPricePreds.map((prediction: any) => {
      const dynamicPricingData = (dynamicPricing as any[]).find(
        (dp: any) => dp.productId === prediction.productId
      );

      return {
        ...prediction,
        dynamicPricing: dynamicPricingData,
        product: (products as any[]).find((p: any) => p.id === prediction.productId || p._id === prediction.productId)
      };
    }).filter(rec => rec.product); // Only include recommendations with valid products

    // Find the most recent generation date
    const allDates = [
      ...predictions.map((p: any) => new Date(p.createdAt)),
      ...(dynamicPricing as any[]).map((dp: any) => dp.timestamp ? new Date(dp.timestamp) : new Date())
    ].filter(date => !isNaN(date.getTime()));

    const latestDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : null;

    return {
      latestPricePredictions: latestPricePreds,
      pricingRecommendations: combinedRecommendations,
      lastGeneratedDate: latestDate
    };
  }, [predictions, dynamicPricing, products]);

  // Filter recommendations based on search and category
  const filteredRecommendations = pricingRecommendations.filter((recommendation: any) => {
    const product = recommendation.product;
    if (!product) return false;

    const matchesSearch = search === "" || 
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(search.toLowerCase()));

    const productCategoryId = product.category?.id || product.category?._id || product.category;
    const matchesCategory = selectedCategory === "all" || productCategoryId === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Helper functions
  const getOptimizationImpact = (current: number, predicted: number) => {
    return ((predicted - current) / current) * 100;
  };

  const getImpactColor = (impact: number) => {
    if (impact > 10) return "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400";
    if (impact > 5) return "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-300";
    if (impact > 0) return "text-green-500 bg-green-25 dark:bg-green-900/10";
    if (impact > -5) return "text-orange-500 bg-orange-50 dark:bg-orange-900/20";
    if (impact > -10) return "text-orange-600 bg-orange-100 dark:bg-orange-900/30";
    return "text-red-600 bg-red-100 dark:bg-red-900/30";
  };

  const getImpactIcon = (impact: number) => {
    if (impact > 5) return <TrendingUp className="w-4 h-4" />;
    if (impact > 0) return <TrendingUp className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400";
    if (confidence >= 60) return "text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return "High";
    if (confidence >= 60) return "Medium";
    return "Low";
  };

  const getStrategyBadge = (strategy: string) => {
    const strategies: any = {
      demand_based: { label: "Demand", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30" },
      expiry_based: { label: "Expiry", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30" },
      hybrid: { label: "Hybrid", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30" },
      competitive: { label: "Competitive", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30" }
    };
    return strategies[strategy] || { label: strategy, color: "bg-gray-100 text-gray-700" };
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Statistics
  const stats = useMemo(() => {
    const total = filteredRecommendations.length;
    const increaseCount = filteredRecommendations.filter((rec: any) => 
      getOptimizationImpact(parseFloat(rec.currentValue), parseFloat(rec.predictedValue)) > 0
    ).length;
    const decreaseCount = filteredRecommendations.filter((rec: any) => 
      getOptimizationImpact(parseFloat(rec.currentValue), parseFloat(rec.predictedValue)) < 0
    ).length;
    const highConfidenceCount = filteredRecommendations.filter((rec: any) => 
      parseFloat(rec.confidence) >= 80
    ).length;
    const potentialRevenueIncrease = filteredRecommendations.reduce((sum: number, rec: any) => {
      const impact = getOptimizationImpact(parseFloat(rec.currentValue), parseFloat(rec.predictedValue));
      return impact > 0 ? sum + impact : sum;
    }, 0);

    return {
      total,
      increaseCount,
      decreaseCount,
      highConfidenceCount,
      potentialRevenueIncrease: potentialRevenueIncrease.toFixed(1)
    };
  }, [filteredRecommendations]);

  const isLoading = isLoadingPredictions || isLoadingDynamicPricing;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <Header 
          title="Price Optimization" 
          subtitle="AI-powered pricing recommendations to maximize your revenue" 
        />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pt-24 lg:pt-20">
          {/* Header actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-muted-foreground">
                <Zap className="w-5 h-5 mr-2 text-primary" />
                {lastGeneratedDate ? (
                  <span>Last updated: {formatDate(lastGeneratedDate)}</span>
                ) : (
                  <span>No pricing data available</span>
                )}
              </div>
            </div>
            <Button 
              onClick={() => generatePredictionsMutation.mutate()}
              disabled={generatePredictionsMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${generatePredictionsMutation.isPending ? 'animate-spin' : ''}`} />
              {generatePredictionsMutation.isPending ? 'Generating...' : 'Generate Recommendations'}
            </Button>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search products by name or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {(categories as any[]).map((category: any) => (
                  <SelectItem key={category.id || category._id} value={category.id || category._id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Products Analyzed</p>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  </div>
                  <Target className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Price Increases</p>
                    <p className="text-2xl font-bold text-green-600">{stats.increaseCount}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Price Decreases</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.decreaseCount}</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Potential Revenue Impact</p>
                    <p className="text-2xl font-bold text-blue-600">+{stats.potentialRevenueIncrease}%</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pricing Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing Recommendations</CardTitle>
              <CardDescription>
                AI-generated pricing suggestions based on market analysis, demand patterns, and expiry dates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="bg-muted rounded-lg h-20 animate-pulse" />
                  ))}
                </div>
              ) : filteredRecommendations.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Pricing Recommendations</h3>
                  <p className="text-muted-foreground mb-4">
                    {isLoading 
                      ? 'Loading pricing recommendations...' 
                      : 'Generate AI-powered pricing recommendations to get started.'
                    }
                  </p>
                  {!isLoading && (
                    <Button 
                      onClick={() => generatePredictionsMutation.mutate()}
                      disabled={generatePredictionsMutation.isPending}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Generate Recommendations
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredRecommendations.map((recommendation: any) => {
                    const product = recommendation.product;
                    const currentPrice = parseFloat(recommendation.currentValue);
                    const recommendedPrice = parseFloat(recommendation.predictedValue);
                    const impact = getOptimizationImpact(currentPrice, recommendedPrice);
                    const confidence = parseFloat(recommendation.confidence);
                    const dynamicPricingData = recommendation.dynamicPricing;
                    const strategy = dynamicPricingData?.strategy || 'demand_based';

                    const strategyInfo = getStrategyBadge(strategy);

                    return (
                      <div key={recommendation.id} className="flex flex-col lg:flex-row gap-6 p-4 border rounded-lg bg-card">
                        {/* Product Info */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-lg">{product.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                {product.sku && (
                                  <Badge variant="outline" className="text-xs">
                                    {product.sku}
                                  </Badge>
                                )}
                                {product.category && (
                                  <Badge variant="secondary" className="text-xs">
                                    {product.category.name || product.category}
                                  </Badge>
                                )}
                                <Badge className={`text-xs ${strategyInfo.color}`}>
                                  {strategyInfo.label}
                                </Badge>
                              </div>
                            </div>
                            <Badge className={getConfidenceColor(confidence)}>
                              {getConfidenceLabel(confidence)} ({confidence}%)
                            </Badge>
                          </div>

                          {/* Pricing Details */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                            <div>
                              <p className="text-sm text-muted-foreground">Current Price</p>
                              <p className="text-lg font-semibold">${currentPrice.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Recommended Price</p>
                              <p className="text-lg font-semibold text-blue-600">${recommendedPrice.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Expected Impact</p>
                              <div className="flex items-center gap-2">
                                {getImpactIcon(impact)}
                                <Badge className={getImpactColor(impact)}>
                                  {impact > 0 ? '+' : ''}{impact.toFixed(1)}%
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Confidence Bar */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Recommendation Confidence</span>
                              <span className="font-medium">{confidence}%</span>
                            </div>
                            <Progress value={confidence} className="h-2" />
                          </div>

                          {/* Additional Factors */}
                          {dynamicPricingData && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {dynamicPricingData.factors?.map((factor: string, index: number) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {factor.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Action Section */}
                        <div className="flex flex-col gap-2 lg:w-48 lg:border-l lg:pl-6">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => applyPricingMutation.mutate({
                              productId: product.id || product._id,
                              newPrice: recommendedPrice
                            })}
                            disabled={applyPricingMutation.isPending}
                          >
                            {applyPricingMutation.isPending ? (
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4 mr-2" />
                            )}
                            Apply Price
                          </Button>
                          
                          

                          {recommendation.createdAt && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Generated: {formatDate(new Date(recommendation.createdAt))}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}