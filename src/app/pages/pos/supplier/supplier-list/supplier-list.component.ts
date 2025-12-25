import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import { FormControl, FormGroup, NgForm } from '@angular/forms';
import { EMPTY, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, pluck, switchMap } from 'rxjs/operators';
import * as XLSX from 'xlsx';

import { UiService } from '../../../../services/core/ui.service';
import { SupplierService } from '../../../../services/common/supplier.service';
import { UtilsService } from '../../../../services/core/utils.service';
import { ReloadService } from '../../../../services/core/reload.service';
import { VendorService } from '../../../../services/vendor/vendor.service';
import { ShopInformationService } from '../../../../services/common/shop-information.service';
import { ConfirmDialogComponent } from '../../../../shared/components/ui/confirm-dialog/confirm-dialog.component';
import { FilterData } from '../../../../interfaces/gallery/filter-data';
import { Supplier } from '../../../../interfaces/common/supplier.interface';
import { ShopInformation } from '../../../../interfaces/common/shop-information.interface';

@Component({
  selector: 'app-supplier-list',
  templateUrl: './supplier-list.component.html',
  styleUrls: ['./supplier-list.component.scss']
})
export class SupplierListComponent implements OnInit, AfterViewInit, OnDestroy {
  // Vendor Base Data
  vendorId: string;
  role: string;
  checkEditPermission: boolean = false;
  checkDeletePermission: boolean = false;

  // Store Data
  isLoading: boolean = true;
  allSuppliers: Supplier[] = [];
  suppliers: Supplier[] = [];
  id?: string;
  supplierData: Supplier = null;

  // Shop data
  shopInformation: ShopInformation;

  // FilterData
  isDefaultFilter: boolean = false;
  filter: any = null;
  sortQuery: any = null;
  activeFilter: string = 'all'; // 'all', 'withDue'
  activeSort: number;

  // Selected Data
  selectedIds: string[] = [];
  @ViewChild('matCheckbox') matCheckbox: MatCheckbox;

  // Search Area
  @ViewChild('searchForm') searchForm: NgForm;
  searchQuery = null;
  searchSuppliers: Supplier[] = [];

  // Subscriptions
  private subDataOne: Subscription;
  private subDataTwo: Subscription;
  private subDataThree: Subscription;
  private subForm: Subscription;
  private subReload: Subscription;
  private subShopInfo: Subscription;

  constructor(
    private supplierService: SupplierService,
    private uiService: UiService,
    private utilsService: UtilsService,
    private router: Router,
    private dialog: MatDialog,
    private reloadService: ReloadService,
    private vendorService: VendorService,
    private shopInformationService: ShopInformationService,
  ) {
  }

  ngOnInit(): void {
    this.getVendorBaseData();
    this.getShopInformation();
    this.initFilter();
    this.getAllSuppliers();
    this.subReload = this.reloadService.refreshCustomer$.subscribe(() => {
      this.getAllSuppliers();
    });
  }

  /**
   * VENDOR BASE DATA
   */
  private getVendorBaseData() {
    this.vendorId = this.vendorService.getUserId();
    this.role = this.vendorService.getUserRole() || 'admin';
    this.checkEditPermission = true;
    this.checkDeletePermission = true;
  }

  /**
   * INIT FILTER
   */
  private initFilter() {
    this.filter = null;
    this.sortQuery = { createdAt: -1 };
    this.activeSort = 0;
    this.isDefaultFilter = true;
  }

  /**
   * HTTP REQ HANDLE
   */
  private getAllSuppliers() {
    this.isLoading = true;

    const mSelect = {
      name: 1,
      phone: 1,
      email: 1,
      address: 1,
      totalDue: 1,
      totalPaid: 1,
      contactPerson: 1,
      alternatePhone: 1,
      createdAt: 1,
      createdAtString: 1,
    };

    let mFilter: any = null;

    // Apply filter
    if (this.activeFilter === 'withDue') {
      mFilter = { totalDue: { $gt: 0 } };
    }

    const filter: FilterData = {
      filter: mFilter,
      pagination: null,
      select: mSelect,
      sort: this.sortQuery || { createdAt: -1 },
    };

    this.subDataOne = this.supplierService.getAllSuppliers(filter, this.searchQuery)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.allSuppliers = res.data || [];
            this.suppliers = this.allSuppliers;
            this.searchSuppliers = this.allSuppliers;
          } else {
            this.uiService.message('Failed to load suppliers', 'warn');
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading suppliers:', err);
          this.uiService.message('Failed to load suppliers. Please try again.', 'warn');
        },
      });
  }

  /**
   * FILTER BY DUE
   */
  onFilterChange(filter: string) {
    this.activeFilter = filter;
    this.getAllSuppliers();
  }

  /**
   * SEARCH AREA
   */
  ngAfterViewInit() {
    const formValue = this.searchForm?.valueChanges;
    if (formValue) {
      this.subForm = formValue
        .pipe(
          pluck('searchTerm'),
          debounceTime(200),
          distinctUntilChanged(),
          switchMap((data) => {
            this.searchQuery = data;
            if (this.searchQuery && this.searchQuery.length > 0) {
              this.getAllSuppliers();
            } else {
              this.searchQuery = null;
              this.getAllSuppliers();
            }
            return EMPTY;
          })
        )
        .subscribe(() => {});
    }
  }

  /**
   * ON SELECT CHANGE
   */
  onCheckChange(event: MatCheckboxChange, index: number, id: string) {
    if (event.checked) {
      this.selectedIds.push(id);
    } else {
      const i = this.selectedIds.findIndex(f => f === id);
      this.selectedIds.splice(i, 1);
    }
  }

  onAllSelectChange(event: MatCheckboxChange, suppliers: Supplier[], index: number) {
    if (event.checked) {
      suppliers.forEach(m => {
        this.selectedIds.push(m._id);
        (m as any).select = true;
      });
    } else {
      suppliers.forEach(m => {
        const i = this.selectedIds.findIndex(f => f === m._id);
        this.selectedIds.splice(i, 1);
        (m as any).select = false;
      });
    }
  }

  /**
   * DELETE METHODS
   */
  private deleteSupplierById(id: string) {
    this.subDataTwo = this.supplierService.deleteSupplierById(id, false)
      .subscribe({
        next: (res) => {
          this.uiService.message(res.message || 'Supplier deleted successfully', 'success');
          this.getAllSuppliers();
        },
        error: (err) => {
          console.error('Error deleting supplier:', err);
          this.uiService.message('Failed to delete supplier', 'warn');
        }
      });
  }

  private deleteMultipleSupplierById() {
    this.subDataThree = this.supplierService.deleteMultipleSupplierById(this.selectedIds, false)
      .subscribe({
        next: (res) => {
          this.uiService.message(res.message || 'Suppliers deleted successfully', 'success');
          this.selectedIds = [];
          this.getAllSuppliers();
        },
        error: (err) => {
          console.error('Error deleting suppliers:', err);
          this.uiService.message('Failed to delete suppliers', 'warn');
        }
      });
  }

  openConfirmDialog(type: string, supplier?: Supplier) {
    if (type === 'delete' && supplier) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        maxWidth: '400px',
        data: {
          title: 'Confirm Delete',
          message: `Are you sure you want to delete supplier: ${supplier.name || supplier.phone}?`,
        },
      });
      dialogRef.afterClosed().subscribe((dialogResult) => {
        if (dialogResult) {
          this.deleteSupplierById(supplier._id);
        }
      });
    } else if (type === 'deleteMultiple' && this.selectedIds.length > 0) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        maxWidth: '400px',
        data: {
          title: 'Confirm Delete',
          message: `Are you sure you want to delete ${this.selectedIds.length} suppliers?`,
        },
      });
      dialogRef.afterClosed().subscribe((dialogResult) => {
        if (dialogResult) {
          this.deleteMultipleSupplierById();
        }
      });
    }
  }

  /**
   * EXPORT TO EXCEL
   */
  exportToExcel() {
    const data = this.suppliers.map(supplier => ({
      'Name': supplier.name || '-',
      'Phone': supplier.phone || '-',
      'Email': supplier.email || '-',
      'Contact Person': supplier.contactPerson || '-',
      'Total Due': supplier.totalDue || 0,
      'Total Paid': supplier.totalPaid || 0,
      'Address': supplier.address || '-',
      'City': supplier.city || '-',
      'Country': supplier.country || '-',
      'Created Date': supplier.createdAtString || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');
    XLSX.writeFile(workbook, `Suppliers_${new Date().getTime()}.xlsx`);
    this.uiService.message('Excel file downloaded successfully', 'success');
  }

  /**
   * GET SHOP INFORMATION
   */
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
   * ON DESTROY
   */
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
    if (this.subForm) {
      this.subForm.unsubscribe();
    }
    if (this.subReload) {
      this.subReload.unsubscribe();
    }
    if (this.subShopInfo) {
      this.subShopInfo.unsubscribe();
    }
  }
}

