import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import { FormControl, FormGroup, NgForm } from '@angular/forms';
import { EMPTY, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, pluck, switchMap } from 'rxjs/operators';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import * as XLSX from 'xlsx';

import { UiService } from '../../../../services/core/ui.service';
import { CustomerService } from '../../../../services/common/customer.service';
import { UtilsService } from '../../../../services/core/utils.service';
import { ReloadService } from '../../../../services/core/reload.service';
import { VendorService } from '../../../../services/vendor/vendor.service';
import { ShopInformationService } from '../../../../services/common/shop-information.service';
import { ConfirmDialogComponent } from '../../../../shared/components/ui/confirm-dialog/confirm-dialog.component';
import { FilterData } from '../../../../interfaces/gallery/filter-data';
import { Customer } from '../../../../interfaces/common/customer.interface';
import { ShopInformation } from '../../../../interfaces/common/shop-information.interface';
import { VendorPermissions } from '../../../../enum/vendor-permission.enum';
import { ExportToolbarComponent, ColumnVisibility } from '../../../../shared/components/export-toolbar/export-toolbar.component';

@Component({
  selector: 'app-customer-list',
  templateUrl: './customer-list.component.html',
  styleUrls: ['./customer-list.component.scss']
})
export class CustomerListComponent implements OnInit, AfterViewInit, OnDestroy {
  // Vendor Base Data
  vendorId: string;
  role: string;
  permissions: VendorPermissions[] = [];
  checkEditPermission: boolean = false;
  checkDeletePermission: boolean = false;

  // Store Data
  isLoading: boolean = true;
  allCustomers: Customer[] = [];
  customers: Customer[] = [];
  id?: string;
  customerData: Customer = null;

  // Shop data
  shopInformation: ShopInformation;

  // FilterData
  isDefaultFilter: boolean = false;
  filter: any = null;
  sortQuery: any = null;
  activeFilter: string = 'all'; // 'all', 'VIP', 'General', 'Wholesale', 'withDue'
  activeSort: number;

  // Selected Data
  selectedIds: string[] = [];
  @ViewChild('matCheckbox') matCheckbox: MatCheckbox;

  // Date
  today = new Date();
  dataFormDateRange = new FormGroup({
    start: new FormControl(),
    end: new FormControl(),
  });

  // Search Area
  @ViewChild('searchForm') searchForm: NgForm;
  searchQuery = null;
  searchCustomers: Customer[] = [];

  exportColumns: ColumnVisibility[] = [
    { key: 'name', label: 'Name', visible: true },
    { key: 'phone', label: 'Phone', visible: true },
    { key: 'email', label: 'Email', visible: true },
    { key: 'address', label: 'Address', visible: true },
    { key: 'group', label: 'Group', visible: true },
    { key: 'dueAmount', label: 'Due Amount', visible: true }
  ];

  // Subscriptions
  private subDataOne: Subscription;
  private subDataTwo: Subscription;
  private subDataThree: Subscription;
  private subForm: Subscription;
  private subReload: Subscription;
  private subShopInfo: Subscription;

  constructor(
    private customerService: CustomerService,
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
    this.getAllCustomers();
    this.subReload = this.reloadService.refreshCustomer$.subscribe(() => {
      this.getAllCustomers();
    });
  }

  /**
   * VENDOR BASE DATA
   */
  private getVendorBaseData() {
    this.vendorId = this.vendorService.getUserId();
    this.role = this.vendorService.getUserRole() || 'admin';
    // Permissions can be added later if needed
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
  private getAllCustomers() {
    this.isLoading = true;

    const mSelect = {
      name: 1,
      phone: 1,
      email: 1,
      address: 1,
      customerGroup: 1,
      totalDue: 1,
      totalPaid: 1,
      walletBalance: 1,
      userPoints: 1,
      smsEnabled: 1,
      emailEnabled: 1,
      birthdate: 1,
      createdAt: 1,
      createdAtString: 1,
    };

    let mFilter: any = {};

    // Apply group filter
    if (this.activeFilter === 'VIP' || this.activeFilter === 'General' || this.activeFilter === 'Wholesale') {
      mFilter.customerGroup = this.activeFilter;
    } else if (this.activeFilter === 'withDue') {
      mFilter.totalDue = { $gt: 0 };
    } else if (this.activeFilter === 'all') {
      // For 'all', use empty filter or null
      mFilter = null;
    }

    const filter: FilterData = {
      filter: mFilter,
      pagination: null,
      select: mSelect,
      sort: this.sortQuery || { createdAt: -1 },
    };

    this.subDataOne = this.customerService.getAllCustomers(filter, this.searchQuery)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.allCustomers = res.data || [];
            this.customers = this.allCustomers;
            this.searchCustomers = this.allCustomers;
          } else {
            this.uiService.message('Failed to load customers', 'warn');
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading customers:', err);
          this.uiService.message('Failed to load customers. Please try again.', 'warn');
        },
      });
  }

  /**
   * FILTER BY GROUP
   */
  onFilterChange(filter: string) {
    this.activeFilter = filter;
    this.getAllCustomers();
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
              this.getAllCustomers();
            } else {
              this.searchQuery = null;
              this.getAllCustomers();
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

  onAllSelectChange(event: MatCheckboxChange, customers: Customer[], index: number) {
    if (event.checked) {
      customers.forEach(m => {
        this.selectedIds.push(m._id);
        (m as any).select = true;
      });
    } else {
      customers.forEach(m => {
        const i = this.selectedIds.findIndex(f => f === m._id);
        this.selectedIds.splice(i, 1);
        (m as any).select = false;
      });
    }
  }

  /**
   * DELETE METHODS
   */
  private deleteCustomerById(id: string) {
    this.subDataTwo = this.customerService.deleteCustomerById(id, false)
      .subscribe({
        next: (res) => {
          this.uiService.message(res.message || 'Customer deleted successfully', 'success');
          this.getAllCustomers();
        },
        error: (err) => {
          console.error('Error deleting customer:', err);
          this.uiService.message('Failed to delete customer', 'warn');
        }
      });
  }

  private deleteMultipleCustomerById() {
    this.subDataThree = this.customerService.deleteMultipleCustomerById(this.selectedIds, false)
      .subscribe({
        next: (res) => {
          this.uiService.message(res.message || 'Customers deleted successfully', 'success');
          this.selectedIds = [];
          this.getAllCustomers();
        },
        error: (err) => {
          console.error('Error deleting customers:', err);
          this.uiService.message('Failed to delete customers', 'warn');
        }
      });
  }

  openConfirmDialog(type: string, customer?: Customer) {
    if (type === 'delete' && customer) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        maxWidth: '400px',
        data: {
          title: 'Confirm Delete',
          message: `Are you sure you want to delete customer: ${customer.name || customer.phone}?`,
        },
      });
      dialogRef.afterClosed().subscribe((dialogResult) => {
        if (dialogResult) {
          this.deleteCustomerById(customer._id);
        }
      });
    } else if (type === 'deleteMultiple' && this.selectedIds.length > 0) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        maxWidth: '400px',
        data: {
          title: 'Confirm Delete',
          message: `Are you sure you want to delete ${this.selectedIds.length} customers?`,
        },
      });
      dialogRef.afterClosed().subscribe((dialogResult) => {
        if (dialogResult) {
          this.deleteMultipleCustomerById();
        }
      });
    }
  }

  /**
   * EXPORT TO EXCEL
   */
  exportToExcel() {
    const data = this.customers.map(customer => ({
      'Name': customer.name || '-',
      'Phone': customer.phone,
      'Email': customer.email || '-',
      'Group': customer.customerGroup || 'General',
      'Total Due': customer.totalDue || 0,
      'Wallet Balance': customer.walletBalance || 0,
      'Points': customer.userPoints || 0,
      'Address': customer.address || '-',
      'Created Date': customer.createdAtString || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
    XLSX.writeFile(workbook, `Customers_${new Date().getTime()}.xlsx`);
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
   * GET CUSTOMER GROUP BADGE CLASS
   */
  getGroupBadgeClass(group: string): string {
    switch (group) {
      case 'VIP':
        return 'vip-badge';
      case 'Wholesale':
        return 'wholesale-badge';
      default:
        return 'general-badge';
    }
  }

  getExportData(): any[] {
    return this.customers.map(customer => ({
      name: customer?.name || '-',
      phone: customer?.phone || '-',
      email: customer?.email || '-',
      address: customer?.address || '-',
      group: customer?.customerGroup || '-',
      dueAmount: customer?.totalDue || 0
    }));
  }

  getExportHeaders(): string[] {
    return this.exportColumns
      .filter(col => col.visible)
      .map(col => col.label);
  }

  onColumnVisibilityChange(columns: ColumnVisibility[]): void {
    this.exportColumns = columns;
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

