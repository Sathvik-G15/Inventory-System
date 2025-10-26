import express from 'express';
import { Category } from '../../shared/mongodb-schema';
import { z } from 'zod';

const router = express.Router();

// Get all categories for the authenticated user
router.get('/', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const categories = await Category.find({ 
      userId: req.user.id,
      isActive: true 
    }).sort({ name: 1 });
    
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

// Create a new category
router.post('/', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { name, description, color, icon } = req.body;
    
    // Check if category with same name already exists for this user
    const existingCategory = await Category.findOne({ 
      userId: req.user.id,
      name: { $regex: new RegExp(`^${name}$`, 'i') } // Case insensitive match
    });

    if (existingCategory) {
      return res.status(400).json({ 
        message: 'A category with this name already exists' 
      });
    }

    const category = new Category({
      userId: req.user.id,
      name,
      description,
      color,
      icon,
      isActive: true
    });

    await category.save();
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error',
        errors: error.errors 
      });
    }
    res.status(500).json({ message: 'Failed to create category' });
  }
});

// Update a category
router.put('/:id', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { name, description, color, icon } = req.body;
    const { id } = req.params;

    // Check if category exists and belongs to user
    const category = await Category.findOne({ 
      _id: id,
      userId: req.user.id 
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if another category with the same name exists
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({
        _id: { $ne: id },
        userId: req.user.id,
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });

      if (existingCategory) {
        return res.status(400).json({ 
          message: 'A category with this name already exists' 
        });
      }
    }

    // Update category
    category.name = name || category.name;
    category.description = description ?? category.description;
    category.color = color ?? category.color;
    category.icon = icon ?? category.icon;

    await category.save();
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Failed to update category' });
  }
});

// Delete a category (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { id } = req.params;

    // Soft delete by setting isActive to false
    const category = await Category.findOneAndUpdate(
      { 
        _id: id,
        userId: req.user.id 
      },
      { isActive: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

export default router;
