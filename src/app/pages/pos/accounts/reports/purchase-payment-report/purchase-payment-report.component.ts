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
  selector: 'app-purchase-payment-report',
  templateUrl: './purchase-payment-report.component.html',
  styleUrls: ['./purchase-payment-report.component.scss'],
  providers: [DatePipe]
})
export class PurchasePaymentReportComponent implements OnInit {
  isLoading: boolean = false;
  reportData: any[] = [];
  dataSource = new MatTableDataSource<any>([]);
  summary: any = {
    totalPurchase: 0,
    totalPaid: 0,
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
    'purchaseNo',
    'supplier',
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
    // Don't set default dates - let user select or view all data
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
      } else {
        this.startDate = null;
        this.endDate = null;
        this.loadReport();
      }
    }
  }

  loadReport() {
    this.isLoading = true;
    const startDateStr = this.startDate ? this.startDate.toISOString().split('T')[0] : undefined;
    const endDateStr = this.endDate ? this.endDate.toISOString().split('T')[0] : undefined;

    console.log('Loading Purchase Payment Report:', { startDateStr, endDateStr });

    this.reportsService.getPurchasePaymentReport(startDateStr, endDateStr)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          console.log('Purchase Payment Report API Response:', res);
          if (res.success) {
            this.reportData = res.data?.report || [];
            this.dataSource.data = this.reportData;
            this.summary = res.data?.summary || {
              totalPurchase: 0,
              totalPaid: 0,
              totalDue: 0,
              totalCount: 0
            };
            console.log('Purchase Payment Report loaded:', {
              count: this.reportData.length,
              summary: this.summary,
              data: this.reportData
            });
            if (this.reportData.length === 0) {
              this.uiService.message('No purchase data found for the selected date range', 'warn');
            } else {
              this.uiService.message(`Loaded ${this.reportData.length} purchase records`, 'success');
            }
          } else {
            console.error('Purchase Payment Report API Error:', res.message);
            this.uiService.message(res.message || 'Failed to load report', 'warn');
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading purchase payment report:', err);
          this.uiService.message('Failed to load report. Please check console for details.', 'warn');
        }
      });
  }

  onDateChange() {
    // Date change doesn't auto-load, user needs to click "Load Report" button
  }

  exportCSV() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Date', 'Purchase No', 'Supplier', 'Total', 'Paid Amount', 'Due Amount', 'Payment Type', 'Status'];
    const csvData = this.reportData.map(item => ({
      'Date': this.datePipe.transform(item.date, 'short') || '',
      'Purchase No': item.purchaseNo || '',
      'Supplier': item.supplier || '',
      'Total': item.total || 0,
      'Paid Amount': item.paidAmount || 0,
      'Due Amount': item.dueAmount || 0,
      'Payment Type': item.paymentType || '',
      'Status': item.status || ''
    }));

    this.exportPrintService.exportCSV(csvData, 'Purchase_Payment_Report', headers);
    this.uiService.message('CSV exported successfully', 'success');
  }

  exportExcel() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const excelData = this.reportData.map(item => ({
      'Date': this.datePipe.transform(item.date, 'short') || '',
      'Purchase No': item.purchaseNo || '',
      'Supplier': item.supplier || '',
      'Total': item.total || 0,
      'Paid Amount': item.paidAmount || 0,
      'Due Amount': item.dueAmount || 0,
      'Payment Type': item.paymentType || '',
      'Status': item.status || ''
    }));

    this.exportPrintService.exportExcel(excelData, 'Purchase_Payment_Report', 'Purchase Payment Report');
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Date', 'Purchase No', 'Supplier', 'Total', 'Paid', 'Due', 'Payment Type', 'Status'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.reportData.map(item => ({
        'Date': this.datePipe.transform(item.date, 'short') || '',
        'Purchase No': item.purchaseNo || '',
        'Supplier': item.supplier || '',
        'Total': (item.total || 0).toFixed(2),
        'Paid': (item.paidAmount || 0).toFixed(2),
        'Due': (item.dueAmount || 0).toFixed(2),
        'Payment Type': item.paymentType || '',
        'Status': item.status || ''
      })),
      headers,
      'Purchase Payment Report'
    );

    // Add summary to PDF
    const summaryHTML = `
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <h3>Summary</h3>
        <p><strong>Total Purchase:</strong> ${(this.summary.totalPurchase || 0).toFixed(2)}</p>
        <p><strong>Total Paid:</strong> ${(this.summary.totalPaid || 0).toFixed(2)}</p>
        <p><strong>Total Due:</strong> ${(this.summary.totalDue || 0).toFixed(2)}</p>
        <p><strong>Total Transactions:</strong> ${this.summary.totalCount || 0}</p>
      </div>
    `;

    this.exportPrintService.exportPDF(summaryHTML + htmlContent, 'Purchase_Payment_Report');
    this.uiService.message('PDF exported successfully', 'success');
  }

  printReport() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    const headers = ['Date', 'Purchase No', 'Supplier', 'Total', 'Paid', 'Due', 'Payment Type', 'Status'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.reportData.map(item => ({
        'Date': this.datePipe.transform(item.date, 'short') || '',
        'Purchase No': item.purchaseNo || '',
        'Supplier': item.supplier || '',
        'Total': (item.total || 0).toFixed(2),
        'Paid': (item.paidAmount || 0).toFixed(2),
        'Due': (item.dueAmount || 0).toFixed(2),
        'Payment Type': item.paymentType || '',
        'Status': item.status || ''
      })),
      headers,
      'Purchase Payment Report'
    );

    // Add summary to print
    const summaryHTML = `
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <h3>Summary</h3>
        <p><strong>Total Purchase:</strong> ${(this.summary.totalPurchase || 0).toFixed(2)}</p>
        <p><strong>Total Paid:</strong> ${(this.summary.totalPaid || 0).toFixed(2)}</p>
        <p><strong>Total Due:</strong> ${(this.summary.totalDue || 0).toFixed(2)}</p>
        <p><strong>Total Transactions:</strong> ${this.summary.totalCount || 0}</p>
      </div>
    `;

    this.exportPrintService.printReport(summaryHTML + htmlContent, 'Purchase Payment Report');
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for this report', 'warn');
  }
}

