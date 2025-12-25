export interface SupplierTransaction {
  _id?: string;
  shop?: any;
  supplier?: {
    _id: string;
    name: string;
  };
  transactionType?: 'payment' | 'purchase_payment' | 'purchase_due' | 'adjustment';
  amount?: number;
  transactionDate?: Date;
  transactionDateString?: string;
  paymentMethod?: 'cash' | 'bank' | 'cheque' | 'mobile_banking';
  reference?: string;
  referenceNo?: string;
  notes?: string;
  purchase?: {
    _id?: string;
    purchaseNo?: string;
  };
  month?: number;
  year?: number;
  createdAtString?: string;
  updatedAtString?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

