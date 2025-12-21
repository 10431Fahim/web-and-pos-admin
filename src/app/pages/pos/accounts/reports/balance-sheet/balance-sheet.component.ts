import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReportsService } from '../../../../../services/common/reports.service';
import { UiService } from '../../../../../services/core/ui.service';
import { ExportPrintService } from '../../../../../services/core/export-print.service';

@Component({
  selector: 'app-balance-sheet',
  templateUrl: './balance-sheet.component.html',
  styleUrls: ['./balance-sheet.component.scss'],
  providers: [DatePipe]
})
export class BalanceSheetComponent implements OnInit {
  isLoading: boolean = true;
  balanceSheet: any;
  asOnDate: Date = new Date();

  constructor(
    private reportsService: ReportsService,
    private uiService: UiService,
    private exportPrintService: ExportPrintService,
    private datePipe: DatePipe,
  ) {}

  ngOnInit(): void {
    this.loadBalanceSheet();
  }

  loadBalanceSheet() {
    this.isLoading = true;
    const dateStr = this.asOnDate.toISOString().split('T')[0];
    this.reportsService.getBalanceSheet(null, null, dateStr)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.balanceSheet = res.data;
            // Debug: Check repair amount
            console.log('Balance Sheet Data:', this.balanceSheet);
            console.log('Repair Service Amount:', this.balanceSheet?.assets?.currentAssets?.repairServiceAmount);
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading balance sheet:', err);
        }
      });
  }

  onDateChange() {
    this.loadBalanceSheet();
  }

  exportCSV() {
    if (!this.balanceSheet) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const csvData = this.prepareBalanceSheetData();
    const headers = ['Category', 'Item', 'Amount'];
    
    this.exportPrintService.exportCSV(csvData, 'Balance_Sheet', headers);
    this.uiService.message('CSV exported successfully', 'success');
  }

  exportExcel() {
    if (!this.balanceSheet) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const excelData = this.prepareBalanceSheetData();
    const headers = ['Category', 'Item', 'Amount'];
    
    this.exportPrintService.exportExcel(excelData, 'Balance_Sheet', 'Balance Sheet', headers);
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (!this.balanceSheet) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const htmlContent = this.generateBalanceSheetHTML();
    this.exportPrintService.exportPDF(htmlContent, 'Balance_Sheet');
    this.uiService.message('PDF exported successfully', 'success');
  }

  printReport() {
    if (!this.balanceSheet) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    const htmlContent = this.generateBalanceSheetHTML();
    this.exportPrintService.printReport(htmlContent, 'Balance Sheet');
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for Balance Sheet report', 'warn');
  }

  private prepareBalanceSheetData(): any[] {
    const data: any[] = [];
    const bs = this.balanceSheet;

    // Assets
    data.push({ Category: 'ASSETS', Item: 'Current Assets', Amount: '' });
    data.push({ Category: '', Item: 'Cash in Hand', Amount: (bs.assets?.currentAssets?.cashInHand || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Cash at Bank', Amount: (bs.assets?.currentAssets?.cashAtBank || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Inventory / Stock', Amount: (bs.assets?.currentAssets?.inventory || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Accounts Receivable', Amount: (bs.assets?.currentAssets?.accountsReceivable || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Repair Service Amount', Amount: (bs.assets?.currentAssets?.repairServiceAmount || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Total Current Assets', Amount: (bs.assets?.currentAssets?.totalCurrentAssets || 0).toFixed(2) });
    data.push({ Category: '', Item: '', Amount: '' });
    data.push({ Category: '', Item: 'Total Fixed Assets', Amount: (bs.assets?.fixedAssets?.total || 0).toFixed(2) });
    data.push({ Category: '', Item: 'TOTAL ASSETS', Amount: (bs.assets?.totalAssets || 0).toFixed(2) });
    data.push({ Category: '', Item: '', Amount: '' });

    // Liabilities
    data.push({ Category: 'LIABILITIES', Item: 'Current Liabilities', Amount: '' });
    data.push({ Category: '', Item: 'Accounts Payable', Amount: (bs.liabilities?.currentLiabilities?.accountsPayable || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Customer Advance / Wallet', Amount: (bs.liabilities?.currentLiabilities?.customerAdvance || 0).toFixed(2) });
    data.push({ Category: '', Item: 'VAT Payable', Amount: (bs.liabilities?.currentLiabilities?.vatPayable || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Total Current Liabilities', Amount: (bs.liabilities?.currentLiabilities?.totalCurrentLiabilities || 0).toFixed(2) });
    data.push({ Category: '', Item: '', Amount: '' });
    data.push({ Category: '', Item: 'Total Long Term Liabilities', Amount: (bs.liabilities?.longTermLiabilities?.total || 0).toFixed(2) });
    data.push({ Category: '', Item: 'TOTAL LIABILITIES', Amount: (bs.liabilities?.totalLiabilities || 0).toFixed(2) });
    data.push({ Category: '', Item: '', Amount: '' });

    // Equity
    data.push({ Category: "OWNER'S EQUITY", Item: 'Owner Capital', Amount: (bs.equity?.ownerCapital || 0).toFixed(2) });
    data.push({ Category: '', Item: 'Retained Earnings', Amount: (bs.equity?.retainedEarnings || 0).toFixed(2) });
    data.push({ Category: '', Item: `Current Year ${(bs.equity?.currentYearProfitLoss || 0) >= 0 ? 'Profit' : 'Loss'}`, Amount: (bs.equity?.currentYearProfitLoss || 0).toFixed(2) });
    data.push({ Category: '', Item: 'TOTAL EQUITY', Amount: (bs.equity?.totalEquity || 0).toFixed(2) });

    return data;
  }

  private generateBalanceSheetHTML(): string {
    const bs = this.balanceSheet;
    const dateStr = this.datePipe.transform(this.asOnDate, 'longDate') || '';

    let html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="text-align: center; color: #2196f3; margin-bottom: 10px;">Balance Sheet</h1>
        <div style="text-align: center; color: #666; margin-bottom: 30px;">As on ${dateStr}</div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
          <!-- Assets Section -->
          <div>
            <h2 style="color: #333; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; margin-bottom: 15px;">Assets</h2>
            
            <h3 style="color: #555; margin: 15px 0 10px 0; font-size: 14px;">Current Assets</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Cash in Hand</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${(bs.assets?.currentAssets?.cashInHand || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Cash at Bank</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${(bs.assets?.currentAssets?.cashAtBank || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Inventory / Stock</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${(bs.assets?.currentAssets?.inventory || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Accounts Receivable</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${(bs.assets?.currentAssets?.accountsReceivable || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Repair Service Amount</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${(bs.assets?.currentAssets?.repairServiceAmount || 0).toFixed(2)}</td>
              </tr>
              <tr style="border-top: 2px solid #e0e0e0; margin-top: 10px;">
                <td style="padding: 10px 0; font-weight: 600;">Total Current Assets</td>
                <td style="text-align: right; padding: 10px 0; font-weight: 600;">${(bs.assets?.currentAssets?.totalCurrentAssets || 0).toFixed(2)}</td>
              </tr>
            </table>
            
            <h3 style="color: #555; margin: 15px 0 10px 0; font-size: 14px;">Fixed Assets</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Total Fixed Assets</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${(bs.assets?.fixedAssets?.total || 0).toFixed(2)}</td>
              </tr>
            </table>
            
            <div style="border-top: 2px solid #e0e0e0; margin-top: 15px; padding-top: 15px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; font-weight: 700; font-size: 16px;">TOTAL ASSETS</td>
                  <td style="text-align: right; padding: 10px 0; font-weight: 700; font-size: 16px; color: #2196f3;">${(bs.assets?.totalAssets || 0).toFixed(2)}</td>
                </tr>
              </table>
            </div>
          </div>
          
          <!-- Liabilities & Equity Section -->
          <div>
            <h2 style="color: #333; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; margin-bottom: 15px;">Liabilities</h2>
            
            <h3 style="color: #555; margin: 15px 0 10px 0; font-size: 14px;">Current Liabilities</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Accounts Payable</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${(bs.liabilities?.currentLiabilities?.accountsPayable || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Customer Advance / Wallet</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${(bs.liabilities?.currentLiabilities?.customerAdvance || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">VAT Payable</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${(bs.liabilities?.currentLiabilities?.vatPayable || 0).toFixed(2)}</td>
              </tr>
              <tr style="border-top: 2px solid #e0e0e0; margin-top: 10px;">
                <td style="padding: 10px 0; font-weight: 600;">Total Current Liabilities</td>
                <td style="text-align: right; padding: 10px 0; font-weight: 600;">${(bs.liabilities?.currentLiabilities?.totalCurrentLiabilities || 0).toFixed(2)}</td>
              </tr>
            </table>
            
            <h3 style="color: #555; margin: 15px 0 10px 0; font-size: 14px;">Long Term Liabilities</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Total Long Term Liabilities</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${(bs.liabilities?.longTermLiabilities?.total || 0).toFixed(2)}</td>
              </tr>
            </table>
            
            <div style="border-top: 2px solid #e0e0e0; margin-top: 15px; padding-top: 15px; margin-bottom: 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; font-weight: 700; font-size: 16px;">TOTAL LIABILITIES</td>
                  <td style="text-align: right; padding: 10px 0; font-weight: 700; font-size: 16px; color: #2196f3;">${(bs.liabilities?.totalLiabilities || 0).toFixed(2)}</td>
                </tr>
              </table>
            </div>
            
            <h2 style="color: #333; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; margin-bottom: 15px;">Owner's Equity</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Owner Capital</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${(bs.equity?.ownerCapital || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Retained Earnings</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600;">${(bs.equity?.retainedEarnings || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Current Year ${(bs.equity?.currentYearProfitLoss || 0) >= 0 ? 'Profit' : 'Loss'}</td>
                <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; color: ${(bs.equity?.currentYearProfitLoss || 0) >= 0 ? '#4caf50' : '#d32f2f'};">${(bs.equity?.currentYearProfitLoss || 0).toFixed(2)}</td>
              </tr>
              <tr style="border-top: 2px solid #e0e0e0; margin-top: 10px;">
                <td style="padding: 10px 0; font-weight: 700; font-size: 16px;">TOTAL EQUITY</td>
                <td style="text-align: right; padding: 10px 0; font-weight: 700; font-size: 16px; color: #2196f3;">${(bs.equity?.totalEquity || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <!-- Summary -->
        <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <div style="display: flex; justify-content: space-around; align-items: center;">
            <div style="text-align: center;">
              <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Total Assets</div>
              <div style="font-size: 20px; font-weight: 700; color: #2196f3;">${(bs.summary?.totalAssets || 0).toFixed(2)}</div>
            </div>
            <div style="font-size: 24px; color: #666;">=</div>
            <div style="text-align: center;">
              <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Liabilities + Equity</div>
              <div style="font-size: 20px; font-weight: 700; color: #2196f3;">${(bs.summary?.totalLiabilitiesAndEquity || 0).toFixed(2)}</div>
            </div>
          </div>
          <div style="text-align: center; margin-top: 15px; padding: 10px; background: ${bs.summary?.balanceCheck === 'BALANCED' ? '#4caf50' : '#ff9800'}; color: white; border-radius: 5px; font-weight: 600;">
            ${bs.summary?.balanceCheck === 'BALANCED' ? '✓ Books are Balanced' : `⚠ Books are Unbalanced (Difference: ${(bs.summary?.difference || 0).toFixed(2)})`}
          </div>
        </div>
      </div>
    `;

    return html;
  }
}


