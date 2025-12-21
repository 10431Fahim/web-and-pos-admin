import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { ReportsService } from '../../../../../services/common/reports.service';
import { UiService } from '../../../../../services/core/ui.service';
import { ExportPrintService } from '../../../../../services/core/export-print.service';
import { UtilsService } from '../../../../../services/core/utils.service';

@Component({
  selector: 'app-expense-report',
  templateUrl: './expense-report.component.html',
  styleUrls: ['./expense-report.component.scss'],
  providers: [DatePipe]
})
export class ExpenseReportComponent implements OnInit {
  isLoading: boolean = true;
  expenseData: any;
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
    this.loadReport();
  }

  loadReport() {
    this.isLoading = true;
    const startStr = this.startDate.toISOString().split('T')[0];
    const endStr = this.endDate.toISOString().split('T')[0];
    this.reportsService.getExpenseReport(startStr, endStr)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.expenseData = res.data;
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading expense report:', err);
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

  exportCSV() {
    if (!this.expenseData) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const csvData = this.prepareExpenseData();
    const headers = ['Category', 'Amount', 'Count'];
    
    this.exportPrintService.exportCSV(csvData, 'Expense_Report', headers);
    this.uiService.message('CSV exported successfully', 'success');
  }

  exportExcel() {
    if (!this.expenseData) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const excelData = this.prepareExpenseData();
    const headers = ['Category', 'Amount', 'Count'];
    
    this.exportPrintService.exportExcel(excelData, 'Expense_Report', 'Expense Report', headers);
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (!this.expenseData) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const htmlContent = this.generateExpenseHTML();
    this.exportPrintService.exportPDF(htmlContent, 'Expense_Report');
    this.uiService.message('PDF exported successfully', 'success');
  }

  printReport() {
    if (!this.expenseData) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    const htmlContent = this.generateExpenseHTML();
    this.exportPrintService.printReport(htmlContent, 'Expense Report');
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for Expense Report', 'warn');
  }

  private prepareExpenseData(): any[] {
    const data: any[] = [];
    
    data.push({ Category: 'Total Expenses', Amount: (this.expenseData.summary?.totalAmount || 0).toFixed(2), Count: this.expenseData.summary?.totalCount || 0 });
    
    if (this.expenseData.categoryWise && this.expenseData.categoryWise.length > 0) {
      data.push({ Category: '', Amount: '', Count: '' });
      this.expenseData.categoryWise.forEach((cat: any) => {
        data.push({ Category: cat.category || 'Other', Amount: (cat.amount || 0).toFixed(2), Count: cat.count || 0 });
      });
    }

    return data;
  }

  private generateExpenseHTML(): string {
    const ed = this.expenseData;
    const startStr = this.datePipe.transform(this.startDate, 'longDate') || '';
    const endStr = this.datePipe.transform(this.endDate, 'longDate') || '';

    let html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="text-align: center; color: #2196f3; margin-bottom: 10px;">Expense Report</h1>
        <div style="text-align: center; color: #666; margin-bottom: 30px;">${startStr} to ${endStr}</div>
        
        <div style="padding: 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white; margin-bottom: 30px; text-align: center;">
          <h3 style="margin: 0 0 10px 0; color: white;">Total Expenses</h3>
          <p style="margin: 0; font-size: 32px; font-weight: 700;">${(ed.summary?.totalAmount || 0).toFixed(2)}</p>
          <small style="opacity: 0.9;">${ed.summary?.totalCount || 0} transactions</small>
        </div>
    `;

    if (ed.categoryWise && ed.categoryWise.length > 0) {
      html += `
        <div style="margin-top: 30px;">
          <h3 style="color: #333; margin-bottom: 15px;">Category Wise Breakdown</h3>
          <table style="width: 100%; border-collapse: collapse; background: #f9f9f9; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <th style="padding: 12px; text-align: left; font-weight: 600;">Category</th>
                <th style="padding: 12px; text-align: right; font-weight: 600;">Amount</th>
                <th style="padding: 12px; text-align: right; font-weight: 600;">Count</th>
              </tr>
            </thead>
            <tbody>
              ${ed.categoryWise.map((cat: any) => `
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0;">${cat.category || 'Other'}</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 600;">${(cat.amount || 0).toFixed(2)}</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">${cat.count || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }
}

