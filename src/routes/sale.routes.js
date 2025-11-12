const express = require('express');
const router = express.Router();
const {
  createSale,
  getSales,
  getSaleById,
  updateSale
} = require('../controllers/sale.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router
  .route('/')
  .post(authorize('admin', 'gerente', 'vendedor'), createSale)
  .get(authorize('admin', 'gerente', 'vendedor'), getSales);

router
  .route('/:id')
  .get(authorize('admin', 'gerente', 'vendedor'), getSaleById)
  .put(authorize('admin', 'gerente'), updateSale);

module.exports = router;