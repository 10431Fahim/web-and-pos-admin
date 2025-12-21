import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { ReportsService } from '../../../../../services/common/reports.service';
import { UiService } from '../../../../../services/core/ui.service';
import { ExportPrintService } from '../../../../../services/core/export-print.service';
import { UtilsService } from '../../../../../services/core/utils.service';

@Component({
  selector: 'app-purchase-vs-sale',
  templateUrl: './purchase-vs-sale.component.html',
  styleUrls: ['./purchase-vs-sale.component.scss'],
  providers: [DatePipe]
})
export class PurchaseVsSaleComponent implements OnInit {
  isLoading: boolean = true;
  comparisonData: any;
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
    this.reportsService.getPurchaseVsSaleComparison(startStr, endStr)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.comparisonData = res.data;
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading comparison:', err);
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

  getDailyComparison() {
    if (!this.comparisonData?.dailyBreakdown) return [];
    
    const salesMap = new Map();
    const purchaseMap = new Map();
    
    this.comparisonData.dailyBreakdown.sales.forEach((item: any) => {
      salesMap.set(item._id, { sales: item.sales, count: item.count });
    });
    
    this.comparisonData.dailyBreakdown.purchase.forEach((item: any) => {
      purchaseMap.set(item._id, { purchase: item.purchase, count: item.count });
    });
    
    const allDates = new Set([...salesMap.keys(), ...purchaseMap.keys()]);
    const result = Array.from(allDates).map(date => {
      const sales = salesMap.get(date) || { sales: 0, count: 0 };
      const purchase = purchaseMap.get(date) || { purchase: 0, count: 0 };
      return {
        date: date,
        sales: sales.sales,
        salesCount: sales.count,
        purchase: purchase.purchase,
        purchaseCount: purchase.count,
        difference: sales.sales - purchase.purchase,
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
    
    return result;
  }

  exportCSV() {
    if (!this.comparisonData) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const csvData = this.prepareComparisonData();
    const headers = ['Date', 'Sales', 'Sales Count', 'Purchase', 'Purchase Count', 'Difference'];
    
    this.exportPrintService.exportCSV(csvData, 'Purchase_Vs_Sale', headers);
    this.uiService.message('CSV exported successfully', 'success');
  }

  exportExcel() {
    if (!this.comparisonData) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const excelData = this.prepareComparisonData();
    const headers = ['Date', 'Sales', 'Sales Count', 'Purchase', 'Purchase Count', 'Difference'];
    
    this.exportPrintService.exportExcel(excelData, 'Purchase_Vs_Sale', 'Purchase vs Sale Comparison', headers);
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (!this.comparisonData) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const htmlContent = this.generateComparisonHTML();
    this.exportPrintService.exportPDF(htmlContent, 'Purchase_Vs_Sale');
    this.uiService.message('PDF exported successfully', 'success');
  }

  printReport() {
    if (!this.comparisonData) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    const htmlContent = this.generateComparisonHTML();
    this.exportPrintService.printReport(htmlContent, 'Purchase vs Sale Comparison');
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for Purchase vs Sale Report', 'warn');
  }

  private prepareComparisonData(): any[] {
    const data: any[] = [];
    const cd = this.comparisonData;

    // Summary
    data.push({ Date: 'SUMMARY', Sales: (cd.summary?.sales?.totalSales || 0).toFixed(2), 'Sales Count': cd.summary?.sales?.totalTransactions || 0, Purchase: (cd.summary?.purchase?.totalPurchase || 0).toFixed(2), 'Purchase Count': cd.summary?.purchase?.totalTransactions || 0, Difference: ((cd.summary?.sales?.totalSales || 0) - (cd.summary?.purchase?.totalPurchase || 0)).toFixed(2) });
    data.push({ Date: '', Sales: '', 'Sales Count': '', Purchase: '', 'Purchase Count': '', Difference: '' });

    // Daily breakdown
    const daily = this.getDailyComparison();
    daily.forEach(day => {
      data.push({ Date: day.date, Sales: (day.sales || 0).toFixed(2), 'Sales Count': day.salesCount || 0, Purchase: (day.purchase || 0).toFixed(2), 'Purchase Count': day.purchaseCount || 0, Difference: (day.difference || 0).toFixed(2) });
    });

    return data;
  }

  private generateComparisonHTML(): string {
    const cd = this.comparisonData;
    const startStr = this.datePipe.transform(this.startDate, 'longDate') || '';
    const endStr = this.datePipe.transform(this.endDate, 'longDate') || '';

    let html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="text-align: center; color: #2196f3; margin-bottom: 10px;">Purchase vs Sale Comparison</h1>
        <div style="text-align: center; color: #666; margin-bottom: 30px;">${startStr} to ${endStr}</div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
          <div style="padding: 1.5rem; background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); border-radius: 8px; color: white; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: white;">Sales</h3>
            <p style="margin: 0; font-size: 24px; font-weight: 700;">${(cd.summary?.sales?.totalSales || 0).toFixed(2)}</p>
            <small style="opacity: 0.9;">${cd.summary?.sales?.totalTransactions || 0} transactions</small>
          </div>
          <div style="padding: 1.5rem; background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); border-radius: 8px; color: white; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: white;">Purchase</h3>
            <p style="margin: 0; font-size: 24px; font-weight: 700;">${(cd.summary?.purchase?.totalPurchase || 0).toFixed(2)}</p>
            <small style="opacity: 0.9;">${cd.summary?.purchase?.totalTransactions || 0} transactions</small>
          </div>
          <div style="padding: 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: white;">Difference</h3>
            <p style="margin: 0; font-size: 24px; font-weight: 700;">${((cd.summary?.sales?.totalSales || 0) - (cd.summary?.purchase?.totalPurchase || 0)).toFixed(2)}</p>
            <small style="opacity: 0.9;">Sales - Purchase</small>
          </div>
        </div>
    `;

    const daily = this.getDailyComparison();
    if (daily.length > 0) {
      html += `
        <div style="margin-top: 30px;">
          <h3 style="color: #333; margin-bottom: 15px;">Daily Breakdown</h3>
          <table style="width: 100%; border-collapse: collapse; background: #f9f9f9; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <th style="padding: 12px; text-align: left; font-weight: 600;">Date</th>
                <th style="padding: 12px; text-align: right; font-weight: 600;">Sales</th>
                <th style="padding: 12px; text-align: right; font-weight: 600;">Sales Count</th>
                <th style="padding: 12px; text-align: right; font-weight: 600;">Purchase</th>
                <th style="padding: 12px; text-align: right; font-weight: 600;">Purchase Count</th>
                <th style="padding: 12px; text-align: right; font-weight: 600;">Difference</th>
              </tr>
            </thead>
            <tbody>
              ${daily.map(day => `
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0;">${day.date}</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 600; color: #4caf50;">${(day.sales || 0).toFixed(2)}</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">${day.salesCount || 0}</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 600; color: #ff9800;">${(day.purchase || 0).toFixed(2)}</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">${day.purchaseCount || 0}</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 600; color: ${(day.difference || 0) >= 0 ? '#4caf50' : '#d32f2f'};">${(day.difference || 0).toFixed(2)}</td>
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

