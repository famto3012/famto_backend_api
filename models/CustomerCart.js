const mongoose = require("mongoose");

// Define the CartItem schema
const cartItemSchema = mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    variantTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VariantType",
      default: null,
    },
  },
  {
    _id: false,
  }
);

// Define the Cart schema
const CustomerCartSchema = mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },
    items: [cartItemSchema],
  },
  {
    timestamps: true,
  }
);

// Virtual field to calculate the total price
CustomerCartSchema.virtual("totalPrice").get(function () {
  return this.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
});

const CustomerCart = mongoose.model("CustomerCart", CustomerCartSchema);
module.exports = CustomerCart;
