// aiPredictionService.ts
import axios from 'axios';
import { IProduct, ISalesHistory } from '../../shared/mongodb-schema';
import * as ss from 'simple-statistics';

export interface DynamicPricingResult {
  productId: string;
  currentPrice: number;
  recommendedPrice: number;
  priceChange: number;
  changePercentage: number;
  confidence: number;
  strategy: 'demand_based' | 'expiry_based' | 'hybrid' | 'competitive';
  factors: string[];
  explanation: string;
  metadata: {
    demandScore: number;
    expiryUrgency: number;
    competitionFactor: number;
    seasonalityFactor: number;
  };
}

export interface DemandPredictionResult {
  productId: string;
  currentValue: number;
  predictedValue: number;
  confidence: number;
  timeframe: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  growthRate: number;
  metadata?: any;
}

export class AIPredictionService {
  private readonly PREDICTION_API_URL = 'https://api.example-ai-prediction.com/predict';
  private readonly API_KEY = process.env.AI_PREDICTION_API_KEY;

  /**
   * Dynamic pricing based on demand patterns and expiry dates
   */
  async calculateDynamicPricing(
    product: IProduct,
    salesHistory: ISalesHistory[],
    similarProducts: IProduct[] = [],
    marketConditions: any = {}
  ): Promise<DynamicPricingResult> {
    try {
      // Calculate individual factors
      const demandScore = await this.calculateDemandScore(product, salesHistory);
      const expiryUrgency = this.calculateExpiryUrgency(product);
      const competitionFactor = this.calculateCompetitionFactor(product, similarProducts);
      const seasonalityFactor = await this.calculateSeasonalityFactor(product, salesHistory);

      // Base price adjustments
      const basePrice = product.price;
      let priceMultiplier = 1.0;
      let strategy: DynamicPricingResult['strategy'] = 'demand_based';
      const factors: string[] = [];

      // Demand-based pricing
      if (demandScore > 0.7) {
        priceMultiplier *= 1.15; // High demand = 15% increase
        factors.push('high_demand');
        strategy = 'demand_based';
      } else if (demandScore > 0.4) {
        priceMultiplier *= 1.05; // Medium demand = 5% increase
        factors.push('medium_demand');
      } else {
        priceMultiplier *= 0.95; // Low demand = 5% decrease
        factors.push('low_demand');
      }

      // Expiry-based pricing
      if (expiryUrgency > 0.8) {
        priceMultiplier *= 0.7; // Urgent expiry = 30% discount
        factors.push('urgent_expiry');
        strategy = 'expiry_based';
      } else if (expiryUrgency > 0.5) {
        priceMultiplier *= 0.85; // Approaching expiry = 15% discount
        factors.push('approaching_expiry');
      }

      // Competition-based adjustment
      priceMultiplier *= competitionFactor;
      if (competitionFactor < 0.95) factors.push('competitive_pricing');
      if (competitionFactor > 1.05) factors.push('premium_positioning');

      // Seasonality adjustment
      priceMultiplier *= seasonalityFactor;
      if (seasonalityFactor > 1.1) factors.push('seasonal_peak');
      if (seasonalityFactor < 0.9) factors.push('seasonal_low');

      // Calculate final price with bounds
      const recommendedPrice = Math.max(
        product.cost * 1.1, // Minimum 10% above cost
        Math.min(
          basePrice * 2.0, // Maximum 100% increase
          basePrice * priceMultiplier
        )
      );

      const priceChange = recommendedPrice - basePrice;
      const changePercentage = (priceChange / basePrice) * 100;

      // Calculate confidence based on data quality
      const confidence = this.calculatePricingConfidence(
        salesHistory.length,
        demandScore,
        expiryUrgency,
        product.expiryDate ? 1 : 0
      );

      const explanation = this.generatePricingExplanation(
        strategy,
        demandScore,
        expiryUrgency,
        changePercentage
      );

      return {
        productId: product._id.toString(),
        currentPrice: basePrice,
        recommendedPrice: Number(recommendedPrice.toFixed(2)),
        priceChange: Number(priceChange.toFixed(2)),
        changePercentage: Number(changePercentage.toFixed(1)),
        confidence,
        strategy,
        factors,
        explanation,
        metadata: {
          demandScore,
          expiryUrgency,
          competitionFactor,
          seasonalityFactor,
        },
      };
    } catch (error) {
      console.error('Error in calculateDynamicPricing:', error);
      throw new Error('Failed to calculate dynamic pricing');
    }
  }

  /**
   * Calculate demand score using multiple ML techniques
   */
  private async calculateDemandScore(
    product: IProduct,
    salesHistory: ISalesHistory[]
  ): Promise<number> {
    if (salesHistory.length < 5) return 0.5; // Default for insufficient data

    try {
      // 1. Trend Analysis (Linear Regression)
      const trendScore = this.analyzeSalesTrend(salesHistory);

      // 2. Seasonality Detection
      const seasonalityScore = this.detectSeasonality(salesHistory);

      // 3. Velocity Analysis (Recent sales momentum)
      const velocityScore = this.analyzeSalesVelocity(salesHistory);

      // 4. Stock-out Risk (Current stock vs demand)
      const stockOutScore = this.calculateStockOutRisk(product, salesHistory);

      // Weighted combination of factors
      const demandScore = 
        (trendScore * 0.4) +
        (seasonalityScore * 0.25) +
        (velocityScore * 0.2) +
        (stockOutScore * 0.15);

      return Math.max(0, Math.min(1, demandScore));
    } catch (error) {
      console.error('Error calculating demand score:', error);
      return 0.5;
    }
  }

  /**
   * Analyze sales trend using linear regression
   */
  private analyzeSalesTrend(salesHistory: ISalesHistory[]): number {
    if (salesHistory.length < 3) return 0.5;

    try {
      // Prepare data for regression: [day_index, quantity]
      const salesData = salesHistory
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((sale, index) => [index, sale.quantity]);

      const regression = ss.linearRegression(salesData);
      
      // Normalize slope to 0-1 range
      const maxExpectedSlope = Math.max(1, salesHistory[salesHistory.length - 1].quantity / 10);
      const normalizedSlope = Math.max(-1, Math.min(1, regression.m / maxExpectedSlope));
      
      return (normalizedSlope + 1) / 2; // Convert to 0-1 range
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Detect seasonality patterns in sales data
   */
  private detectSeasonality(salesHistory: ISalesHistory[]): number {
    if (salesHistory.length < 30) return 0.5; // Need at least 30 days

    try {
      const dailySales = this.groupSalesByDay(salesHistory);
      
      // Calculate variance (higher variance suggests seasonality)
      const quantities = Object.values(dailySales).map(day => day.quantity);
      const mean = ss.mean(quantities);
      const variance = ss.variance(quantities);
      const coefficientOfVariation = Math.sqrt(variance) / mean;

      // Normalize to 0-1 range (higher = more seasonality)
      return Math.min(1, coefficientOfVariation * 2);
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Analyze recent sales velocity (momentum)
   */
  private analyzeSalesVelocity(salesHistory: ISalesHistory[]): number {
    if (salesHistory.length < 7) return 0.5;

    try {
      const recentSales = salesHistory
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 7);

      const last7Days = recentSales.reduce((sum, sale) => sum + sale.quantity, 0);
      const previous7Days = salesHistory
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(7, 14)
        .reduce((sum, sale) => sum + sale.quantity, 0);

      if (previous7Days === 0) return last7Days > 0 ? 0.8 : 0.2;

      const growth = (last7Days - previous7Days) / previous7Days;
      return Math.max(0, Math.min(1, (growth + 1) / 2));
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate stock-out risk based on current stock and demand patterns
   */
  private calculateStockOutRisk(product: IProduct, salesHistory: ISalesHistory[]): number {
    if (salesHistory.length < 7) return 0.5;

    try {
      const recentDailySales = this.calculateAverageDailySales(salesHistory, 7);
      const daysOfSupply = product.stockLevel / recentDailySales;

      // Higher risk when days of supply is low
      if (daysOfSupply <= 3) return 0.9;
      if (daysOfSupply <= 7) return 0.7;
      if (daysOfSupply <= 14) return 0.5;
      return 0.3;
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate expiry urgency (0-1, where 1 is most urgent)
   */
  private calculateExpiryUrgency(product: IProduct): number {
    if (!product.expiryDate) return 0;

    const now = new Date();
    const expiry = new Date(product.expiryDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 0) return 1.0; // Expired
    if (daysUntilExpiry <= 3) return 0.9; // Urgent
    if (daysUntilExpiry <= 7) return 0.7; // High urgency
    if (daysUntilExpiry <= 14) return 0.5; // Medium urgency
    if (daysUntilExpiry <= 30) return 0.3; // Low urgency
    return 0.1; // No urgency
  }

  /**
   * Calculate competition factor based on similar products
   */
  private calculateCompetitionFactor(product: IProduct, similarProducts: IProduct[]): number {
    if (similarProducts.length === 0) return 1.0;

    const competitorPrices = similarProducts
      .filter(p => p.price > 0)
      .map(p => p.price);

    if (competitorPrices.length === 0) return 1.0;

    const avgCompetitorPrice = ss.mean(competitorPrices);
    const priceRatio = product.price / avgCompetitorPrice;

    // Adjust based on competitive position
    if (priceRatio > 1.2) return 0.9; // Overpriced compared to competition
    if (priceRatio > 1.1) return 0.95;
    if (priceRatio < 0.8) return 1.1; // Undersold compared to competition
    if (priceRatio < 0.9) return 1.05;
    
    return 1.0; // Competitively priced
  }

  /**
   * Calculate seasonality factor based on historical patterns
   */
  private async calculateSeasonalityFactor(
    product: IProduct, 
    salesHistory: ISalesHistory[]
  ): Promise<number> {
    if (salesHistory.length < 90) return 1.0; // Need 3 months of data

    try {
      const monthlySales = this.groupSalesByMonth(salesHistory);
      const currentMonth = new Date().getMonth();
      
      // Simple seasonality: compare current month to yearly average
      const currentMonthSales = monthlySales[currentMonth] || 0;
      const yearlyAverage = Object.values(monthlySales).reduce((a, b) => a + b, 0) / 12;
      
      if (yearlyAverage === 0) return 1.0;
      
      const seasonalityRatio = currentMonthSales / yearlyAverage;
      
      // Map to pricing multiplier
      if (seasonalityRatio > 1.5) return 1.15; // Peak season
      if (seasonalityRatio > 1.2) return 1.08;
      if (seasonalityRatio < 0.7) return 0.9;  // Off season
      if (seasonalityRatio < 0.85) return 0.95;
      
      return 1.0;
    } catch (error) {
      return 1.0;
    }
  }

  /**
   * Calculate confidence score for pricing recommendations
   */
  private calculatePricingConfidence(
    dataPoints: number,
    demandScore: number,
    expiryUrgency: number,
    hasExpiryDate: number
  ): number {
    let confidence = 0.5; // Base confidence

    // Data quality factor
    if (dataPoints >= 100) confidence += 0.3;
    else if (dataPoints >= 30) confidence += 0.2;
    else if (dataPoints >= 10) confidence += 0.1;

    // Factor reliability
    if (demandScore !== 0.5) confidence += 0.1;
    if (expiryUrgency > 0) confidence += 0.1;
    if (hasExpiryDate) confidence += 0.1;

    return Math.min(0.95, confidence);
  }

  /**
   * Generate human-readable explanation for pricing decisions
   */
  private generatePricingExplanation(
    strategy: string,
    demandScore: number,
    expiryUrgency: number,
    changePercentage: number
  ): string {
    const explanations = {
      demand_based: `Based on ${demandScore > 0.6 ? 'strong' : 'moderate'} demand patterns`,
      expiry_based: `Inventory clearance for ${expiryUrgency > 0.7 ? 'urgently' : 'approaching'} expiring products`,
      hybrid: `Balanced approach considering both demand patterns and inventory age`,
      competitive: `Market-aligned pricing based on competitor analysis`
    };

    const direction = changePercentage >= 0 ? 'increase' : 'decrease';
    const magnitude = Math.abs(changePercentage) > 15 ? 'significant' : 
                     Math.abs(changePercentage) > 5 ? 'moderate' : 'slight';

    return `${explanations[strategy]}. Recommended ${magnitude} ${direction} to optimize revenue.`;
  }

  // Helper methods
  private groupSalesByDay(salesHistory: ISalesHistory[]): { [key: string]: { quantity: number } } {
    const dailySales: { [key: string]: { quantity: number } } = {};

    salesHistory.forEach(sale => {
      const date = new Date(sale.date).toISOString().split('T')[0];
      if (!dailySales[date]) {
        dailySales[date] = { quantity: 0 };
      }
      dailySales[date].quantity += sale.quantity;
    });

    return dailySales;
  }

  private groupSalesByMonth(salesHistory: ISalesHistory[]): { [key: number]: number } {
    const monthlySales: { [key: number]: number } = {};

    salesHistory.forEach(sale => {
      const month = new Date(sale.date).getMonth();
      monthlySales[month] = (monthlySales[month] || 0) + sale.quantity;
    });

    return monthlySales;
  }

  private calculateAverageDailySales(salesHistory: ISalesHistory[], days: number): number {
    const recentSales = salesHistory
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, days);

    if (recentSales.length === 0) return 0;

    const totalQuantity = recentSales.reduce((sum, sale) => sum + sale.quantity, 0);
    return totalQuantity / Math.min(days, recentSales.length);
  }

  /**
   * Fallback prediction method when external services fail
   */
  private getFallbackPrediction(
    product: IProduct,
    salesHistory: ISalesHistory[],
    timeframe: string
  ): DemandPredictionResult {
    const recentSales = salesHistory.slice(-7);
    const avgSales = recentSales.length > 0 
      ? recentSales.reduce((sum, sale) => sum + sale.quantity, 0) / recentSales.length
      : product.stockLevel * 0.1; // Default estimate

    return {
      productId: product._id.toString(),
      currentValue: product.stockLevel,
      predictedValue: Math.round(avgSales),
      confidence: 0.4,
      timeframe,
      trend: 'stable',
      growthRate: 0,
      metadata: { method: 'fallback_average' }
    };
  }
}