// AI service for generating predictions and recommendations
export class AIService {
  // Simple linear regression for demand prediction
  static predictDemand(salesHistory: number[], days: number = 7): {
    prediction: number;
    confidence: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    if (salesHistory.length === 0) {
      return { prediction: 0, confidence: 0, trend: 'stable' };
    }

    // Calculate trend using simple linear regression
    const n = salesHistory.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = salesHistory;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Predict future values
    const futureX = n + days - 1;
    const prediction = Math.max(0, slope * futureX + intercept);
    
    // Calculate confidence based on R-squared
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);
    const confidence = Math.max(0, Math.min(100, rSquared * 100));
    
    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (slope > 0.1) trend = 'increasing';
    else if (slope < -0.1) trend = 'decreasing';
    
    return { prediction: Math.round(prediction), confidence, trend };
  }

  // Price optimization using demand elasticity
  static optimizePrice(currentPrice: number, currentDemand: number, stockLevel: number): {
    optimizedPrice: number;
    confidence: number;
    expectedDemand: number;
    reasoning: string;
  } {
    let priceFactor = 1.0;
    let reasoning = "Maintain current pricing";
    let confidence = 60;

    // Adjust based on stock level
    if (stockLevel < 10) {
      // Low stock - increase price
      priceFactor = 1.05 + Math.random() * 0.05;
      reasoning = "Low stock detected - increase price to maximize profit per unit";
      confidence = 75;
    } else if (stockLevel > 100) {
      // High stock - decrease price to move inventory
      priceFactor = 0.95 - Math.random() * 0.05;
      reasoning = "High stock levels - reduce price to increase turnover";
      confidence = 70;
    } else {
      // Medium stock - minor adjustments
      priceFactor = 0.98 + Math.random() * 0.04;
      reasoning = "Optimal stock levels - minor price optimization";
      confidence = 65;
    }

    const optimizedPrice = currentPrice * priceFactor;
    
    // Estimate demand change (simple elasticity model)
    const priceChange = (optimizedPrice - currentPrice) / currentPrice;
    const demandElasticity = -1.2; // Assume price elasticity of -1.2
    const demandChange = demandElasticity * priceChange;
    const expectedDemand = Math.max(0, currentDemand * (1 + demandChange));

    return {
      optimizedPrice: parseFloat(optimizedPrice.toFixed(2)),
      confidence,
      expectedDemand: Math.round(expectedDemand),
      reasoning
    };
  }

  // Generate location insights
  static generateLocationInsights(salesData: any[]): Array<{
    location: string;
    opportunity: string;
    potential: string;
    confidence: number;
    products: string[];
  }> {
    // Mock location insights - in production, this would use real market data
    const locations = [
      {
        location: "New York, NY",
        opportunity: "High demand for electronics and tech accessories",
        potential: "$125K annually",
        confidence: 85,
        products: ["Smartphones", "Laptops", "Headphones"],
        marketSize: 8.3,
        competition: "high",
      },
      {
        location: "Austin, TX",
        opportunity: "Growing tech hub with young professionals",
        potential: "$95K annually", 
        confidence: 79,
        products: ["Gaming Equipment", "Smart Devices", "Tech Accessories"],
        marketSize: 2.3,
        competition: "medium",
      },
      {
        location: "Seattle, WA",
        opportunity: "Tech-savvy population with high disposable income",
        potential: "$108K annually",
        confidence: 82,
        products: ["Premium Electronics", "Software", "Gaming"],
        marketSize: 3.9,
        competition: "high",
      },
      {
        location: "Denver, CO",
        opportunity: "Outdoor enthusiast market with tech adoption",
        potential: "$67K annually",
        confidence: 71,
        products: ["Wearables", "Outdoor Tech", "Fitness Equipment"],
        marketSize: 2.9,
        competition: "low",
      },
    ];

    return locations;
  }

  // Detect anomalies in sales patterns
  static detectAnomalies(salesData: number[]): Array<{
    index: number;
    value: number;
    expected: number;
    severity: 'low' | 'medium' | 'high';
    type: 'spike' | 'drop';
  }> {
    if (salesData.length < 7) return [];

    const anomalies = [];
    const windowSize = 7;
    
    for (let i = windowSize; i < salesData.length; i++) {
      const window = salesData.slice(i - windowSize, i);
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
      const stdDev = Math.sqrt(variance);
      
      const current = salesData[i];
      const zScore = Math.abs(current - mean) / stdDev;
      
      if (zScore > 2) { // 2 standard deviations
        const severity = zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low' as 'high' | 'medium' | 'low';
        const type = current > mean ? 'spike' : 'drop' as 'spike' | 'drop';
        
        anomalies.push({
          index: i,
          value: current,
          expected: mean,
          severity,
          type
        });
      }
    }
    
    return anomalies;
  }

  // Generate inventory recommendations
  static generateInventoryRecommendations(products: any[]): Array<{
    productId: string;
    type: 'restock' | 'reduce' | 'optimize';
    priority: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    suggestedAction: string;
    impact: string;
  }> {
    const recommendations = [];

    for (const product of products) {
      const stockLevel = product.stockLevel;
      const minLevel = product.minStockLevel || 10;
      const maxLevel = product.maxStockLevel || 1000;
      const price = parseFloat(product.price);

      // Low stock recommendations
      if (stockLevel <= minLevel * 0.5) {
        recommendations.push({
          productId: product.id,
          type: 'restock' as 'restock' | 'reduce' | 'optimize',
          priority: 'critical' as 'low' | 'medium' | 'high' | 'critical',
          message: `Critical stock shortage for ${product.name}`,
          suggestedAction: `Order ${minLevel * 3} units immediately`,
          impact: 'Prevent stockout and lost sales'
        });
      } else if (stockLevel <= minLevel) {
        recommendations.push({
          productId: product.id,
          type: 'restock',
          priority: 'high',
          message: `Low stock warning for ${product.name}`,
          suggestedAction: `Order ${minLevel * 2} units`,
          impact: 'Maintain service levels'
        });
      }

      // Overstock recommendations
      if (stockLevel > maxLevel * 0.8) {
        recommendations.push({
          productId: product.id,
          type: 'reduce',
          priority: 'medium',
          message: `Excess inventory for ${product.name}`,
          suggestedAction: 'Consider promotional pricing or bundle offers',
          impact: 'Free up warehouse space and improve cash flow'
        });
      }

      // Price optimization
      if (price < 50 && stockLevel > minLevel * 2) {
        recommendations.push({
          productId: product.id,
          type: 'optimize',
          priority: 'low',
          message: `Price optimization opportunity for ${product.name}`,
          suggestedAction: `Consider 5-10% price increase`,
          impact: 'Improve profit margins'
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder: { [key: string]: number } = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}
