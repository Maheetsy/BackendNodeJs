const mongoose = require('mongoose');
const Sale = require('../models/Sale');

const isAdminOrManager = (role) => ['admin', 'gerente'].includes(role);
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const normalizeItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('La venta debe incluir al menos un producto');
  }

  return items.map((item, index) => {
    const { product_id, name, price_at_sale, quantity } = item;

    if (product_id === undefined || product_id === null) {
      throw new Error(`El producto en la posición ${index + 1} no tiene product_id`);
    }
    const productIdNumber = Number(product_id);
    if (!Number.isInteger(productIdNumber) || productIdNumber <= 0) {
      throw new Error(`El producto en la posición ${index + 1} tiene un product_id inválido`);
    }
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new Error(`El producto en la posición ${index + 1} tiene un nombre inválido`);
    }
    const quantityValue = Number(quantity);
    if (!Number.isInteger(quantityValue) || quantityValue <= 0) {
      throw new Error(`El producto en la posición ${index + 1} debe tener cantidad entera mayor a 0`);
    }
    const numericPrice = Number(price_at_sale);
    if (price_at_sale === undefined || Number.isNaN(numericPrice) || numericPrice < 0) {
      throw new Error(`El producto en la posición ${index + 1} debe tener un precio válido`);
    }

    return {
      product_id: productIdNumber,
      name: name.trim(),
      price_at_sale: numericPrice.toFixed(2),
      quantity: quantityValue
    };
  });
};

// @desc    Crear venta
// @route   POST /api/sales
// @access  Private (Admin/Gerente/Vendedor)
exports.createSale = async (req, res) => {
  try {
    const { items, payment_method, status, sale_date, user_id } = req.body;
    const requester = req.user;

    const normalizedItems = normalizeItems(items);

    if (!payment_method) {
      return res.status(400).json({
        success: false,
        message: 'El método de pago es requerido'
      });
    }

    let parsedSaleDate;
    if (sale_date) {
      parsedSaleDate = new Date(sale_date);
      if (Number.isNaN(parsedSaleDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de la venta es inválida'
        });
      }
    }

    let saleOwner = requester._id;
    if (user_id) {
      if (!isAdminOrManager(requester.role)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para asignar ventas a otros usuarios'
        });
      }
      if (!isValidObjectId(user_id)) {
        return res.status(400).json({
          success: false,
          message: 'El usuario asignado es inválido'
        });
      }
      saleOwner = user_id;
    }

    const sale = await Sale.create({
      sale_date: parsedSaleDate,
      user_id: saleOwner,
      items: normalizedItems,
      payment_method,
      status
    });

    res.status(201).json({
      success: true,
      message: 'Venta registrada exitosamente',
      sale: sale.toJSON()
    });
  } catch (error) {
    console.error('Error al crear venta:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al registrar la venta'
    });
  }
};

// @desc    Listar ventas
// @route   GET /api/sales
// @access  Private (Admin/Gerente/Vendedor con restricciones)
exports.getSales = async (req, res) => {
  try {
    const filters = {};
    const { status, user } = req.query;

    if (status) {
      filters.status = status;
    }

    if (req.user.role === 'vendedor') {
      filters.user_id = req.user._id;
    } else if (user) {
      if (!isValidObjectId(user)) {
        return res.status(400).json({
          success: false,
          message: 'El parámetro de usuario es inválido'
        });
      }
      filters.user_id = user;
    }

    const sales = await Sale.find(filters)
      .populate('user_id', 'name email role')
      .sort({ sale_date: -1 });

    res.status(200).json({
      success: true,
      count: sales.length,
      sales: sales.map((sale) => sale.toJSON())
    });
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las ventas'
    });
  }
};

// @desc    Obtener venta por ID
// @route   GET /api/sales/:id
// @access  Private (Admin/Gerente/Vendedor con restricciones)
exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de venta inválido'
      });
    }

    const sale = await Sale.findById(id).populate('user_id', 'name email role');

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
    }

    if (req.user.role === 'vendedor' && sale.user_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para consultar esta venta'
      });
    }

    res.status(200).json({
      success: true,
      sale: sale.toJSON()
    });
  } catch (error) {
    console.error('Error al obtener venta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la venta'
    });
  }
};

// @desc    Actualizar venta (solo Admin/Gerente)
// @route   PUT /api/sales/:id
// @access  Private (Admin/Gerente)
exports.updateSale = async (req, res) => {
  try {
    if (!isAdminOrManager(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Solo un administrador o gerente puede modificar ventas'
      });
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de venta inválido'
      });
    }

    const { items, payment_method, status, sale_date, user_id } = req.body;

    const sale = await Sale.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
    }

    if (items) {
      sale.items = normalizeItems(items);
    }
    if (payment_method) {
      sale.payment_method = payment_method;
    }
    if (status) {
      sale.status = status;
    }
    if (sale_date) {
      const parsedSaleDate = new Date(sale_date);
      if (Number.isNaN(parsedSaleDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de la venta es inválida'
        });
      }
      sale.sale_date = parsedSaleDate;
    }
    if (user_id) {
      if (!isValidObjectId(user_id)) {
        return res.status(400).json({
          success: false,
          message: 'El usuario asignado es inválido'
        });
      }
      sale.user_id = user_id;
    }

    await sale.save();

    res.status(200).json({
      success: true,
      message: 'Venta actualizada exitosamente',
      sale: sale.toJSON()
    });
  } catch (error) {
    console.error('Error al actualizar venta:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar la venta'
    });
  }
};

