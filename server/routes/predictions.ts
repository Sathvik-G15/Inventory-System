import { Router } from 'express';
import { z } from 'zod';
import { AIPredictionService } from '../services/aiPredictionService';
import { mongoStorage as storage } from '../mongodb-storage';
import { IProduct } from '../../shared/mongodb-schema';

const router = Router();
const predictionService = new AIPredictionService();

// Schema for prediction request
const predictionRequestSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  timeframe: z.enum(['week', 'month', 'quarter']).default('month'),
});

/**
 * @route GET /api/predictions/:productId
 * @desc Get AI prediction for product demand
 * @access Private
 */
router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { timeframe } = req.query;

    // Validate input
    const validation = predictionRequestSchema.safeParse({ 
      productId, 
      timeframe: timeframe as string 
    });
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false,
        error: validation.error.errors[0].message 
      });
    }

    // Get product and sales data
    const product = await storage.getProductById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found' 
      });
    }

    const salesHistory = await storage.getSalesHistoryForProduct(productId);
    
    // Get prediction
    const prediction = await predictionService.predictProductDemand(
      product as IProduct,
      salesHistory,
      timeframe as 'week' | 'month' | 'quarter'
    );
    
    // Save prediction to database
    await storage.savePrediction({
      productId,
      predictionType: 'demand',
      currentValue: prediction.currentValue,
      predictedValue: prediction.predictedValue,
      confidence: prediction.confidence,
      timeframe: prediction.timeframe,
      metadata: prediction.metadata
    });
    
    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate prediction',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    });
  }
});

/**
 * @route GET /api/predictions/product/:productId/history
 * @desc Get prediction history for a product
 * @access Private
 */
router.get('/product/:productId/history', async (req, res) => {
  try {
    const { productId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const predictions = await storage.getPredictionHistory(productId, limit);
    
    res.json({
      success: true,
      data: predictions
    });
  } catch (error) {
    console.error('Error fetching prediction history:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch prediction history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
