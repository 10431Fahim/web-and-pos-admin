import {Component, inject, OnDestroy, OnInit, ViewChild, ChangeDetectorRef} from '@angular/core';
import {FormControl, FormGroup, NgForm} from '@angular/forms';
import {EMPTY, Subscription} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {MatDatepickerInputEvent} from '@angular/material/datepicker';
import {Router} from '@angular/router';
import {debounceTime, distinctUntilChanged, pluck, switchMap} from 'rxjs/operators';
import {FilterData} from '../../../interfaces/gallery/filter-data';
import {ConfirmDialogComponent} from '../../../shared/components/ui/confirm-dialog/confirm-dialog.component';
import {RepairService} from '../../../services/common/repair.service';
import {UiService} from '../../../services/core/ui.service';
import {UtilsService} from '../../../services/core/utils.service';
import {ReloadService} from '../../../services/core/reload.service';
import {ShopInformationService} from '../../../services/common/shop-information.service';
import {Select} from '../../../interfaces/core/select';
import {MONTHS, YEARS} from '../../../core/utils/app-data';
import {adminBaseMixin} from '../../../mixin/admin-base.mixin';
import {PageDataService} from '../../../services/core/page-data.service';
import {Title} from '@angular/platform-browser';
import * as XLSX from 'xlsx';
import {ExportToolbarComponent, ColumnVisibility} from '../../../shared/components/export-toolbar/export-toolbar.component';

@Component({
  selector: 'app-repair-list',
  templateUrl: './repair-list.component.html',
  styleUrls: ['./repair-list.component.scss']
})
export class RepairListComponent extends adminBaseMixin(Component) implements OnInit, OnDestroy {
  @ViewChild('searchForm') searchForm: NgForm;

  shopInformation: any;
  months: Select[] = MONTHS;
  years: Select[] = YEARS;

  isLoading: boolean = true;
  private allRepair: any[] = [];
  private holdAllRepair: any[] = [];
  repairs: { _id: string, data: any[], total: number }[] = [];
  holdPrevData: any[] = [];
  calculation: { totalAmount: number, totalPartsAmount: number, totalRepairAmount: number } = null;
  holdCalculation: { totalAmount: number, totalPartsAmount: number, totalRepairAmount: number } = null;

  isDefaultFilter: boolean = false;
  filter: any = null;
  sortQuery: any = null;
  activeFilterMonth: number = null;
  activeFilterYear: number = null;
  repairData: any;
  activeSort: number;
  selectedStatus: string | null = null;
  statusCounts: { [key: string]: number } = {
    'All': 0,
    'Pending': 0,
    'In Progress': 0,
    'Completed': 0,
    'Delivered': 0
  };

  selectedIds: string[] = [];

  today = new Date();
  dataFormDateRange = new FormGroup({
    start: new FormControl(),
    end: new FormControl(),
  });

  searchQuery = null;
  searchRepair: any[] = [];

  exportColumns: ColumnVisibility[] = [
    { key: 'brand', label: 'Brand', visible: true },
    { key: 'modelNo', label: 'Model Number', visible: true },
    { key: 'phoneNo', label: 'Customer Phone', visible: true },
    { key: 'amount', label: 'Amount', visible: true },
    { key: 'dateString', label: 'Repair Date', visible: true },
    { key: 'deliveredDate', label: 'Delivery Date', visible: true },
    { key: 'status', label: 'Status', visible: true }
  ];

  private subscriptions: Subscription[] = [];

  private readonly repairService = inject(RepairService);
  private readonly uiService = inject(UiService);
  private readonly utilsService = inject(UtilsService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly reloadService = inject(ReloadService);
  private readonly shopInformationService = inject(ShopInformationService);
  private readonly pageDataService = inject(PageDataService);
  private readonly title = inject(Title);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    const subReload = this.reloadService.refreshData$.subscribe(() => {
      this.getAllRepair();
    });
    this.subscriptions.push(subReload);

    this.setDefaultFilter();
    this.getAllRepair();
    this.getShopInformation();
    this.setPageData();
  }

  ngAfterViewInit(): void {
    const formValue = this.searchForm.valueChanges;
    const subForm = formValue
      .pipe(
        pluck('searchTerm'),
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((data) => {
          this.searchQuery = data;
          if (this.searchQuery === '' || this.searchQuery === null) {
            this.searchRepair = [];
            this.repairs = this.holdPrevData;
            this.allRepair = this.holdAllRepair;
            this.calculation = this.holdCalculation;
            this.searchQuery = null;
            return EMPTY;
          }

              const mSelect = {
                images: 1,
                date: 1,
                dateString: 1,
                nricNo: 1,
                deliveredDate: 1,
                phoneNo: 1,
                brand: 1,
                modelNo: 1,
                imeiNo: 1,
                repairFor: 1,
                deliveredTime: 1,
                amount: 1,
                partsAmount: 1,
                parts: 1,
                status: 1,
                description: 1,
                createdAt: 1,
              };

          const filterData: FilterData = {
            pagination: null,
            filter: this.filter,
            select: mSelect,
            sort: {dateString: -1},
          };

          return this.repairService.getAllRepair(filterData, this.searchQuery);
        })
      )
      .subscribe({
            next: (res: any) => {
              this.searchRepair = res.data || [];
              this.allRepair = res.data || [];
              // Initialize select property and calculate total amount for search results
              this.allRepair.forEach(item => {
                if (item.select === undefined) {
                  item.select = false;
                }
                // Calculate total amount - ensure partsAmount is a number
                const partsAmount = item.partsAmount ? parseFloat(item.partsAmount.toString()) : 0;
                const repairAmount = item.amount ? parseFloat(item.amount.toString()) : 0;
                item.totalAmount = partsAmount + repairAmount;
              });
              // Use totalAmount for grouping
              const searchDataWithTotal = this.searchRepair.map(item => {
                const partsAmount = item.partsAmount ? parseFloat(item.partsAmount.toString()) : 0;
                const repairAmount = item.amount ? parseFloat(item.amount.toString()) : 0;
                return { ...item, amount: partsAmount + repairAmount };
              });
              this.repairs = this.utilsService.arrayGroupByField(searchDataWithTotal, 'dateString', 'amount');
          // Initialize select property for grouped items
          this.repairs.forEach(group => {
            group.data.forEach(item => {
              if (item.select === undefined) {
                item.select = false;
              }
            });
          });
          this.calculation = res.calculation || { 
            totalAmount: 0, 
            totalPartsAmount: 0, 
            totalRepairAmount: 0 
          };
          // Note: Status counts are calculated from holdAllRepair (all data), not search results
        },
        error: (error) => {
          console.log(error);
        },
      });
    this.subscriptions.push(subForm);
  }

  private setPageData(): void {
    this.title.setTitle('Repair List');
    this.pageDataService.setPageData({
      title: 'Repair List',
      navArray: [
        {name: 'Dashboard', url: `/dashboard`},
        {name: 'Repair', url: ''},
      ]
    })
  }

  private setDefaultFilter() {
    this.isDefaultFilter = true;
    const month = this.utilsService.getDateMonth(false, new Date());
    const year = new Date().getFullYear();

    this.filter = {
      ...this.filter, ...{
        month: month,
        year: year,
      }
    }
    this.activeFilterMonth = this.months.findIndex(f => f.value === month);
    this.activeFilterYear = this.years.findIndex(f => f.value === year);
  }

  getAllRepair() {
    this.isLoading = true;
    const mSelect = {
      images: 1,
      date: 1,
      dateString: 1,
      updateTime: 1,
      repairFor: 1,
      brand: 1,
      model: 1,
      phoneNo: 1,
      nricNo: 1,
      deliveredDate: 1,
      amount: 1,
      partsAmount: 1,
      parts: 1,
      description: 1,
      createdAt: 1,
      condition: 1,
      purchase: 1,
      deliveredTime: 1,
      status: 1,
      problem: 1,
      password: 1,
      modelNo: 1,
      color: 1,
      imeiNo: 1,
    };

    const filter: FilterData = {
      filter: this.filter,
      pagination: null,
      select: mSelect,
      sort: {dateString: -1},
    };

    const subscription = this.repairService.getAllRepair(filter, null)
      .subscribe({
        next: (res: any) => {
          this.isLoading = false;
          if (res.success) {
            this.allRepair = res.data || [];
            // Calculate total amount (partsAmount + amount) for each repair
            this.allRepair.forEach(item => {
              if (item.select === undefined) {
                item.select = false;
              }
              // Calculate total amount - ensure partsAmount is a number
              const partsAmount = item.partsAmount ? parseFloat(item.partsAmount.toString()) : 0;
              const repairAmount = item.amount ? parseFloat(item.amount.toString()) : 0;
              item.totalAmount = partsAmount + repairAmount;
            });
            this.holdAllRepair = this.allRepair;
            // Use totalAmount for grouping (preserve original amount field)
            const dataWithTotal = (res.data || []).map(item => {
              const partsAmount = item.partsAmount || 0;
              const repairAmount = item.amount || 0;
              return { ...item, totalAmount: partsAmount + repairAmount };
            });
            this.repairs = this.utilsService.arrayGroupByField(dataWithTotal, 'dateString', 'totalAmount');
            // Initialize select property for grouped items
            this.repairs.forEach(group => {
              group.data.forEach(item => {
                if (item.select === undefined) {
                  item.select = false;
                }
              });
            });
            this.holdPrevData = this.repairs;
            this.calculation = res.calculation || { 
              totalAmount: 0, 
              totalPartsAmount: 0, 
              totalRepairAmount: 0 
            };
            // Ensure calculation has the separate amounts
            if (this.calculation && !this.calculation.totalPartsAmount) {
              this.calculation.totalPartsAmount = 0;
            }
            if (this.calculation && !this.calculation.totalRepairAmount) {
              this.calculation.totalRepairAmount = 0;
            }
            this.holdCalculation = this.calculation;
            // Clear selectedIds when data is refreshed
            this.selectedIds = [];
            // Calculate status counts
            this.calculateStatusCounts();
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.log(err);
        },
      });
    this.subscriptions.push(subscription);
  }

  private deleteMultipleRepairById() {
    const subscription = this.repairService.deleteMultipleRepairById(this.selectedIds)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.selectedIds = [];
            // Clear all selections
            this.repairs.forEach(group => {
              group.data.forEach(item => {
                item.select = false;
              });
            });
            this.uiService.message(res.message || 'Deleted successfully', 'success');
            this.reloadService.needRefreshData$();
          } else {
            this.uiService.message(res.message || 'Delete failed', 'warn');
          }
        },
        error: (error) => {
          console.log(error);
          this.uiService.message('Failed to delete repairs', 'warn');
        }
      });
    this.subscriptions.push(subscription);
  }

  filterData(value: any, index: number, type: string) {
    switch (type) {
      case 'month': {
        this.isDefaultFilter = false;
        this.filter = {'month': value};
        this.activeFilterMonth = index;
        break;
      }
      default: {
        break;
      }
    }
    this.getAllRepair();
  }

  filterByStatus(status: string | null) {
    this.selectedStatus = status;
    this.isDefaultFilter = false;
    
    if (status) {
      this.filter = {
        ...this.filter,
        status: status
      };
    } else {
      // Remove status from filter if "All Status" is selected
      const { status: _, ...rest } = this.filter || {};
      this.filter = rest;
    }
    
    this.getAllRepair();
  }

  endChangeRegDateRange(event: MatDatepickerInputEvent<any>) {
    if (event.value) {
      const startDate = this.utilsService.getDateString(this.dataFormDateRange.value.start);
      const endDate = this.utilsService.getDateString(this.dataFormDateRange.value.end);
      const qData = {dateString: {$gte: startDate, $lte: endDate}};
      this.isDefaultFilter = false;
      this.filter = {...qData};
      this.getAllRepair();
    }
  }

  onRemoveAllQuery() {
    this.activeSort = null;
    this.activeFilterMonth = null;
    this.selectedStatus = null;
    this.sortQuery = {createdAt: -1};
    this.filter = null;
    this.dataFormDateRange.reset();
    this.setDefaultFilter();
    this.getAllRepair();
  }

  onCheckChange(event: any, groupIndex: number, itemIndex: number, id: string) {
    // Find the item in the repairs array
    const item = this.repairs[groupIndex]?.data[itemIndex];
    if (item) {
      item.select = event;
      if (event) {
        if (!this.selectedIds.includes(id)) {
          this.selectedIds.push(id);
        }
      } else {
        const i = this.selectedIds.findIndex((f) => f === id);
        if (i !== -1) {
          this.selectedIds.splice(i, 1);
        }
      }
      // Trigger change detection to update UI
      this.cdr.detectChanges();
    }
  }

  onAllSelectChange(event: any, data: any[], groupIndex: number) {
    if (!event || !data || groupIndex === undefined || groupIndex < 0) {
      return;
    }

    if (!this.repairs[groupIndex] || !this.repairs[groupIndex].data) {
      return;
    }

    const currentPageIds = data.map((m) => m?._id).filter(id => id && true && true);

    if (currentPageIds.length === 0) {
      return;
    }

    if (event.checked) {
      // Add all IDs to selectedIds
      this.selectedIds = this.utilsService.mergeArrayString(this.selectedIds, currentPageIds);
      // Update select state for all items in this group
      this.repairs[groupIndex].data.forEach((m) => {
        m.select = true;
      });
    } else {
      // Remove all IDs from selectedIds
      currentPageIds.forEach((id) => {
        const i = this.selectedIds.findIndex((f) => f === id);
        if (i !== -1) {
          this.selectedIds.splice(i, 1);
        }
        // Update select state for items in this group
        const item = this.repairs[groupIndex].data.find((f) => f._id === id);
        if (item) {
          item.select = false;
        }
      });
    }

    // Trigger change detection to update UI
    this.cdr.detectChanges();
  }

  exportToAllExcel() {
    const date = this.utilsService.getDateString(new Date());
    if (this.selectedIds.length) {
      const selectedSales = [];
      this.selectedIds.forEach(id => {
        const data = this.allRepair.find(f => f._id === id);
        selectedSales.push(data);
      })
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(selectedSales);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, `Repair_${date}.xlsx`);
    } else {
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.allRepair);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, `Repair_${date}.xlsx`);
    }
  }

  public openConfirmDialog(type: string, data?: any) {
    switch (type) {
      case 'delete': {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
          maxWidth: '400px',
          data: {
            title: 'Confirm Delete',
            message: 'Are you sure you want delete this data?',
          },
        });
        dialogRef.afterClosed().subscribe((dialogResult) => {
          if (dialogResult) {
            this.deleteMultipleRepairById();
          }
        });
        break;
      }
      case 'edit': {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
          maxWidth: '400px',
          data: {
            title: 'Confirm Status Change',
            message: `Are you sure you want to change status to "${data?.status || 'selected status'}"?`,
          },
        });
        dialogRef.afterClosed().subscribe((dialogResult) => {
          if (dialogResult) {
            this.updateMultipleRepairById(data);
          }
        });
        break;
      }
      default: {
        break;
      }
    }
  }

  private updateMultipleRepairById(data: any) {
    if (!this.selectedIds || this.selectedIds.length === 0) {
      this.uiService.message('No items selected', 'warn');
      return;
    }

    if (!data || !data.status) {
      this.uiService.message('Invalid status data', 'warn');
      return;
    }

    const subscription = this.repairService.updateMultipleRepairById(this.selectedIds, data)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.selectedIds = [];
            // Clear all selections
            this.repairs.forEach(group => {
              group.data.forEach(item => {
                item.select = false;
              });
            });
            this.uiService.message(res.message || 'Status updated successfully', 'success');
            this.reloadService.needRefreshData$();
          } else {
            this.uiService.message(res.message || 'Status update failed', 'warn');
          }
        },
        error: (error) => {
          console.error('Error updating repair status:', error);
          this.uiService.message(error?.error?.message || 'Failed to update status', 'warn');
        }
      });
    this.subscriptions.push(subscription);
  }

  private calculateStatusCounts() {
    // Reset counts
    this.statusCounts = {
      'All': 0,
      'Pending': 0,
      'In Progress': 0,
      'Completed': 0,
      'Delivered': 0
    };

    // Count from holdAllRepair (all data without filters)
    if (this.holdAllRepair && this.holdAllRepair.length > 0) {
      this.statusCounts['All'] = this.holdAllRepair.length;
      
      this.holdAllRepair.forEach(repair => {
        const status = repair.status || 'Pending';
        if (this.statusCounts.hasOwnProperty(status)) {
          this.statusCounts[status] = (this.statusCounts[status] || 0) + 1;
        }
      });
    }
  }

  private getShopInformation() {
    const subscription = this.shopInformationService.getShopInformation()
      .subscribe({
        next: res => {
          this.shopInformation = res.data;
        },
        error: err => {
          console.log(err);
        }
      });
    this.subscriptions.push(subscription);
  }

  /**
   * Print Repair Invoice
   */
  printRepairInvoice(repair: any) {
    try {
      if (!repair) {
        this.uiService.message('Repair data not available for printing', 'warn');
        return;
      }

      const printContent = this.generateRepairInvoiceContent(repair);

      if (!printContent || printContent.includes('Error:')) {
        this.uiService.message('Failed to generate invoice content', 'warn');
        return;
      }

      const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');

      if (printWindow && !printWindow.closed) {
        printWindow.document.open();
        printWindow.document.write(printContent);
        printWindow.document.close();

        setTimeout(() => {
          try {
            if (printWindow && !printWindow.closed) {
              printWindow.focus();
              printWindow.print();
            }
          } catch (printError) {
            console.error('Print trigger error:', printError);
            printWindow.focus();
          }
        }, 1000);
      } else {
        this.uiService.message('Please allow popups to print invoice', 'warn');
        const blob = new Blob([printContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const altWindow = window.open(url, '_blank');
        if (altWindow) {
          setTimeout(() => {
            altWindow.print();
            URL.revokeObjectURL(url);
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Print error:', error);
      this.uiService.message('Failed to open invoice for printing', 'warn');
    }
  }

  /**
   * Generate Repair Invoice HTML Content
   */
  private generateRepairInvoiceContent(repair: any): string {
    const shopInfo: any = this.shopInformation;
    let currencySymbol = '৳';
    if (shopInfo?.currency) {
      switch(shopInfo.currency) {
        case 'BDT':
          currencySymbol = '৳';
          break;
        case 'SGD':
          currencySymbol = 'S$';
          break;
        case 'Dollar':
        case 'USD':
          currencySymbol = '$';
          break;
        default:
          currencySymbol = '৳';
      }
    }

    if (!shopInfo) {
      return 'Error: Shop information not available';
    }

    const repairDate = repair.dateString ? new Date(repair.dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) : '-';
    const repairTime = repair.updateTime || '-';
    const deliveryDate = repair.deliveredDate ? new Date(repair.deliveredDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) : '-';
    const deliveryTime = repair.deliveredTime || '-';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Repair Invoice - ${shopInfo.shopName || 'Shop'}</title>
          <meta charset="utf-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 10px;
              line-height: 1.3;
              color: #333;
              background: white;
              font-size: 11px;
            }
            .invoice-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 15px;
            }
            .invoice-header {
              text-align: center;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #1976d2;
            }
            .shop-name {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 4px;
              color: #1976d2;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .shop-details {
              margin-top: 4px;
              color: #666;
            }
            .shop-details p {
              margin: 2px 0;
              font-size: 10px;
            }
            .invoice-title {
              font-size: 16px;
              font-weight: bold;
              margin: 10px 0 8px 0;
              color: #333;
              text-align: center;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .invoice-info {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
              padding: 8px;
              background: #f8f9fa;
              border-radius: 4px;
              font-size: 10px;
            }
            .info-section {
              flex: 1;
            }
            .info-section h3 {
              font-size: 11px;
              margin-bottom: 4px;
              color: #1976d2;
              border-bottom: 1px solid #1976d2;
              padding-bottom: 2px;
            }
            .info-section p {
              margin: 2px 0;
              font-size: 10px;
              color: #333;
            }
            .info-section strong {
              color: #1976d2;
            }
            .repair-details {
              margin-bottom: 10px;
            }
            .details-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 8px;
              background: white;
              border-radius: 4px;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .details-table th {
              background-color: #1976d2;
              color: white;
              padding: 6px 8px;
              text-align: left;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              font-size: 10px;
            }
            .details-table td {
              padding: 5px 8px;
              border-bottom: 1px solid #e0e0e0;
              font-size: 10px;
            }
            .details-table tr:last-child td {
              border-bottom: none;
            }
            .details-table tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            .label-cell {
              font-weight: 600;
              color: #666;
              width: 40%;
            }
            .value-cell {
              color: #333;
            }
            .amount-section {
              margin-top: 10px;
              padding: 10px;
              background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
              border-radius: 4px;
              text-align: center;
            }
            .amount-label {
              font-size: 11px;
              color: rgba(255, 255, 255, 0.9);
              margin-bottom: 4px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .amount-value {
              font-size: 20px;
              font-weight: bold;
              color: white;
            }
            .status-badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 12px;
              font-size: 9px;
              font-weight: 600;
              text-transform: capitalize;
            }
            .status-pending {
              background: #fff3e0;
              color: #f57c00;
            }
            .status-in-progress {
              background: #e3f2fd;
              color: #1976d2;
            }
            .status-completed {
              background: #e8f5e9;
              color: #388e3c;
            }
            .status-delivered {
              background: #f3e5f5;
              color: #7b1fa2;
            }
            .invoice-footer {
              margin-top: 10px;
              padding-top: 8px;
              border-top: 1px solid #e0e0e0;
              text-align: center;
            }
            .footer-note {
              color: #666;
              font-size: 9px;
              margin-bottom: 6px;
              font-style: italic;
            }
            .footer-signature {
              margin-top: 8px;
            }
            .signature-line {
              border-top: 1px solid #333;
              width: 150px;
              margin: 15px auto 5px;
            }
            .signature-label {
              color: #333;
              font-weight: 600;
              font-size: 9px;
            }
            .parts-section {
              margin: 8px 0;
            }
            .parts-section h3 {
              font-size: 12px;
              color: #1976d2;
              margin-bottom: 6px;
              border-bottom: 1px solid #1976d2;
              padding-bottom: 4px;
            }
            .parts-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              background: white;
              border-radius: 4px;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .parts-table th {
              background-color: #1976d2;
              color: white;
              padding: 5px 6px;
              text-align: left;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              font-size: 9px;
            }
            .parts-table td {
              padding: 4px 6px;
              border-bottom: 1px solid #e0e0e0;
              font-size: 9px;
            }
            .parts-table tr:last-child td {
              border-bottom: none;
            }
            .parts-table tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            .parts-table .text-right {
              text-align: right;
            }
            .parts-table .text-center {
              text-align: center;
            }
            .parts-total-row {
              background-color: #e3f2fd !important;
              font-weight: 600;
            }
            .parts-total-row td {
              border-top: 1px solid #1976d2;
              padding: 5px 6px;
            }
            @media print {
              * {
                page-break-inside: avoid;
              }
              body {
                margin: 0;
                padding: 5mm;
                font-size: 10px;
              }
              .invoice-container {
                box-shadow: none;
                padding: 10px;
              }
              @page {
                margin: 5mm;
                size: A4;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="invoice-header">
              <div class="shop-name">${shopInfo.websiteName || 'Shop Name'}</div>
              <div class="shop-details">
                ${shopInfo.shopAddress ? `<p>${shopInfo.shopAddress}</p>` : ''}
                ${shopInfo.shopPhoneNo ? `<p>Phone: ${shopInfo.shopPhoneNo}</p>` : ''}
                ${shopInfo.shopEmail ? `<p>Email: ${shopInfo.shopEmail}</p>` : ''}
              </div>
            </div>

            <div class="invoice-title">Repair Invoice</div>

            <div class="invoice-info">
              <div class="info-section">
                <h3>Repair Information</h3>
                <p><strong>Repair Date:</strong> ${repairDate}</p>
                <p><strong>Repair Time:</strong> ${repairTime}</p>
                ${deliveryDate !== '-' ? `<p><strong>Delivery Date:</strong> ${deliveryDate}</p>` : ''}
                ${deliveryTime !== '-' ? `<p><strong>Delivery Time:</strong> ${deliveryTime}</p>` : ''}
              </div>
              <div class="info-section">
                <h3>Customer Information</h3>
                <p><strong>Phone:</strong> ${repair.phoneNo || '-'}</p>
                ${repair.nricNo ? `<p><strong>NRIC No:</strong> ${repair.nricNo}</p>` : ''}
              </div>
            </div>

            <div class="repair-details">
              <table class="details-table">
                <tr>
                  <td class="label-cell">Brand</td>
                  <td class="value-cell">${repair.brand?.name || '-'}</td>
                </tr>
                <tr>
                  <td class="label-cell">Model Number</td>
                  <td class="value-cell">${repair.modelNo?.name || '-'}</td>
                </tr>
                ${repair.color?.name ? `
                <tr>
                  <td class="label-cell">Color</td>
                  <td class="value-cell">${repair.color.name}</td>
                </tr>
                ` : ''}
                ${repair.imeiNo ? `
                <tr>
                  <td class="label-cell">IMEI Number</td>
                  <td class="value-cell">${repair.imeiNo}</td>
                </tr>
                ` : ''}
                ${repair.problem?.name ? `
                <tr>
                  <td class="label-cell">Problem</td>
                  <td class="value-cell">${repair.problem.name}</td>
                </tr>
                ` : ''}
                ${repair.repairFor ? `
                <tr>
                  <td class="label-cell">Repair For</td>
                  <td class="value-cell">${repair.repairFor}</td>
                </tr>
                ` : ''}
                ${repair.condition ? `
                <tr>
                  <td class="label-cell">Condition</td>
                  <td class="value-cell">${repair.condition}</td>
                </tr>
                ` : ''}
                ${repair.password ? `
                <tr>
                  <td class="label-cell">Password</td>
                  <td class="value-cell">${repair.password}</td>
                </tr>
                ` : ''}
                <tr>
                  <td class="label-cell">Status</td>
                  <td class="value-cell">
                    <span class="status-badge status-${(repair.status || '').toLowerCase().replace(' ', '-')}">
                      ${repair.status || '-'}
                    </span>
                  </td>
                </tr>
                ${repair.description ? `
                <tr>
                  <td class="label-cell">Description</td>
                  <td class="value-cell">${repair.description}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            ${repair.parts && repair.parts.length > 0 ? `
            <div class="parts-section">
              <h3>Parts / Spare Parts</h3>
              <table class="parts-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th class="text-center">Quantity</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${repair.parts.map((part: any) => `
                    <tr>
                      <td>${part.product?.name || '-'}${part.product?.sku ? ` (SKU: ${part.product.sku})` : ''}</td>
                      <td class="text-center">${part.quantity || 0}</td>
                      <td class="text-right">${currencySymbol} ${(part.unitPrice || 0).toFixed(2)}</td>
                      <td class="text-right">${currencySymbol} ${(part.totalPrice || 0).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  <tr class="parts-total-row">
                    <td colspan="3" style="text-align: right; font-weight: 600;">Parts Total:</td>
                    <td class="text-right" style="font-weight: 600;">${currencySymbol} ${(repair.partsAmount || repair.parts.reduce((sum: number, part: any) => sum + (part.totalPrice || 0), 0)).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            ` : ''}

            <div class="amount-section">
              <div class="amount-label">Repair Amount</div>
              <div class="amount-value">${currencySymbol} ${(repair.amount || 0).toFixed(2)}</div>
              ${repair.parts && repair.parts.length > 0 ? `
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.3);">
                  <div class="amount-label" style="font-size: 10px;">Parts Amount</div>
                  <div style="font-size: 16px; font-weight: bold; color: white; margin-bottom: 4px;">
                    ${currencySymbol} ${(repair.partsAmount || repair.parts.reduce((sum: number, part: any) => sum + (part.totalPrice || 0), 0)).toFixed(2)}
                  </div>
                  <div class="amount-label" style="font-size: 11px; margin-top: 6px;">Grand Total</div>
                  <div style="font-size: 22px; font-weight: bold; color: white;">
                    ${currencySymbol} ${((repair.amount || 0) + (repair.partsAmount || repair.parts.reduce((sum: number, part: any) => sum + (part.totalPrice || 0), 0))).toFixed(2)}
                  </div>
                </div>
              ` : ''}
            </div>

            <div class="invoice-footer">
              <div class="footer-note">
                Thank you for your business!
              </div>
              <div class="footer-signature">
                <div class="signature-line"></div>
                <div class="signature-label">Authorized Signature</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  getAllRepairData(): any[] {
    // Flatten grouped repairs for export
    const flatData: any[] = [];
    this.repairs.forEach(group => {
      group.data.forEach(repair => {
        flatData.push({
          brand: repair?.brand?.name || '-',
          modelNo: repair?.modelNo?.name || '-',
          phoneNo: repair?.phoneNo || '-',
          amount: repair?.amount || 0,
          dateString: repair?.dateString || '-',
          deliveredDate: repair?.deliveredDate || '-',
          status: repair?.status || '-'
        });
      });
    });
    return flatData;
  }

  getExportHeaders(): string[] {
    return this.exportColumns
      .filter(col => col.visible)
      .map(col => col.label);
  }

  onColumnVisibilityChange(columns: ColumnVisibility[]): void {
    this.exportColumns = columns;
    // You can add logic here to hide/show table columns
  }

  /**
   * Get parts amount for a repair
   */
  getPartsAmount(repair: any): number {
    if (!repair) return 0;
    // First check if partsAmount is directly available
    if (repair.partsAmount !== null && repair.partsAmount !== undefined) {
      return parseFloat(repair.partsAmount.toString()) || 0;
    }
    // Fallback: calculate from parts array
    if (repair.parts && Array.isArray(repair.parts)) {
      return repair.parts.reduce((sum: number, part: any) => sum + (part.totalPrice || 0), 0);
    }
    return 0;
  }

  /**
   * Get repair amount (service charge) for a repair
   */
  getRepairAmount(repair: any): number {
    if (!repair) return 0;
    const repairAmount = repair.amount;
    if (repairAmount === null || repairAmount === undefined) return 0;
    return parseFloat(repairAmount.toString()) || 0;
  }

  /**
   * Get total amount for a repair (partsAmount + amount)
   */
  getRepairTotalAmount(repair: any): number {
    const partsAmount = this.getPartsAmount(repair);
    const repairAmount = this.getRepairAmount(repair);
    return partsAmount + repairAmount;
  }

  /**
   * Get group parts total
   */
  getGroupPartsTotal(repairs: any[]): number {
    return repairs.reduce((sum, repair) => sum + this.getPartsAmount(repair), 0);
  }

  /**
   * Get group repair total
   */
  getGroupRepairTotal(repairs: any[]): number {
    return repairs.reduce((sum, repair) => sum + this.getRepairAmount(repair), 0);
  }

  /**
   * Get total parts amount from all repairs
   */
  getTotalPartsAmount(): number {
    if (!this.allRepair || !this.allRepair.length) return 0;
    return this.allRepair.reduce((sum, repair) => sum + this.getPartsAmount(repair), 0);
  }

  /**
   * Get total repair amount from all repairs
   */
  getTotalRepairAmount(): number {
    if (!this.allRepair || !this.allRepair.length) return 0;
    return this.allRepair.reduce((sum, repair) => sum + this.getRepairAmount(repair), 0);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub?.unsubscribe());
  }
}

