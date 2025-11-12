const mongoose = require('mongoose');

const DECIMAL_PLACES = 2;
const VALID_PAYMENT_METHODS = ['efectivo', 'tarjeta'];
const VALID_STATUS = ['completed', 'cancelled'];

const toDecimal128 = (value) => {
  if (value === undefined || value === null) return value;
  if (value instanceof mongoose.Types.Decimal128) return value;

  const numericValue = Number(value);
  if (Number.isNaN(numericValue) || numericValue < 0) {
    throw new mongoose.Error.ValidatorError({
      path: 'price_at_sale',
      message: 'El precio debe ser un número válido positivo'
    });
  }

  return mongoose.Types.Decimal128.fromString(numericValue.toFixed(DECIMAL_PLACES));
};

const saleItemSchema = new mongoose.Schema(
  {
    product_id: {
      type: Number,
      required: [true, 'El ID del producto es requerido']
    },
    name: {
      type: String,
      required: [true, 'El nombre del producto es requerido'],
      trim: true,
      minlength: [2, 'El nombre del producto debe tener al menos 2 caracteres']
    },
    price_at_sale: {
      type: mongoose.Schema.Types.Decimal128,
      required: [true, 'El precio del producto es requerido'],
      set: toDecimal128
    },
    quantity: {
      type: Number,
      required: [true, 'La cantidad es requerida'],
      min: [1, 'La cantidad debe ser mayor a cero']
    }
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    sale_date: {
      type: Date,
      default: Date.now
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario asociado es requerido']
    },
    items: {
      type: [saleItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'La venta debe contener al menos un producto'
      }
    },
    status: {
      type: String,
      enum: {
        values: VALID_STATUS,
        message: 'Estado de venta inválido'
      },
      default: 'completed'
    },
    payment_method: {
      type: String,
      enum: {
        values: VALID_PAYMENT_METHODS,
        message: 'Método de pago inválido'
      },
      required: [true, 'El método de pago es requerido']
    },
    total_amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      default: mongoose.Types.Decimal128.fromString('0.00')
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
  }
);

saleSchema.pre('validate', function (next) {
  try {
    if (!this.items || this.items.length === 0) {
      return next(new Error('La venta debe contener al menos un producto'));
    }

    const total = this.items.reduce((acc, item) => {
      const priceDecimal = item.price_at_sale instanceof mongoose.Types.Decimal128
        ? parseFloat(item.price_at_sale.toString())
        : Number(item.price_at_sale);

      if (Number.isNaN(priceDecimal)) {
        throw new Error('Alguno de los productos tiene un precio inválido');
      }

      const subtotal = priceDecimal * item.quantity;
      return acc + subtotal;
    }, 0);

    if (total <= 0) {
      return next(new Error('El total de la venta debe ser mayor a cero'));
    }

    this.total_amount = mongoose.Types.Decimal128.fromString(total.toFixed(DECIMAL_PLACES));
    next();
  } catch (error) {
    next(error);
  }
});

saleSchema.methods.toJSON = function () {
  const obj = this.toObject({ getters: true });

  const parseDecimal = (decimal) =>
    decimal instanceof mongoose.Types.Decimal128 ? decimal.toString() : decimal;

  if (obj.total_amount) {
    obj.total_amount = parseDecimal(obj.total_amount);
  }

  if (Array.isArray(obj.items)) {
    obj.items = obj.items.map((item) => ({
      ...item,
      price_at_sale: parseDecimal(item.price_at_sale)
    }));
  }

  return obj;
};

saleSchema.index({ user_id: 1, sale_date: -1 });

module.exports = mongoose.model('Sale', saleSchema);

