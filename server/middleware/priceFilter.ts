import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { permissionsService } from '../modules/permissions/service';

/**
 * Recursively removes price-related fields from an object
 */
function removePriceFields(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  // If it's an array, process each element
  if (Array.isArray(obj)) {
    return obj.map(item => removePriceFields(item));
  }

  // If it's not an object, return as is
  if (typeof obj !== 'object') return obj;

  // If it's a Date object, return as is (Date has typeof 'object')
  if (obj instanceof Date) return obj;

  // Create a new object without price fields
  const filtered: any = {};

  const priceFields = [
    'price', 'cost', 'amount', 'total', 'subtotal', 'sum',
    'budget', 'margin', 'profit', 'revenue', 'expense',
    'payment', 'balance', 'discount', 'tax', 'vat',
    'price_per_unit', 'total_amount', 'total_cost',
    'total_price', 'product_price', 'service_price',
    'deal_amount', 'project_budget', 'item_price',
    'wholesale_price', 'retail_price', 'purchase_price'
  ];

  for (const key in obj) {
    // Skip price-related fields
    const lowerKey = key.toLowerCase();
    const shouldHide = priceFields.some(field => lowerKey.includes(field));

    if (shouldHide) {
      // Replace with placeholder text
      filtered[key] = '***';
    } else if (typeof obj[key] === 'object') {
      // Recursively filter nested objects
      filtered[key] = removePriceFields(obj[key]);
    } else {
      filtered[key] = obj[key];
    }
  }

  return filtered;
}

/**
 * Middleware to filter prices from responses based on user permissions
 */
export function priceFilterMiddleware(module: string = 'global') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    try {
      // Check if prices should be hidden for this user and module
      const shouldHidePrices = await permissionsService.shouldHidePrices(req.user.id, module);

      // Also check if prices should be hidden globally
      const shouldHidePricesGlobal = await permissionsService.shouldHidePricesAny(req.user.id);

      if (shouldHidePrices || shouldHidePricesGlobal) {
        // Store original json method
        const originalJson = res.json;

        // Override json method to filter prices
        res.json = function(data: any) {
          // Filter out price fields from the response
          const filteredData = removePriceFields(data);

          // Call original json method with filtered data
          return originalJson.call(this, filteredData);
        };
      }

      next();
    } catch (error) {
      console.error('Error in price filter middleware:', error);
      next();
    }
  };
}

/**
 * Global price filter that checks all modules
 */
export function globalPriceFilter() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    try {
      // Check if prices should be hidden for any module
      const shouldHidePrices = await permissionsService.shouldHidePricesAny(req.user.id);

      if (shouldHidePrices) {
        // Store original json method
        const originalJson = res.json;

        // Override json method to filter prices
        res.json = function(data: any) {
          // Filter out price fields from the response
          const filteredData = removePriceFields(data);

          // Call original json method with filtered data
          return originalJson.call(this, filteredData);
        };
      }

      next();
    } catch (error) {
      console.error('Error in global price filter middleware:', error);
      next();
    }
  };
}