import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
    billingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserBilling',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['topup', 'usage', 'refund', 'bonus'],
        required: true
    },
    description: {
        type: String
    },
    paymentMethod: {
        type: String,
        enum: ['visa', 'mastercard', 'crypto', 'internal'],
        default: 'internal'
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'success'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

export const Transaction = mongoose.model('Transaction', TransactionSchema);
