import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { ReportsService } from '../../../../../services/common/reports.service';
import { ShopService } from '../../../../../services/common/shop.service';
import { UiService } from '../../../../../services/core/ui.service';
import { ExportPrintService } from '../../../../../services/core/export-print.service';
import { UtilsService } from '../../../../../services/core/utils.service';

@Component({
  selector: 'app-branch-wise-sale-report',
  templateUrl: './branch-wise-sale-report.component.html',
  styleUrls: ['./branch-wise-sale-report.component.scss'],
  providers: [DatePipe]
})
export class BranchWiseSaleReportComponent implements OnInit {
  isLoading: boolean = true;
  branchSales: any[] = [];
  branches: any[] = [];
  selectedBranch: string = '';
  startDate: Date;
  endDate: Date = new Date();
  
  // Date Range Filter
  today = new Date();
  dataFormDateRange = new FormGroup({
    start: new FormControl(),
    end: new FormControl(),
  });

  constructor(
    private reportsService: ReportsService,
    private shopService: ShopService,
    private uiService: UiService,
    private exportPrintService: ExportPrintService,
    private datePipe: DatePipe,
    private utilsService: UtilsService,
  ) {
    const today = new Date();
    this.endDate = today;
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.startDate = firstDay;
    
    // Initialize date range form
    this.dataFormDateRange.patchValue({
      start: firstDay,
      end: today
    });
  }

  ngOnInit(): void {
    this.loadBranches();
  }

  loadBranches(): void {
    this.shopService.getAllShop({ pagination: { pageSize: 1000, currentPage: 1 } }).subscribe({
      next: (res) => {
        if (res.success) {
          this.branches = res.data;
          this.loadReport();
        }
      },
      error: (err) => {
        console.error(err);
        this.uiService.message('Failed to load branches', 'warn');
        this.isLoading = false;
      }
    });
  }

  loadReport() {
    this.isLoading = true;
    const startStr = this.startDate.toISOString().split('T')[0];
    const endStr = this.endDate.toISOString().split('T')[0];
    this.reportsService.getBranchWiseSaleReport(startStr, endStr, this.selectedBranch || undefined)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.branchSales = res.data || [];
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading branch wise sale report:', err);
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

  onDateRangeChange() {
    this.loadReport();
  }

  onBranchChange() {
    this.loadReport();
  }

  exportCSV() {
    if (this.branchSales.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Branch Name', 'Total Sales', 'Total Transactions', 'Average Sale'];
    const csvData = this.branchSales.map(item => ({
      'Branch Name': item.branchName || '',
      'Total Sales': (item.totalSales || 0).toFixed(2),
      'Total Transactions': item.totalTransactions || 0,
      'Average Sale': (item.averageSale || 0).toFixed(2)
    }));

    this.exportPrintService.exportCSV(csvData, 'Branch_Wise_Sale_Report', headers);
    this.uiService.message('CSV exported successfully', 'success');
  }

  exportExcel() {
    if (this.branchSales.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Branch Name', 'Total Sales', 'Total Transactions', 'Average Sale'];
    const excelData = this.branchSales.map(item => ({
      'Branch Name': item.branchName || '',
      'Total Sales': (item.totalSales || 0).toFixed(2),
      'Total Transactions': item.totalTransactions || 0,
      'Average Sale': (item.averageSale || 0).toFixed(2)
    }));

    this.exportPrintService.exportExcel(excelData, 'Branch_Wise_Sale_Report', 'Branch Wise Sale Report', headers);
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (this.branchSales.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Branch Name', 'Total Sales', 'Total Transactions', 'Average Sale'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.branchSales.map(item => ({
        'Branch Name': item.branchName || '',
        'Total Sales': (item.totalSales || 0).toFixed(2),
        'Total Transactions': item.totalTransactions || 0,
        'Average Sale': (item.averageSale || 0).toFixed(2)
      })),
      headers,
      'Branch Wise Sale Report'
    );

    this.exportPrintService.exportPDF(htmlContent, 'Branch_Wise_Sale_Report');
    this.uiService.message('PDF exported successfully', 'success');
  }

  printReport() {
    if (this.branchSales.length === 0) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    const headers = ['Branch Name', 'Total Sales', 'Total Transactions', 'Average Sale'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.branchSales.map(item => ({
        'Branch Name': item.branchName || '',
        'Total Sales': (item.totalSales || 0).toFixed(2),
        'Total Transactions': item.totalTransactions || 0,
        'Average Sale': (item.averageSale || 0).toFixed(2)
      })),
      headers,
      'Branch Wise Sale Report'
    );

    this.exportPrintService.printReport(htmlContent, 'Branch Wise Sale Report');
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for this report', 'warn');
  }
}

