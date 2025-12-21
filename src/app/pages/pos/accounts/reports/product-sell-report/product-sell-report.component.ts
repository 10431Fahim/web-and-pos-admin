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
  selector: 'app-product-sell-report',
  templateUrl: './product-sell-report.component.html',
  styleUrls: ['./product-sell-report.component.scss'],
  providers: [DatePipe]
})
export class ProductSellReportComponent implements OnInit {
  isLoading: boolean = false;
  reportData: any[] = [];
  dataSource = new MatTableDataSource<any>([]);
  summary: any = {
    totalProducts: 0,
    totalQuantity: 0,
    totalSales: 0,
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

  loadReport() {
    if (!this.startDate || !this.endDate) {
      this.uiService.message('Please select date range', 'warn');
      return;
    }

    this.isLoading = true;
    const startDateStr = this.startDate.toISOString().split('T')[0];
    const endDateStr = this.endDate.toISOString().split('T')[0];

    console.log('Loading Product Sell Report:', { startDateStr, endDateStr });

    this.reportsService.getProductSellReport(startDateStr, endDateStr)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          console.log('Product Sell Report API Response:', res);
          if (res.success) {
            this.reportData = res.data?.report || [];
            this.dataSource.data = this.reportData;
            this.summary = res.data?.summary || {
              totalProducts: 0,
              totalQuantity: 0,
              totalSales: 0,
              totalTransactions: 0
            };
            console.log('Product Sell Report loaded:', {
              count: this.reportData.length,
              summary: this.summary,
              data: this.reportData
            });
            if (this.reportData.length === 0) {
              this.uiService.message('No product sell data found for the selected date range', 'warn');
            } else {
              this.uiService.message(`Loaded ${this.reportData.length} product records`, 'success');
            }
          } else {
            console.error('Product Sell Report API Error:', res.message);
            this.uiService.message(res.message || 'Failed to load report', 'warn');
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading product sell report:', err);
          this.uiService.message('Failed to load report. Please check console for details.', 'warn');
        }
      });
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

    const headers = ['Product Name', 'Quantity', 'Unit Price', 'Total', 'Transaction Count'];
    const csvData = this.reportData.map(item => ({
      'Product Name': item.productName || '',
      'Quantity': item.quantity || 0,
      'Unit Price': item.unitPrice || 0,
      'Total': item.total || 0,
      'Transaction Count': item.count || 0
    }));

    this.exportPrintService.exportCSV(csvData, 'Product_Sell_Report', headers);
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
      'Transaction Count': item.count || 0
    }));

    this.exportPrintService.exportExcel(excelData, 'Product_Sell_Report', 'Product Sell Report');
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Product Name', 'Quantity', 'Unit Price', 'Total', 'Transactions'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.reportData.map(item => ({
        'Product Name': item.productName || '',
        'Quantity': item.quantity || 0,
        'Unit Price': (item.unitPrice || 0).toFixed(2),
        'Total': (item.total || 0).toFixed(2),
        'Transactions': item.count || 0
      })),
      headers,
      'Product Sell Report'
    );

    const summaryHTML = `
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <h3>Summary</h3>
        <p><strong>Total Products:</strong> ${this.summary.totalProducts || 0}</p>
        <p><strong>Total Quantity:</strong> ${this.summary.totalQuantity || 0}</p>
        <p><strong>Total Sales:</strong> ${(this.summary.totalSales || 0).toFixed(2)}</p>
        <p><strong>Total Transactions:</strong> ${this.summary.totalTransactions || 0}</p>
      </div>
    `;

    this.exportPrintService.exportPDF(summaryHTML + htmlContent, 'Product_Sell_Report');
    this.uiService.message('PDF exported successfully', 'success');
  }

  printReport() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    const headers = ['Product Name', 'Quantity', 'Unit Price', 'Total', 'Transactions'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.reportData.map(item => ({
        'Product Name': item.productName || '',
        'Quantity': item.quantity || 0,
        'Unit Price': (item.unitPrice || 0).toFixed(2),
        'Total': (item.total || 0).toFixed(2),
        'Transactions': item.count || 0
      })),
      headers,
      'Product Sell Report'
    );

    const summaryHTML = `
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <h3>Summary</h3>
        <p><strong>Total Products:</strong> ${this.summary.totalProducts || 0}</p>
        <p><strong>Total Quantity:</strong> ${this.summary.totalQuantity || 0}</p>
        <p><strong>Total Sales:</strong> ${(this.summary.totalSales || 0).toFixed(2)}</p>
        <p><strong>Total Transactions:</strong> ${this.summary.totalTransactions || 0}</p>
      </div>
    `;

    this.exportPrintService.printReport(summaryHTML + htmlContent, 'Product Sell Report');
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for this report', 'warn');
  }
}

