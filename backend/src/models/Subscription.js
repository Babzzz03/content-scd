const mongoose = require('mongoose')

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, enum: ['starter', 'pro', 'agency'], required: true },

    // Paystack identifiers
    paystackSubscriptionCode: { type: String, required: true },
    paystackCustomerCode: { type: String },
    paystackPlanCode: { type: String },

    status: {
      type: String,
      enum: ['active', 'inactive', 'cancelled', 'past_due', 'non-renewing'],
      default: 'active',
    },

    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    cancelledAt: { type: Date, default: null },

    // Billing event log (lightweight — webhook payloads are large)
    events: [
      {
        event: String,
        recordedAt: { type: Date, default: Date.now },
        amount: Number,        // in kobo
        currency: { type: String, default: 'NGN' },
      },
    ],
  },
  { timestamps: true }
)

module.exports = mongoose.model('Subscription', subscriptionSchema)
