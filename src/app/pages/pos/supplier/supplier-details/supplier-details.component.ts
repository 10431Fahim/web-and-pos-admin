import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import { UiService } from '../../../../services/core/ui.service';
import { SupplierService } from '../../../../services/common/supplier.service';
import { PurchaseService } from '../../../../services/common/purchase.service';
import { UtilsService } from '../../../../services/core/utils.service';
import { ShopInformationService } from '../../../../services/common/shop-information.service';
import { ConfirmDialogComponent } from '../../../../shared/components/ui/confirm-dialog/confirm-dialog.component';
import { Supplier } from '../../../../interfaces/common/supplier.interface';
import { Purchase } from '../../../../interfaces/common/purchase.interface';
import { SupplierTransaction } from '../../../../interfaces/common/supplier-transaction.interface';
import { ShopInformation } from '../../../../interfaces/common/shop-information.interface';

@Component({
  selector: 'app-supplier-details',
  templateUrl: './supplier-details.component.html',
  styleUrls: ['./supplier-details.component.scss']
})
export class SupplierDetailsComponent implements OnInit, OnDestroy {
  // Store Data
  isLoading: boolean = true;
  supplierId: string;
  supplier: Supplier = null;
  supplierStats: any = null;
  purchaseHistory: Purchase[] = [];
  paymentHistory: SupplierTransaction[] = [];
  filteredPaymentHistory: SupplierTransaction[] = [];
  filteredPaymentTotal: number = 0;
  
  // Shop data
  shopInformation: ShopInformation;

  // Tabs
  selectedTab: number = 0;

  // Due Management
  dueAmount: number = 0;
  dueType: 'add' | 'subtract' = 'add';

  // Payment Management
  paymentAmount: number = 0;
  paymentMethod: string = 'cash';
  paymentReference: string = '';
  paymentNotes: string = '';

  // Date Filter for Payment History
  startDate: Date | null = null;
  endDate: Date | null = null;
  dateFilterApplied: boolean = false;

  // Subscriptions
  private subDataOne: Subscription;
  private subDataTwo: Subscription;
  private subDataThree: Subscription;
  private subDataFour: Subscription;
  private subDataFive: Subscription;
  private subShopInfo: Subscription;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private supplierService: SupplierService,
    private purchaseService: PurchaseService,
    private uiService: UiService,
    private utilsService: UtilsService,
    private shopInformationService: ShopInformationService,
    private dialog: MatDialog,
  ) {
  }

  ngOnInit(): void {
    this.supplierId = this.activatedRoute.snapshot.paramMap.get('id');
    if (this.supplierId) {
      this.getSupplierById();
      this.getSupplierStats();
      this.getPurchaseHistory();
      this.getPaymentHistory();
      this.getShopInformation();
    } else {
      this.router.navigate(['/pos/supplier/supplier-list']);
    }
  }

  /**
   * HTTP REQ HANDLE
   */
  private getSupplierById() {
    this.isLoading = true;
    this.subDataOne = this.supplierService.getSupplierById(this.supplierId)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success && res.data) {
            this.supplier = res.data;
          } else {
            this.uiService.message('Supplier not found', 'warn');
            this.router.navigate(['/pos/supplier/supplier-list']);
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading supplier:', err);
          this.uiService.message('Failed to load supplier', 'warn');
        }
      });
  }

  private getSupplierStats() {
    this.subDataTwo = this.supplierService.getSupplierStats(this.supplierId)
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.supplierStats = res.data;
          }
        },
        error: (err) => {
          console.error('Error loading supplier stats:', err);
        }
      });
  }

  private getPurchaseHistory() {
    this.subDataThree = this.purchaseService.getSupplierPurchaseHistory(this.supplierId)
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.purchaseHistory = res.data || [];
          }
        },
        error: (err) => {
          console.error('Error loading purchase history:', err);
        }
      });
  }

  private getPaymentHistory() {
    let startDateStr: string | undefined;
    let endDateStr: string | undefined;

    if (this.startDate && this.endDate) {
      startDateStr = this.utilsService.getDateString(this.startDate);
      endDateStr = this.utilsService.getDateString(this.endDate);
    }

    this.subDataFive = this.supplierService.getSupplierTransactions(
      this.supplierId,
      startDateStr,
      endDateStr
    )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.paymentHistory = res.data || [];
            this.filteredPaymentHistory = res.data || [];
            // Use backend calculated total
            this.filteredPaymentTotal = (res as any).totalAmount || 0;
            this.dateFilterApplied = !!(this.startDate && this.endDate);
          }
        },
        error: (err) => {
          console.error('Error loading payment history:', err);
        }
      });
  }

  applyDateFilter() {
    // Filtering is now done on backend, just reload data
    this.getPaymentHistory();
  }

  onDateFilterChange() {
    if (this.startDate && this.endDate) {
      if (this.startDate > this.endDate) {
        this.uiService.message('Start date cannot be greater than end date', 'warn');
        return;
      }
      this.getPaymentHistory();
    } else {
      this.dateFilterApplied = false;
      this.filteredPaymentHistory = this.paymentHistory;
    }
  }

  clearDateFilter() {
    this.startDate = null;
    this.endDate = null;
    this.dateFilterApplied = false;
    this.getPaymentHistory();
  }

  getFilteredPaymentTotal(): number {
    // Use backend calculated total
    return this.filteredPaymentTotal || 0;
  }

  private getShopInformation() {
    this.subShopInfo = this.shopInformationService.getShopInformation()
      .subscribe({
        next: res => {
          this.shopInformation = res.data;
        },
        error: err => {
          console.log(err);
        }
      });
  }

  /**
   * UPDATE DUE
   */
  updateDue() {
    if (!this.dueAmount || this.dueAmount <= 0) {
      this.uiService.message('Please enter a valid amount', 'warn');
      return;
    }

    this.subDataFour = this.supplierService.updateSupplierDue(
      this.supplierId,
      this.dueAmount,
      this.dueType
    )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.uiService.message(res.message || 'Due updated successfully', 'success');
            this.dueAmount = 0;
            this.getSupplierById();
            this.getSupplierStats();
          } else {
            this.uiService.message(res.message || 'Failed to update due', 'warn');
          }
        },
        error: (err) => {
          console.error('Error updating due:', err);
          this.uiService.message('Failed to update due', 'warn');
        }
      });
  }

  /**
   * GET TOTAL DUE - Use backend calculated value only
   */
  getTotalDue(): number {
    return this.supplierStats?.totalDue ?? this.supplier?.totalDue ?? 0;
  }

  /**
   * GET TOTAL PAID - Use backend calculated value only
   */
  getTotalPaid(): number {
    return this.supplierStats?.totalPaid ?? this.supplier?.totalPaid ?? 0;
  }

  /**
   * GET BALANCE - Use backend calculated value only
   */
  getBalance(): number {
    return this.supplierStats?.balance ?? 0;
  }

  /**
   * GET TOTAL PURCHASE AMOUNT - Use backend calculated value only
   */
  getTotalPurchaseAmount(): number {
    return this.supplierStats?.totalPurchaseAmount ?? 0;
  }

  /**
   * ADD PAYMENT
   */
  addPayment() {
    if (!this.paymentAmount || this.paymentAmount <= 0) {
      this.uiService.message('Please enter a valid amount', 'warn');
      return;
    }

    this.subDataFour = this.supplierService.addSupplierPayment(
      this.supplierId,
      this.paymentAmount,
      this.paymentMethod,
      this.paymentReference,
      this.paymentNotes
    )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.uiService.message(res.message || 'Payment recorded successfully', 'success');
            this.paymentAmount = 0;
            this.paymentMethod = 'cash';
            this.paymentReference = '';
            this.paymentNotes = '';
            this.getSupplierById();
            this.getSupplierStats();
            this.getPaymentHistory();
          } else {
            this.uiService.message(res.message || 'Failed to record payment', 'warn');
          }
        },
        error: (err) => {
          console.error('Error recording payment:', err);
          this.uiService.message('Failed to record payment', 'warn');
        }
      });
  }

  ngOnDestroy() {
    if (this.subDataOne) {
      this.subDataOne.unsubscribe();
    }
    if (this.subDataTwo) {
      this.subDataTwo.unsubscribe();
    }
    if (this.subDataThree) {
      this.subDataThree.unsubscribe();
    }
    if (this.subDataFour) {
      this.subDataFour.unsubscribe();
    }
    if (this.subDataFive) {
      this.subDataFive.unsubscribe();
    }
    if (this.subShopInfo) {
      this.subShopInfo.unsubscribe();
    }
  }
}

