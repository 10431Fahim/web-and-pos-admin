import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { ReportsService } from '../../../../../services/common/reports.service';
import { UiService } from '../../../../../services/core/ui.service';
import { ExportPrintService } from '../../../../../services/core/export-print.service';
import { DatePipe } from '@angular/common';
import { MatTableDataSource } from '@angular/material/table';
import { UtilsService } from '../../../../../services/core/utils.service';

@Component({
  selector: 'app-product-purchase-report',
  templateUrl: './product-purchase-report.component.html',
  styleUrls: ['./product-purchase-report.component.scss'],
  providers: [DatePipe]
})
export class ProductPurchaseReportComponent implements OnInit {
  isLoading: boolean = false;
  reportData: any[] = [];
  dataSource = new MatTableDataSource<any>([]);
  summary: any = {
    totalProducts: 0,
    totalQuantity: 0,
    totalPurchase: 0,
    totalTransactions: 0
  };
  startDate: Date | null = null;
  endDate: Date | null = null;
  
  // Date Range Filter
  today = new Date();
  dataFormDateRange = new FormGroup({
    start: new FormControl(),
    end: new FormControl(),
  });

  get hasSummary(): boolean {
    return this.summary && typeof this.summary === 'object' && Object.keys(this.summary).length > 0;
  }

  displayedColumns: string[] = [
    'productName',
    'quantity',
    'unitPrice',
    'total',
    'supplier',
    'count'
  ];

  constructor(
    private reportsService: ReportsService,
    private uiService: UiService,
    private exportPrintService: ExportPrintService,
    private datePipe: DatePipe,
    private utilsService: UtilsService
  ) {}

  ngOnInit(): void {
    const today = new Date();
    this.endDate = today;
    this.startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Initialize date range form
    this.dataFormDateRange.patchValue({
      start: this.startDate,
      end: this.endDate
    });
    
    this.loadReport();
  }

  loadReport() {
    if (!this.startDate || !this.endDate) {
      this.uiService.message('Please select date range', 'warn');
      return;
    }

    this.isLoading = true;
    const startDateStr = this.startDate.toISOString().split('T')[0];
    const endDateStr = this.endDate.toISOString().split('T')[0];

    this.reportsService.getProductPurchaseReport(startDateStr, endDateStr)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.reportData = res.data?.report || [];
            this.dataSource.data = this.reportData;
            this.summary = res.data?.summary || {
              totalProducts: 0,
              totalQuantity: 0,
              totalPurchase: 0,
              totalTransactions: 0
            };
            if (this.reportData.length === 0) {
              this.uiService.message('No product purchase data found', 'warn');
            }
          } else {
            this.uiService.message(res.message || 'Failed to load report', 'warn');
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading product purchase report:', err);
          this.uiService.message('Failed to load report', 'warn');
        }
      });
  }

  endChangeRegDateRange(event: MatDatepickerInputEvent<any>) {
    if (event.value) {
      const startDate = this.utilsService.getDateString(
        this.dataFormDateRange.value.start
      );
      const endDate = this.utilsService.getDateString(
        this.dataFormDateRange.value.end
      );

      if (startDate && endDate) {
        const start = new Date(this.dataFormDateRange.value.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(this.dataFormDateRange.value.end);
        end.setHours(23, 59, 59, 999);
        
        this.startDate = start;
        this.endDate = end;
        this.loadReport();
      }
    }
  }

  onDateChange() {
    if (this.startDate && this.endDate) {
      this.loadReport();
    }
  }

  exportCSV() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Product Name', 'Quantity', 'Unit Price', 'Total', 'Supplier', 'Transaction Count'];
    const csvData = this.reportData.map(item => ({
      'Product Name': item.productName || '',
      'Quantity': item.quantity || 0,
      'Unit Price': item.unitPrice || 0,
      'Total': item.total || 0,
      'Supplier': item.supplier || '',
      'Transaction Count': item.count || 0
    }));

    this.exportPrintService.exportCSV(csvData, 'Product_Purchase_Report', headers);
    this.uiService.message('CSV exported successfully', 'success');
  }

  exportExcel() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const excelData = this.reportData.map(item => ({
      'Product Name': item.productName || '',
      'Quantity': item.quantity || 0,
      'Unit Price': item.unitPrice || 0,
      'Total': item.total || 0,
      'Supplier': item.supplier || '',
      'Transaction Count': item.count || 0
    }));

    this.exportPrintService.exportExcel(excelData, 'Product_Purchase_Report', 'Product Purchase Report');
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Product Name', 'Quantity', 'Unit Price', 'Total', 'Supplier', 'Transactions'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.reportData.map(item => ({
        'Product Name': item.productName || '',
        'Quantity': item.quantity || 0,
        'Unit Price': (item.unitPrice || 0).toFixed(2),
        'Total': (item.total || 0).toFixed(2),
        'Supplier': item.supplier || '',
        'Transactions': item.count || 0
      })),
      headers,
      'Product Purchase Report'
    );

    const summaryHTML = `
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <h3>Summary</h3>
        <p><strong>Total Products:</strong> ${this.summary.totalProducts || 0}</p>
        <p><strong>Total Quantity:</strong> ${this.summary.totalQuantity || 0}</p>
        <p><strong>Total Purchase:</strong> ${(this.summary.totalPurchase || 0).toFixed(2)}</p>
        <p><strong>Total Transactions:</strong> ${this.summary.totalTransactions || 0}</p>
      </div>
    `;

    this.exportPrintService.exportPDF(summaryHTML + htmlContent, 'Product_Purchase_Report');
    this.uiService.message('PDF exported successfully', 'success');
  }

  printReport() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    const headers = ['Product Name', 'Quantity', 'Unit Price', 'Total', 'Supplier', 'Transactions'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.reportData.map(item => ({
        'Product Name': item.productName || '',
        'Quantity': item.quantity || 0,
        'Unit Price': (item.unitPrice || 0).toFixed(2),
        'Total': (item.total || 0).toFixed(2),
        'Supplier': item.supplier || '',
        'Transactions': item.count || 0
      })),
      headers,
      'Product Purchase Report'
    );

    const summaryHTML = `
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <h3>Summary</h3>
        <p><strong>Total Products:</strong> ${this.summary.totalProducts || 0}</p>
        <p><strong>Total Quantity:</strong> ${this.summary.totalQuantity || 0}</p>
        <p><strong>Total Purchase:</strong> ${(this.summary.totalPurchase || 0).toFixed(2)}</p>
        <p><strong>Total Transactions:</strong> ${this.summary.totalTransactions || 0}</p>
      </div>
    `;

    this.exportPrintService.printReport(summaryHTML + htmlContent, 'Product Purchase Report');
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for this report', 'warn');
  }
}

