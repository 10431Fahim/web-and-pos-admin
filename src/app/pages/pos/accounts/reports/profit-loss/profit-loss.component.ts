import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { ReportsService } from '../../../../../services/common/reports.service';
import { UiService } from '../../../../../services/core/ui.service';
import { ExportPrintService } from '../../../../../services/core/export-print.service';
import { UtilsService } from '../../../../../services/core/utils.service';

@Component({
  selector: 'app-profit-loss',
  templateUrl: './profit-loss.component.html',
  styleUrls: ['./profit-loss.component.scss'],
  providers: [DatePipe]
})
export class ProfitLossComponent implements OnInit {
  isLoading: boolean = true;
  profitLoss: any;
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
    this.loadProfitLoss();
  }

  loadProfitLoss() {
    this.isLoading = true;
    const startStr = this.startDate.toISOString().split('T')[0];
    const endStr = this.endDate.toISOString().split('T')[0];
    this.reportsService.getProfitAndLoss(startStr, endStr)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.profitLoss = res.data;
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading profit & loss:', err);
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
        this.loadProfitLoss();
      }
    }
  }

  onDateRangeChange() {
    this.loadProfitLoss();
  }

  exportCSV() {
    if (!this.profitLoss) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const csvData = this.prepareProfitLossData();
    const headers = ['Category', 'Item', 'Amount'];
    
    this.exportPrintService.exportCSV(csvData, 'Profit_Loss_Report', headers);
    this.uiService.message('CSV exported successfully', 'success');
  }

  exportExcel() {
    if (!this.profitLoss) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const excelData = this.prepareProfitLossData();
    const headers = ['Category', 'Item', 'Amount'];
    
    this.exportPrintService.exportExcel(excelData, 'Profit_Loss_Report', 'Profit & Loss Report', headers);
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (!this.profitLoss) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const htmlContent = this.generateProfitLossHTML();
    this.exportPrintService.exportPDF(htmlContent, 'Profit_Loss_Report');
    this.uiService.message('PDF exported successfully', 'success');
  }

  printReport() {
    if (!this.profitLoss) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    const htmlContent = this.generateProfitLossHTML();
    this.exportPrintService.printReport(htmlContent, 'Profit & Loss Report');
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for Profit & Loss Report', 'warn');
  }

  private prepareProfitLossData(): any[] {
    const data: any[] = [];
    const pl = this.profitLoss;

    // Revenue
    data.push({ Category: 'REVENUE', Item: 'Gross Sales', Amount: (pl.revenue?.grossSales || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Less: Sales Returns', Amount: (pl.revenue?.salesReturns || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Less: Sales Discount', Amount: (pl.revenue?.salesDiscount || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Net Sales', Amount: (pl.revenue?.netSales || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Other Income', Amount: (pl.revenue?.otherIncome || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Total Revenue', Amount: (pl.revenue?.totalRevenue || 0).toFixed(2) });
    data.push({ Category: '', Item: '', Amount: '' });

    // COGS
    data.push({ Category: 'COST OF GOODS SOLD', Item: 'COGS', Amount: (pl.costOfGoodsSold?.cogs || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Less: COGS Returns', Amount: (pl.costOfGoodsSold?.cogsReturns || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Net COGS', Amount: (pl.costOfGoodsSold?.netCogs || 0).toFixed(2) });
    data.push({ Category: '', Item: '', Amount: '' });

    // Gross Profit
    data.push({ Category: 'GROSS PROFIT', Item: 'Gross Profit', Amount: (pl.grossProfit || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Gross Profit Margin', Amount: (pl.grossProfitMargin || '0%') });
    data.push({ Category: '', Item: '', Amount: '' });

    // Operating Expenses
    if (pl.operatingExpenses?.breakdown) {
      pl.operatingExpenses.breakdown.forEach((exp: any) => {
        data.push({ Category: 'OPERATING EXPENSES', Item: exp.category || 'Other', Amount: (exp.amount || 0).toFixed(2) });
      });
    }
    data.push({ Category: '', Item: 'Total Operating Expenses', Amount: (pl.operatingExpenses?.total || 0).toFixed(2) });
    data.push({ Category: '', Item: '', Amount: '' });

    // Operating Profit
    data.push({ Category: 'OPERATING PROFIT', Item: 'Operating Profit', Amount: (pl.operatingProfit || 0).toFixed(2) });
    data.push({ Category: '', Item: '', Amount: '' });

    // Net Profit
    data.push({ Category: 'NET ' + ((pl.netProfit || 0) >= 0 ? 'PROFIT' : 'LOSS'), Item: 'Net ' + ((pl.netProfit || 0) >= 0 ? 'Profit' : 'Loss'), Amount: (pl.netProfit || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Net Profit Margin', Amount: (pl.netProfitMargin || '0%') });

    return data;
  }

  private generateProfitLossHTML(): string {
    const pl = this.profitLoss;
    const startStr = this.datePipe.transform(this.startDate, 'longDate') || '';
    const endStr = this.datePipe.transform(this.endDate, 'longDate') || '';

    let html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="text-align: center; color: #2196f3; margin-bottom: 10px;">Profit & Loss Statement</h1>
        <div style="text-align: center; color: #666; margin-bottom: 30px;">${startStr} to ${endStr}</div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
          <div style="padding: 1.5rem; background: #f9f9f9; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #333;">Revenue</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">Gross Sales</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600;">${(pl.revenue?.grossSales || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">Less: Sales Returns</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">-${(pl.revenue?.salesReturns || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">Less: Sales Discount</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">-${(pl.revenue?.salesDiscount || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">Net Sales</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600;">${(pl.revenue?.netSales || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">Other Income</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e0e0e0; color: #4caf50; font-weight: 600;">${(pl.revenue?.otherIncome || 0).toFixed(2)}</td>
              </tr>
              <tr style="border-top: 2px solid #e0e0e0; margin-top: 10px;">
                <td style="padding: 10px 0; font-weight: 700; font-size: 16px;">Total Revenue</td>
                <td style="text-align: right; padding: 10px 0; font-weight: 700; font-size: 16px; color: #2196f3;">${(pl.revenue?.totalRevenue || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div style="padding: 1.5rem; background: #f9f9f9; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #333;">Cost of Goods Sold</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">COGS</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600;">${(pl.costOfGoodsSold?.cogs || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">Less: COGS Returns</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">-${(pl.costOfGoodsSold?.cogsReturns || 0).toFixed(2)}</td>
              </tr>
              <tr style="border-top: 2px solid #e0e0e0; margin-top: 10px;">
                <td style="padding: 10px 0; font-weight: 700; font-size: 16px;">Net COGS</td>
                <td style="text-align: right; padding: 10px 0; font-weight: 700; font-size: 16px; color: #2196f3;">${(pl.costOfGoodsSold?.netCogs || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="padding: 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: white;">Gross Profit</h3>
          <div style="border-top: 2px solid rgba(255, 255, 255, 0.3); padding-top: 1rem; margin-top: 1rem;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; font-weight: 700; font-size: 16px;">Gross Profit</td>
                <td style="text-align: right; padding: 10px 0; font-weight: 700; font-size: 16px; color: #ffffff;">${(pl.grossProfit || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">Gross Profit Margin</td>
                <td style="text-align: right; padding: 8px 0; color: #ffffff;">${pl.grossProfitMargin || '0%'}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="padding: 1.5rem; background: #f9f9f9; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Operating Expenses</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${pl.operatingExpenses?.breakdown ? pl.operatingExpenses.breakdown.map((exp: any) => `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">${exp.category || 'Other'}</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e0e0e0; color: #d32f2f; font-weight: 600;">${(exp.amount || 0).toFixed(2)}</td>
              </tr>
            `).join('') : ''}
            <tr style="border-top: 2px solid #e0e0e0; margin-top: 10px;">
              <td style="padding: 10px 0; font-weight: 700; font-size: 16px;">Total Operating Expenses</td>
              <td style="text-align: right; padding: 10px 0; font-weight: 700; font-size: 16px; color: #d32f2f;">${(pl.operatingExpenses?.total || 0).toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div style="padding: 1.5rem; background: #f9f9f9; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Operating Profit</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; font-weight: 700; font-size: 16px;">Operating Profit</td>
              <td style="text-align: right; padding: 10px 0; font-weight: 700; font-size: 16px; color: ${(pl.operatingProfit || 0) >= 0 ? '#4caf50' : '#d32f2f'};">${(pl.operatingProfit || 0).toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div style="padding: 1.5rem; background: linear-gradient(135deg, ${(pl.netProfit || 0) >= 0 ? '#4caf50' : '#d32f2f'} 0%, ${(pl.netProfit || 0) >= 0 ? '#388e3c' : '#c62828'} 100%); border-radius: 8px; color: white;">
          <h3 style="margin-top: 0; color: white;">Net ${(pl.netProfit || 0) >= 0 ? 'Profit' : 'Loss'}</h3>
          <div style="border-top: 2px solid rgba(255, 255, 255, 0.3); padding-top: 1rem; margin-top: 1rem;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; font-weight: 700; font-size: 18px;">Net ${(pl.netProfit || 0) >= 0 ? 'Profit' : 'Loss'}</td>
                <td style="text-align: right; padding: 10px 0; font-weight: 700; font-size: 18px; color: #ffffff;">${(pl.netProfit || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">Net Profit Margin</td>
                <td style="text-align: right; padding: 8px 0; color: #ffffff;">${pl.netProfitMargin || '0%'}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    `;

    return html;
  }
}


