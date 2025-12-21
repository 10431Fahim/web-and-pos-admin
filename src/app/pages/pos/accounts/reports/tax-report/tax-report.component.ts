import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { ReportsService } from '../../../../../services/common/reports.service';
import { UiService } from '../../../../../services/core/ui.service';
import { ExportPrintService } from '../../../../../services/core/export-print.service';
import { UtilsService } from '../../../../../services/core/utils.service';

@Component({
  selector: 'app-tax-report',
  templateUrl: './tax-report.component.html',
  styleUrls: ['./tax-report.component.scss'],
  providers: [DatePipe]
})
export class TaxReportComponent implements OnInit {
  isLoading: boolean = true;
  taxReport: any;
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
    this.loadTaxReport();
  }

  loadTaxReport() {
    this.isLoading = true;
    const startStr = this.startDate.toISOString().split('T')[0];
    const endStr = this.endDate.toISOString().split('T')[0];
    this.reportsService.getTaxReport(startStr, endStr)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.taxReport = res.data;
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading tax report:', err);
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
        this.loadTaxReport();
      }
    }
  }

  onDateRangeChange() {
    this.loadTaxReport();
  }

  exportCSV() {
    if (!this.taxReport) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const csvData = this.prepareTaxReportData();
    const headers = ['Category', 'Item', 'Amount'];
    
    this.exportPrintService.exportCSV(csvData, 'Tax_Report', headers);
    this.uiService.message('CSV exported successfully', 'success');
  }

  exportExcel() {
    if (!this.taxReport) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const excelData = this.prepareTaxReportData();
    const headers = ['Category', 'Item', 'Amount'];
    
    this.exportPrintService.exportExcel(excelData, 'Tax_Report', 'Tax Report', headers);
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (!this.taxReport) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const htmlContent = this.generateTaxReportHTML();
    this.exportPrintService.exportPDF(htmlContent, 'Tax_Report');
    this.uiService.message('PDF exported successfully', 'success');
  }

  printReport() {
    if (!this.taxReport) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    const htmlContent = this.generateTaxReportHTML();
    this.exportPrintService.printReport(htmlContent, 'Tax Report');
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for Tax Report', 'warn');
  }

  private prepareTaxReportData(): any[] {
    const data: any[] = [];
    const tr = this.taxReport;

    // Sales Tax
    data.push({ Category: 'SALES TAX (VAT)', Item: 'Total Sales', Amount: (tr.sales?.totalSales || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Total VAT', Amount: (tr.sales?.totalVat || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Total Sales Count', Amount: (tr.sales?.totalSalesCount || 0) });
    data.push({ Category: '', Item: '', Amount: '' });

    // Purchase Tax
    data.push({ Category: 'PURCHASE TAX', Item: 'Total Purchase', Amount: (tr.purchases?.totalPurchase || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Total Tax', Amount: (tr.purchases?.totalTax || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Total Purchase Count', Amount: (tr.purchases?.totalPurchaseCount || 0) });
    data.push({ Category: '', Item: '', Amount: '' });

    // Net Tax Payable
    data.push({ Category: 'NET TAX PAYABLE', Item: 'Payable Amount', Amount: (tr.netTax?.payable || 0).toFixed(2) });

    return data;
  }

  private generateTaxReportHTML(): string {
    const tr = this.taxReport;
    const startStr = this.datePipe.transform(this.startDate, 'longDate') || '';
    const endStr = this.datePipe.transform(this.endDate, 'longDate') || '';

    let html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="text-align: center; color: #2196f3; margin-bottom: 10px;">Tax Report</h1>
        <div style="text-align: center; color: #666; margin-bottom: 30px;">${startStr} to ${endStr}</div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
          <div style="padding: 1.5rem; background: #f9f9f9; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #333;">Sales Tax (VAT)</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">Total Sales</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600;">${(tr.sales?.totalSales || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">Total VAT</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600;">${(tr.sales?.totalVat || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">Total Sales Count</td>
                <td style="text-align: right; padding: 8px 0; font-weight: 600;">${tr.sales?.totalSalesCount || 0}</td>
              </tr>
            </table>
          </div>

          <div style="padding: 1.5rem; background: #f9f9f9; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #333;">Purchase Tax</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">Total Purchase</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600;">${(tr.purchases?.totalPurchase || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">Total Tax</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600;">${(tr.purchases?.totalTax || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">Total Purchase Count</td>
                <td style="text-align: right; padding: 8px 0; font-weight: 600;">${tr.purchases?.totalPurchaseCount || 0}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="padding: 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white;">
          <h3 style="margin-top: 0; color: white;">Net Tax Payable</h3>
          <div style="border-top: 2px solid rgba(255, 255, 255, 0.3); padding-top: 1rem; margin-top: 1rem;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; font-weight: 700; font-size: 16px;">Payable Amount</td>
                <td style="text-align: right; padding: 10px 0; font-weight: 700; font-size: 16px; color: #ffffff;">${(tr.netTax?.payable || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    `;

    return html;
  }
}


