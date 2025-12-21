import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { ReportsService } from '../../../../../services/common/reports.service';
import { UiService } from '../../../../../services/core/ui.service';
import { ExportPrintService } from '../../../../../services/core/export-print.service';
import { UtilsService } from '../../../../../services/core/utils.service';

@Component({
  selector: 'app-slow-selling-products',
  templateUrl: './slow-selling-products.component.html',
  styleUrls: ['./slow-selling-products.component.scss'],
  providers: [DatePipe]
})
export class SlowSellingProductsComponent implements OnInit {
  isLoading: boolean = true;
  slowProducts: any[] = [];
  startDate: Date;
  endDate: Date = new Date();
  limit: number = 10;
  
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
    this.reportsService.getSlowSellingProducts(startStr, endStr, this.limit)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.slowProducts = res.data || [];
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading slow selling products:', err);
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

  onLimitChange() {
    this.loadReport();
  }

  exportCSV() {
    if (this.slowProducts.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Product Name', 'SKU', 'Quantity Sold', 'Total Sale Amount'];
    const csvData = this.slowProducts.map(item => ({
      'Product Name': item.productName || '',
      'SKU': item.sku || '',
      'Quantity Sold': item.quantitySold || 0,
      'Total Sale Amount': (item.totalSaleAmount || 0).toFixed(2)
    }));

    this.exportPrintService.exportCSV(csvData, 'Slow_Selling_Products', headers);
    this.uiService.message('CSV exported successfully', 'success');
  }

  exportExcel() {
    if (this.slowProducts.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Product Name', 'SKU', 'Quantity Sold', 'Total Sale Amount'];
    const excelData = this.slowProducts.map(item => ({
      'Product Name': item.productName || '',
      'SKU': item.sku || '',
      'Quantity Sold': item.quantitySold || 0,
      'Total Sale Amount': (item.totalSaleAmount || 0).toFixed(2)
    }));

    this.exportPrintService.exportExcel(excelData, 'Slow_Selling_Products', 'Slow Selling Products', headers);
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (this.slowProducts.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Product Name', 'SKU', 'Quantity Sold', 'Total Sale Amount'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.slowProducts.map(item => ({
        'Product Name': item.productName || '',
        'SKU': item.sku || '',
        'Quantity Sold': item.quantitySold || 0,
        'Total Sale Amount': (item.totalSaleAmount || 0).toFixed(2)
      })),
      headers,
      'Slow Selling Products'
    );

    this.exportPrintService.exportPDF(htmlContent, 'Slow_Selling_Products');
    this.uiService.message('PDF exported successfully', 'success');
  }

  printReport() {
    if (this.slowProducts.length === 0) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    const headers = ['Product Name', 'SKU', 'Quantity Sold', 'Total Sale Amount'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.slowProducts.map(item => ({
        'Product Name': item.productName || '',
        'SKU': item.sku || '',
        'Quantity Sold': item.quantitySold || 0,
        'Total Sale Amount': (item.totalSaleAmount || 0).toFixed(2)
      })),
      headers,
      'Slow Selling Products'
    );

    this.exportPrintService.printReport(htmlContent, 'Slow Selling Products');
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for this report', 'warn');
  }
}

