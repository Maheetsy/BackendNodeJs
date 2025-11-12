// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true,
      minlength: [2, 'El nombre debe tener al menos 2 caracteres']
    },
    email: {
      type: String,
      required: [true, 'El email es requerido'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email inválido']
    },
    hashed_password: {
      type: String,
      required: [true, 'La contraseña es requerida'],
      minlength: [8, 'La contraseña debe tener al menos 8 caracteres']
    },
    role: {
      type: String,
      enum: ['admin', 'gerente', 'vendedor'],
      default: 'vendedor',
      immutable: false
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
  }
);

// Hash password antes de guardar
userSchema.pre('save', async function (next) {
  if (!this.isModified('hashed_password')) return next();

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.hashed_password = await bcrypt.hash(this.hashed_password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// No exponer campos sensibles en queries update
userSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update && update.hashed_password) {
    return next(
      new Error('No se permite actualizar la contraseña mediante este método')
    );
  }
  next();
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.hashed_password);
};

// No devolver la contraseña en el JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.hashed_password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);