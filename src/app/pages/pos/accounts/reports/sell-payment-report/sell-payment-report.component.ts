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
  selector: 'app-sell-payment-report',
  templateUrl: './sell-payment-report.component.html',
  styleUrls: ['./sell-payment-report.component.scss'],
  providers: [DatePipe]
})
export class SellPaymentReportComponent implements OnInit {
  isLoading: boolean = false;
  reportData: any[] = [];
  dataSource = new MatTableDataSource<any>([]);
  summary: any = {
    totalSale: 0,
    totalReceived: 0,
    totalDue: 0,
    totalCount: 0
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
    'date',
    'invoiceNo',
    'customer',
    'total',
    'paidAmount',
    'dueAmount',
    'paymentType',
    'status'
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

    console.log('Loading Sell Payment Report:', { startDateStr, endDateStr });
    this.reportsService.getSellPaymentReport(startDateStr, endDateStr)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          console.log('Sell Payment Report Response:', res);
          if (res.success) {
            this.reportData = res.data?.report || [];
            this.dataSource.data = this.reportData;
            this.summary = res.data?.summary || {
              totalSale: 0,
              totalReceived: 0,
              totalDue: 0,
              totalCount: 0
            };
            console.log('Report Data:', this.reportData);
            console.log('Summary:', this.summary);
            if (this.reportData.length === 0) {
              this.uiService.message('No sales data found for the selected date range', 'warn');
            } else {
              this.uiService.message(`Report loaded: ${this.reportData.length} transactions found`, 'success');
            }
          } else {
            console.error('Report API returned success=false:', res);
            this.uiService.message(res.message || 'Failed to load report', 'warn');
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading sell payment report:', err);
          console.error('Error details:', JSON.stringify(err, null, 2));
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

    const headers = ['Date', 'Invoice No', 'Customer', 'Total', 'Paid Amount', 'Due Amount', 'Payment Type', 'Status'];
    const csvData = this.reportData.map(item => ({
      'Date': this.datePipe.transform(item.date, 'short') || '',
      'Invoice No': item.invoiceNo || '',
      'Customer': item.customer || '',
      'Total': item.total || 0,
      'Paid Amount': item.paidAmount || 0,
      'Due Amount': item.dueAmount || 0,
      'Payment Type': item.paymentType || '',
      'Status': item.status || ''
    }));

    this.exportPrintService.exportCSV(csvData, 'Sell_Payment_Report', headers);
    this.uiService.message('CSV exported successfully', 'success');
  }

  exportExcel() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const excelData = this.reportData.map(item => ({
      'Date': this.datePipe.transform(item.date, 'short') || '',
      'Invoice No': item.invoiceNo || '',
      'Customer': item.customer || '',
      'Total': item.total || 0,
      'Paid Amount': item.paidAmount || 0,
      'Due Amount': item.dueAmount || 0,
      'Payment Type': item.paymentType || '',
      'Status': item.status || ''
    }));

    this.exportPrintService.exportExcel(excelData, 'Sell_Payment_Report', 'Sell Payment Report');
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Date', 'Invoice No', 'Customer', 'Total', 'Paid', 'Due', 'Payment Type', 'Status'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.reportData.map(item => ({
        'Date': this.datePipe.transform(item.date, 'short') || '',
        'Invoice No': item.invoiceNo || '',
        'Customer': item.customer || '',
        'Total': (item.total || 0).toFixed(2),
        'Paid': (item.paidAmount || 0).toFixed(2),
        'Due': (item.dueAmount || 0).toFixed(2),
        'Payment Type': item.paymentType || '',
        'Status': item.status || ''
      })),
      headers,
      'Sell Payment Report'
    );

    const summaryHTML = `
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <h3>Summary</h3>
        <p><strong>Total Sale:</strong> ${(this.summary.totalSale || 0).toFixed(2)}</p>
        <p><strong>Total Received:</strong> ${(this.summary.totalReceived || 0).toFixed(2)}</p>
        <p><strong>Total Due:</strong> ${(this.summary.totalDue || 0).toFixed(2)}</p>
        <p><strong>Total Transactions:</strong> ${this.summary.totalCount || 0}</p>
      </div>
    `;

    this.exportPrintService.exportPDF(summaryHTML + htmlContent, 'Sell_Payment_Report');
    this.uiService.message('PDF exported successfully', 'success');
  }

  printReport() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    const headers = ['Date', 'Invoice No', 'Customer', 'Total', 'Paid', 'Due', 'Payment Type', 'Status'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.reportData.map(item => ({
        'Date': this.datePipe.transform(item.date, 'short') || '',
        'Invoice No': item.invoiceNo || '',
        'Customer': item.customer || '',
        'Total': (item.total || 0).toFixed(2),
        'Paid': (item.paidAmount || 0).toFixed(2),
        'Due': (item.dueAmount || 0).toFixed(2),
        'Payment Type': item.paymentType || '',
        'Status': item.status || ''
      })),
      headers,
      'Sell Payment Report'
    );

    const summaryHTML = `
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <h3>Summary</h3>
        <p><strong>Total Sale:</strong> ${(this.summary.totalSale || 0).toFixed(2)}</p>
        <p><strong>Total Received:</strong> ${(this.summary.totalReceived || 0).toFixed(2)}</p>
        <p><strong>Total Due:</strong> ${(this.summary.totalDue || 0).toFixed(2)}</p>
        <p><strong>Total Transactions:</strong> ${this.summary.totalCount || 0}</p>
      </div>
    `;

    this.exportPrintService.printReport(summaryHTML + htmlContent, 'Sell Payment Report');
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for this report', 'warn');
  }
}

