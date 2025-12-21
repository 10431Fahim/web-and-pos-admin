import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { SaleService } from '../../../../../services/common/sale.service';
import { CategoryService } from '../../../../../services/common/category.service';
import { SubCategoryService } from '../../../../../services/common/sub-category.service';
import { BrandService } from '../../../../../services/common/brand.service';
import { ShopInformationService } from '../../../../../services/common/shop-information.service';
import { UiService } from '../../../../../services/core/ui.service';
import { ExportPrintService } from '../../../../../services/core/export-print.service';
import { StorageService } from '../../../../../services/core/storage.service';
import { FilterData } from '../../../../../interfaces/gallery/filter-data';
import { Category } from '../../../../../interfaces/common/category.interface';
import { SubCategory } from '../../../../../interfaces/common/sub-category.interface';
import { Brand } from '../../../../../interfaces/common/brand.interface';
import { Sale } from '../../../../../interfaces/common/sale.interface';
import { ShopInformation } from '../../../../../interfaces/common/shop-information.interface';
import { MatTableDataSource } from '@angular/material/table';
import { PAYMENT_TYPES } from '../../../../../core/utils/app-data';
import { DATABASE_KEY } from '../../../../../core/utils/global-variable';
import { UtilsService } from '../../../../../services/core/utils.service';

@Component({
  selector: 'app-sales-record',
  templateUrl: './sales-record.component.html',
  styleUrls: ['./sales-record.component.scss'],
  providers: [DatePipe]
})
export class SalesRecordComponent implements OnInit {
  isLoading: boolean = false;
  salesData: Sale[] = [];
  filteredSalesData: any[] = [];
  dataSource = new MatTableDataSource<any>([]);

  // Filters
  selectedCategories: string[] = [];
  selectedSubCategories: string[] = [];
  selectedBrands: string[] = [];
  startDate: Date | null = null;
  endDate: Date | null = null;
  dateFilterType: string = 'all'; // 'all', 'today', 'yesterday', 'last7days', 'last30days', 'thisMonth', 'custom'
  
  // Date Range Filter
  today = new Date();
  dataFormDateRange = new FormGroup({
    start: new FormControl(),
    end: new FormControl(),
  });

  // Dropdown options
  categories: Category[] = [];
  subCategories: SubCategory[] = [];
  brands: Brand[] = [];

  // Shop Information
  shopInfo: ShopInformation | null = null;
  shopInformation: ShopInformation | null = null; // Alias for print template

  // Grouped data for filtered reports
  categoryReportsData: any[] = [];
  processedData: any[] = [];
  
  // Payouts (placeholder - should be fetched from expense service)
  payouts: any[] = [
    { expenseFor: '', amount: 0 },
    { expenseFor: '', amount: 0 },
    { expenseFor: '', amount: 0 },
    { expenseFor: '', amount: 0 },
    { expenseFor: '', amount: 0 },
    { expenseFor: '', amount: 0 },
    { expenseFor: '', amount: 0 },
    { expenseFor: '', amount: 0 },
    { expenseFor: '', amount: 0 }
  ];

  // Summary
  summary: any = {
    totalSales: 0,
    totalQuantity: 0,
    totalTransactions: 0,
    totalAmount: 0,
    totalCost: 0,
    totalProfit: 0
  };

  // Check if filters are applied
  get hasFilters(): boolean {
    return (this.selectedCategories && this.selectedCategories.length > 0) ||
           (this.selectedSubCategories && this.selectedSubCategories.length > 0) ||
           (this.selectedBrands && this.selectedBrands.length > 0) ||
           (this.dateFilterType !== 'all' && this.dateFilterType !== null);
  }

  displayedColumns: string[] = [
    'serialNo',
    'item',
    'qty',
    'price',
    'cost',
    'profit',
    'notes'
  ];

  constructor(
    private saleService: SaleService,
    private categoryService: CategoryService,
    private subCategoryService: SubCategoryService,
    private brandService: BrandService,
    private shopInformationService: ShopInformationService,
    private uiService: UiService,
    private exportPrintService: ExportPrintService,
    private storageService: StorageService,
    private datePipe: DatePipe,
    private utilsService: UtilsService
  ) {}

  ngOnInit(): void {
    // Don't set date filter initially - load all data first
    this.startDate = null;
    this.endDate = null;
    this.dateFilterType = 'all';

    this.loadShopInformation();
    this.loadCategories();
    this.loadBrands();
    this.loadSales();
  }

  loadShopInformation() {
    this.shopInformationService.getShopInformation('websiteName addresses phones shopNumber siteName sellerName currency').subscribe({
      next: (res) => {
        if (res.success) {
          this.shopInfo = res.data;
          this.shopInformation = res.data; // Set alias for print template
        }
      },
      error: (err) => {
        console.error('Error loading shop information:', err);
      }
    });
  }

  getReportDate(): string {
    if (this.dateFilterType === 'today') {
      return this.datePipe.transform(new Date(), 'MMM d, y, EEEE') || '';
    } else if (this.dateFilterType === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return this.datePipe.transform(yesterday, 'MMM d, y, EEEE') || '';
    } else if (this.startDate && this.endDate) {
      if (this.startDate.getTime() === this.endDate.getTime()) {
        // Same day
        return this.datePipe.transform(this.startDate, 'MMM d, y, EEEE') || '';
      } else {
        return (this.datePipe.transform(this.startDate, 'MMM d, y') || '') + ' - ' + (this.datePipe.transform(this.endDate, 'MMM d, y') || '');
      }
    } else if (this.endDate) {
      return this.datePipe.transform(this.endDate, 'MMM d, y, EEEE') || '';
    } else if (this.startDate) {
      return this.datePipe.transform(this.startDate, 'MMM d, y, EEEE') || '';
    } else {
      return this.datePipe.transform(new Date(), 'MMM d, y, EEEE') || '';
    }
  }

  loadCategories() {
    const filterData: FilterData = {
      pagination: null,
      filter: null,
      select: { name: 1 },
      sort: { name: 1 }
    };

    this.categoryService.getAllCategories(filterData).subscribe({
      next: (res) => {
        if (res.success) {
          this.categories = res.data;
        }
      },
      error: (err) => {
        console.error('Error loading categories:', err);
      }
    });
  }

  loadSubCategories() {
    if (!this.selectedCategories || this.selectedCategories.length === 0) {
      this.subCategories = [];
      this.selectedSubCategories = [];
      return;
    }

    // Load subcategories for all selected categories
    this.subCategories = [];
    const loadPromises = this.selectedCategories.map(categoryId => {
      return this.subCategoryService.getSubCategoriesByCategoryId(categoryId).toPromise();
    });

    Promise.all(loadPromises).then(results => {
      const allSubCategories: SubCategory[] = [];
      results.forEach(res => {
        if (res && res.success && res.data) {
          // Merge subcategories, avoiding duplicates
          res.data.forEach((subCat: SubCategory) => {
            if (!allSubCategories.find(sc => sc._id === subCat._id)) {
              allSubCategories.push(subCat);
            }
          });
        }
      });
      this.subCategories = allSubCategories;
    }).catch(err => {
      console.error('Error loading subcategories:', err);
    });
  }

  loadBrands() {
    const filterData: FilterData = {
      pagination: null,
      filter: null,
      select: { name: 1 },
      sort: { name: 1 }
    };

    this.brandService.getAllBrands(filterData).subscribe({
      next: (res) => {
        if (res.success) {
          this.brands = res.data;
        }
      },
      error: (err) => {
        console.error('Error loading brands:', err);
      }
    });
  }

  onCategoryChange() {
    this.selectedSubCategories = [];
    this.loadSubCategories();
    this.loadSales();
  }

  onSubCategoryChange() {
    this.loadSales();
  }

  onBrandChange() {
    this.loadSales();
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
        this.dateFilterType = 'custom';
        this.loadSales();
      }
    }
  }

  onDateChange() {
    if (this.dateFilterType === 'custom') {
      this.loadSales();
    }
  }

  onDateFilterTypeChange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (this.dateFilterType) {
      case 'today':
        this.startDate = new Date(today);
        this.endDate = new Date(today);
        this.endDate.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        this.startDate = yesterday;
        this.endDate = new Date(yesterday);
        this.endDate.setHours(23, 59, 59, 999);
        break;
      case 'last7days':
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);
        this.startDate = last7Days;
        this.endDate = new Date(today);
        this.endDate.setHours(23, 59, 59, 999);
        break;
      case 'last30days':
        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);
        this.startDate = last30Days;
        this.endDate = new Date(today);
        this.endDate.setHours(23, 59, 59, 999);
        break;
      case 'thisMonth':
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        this.startDate = firstDayOfMonth;
        this.endDate = new Date(today);
        this.endDate.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        // Keep existing dates or set to null
        if (!this.startDate || !this.endDate) {
          this.startDate = null;
          this.endDate = null;
        }
        break;
      case 'all':
      default:
        this.startDate = null;
        this.endDate = null;
        break;
    }
    this.loadSales();
  }

  loadSales() {
    this.isLoading = true;

    const mSelect = {
      invoiceNo: 1,
      soldDate: 1,
      products: 1,
      total: 1,
      subTotal: 1,
      status: 1,
      createdAt: 1,
      paymentType: 1,
      payments: 1
    };

    let mFilter: any = {
      status: { $in: ['Sale', 'Hold', 'Draft', 'Exchange'] }
    };

    // Date filter - apply based on dateFilterType
    if (this.dateFilterType && this.dateFilterType !== 'all') {
      if (this.startDate && this.endDate) {
        try {
          const start = new Date(this.startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(this.endDate);
          end.setHours(23, 59, 59, 999);
          
          // Filter by soldDate (primary) or createdAt (fallback)
          mFilter.$or = [
            { soldDate: { $gte: start, $lte: end } },
            { createdAt: { $gte: start, $lte: end } }
          ];
        } catch (error) {
          console.error('Error setting date filter:', error);
        }
      }
    }

    const filter: FilterData = {
      filter: mFilter,
      pagination: null,
      select: mSelect,
      sort: { invoiceNo: -1 }
    };

    console.log('Loading sales with filter:', filter);

    this.saleService.getAllSale(filter, null).subscribe({
      next: (res) => {
        this.isLoading = false;
        console.log('Sales API response:', res);
        if (res.success) {
          this.salesData = res.data || [];
          console.log('Sales data loaded:', this.salesData.length, 'sales');
          if (this.salesData.length > 0) {
            console.log('First sale sample:', this.salesData[0]);
            console.log('First sale products:', this.salesData[0]?.products);
          }
          this.applyFilters();
        } else {
          console.error('API returned success=false:', res);
          this.uiService.message('Failed to load sales data', 'warn');
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error loading sales:', err);
        this.uiService.message('Failed to load sales data. Please check console for details.', 'warn');
      }
    });
  }

  applyFilters() {
    this.filteredSalesData = [];

    console.log('Applying filters. Sales data count:', this.salesData.length);
    console.log('Selected categories:', this.selectedCategories);
    console.log('Selected subcategories:', this.selectedSubCategories);
    console.log('Selected brands:', this.selectedBrands);

    // Flatten sales data to product level
    this.salesData.forEach((sale, saleIndex) => {
      if (sale.products && sale.products.length > 0) {
        sale.products.forEach((product: any, productIndex: number) => {
          // Apply filters
          let include = true;
          
          if (saleIndex === 0 && productIndex === 0) {
            console.log('Sample product data:', {
              name: product.name,
              category: product.category,
              subCategory: product.subCategory || product.subcategory,
              brand: product.brand,
              soldQuantity: product.soldQuantity,
              salePrice: product.salePrice
            });
          }

          // Category filter - check if product category is in selected categories array
          if (this.selectedCategories && this.selectedCategories.length > 0) {
            const productCategoryId = product.category?._id ? String(product.category._id) : null;
            if (!productCategoryId || !this.selectedCategories.map(c => String(c)).includes(productCategoryId)) {
              include = false;
            }
          }

          // SubCategory filter - check both subCategory and subcategory (schema uses lowercase)
          if (include && this.selectedSubCategories && this.selectedSubCategories.length > 0) {
            const subCategoryId = product.subCategory?._id || product.subcategory?._id;
            const subCategoryIdStr = subCategoryId ? String(subCategoryId) : null;
            if (!subCategoryIdStr || !this.selectedSubCategories.map(sc => String(sc)).includes(subCategoryIdStr)) {
              include = false;
            }
          }

          // Brand filter - check if product brand is in selected brands array
          if (include && this.selectedBrands && this.selectedBrands.length > 0) {
            const productBrandId = product.brand?._id ? String(product.brand._id) : null;
            if (!productBrandId || !this.selectedBrands.map(b => String(b)).includes(productBrandId)) {
              include = false;
            }
          }

          if (include) {
            const quantity = product.soldQuantity || product.quantity || 0;
            const unitPrice = product.salePrice || product.unitPrice || 0;
            // costPrice is purchasePrice in product schema
            const costPrice = product.purchasePrice || product.costPrice || 0;
            const profit = (unitPrice - costPrice) * quantity;
            
            // Format payment notes - show mixed payment methods if available
            let paymentNotes = sale.paymentType || 'N/A';
            if (sale.paymentType === 'mixed' && sale.payments && sale.payments.length > 0) {
              const paymentMethods = sale.payments
                .filter((p: any) => p.amount > 0 && p.method !== 'due')
                .map((p: any) => {
                  const methodName = this.getPaymentMethodName(p.method);
                  return `${methodName} ${this.getCurrencySymbol()}${(p.amount || 0).toFixed(2)}`;
                })
                .join(', ');
              paymentNotes = paymentMethods || paymentNotes;
            } else if (sale.paymentType) {
              paymentNotes = this.getPaymentMethodName(sale.paymentType).toUpperCase() + ' $' + (sale.total || 0).toFixed(2);
            }
            
            this.filteredSalesData.push({
              serialNo: this.filteredSalesData.length + 1,
              item: product.name || 'N/A',
              qty: quantity,
              price: unitPrice,
              cost: costPrice,
              profit: profit,
              notes: paymentNotes,
              // Keep original data for filtering
              invoiceNo: sale.invoiceNo,
              date: sale.soldDate || sale.createdAt,
              productName: product.name || 'N/A',
              category: product.category?.name || 'N/A',
              subCategory: product.subCategory?.name || product.subcategory?.name || 'N/A',
              brand: product.brand?.name || 'N/A',
              quantity: quantity,
              unitPrice: unitPrice,
              total: quantity * unitPrice
            });
          }
        });
      } else {
        if (saleIndex === 0) {
          console.log('Sale has no products:', sale);
        }
      }
    });

    console.log('Filtered data count:', this.filteredSalesData.length);
    this.dataSource.data = this.filteredSalesData;
    this.calculateSummary();
    
    // Prepare grouped data for filtered reports
    if (this.hasFilters) {
      this.prepareGroupedData();
    }
  }

  prepareGroupedData() {
    // Group by category and brand
    const categoryMap = new Map();
    
    this.filteredSalesData.forEach(item => {
      const categoryName = item.category || 'Uncategorized';
      const brandName = item.brand || 'No Brand';
      const key = `${categoryName}_${brandName}`;
      
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          invoiceTitle: `${categoryName} - ${brandName}`,
          category: categoryName,
          brand: brandName,
          data: []
        });
      }
      
      const categoryData = categoryMap.get(key);
      
      // Prepare product data with multi-payment info
      const sale = this.salesData.find(s => s.invoiceNo === item.invoiceNo);
      let multiPayments: any[] = [];
      
      if (sale && sale.paymentType === 'mixed' && sale.payments && sale.payments.length > 0) {
        multiPayments = sale.payments
          .filter((p: any) => p.amount > 0 && p.method !== 'due')
          .map((p: any) => ({
            name: this.getPaymentMethodName(p.method).toLowerCase(),
            amount: p.amount || 0
          }));
      } else if (sale && sale.paymentType) {
        multiPayments = [{
          name: sale.paymentType.toLowerCase(),
          amount: sale.total || 0
        }];
      }
      
      categoryData.data.push({
        productName: item.item || item.productName,
        soldQuantity: item.qty || item.quantity,
        salePrice: item.price || item.unitPrice,
        purchasePrice: item.cost,
        multiPayments: multiPayments,
        paymentCategory: sale?.paymentType === 'mixed' ? 'MIXED' : (sale?.paymentType || '').toUpperCase()
      });
    });
    
    this.categoryReportsData = Array.from(categoryMap.values());
    
    // Prepare processed data for summary
    this.processedData = this.categoryReportsData.map(cat => ({
      invoiceTitle: cat.invoiceTitle,
      totalSale: this.totalSalePrice(cat.data),
      totalPurchasePrice: this.totalPurchasePrice(cat.data),
      totalProfit: this.totalProfitPrice(cat.data)
    }));
  }

  calculateSummary() {
    this.summary = {
      totalSales: this.filteredSalesData.length,
      totalQuantity: 0,
      totalTransactions: new Set(this.filteredSalesData.map(item => item.invoiceNo)).size,
      totalAmount: 0,
      totalCost: 0,
      totalProfit: 0
    };

    this.filteredSalesData.forEach(item => {
      const qty = item.qty || item.quantity || 0;
      const price = item.price || item.unitPrice || 0;
      const cost = item.cost || 0;
      
      this.summary.totalQuantity += qty;
      this.summary.totalAmount += price * qty;
      this.summary.totalCost += cost * qty;
      this.summary.totalProfit += item.profit || ((price - cost) * qty);
    });
  }

  exportCSV() {
    if (this.filteredSalesData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Invoice No', 'Date', 'Product Name', 'Category', 'Sub Category', 'Brand', 'Quantity', 'Unit Price', 'Total'];
    const csvData = this.filteredSalesData.map(item => ({
      'Invoice No': item.invoiceNo || '',
      'Date': this.datePipe.transform(item.date, 'short') || '',
      'Product Name': item.productName || '',
      'Category': item.category || '',
      'Sub Category': item.subCategory || '',
      'Brand': item.brand || '',
      'Quantity': item.quantity || 0,
      'Unit Price': (item.unitPrice || 0).toFixed(2),
      'Total': (item.total || 0).toFixed(2)
    }));

    this.exportPrintService.exportCSV(csvData, 'Sales_Record_Report', headers);
    this.uiService.message('CSV exported successfully', 'success');
  }

  exportExcel() {
    if (this.filteredSalesData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Invoice No', 'Date', 'Product Name', 'Category', 'Sub Category', 'Brand', 'Quantity', 'Unit Price', 'Total'];
    const excelData = this.filteredSalesData.map(item => ({
      'Invoice No': item.invoiceNo || '',
      'Date': this.datePipe.transform(item.date, 'short') || '',
      'Product Name': item.productName || '',
      'Category': item.category || '',
      'Sub Category': item.subCategory || '',
      'Brand': item.brand || '',
      'Quantity': item.quantity || 0,
      'Unit Price': (item.unitPrice || 0).toFixed(2),
      'Total': (item.total || 0).toFixed(2)
    }));

    this.exportPrintService.exportExcel(excelData, 'Sales_Record_Report', 'Sales Record Report', headers);
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (this.filteredSalesData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    // Use the same print format for PDF
    let html = '';
    if (!this.hasFilters) {
      // Generate simple format HTML (same as printSimpleFormat but without print service wrapper)
      const paymentBreakdown = this.calculatePaymentBreakdown();
      html = this.generateSimpleFormatHTML(this.currency, paymentBreakdown);
    } else {
      // Generate detailed format HTML (same as printDetailedFormat)
      html = this.generateDetailedFormatHTML();
    }

    this.exportPrintService.exportPDF(html, 'Sales_Record_Report');
    this.uiService.message('PDF exported successfully', 'success');
  }

  private generateSimpleFormatHTML(currencyCode: string, paymentBreakdown: any): string {
    const currency = this.getCurrencySymbol(currencyCode);
    // Same HTML as printSimpleFormat but return as string
    const currencyCodeForPayout = currencyCode;
    let html = `
      <div class="my-table" style="font-family: arial, sans-serif; padding: 20px;">
        <div class="shopInfo" style="margin-bottom: 20px;">
          ${this.shopInfo?._id ? `<p style="margin: 5px 0;">${this.shopInfo._id}</p>` : ''}
          <p style="margin: 5px 0;">${this.shopInfo?.siteName || this.shopInfo?.websiteName || ''}</p>
          <p style="margin: 5px 0;">${this.shopInfo?.addresses?.[0]?.value || ''}</p>
        </div>
        <div>
          <h1 style="font-size: 18px; margin-bottom: 0;">${this.sellerName}</h1>
          <div class="header" style="margin-top: 10px;">
            <p style="font-size: 14px; margin: 5px 0;">${this.shopInfo?.siteName || this.shopInfo?.websiteName || ''}</p>
            <p style="font-size: 14px; margin: 5px 0;">Date: ${this.getReportDate()}</p>
          </div>
        </div>
        <table style="font-family: arial, sans-serif; border-collapse: collapse; width: 100%; margin-bottom: 40px; font-size: 18px;">
          <tr>
            <th style="width: 25px; padding: 8px; border: 1px solid #000; text-align: left;">S/N</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: left;">ITEM</th>
            <th style="width: 60px; padding: 8px; border: 1px solid #000; text-align: center;">QTY</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: right;">PRICE</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: right;">COST</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: right;">PROFIT</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: left;">NOTES</th>
          </tr>
    `;

    this.filteredSalesData.forEach((item, index) => {
      const sale = this.salesData.find(s => s.invoiceNo === item.invoiceNo);
      let notesHtml = '';
      
      if (sale && sale.paymentType === 'mixed' && sale.payments && sale.payments.length > 0) {
        const paymentMethods = sale.payments
          .filter((p: any) => p.amount > 0 && p.method !== 'due')
          .map((p: any) => {
            const methodName = this.getPaymentMethodName(p.method).toUpperCase();
            return `${methodName} ${currency}${(p.amount || 0).toFixed(2)}`;
          })
          .join(', ');
        notesHtml = paymentMethods || '-';
      } else {
        notesHtml = item.notes || '-';
      }

      html += `
          <tr>
            <td style="padding: 8px; border: 1px solid #000;">${index + 1}</td>
            <td style="padding: 8px; border: 1px solid #000;">${item.item || ''}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: center;">${item.qty || 0}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${((item.qty || 0) * (item.price || 0)).toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${((item.qty || 0) * (item.cost || 0)).toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${((item.qty || 0) * (item.price || 0) - (item.qty || 0) * (item.cost || 0)).toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000;">${notesHtml}</td>
          </tr>
      `;
    });

    html += `
          <tr class="table-hover" style="font-weight: bold;">
            <td style="padding: 8px; border: 1px solid #000;"></td>
            <td style="padding: 8px; border: 1px solid #000;">SUB-TOTAL AMOUNT:</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: center;">${this.totalQuantity()}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${this.totalSalePrice().toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${this.totalPurchasePrice().toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${this.totalProfitPrice().toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000;"></td>
          </tr>
        </table>
    `;

    // Add payout table (same as printSimpleFormat)
    html += this.generatePayoutTableHTML(currencyCodeForPayout);

    html += `</div>`;
    return html;
  }

  private generateDetailedFormatHTML(): string {
    // Same as printDetailedFormat but return as string
    const currencyCode = this.currency;
    const currency = this.getCurrencySymbol();
    let html = '';

    if (this.categoryReportsData && this.categoryReportsData.length > 0) {
      this.categoryReportsData.forEach(categoryData => {
        html += this.generateCategoryTableHTML(categoryData, currencyCode);
      });
    }

    if (this.processedData && this.processedData.length > 0) {
      html += this.generateSummaryTableHTML(currencyCode);
    }

    return html;
  }

  private generateCategoryTableHTML(categoryData: any, currencyCode: string): string {
    const currency = this.getCurrencySymbol(currencyCode);
    let html = `
      <div class="my-table" style="font-family: arial, sans-serif; padding: 20px; page-break-after: always;">
        <div class="shopInfo" style="margin-bottom: 20px;">
          ${this.shopInfo?._id ? `<p style="margin: 5px 0;">${this.shopInfo._id}</p>` : ''}
          <p style="margin: 5px 0;">${this.shopInfo?.siteName || this.shopInfo?.websiteName || ''}</p>
          <p style="margin: 5px 0;">${this.shopInfo?.addresses?.[0]?.value || ''}</p>
        </div>
        <div>
          <h1 style="font-size: 18px; margin-bottom: 0;">${categoryData.invoiceTitle}</h1>
          <div class="header" style="margin-top: 10px;">
            <p style="font-size: 14px; margin: 5px 0;">${this.shopInfo?.siteName || this.shopInfo?.websiteName || ''}</p>
            <p style="font-size: 14px; margin: 5px 0;">Date: ${this.getReportDate()}</p>
          </div>
        </div>
        <table style="font-family: arial, sans-serif; border-collapse: collapse; width: 100%; margin-bottom: 40px; font-size: 18px;">
          <tr>
            <th style="width: 25px; padding: 8px; border: 1px solid #000; text-align: left;">S/N</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: left;">ITEM</th>
            <th style="width: 60px; padding: 8px; border: 1px solid #000; text-align: center;">QTY</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: right;">PRICE</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: right;">COST</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: right;">PROFIT</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: left;">NOTES</th>
          </tr>
    `;

    categoryData.data.forEach((data: any, index: number) => {
      let notesHtml = '';
      
      if (data.multiPayments && data.multiPayments.length > 0) {
        const paymentMethods = data.multiPayments.map((d: any, i: number) => {
          const methodName = (d.name === 'pay-now' || d.name === 'nets') ? `<span style="color: darkred;">${d.name.toUpperCase()}</span>` : d.name.toUpperCase();
          const amount = data.multiPayments.length > 1 ? ` ${currency}${(d.amount || 0).toFixed(2)}` : ` ${currency}${((data.soldQuantity || 0) * (data.salePrice || 0)).toFixed(2)}`;
          return `${methodName}${amount}${i !== data.multiPayments.length - 1 ? ',' : ''}`;
        }).join(' ');
        
        notesHtml = `
          <span>${paymentMethods}</span>
          ${data.multiPayments.length > 1 ? `<br><span style="color: darkred;">${data.paymentCategory || ''}</span>` : ''}
        `;
      } else {
        notesHtml = '<span>-</span>';
      }

      html += `
          <tr>
            <td style="padding: 8px; border: 1px solid #000;">${index + 1}</td>
            <td style="padding: 8px; border: 1px solid #000;">${data.productName || ''}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: center;">${data.soldQuantity || '-'}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${((data.soldQuantity || 0) * (data.salePrice || 0)).toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${((data.soldQuantity || 0) * (data.purchasePrice || 0)).toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${(((data.soldQuantity || 0) * (data.salePrice || 0)) - ((data.soldQuantity || 0) * (data.purchasePrice || 0))).toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000;">${notesHtml}</td>
          </tr>
      `;
    });

    html += `
          <tr class="table-hover" style="font-weight: bold;">
            <td style="padding: 8px; border: 1px solid #000;"></td>
            <td style="padding: 8px; border: 1px solid #000;">SUB-TOTAL AMOUNT:</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: center;">${this.totalQuantity(categoryData.data)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${this.totalSalePrice(categoryData.data).toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${this.totalPurchasePrice(categoryData.data).toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${this.totalProfitPrice(categoryData.data).toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000;"></td>
          </tr>
        </table>
      </div>
    `;

    return html;
  }

  private generateSummaryTableHTML(currencyCode: string): string {
    const currency = this.getCurrencySymbol(currencyCode);
    let html = `
      <div class="my-table" style="font-family: arial, sans-serif; padding: 20px;">
        <div class="shopInfo" style="margin-bottom: 20px;">
          ${this.shopInfo?._id ? `<p style="margin: 5px 0;">${this.shopInfo._id}</p>` : ''}
          <p style="margin: 5px 0;">${this.shopInfo?.siteName || this.shopInfo?.websiteName || ''}</p>
          <p style="margin: 5px 0;">${this.shopInfo?.addresses?.[0]?.value || ''}</p>
        </div>
        <div>
          <h1 style="font-size: 18px; margin-bottom: 0;">${this.sellerName}</h1>
          <div class="header" style="margin-top: 10px;">
            <p style="font-size: 14px; margin: 5px 0;">${this.shopInfo?.siteName || this.shopInfo?.websiteName || ''}</p>
            <p style="font-size: 14px; margin: 5px 0;">Date: ${this.getReportDate()}</p>
          </div>
        </div>
        <table style="font-family: arial, sans-serif; border-collapse: collapse; width: 100%; margin-bottom: 8%; font-size: 18px;">
          <tr>
            <th style="width: 25px; padding: 8px; border: 1px solid #000; text-align: left;">S/N</th>
            <th style="width: 48%; padding: 8px; border: 1px solid #000; text-align: left;">Item</th>
            <th style="width: 80px; padding: 8px; border: 1px solid #000; text-align: right;">Amount</th>
            <th style="width: 80px; padding: 8px; border: 1px solid #000; text-align: right;">Cost</th>
            <th style="width: 80px; padding: 8px; border: 1px solid #000; text-align: right;">Profit</th>
          </tr>
    `;

    this.processedData.forEach((data, index) => {
      html += `
          <tr>
            <td style="padding: 8px; border: 1px solid #000;">${index + 1}</td>
            <td style="padding: 8px; border: 1px solid #000;">${data.invoiceTitle}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${(data.totalSale || 0).toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${(data.totalPurchasePrice || 0).toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${(data.totalProfit || 0).toFixed(2)}</td>
          </tr>
      `;
    });

    html += `
          <tr class="table-hover" style="font-weight: bold;">
            <td style="padding: 8px; border: 1px solid #000;"></td>
            <td style="padding: 8px; border: 1px solid #000;">TOTAL AMOUNT:</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${this.getProcessedData().toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${this.getProcessedDataPurchasePrice().toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${this.getProcessedDataProfit().toFixed(2)}</td>
          </tr>
        </table>
    `;

    html += this.generatePayoutTableHTML(currencyCode, true);
    html += `</div>`;
    return html;
  }

  private generatePayoutTableHTML(currencyCode: string, useProcessedData: boolean = false): string {
    const currency = this.getCurrencySymbol(currencyCode);
    const totalSales = useProcessedData ? this.getProcessedData() : this.totalSalePrice();
    
    let html = `
      <table style="font-family: arial, sans-serif; border-collapse: collapse; width: 100%; font-size: 18px;">
        <tr>
          <th style="width: 25px; padding: 8px; border: 1px solid #000; text-align: left;">S/N</th>
          <th style="width: 48%; padding: 8px; border: 1px solid #000; text-align: left;">PAYOUT</th>
          <th style="width: 80px; padding: 8px; border: 1px solid #000; text-align: right;">AMOUNT</th>
          <th style="width: 180px; padding: 8px; border: 1px solid #000; text-align: left;" rowspan="2">TOTAL SALES:</th>
          <th style="width: 60px; padding: 8px; border: 1px solid #000; text-align: right;" rowspan="2" colspan="2">${currency}${totalSales.toFixed(2)}</th>
        </tr>
    `;

    const maxRows = useProcessedData ? 9 : 10;
    for (let i = 0; i < maxRows; i++) {
      const payout = this.payouts[i] || { expenseFor: '', amount: 0 };
      let extraCells = '';
      
      if (i === 1) {
        extraCells = `<td style="padding: 8px; border: 1px solid #000; text-align: left;">Card:</td><td style="padding: 8px; border: 1px solid #000; text-align: right; color: darkred;" colspan="2">${currency}${this.getPaymentTypeAmount('card').toFixed(2)}</td>`;
      } else if (i === 2) {
        extraCells = `<td style="padding: 8px; border: 1px solid #000; text-align: left;">Visa Card:</td><td style="padding: 8px; border: 1px solid #000; text-align: right; color: darkred;" colspan="2">${currency}${this.getPaymentTypeAmount('visa-card').toFixed(2)}</td>`;
      } else if (i === 3) {
        extraCells = `<td style="padding: 8px; border: 1px solid #000; text-align: left;">bKash:</td><td style="padding: 8px; border: 1px solid #000; text-align: right; color: darkred;" colspan="2">${currency}${this.getPaymentTypeAmount('bkash').toFixed(2)}</td>`;
      } else if (i === 4) {
        extraCells = `<td style="padding: 8px; border: 1px solid #000; text-align: left;">Nagad:</td><td style="padding: 8px; border: 1px solid #000; text-align: right; color: darkred;" colspan="2">${currency}${this.getPaymentTypeAmount('nagad').toFixed(2)}</td>`;
      } else if (i === 5) {
        extraCells = `<td style="padding: 8px; border: 1px solid #000; text-align: left;">Cash:</td><td style="padding: 8px; border: 1px solid #000; text-align: right;" colspan="2">${currency}${this.getPaymentTypeAmount('cash').toFixed(2)}</td>`;
      } else if (i === 6 && !useProcessedData) {
        extraCells = `<td style="padding: 8px; border: 1px solid #000;"></td><td style="padding: 8px; border: 1px solid #000;" colspan="2"></td>`;
      } else if ((i === 6 && useProcessedData) || (i === 7 && !useProcessedData)) {
        extraCells = `<td style="padding: 8px; border: 1px solid #000; text-align: left;">Overall Pay Out</td><td style="padding: 8px; border: 1px solid #000; text-align: right;" colspan="2">${currency}${this.getPayAmount().toFixed(2)}</td>`;
      } else if ((i === 7 && useProcessedData) || (i === 8 && !useProcessedData)) {
        const cardAmount = this.getPaymentTypeAmount('card');
        const visaCardAmount = this.getPaymentTypeAmount('visa-card');
        const totalCard = cardAmount + visaCardAmount;
        const bkashAmount = this.getPaymentTypeAmount('bkash');
        const nagadAmount = this.getPaymentTypeAmount('nagad');
        const rocketAmount = this.getPaymentTypeAmount('rocket');
        const totalMobileBanking = bkashAmount + nagadAmount + rocketAmount;
        const netCash = useProcessedData 
          ? (this.getProcessedData() - totalCard - this.getPayAmount() - totalMobileBanking)
          : (this.totalSalePrice() - totalCard - this.getPayAmount() - totalMobileBanking);
        extraCells = `<td style="padding: 8px; border: 1px solid #000; text-align: left;" rowspan="2">NET CASH:</td><td style="padding: 8px; border: 1px solid #000; text-align: right;" rowspan="2" colspan="2">${currency}${netCash.toFixed(2)}</td>`;
      } else if ((i === 8 && useProcessedData) || (i === 9 && !useProcessedData)) {
        extraCells = '';
      } else {
        extraCells = '';
      }

      html += `
          <tr>
            <td style="padding: 8px; border: 1px solid #000;">${i + 1}</td>
            <td style="padding: 8px; border: 1px solid #000;">${payout.expenseFor || ''}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${(payout.amount || 0).toFixed(2)}</td>
            ${extraCells}
          </tr>
      `;
    }

    html += `
          <tr class="table-hover" style="font-weight: bold;">
            <td style="padding: 8px; border: 1px solid #000;"></td>
            <td style="padding: 8px; border: 1px solid #000;">TOTAL AMOUNT:</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currency}${this.getPayAmount().toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000;">
              <div style="display: flex;">
                <p style="border-right: 1px solid #000; margin: 0; padding-right: 5px;">EXTRA</p>
                <p style="margin: 0; padding-left: 5px;"></p>
              </div>
            </td>
            <td colspan="2" style="padding: 8px; border: 1px solid #000;">
              <div style="display: flex;">
                <p style="border-right: 1px solid #000; margin: 0; padding-right: 5px;">SORTAGE</p>
                <p style="margin: 0; padding-left: 5px;"></p>
              </div>
            </td>
          </tr>
        </table>
    `;

    return html;
  }

  printReport() {
    if (this.filteredSalesData.length === 0) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    // If no filters, use the simple format (image format)
    if (!this.hasFilters) {
      this.printSimpleFormat();
    } else {
      // If filters applied, use detailed format
      this.printDetailedFormat();
    }
  }

  private printSimpleFormat() {
    const paymentBreakdown = this.calculatePaymentBreakdown();
    const html = this.generateSimpleFormatHTML(this.currency, paymentBreakdown);
    this.exportPrintService.printReport(html, 'Sales Record Report');
  }

  private printDetailedFormat() {
    const html = this.generateDetailedFormatHTML();
    this.exportPrintService.printReport(html, 'Sales Record Report');
  }

  private calculatePaymentBreakdown(): any {
    // Breakdown keys based on PAYMENT_TYPES: cash, card, bkash, nagad, rocket, due, mixed
    const breakdown: any = {
      cash: 0,
      card: 0,
      'visa-card': 0,
      bkash: 0,
      nagad: 0,
      rocket: 0,
      vm: 0, // backward compatibility for card
      paynow: 0, // backward compatibility for mobile banking
      overallPayOut: 0,
      netCash: 0,
      totalAmount: 0,
      extra: '0.00',
      sortage: '0.00'
    };

    // Group by invoice to get payment types (avoid duplicates)
    const invoiceMap = new Map();
    this.salesData.forEach(sale => {
      if (!invoiceMap.has(sale.invoiceNo)) {
        invoiceMap.set(sale.invoiceNo, {
          paymentType: sale.paymentType || '',
          payments: sale.payments || [],
          total: sale.total || 0
        });
      }
    });

    // Calculate breakdown using PAYMENT_TYPES methods
    invoiceMap.forEach((value) => {
      const paymentType = (value.paymentType || '').toLowerCase();
      const total = value.total || 0;
      const payments = value.payments || [];

      // Handle split payments (mixed payment)
      if (payments && payments.length > 0) {
        payments.forEach((payment: any) => {
          const method = (payment.method || '').toLowerCase();
          const amount = payment.amount || 0;

          // Use only PAYMENT_TYPES: cash, card, bkash, nagad, rocket, due
          if (method === 'cash') {
            breakdown.cash += amount;
          } else if (method === 'card' || method === 'visa-card' || method === 'visa card') {
            breakdown.card += amount;
            breakdown['visa-card'] += amount; // Also track visa-card separately
            breakdown.vm += amount; // backward compatibility
          } else if (method === 'bkash') {
            breakdown.bkash += amount;
            breakdown.paynow += amount; // backward compatibility
          } else if (method === 'nagad') {
            breakdown.nagad += amount;
            breakdown.paynow += amount; // backward compatibility
          } else if (method === 'rocket') {
            breakdown.rocket += amount;
            breakdown.paynow += amount; // backward compatibility
          } else if (method === 'due') {
            // Due payments don't count in breakdown
          } else {
            // Default to cash if method is not recognized
            breakdown.cash += amount;
          }
        });
      } else {
        // Single payment method
        if (paymentType === 'cash') {
          breakdown.cash += total;
        } else if (paymentType === 'card' || paymentType === 'visa-card' || paymentType === 'visa card') {
          breakdown.card += total;
          breakdown['visa-card'] += total; // Also track visa-card separately
          breakdown.vm += total; // backward compatibility
        } else if (paymentType === 'bkash') {
          breakdown.bkash += total;
          breakdown.paynow += total; // backward compatibility
        } else if (paymentType === 'nagad') {
          breakdown.nagad += total;
          breakdown.paynow += total; // backward compatibility
        } else if (paymentType === 'rocket') {
          breakdown.rocket += total;
          breakdown.paynow += total; // backward compatibility
        } else if (paymentType === 'due') {
          // Due payments don't count in breakdown
        } else if (paymentType === 'mixed') {
          // Mixed should be handled by payments array, but if not, default to cash
          breakdown.cash += total;
        } else {
          // Default to cash if payment type is not specified
          breakdown.cash += total;
        }
      }
    });

    breakdown.netCash = breakdown.cash;
    breakdown.totalAmount = breakdown.overallPayOut;

    return breakdown;
  }

  private getPaymentMethodName(method: string): string {
    // Use only PAYMENT_TYPES methods: cash, card, bkash, nagad, rocket, due, mixed
    const methodMap: { [key: string]: string } = {
      'cash': 'CASH',
      'card': 'CARD',
      'bkash': 'BKASH',
      'nagad': 'NAGAD',
      'rocket': 'ROCKET',
      'due': 'DUE',
      'mixed': 'MIXED'
    };
    return methodMap[method?.toLowerCase()] || method?.toUpperCase() || 'N/A';
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for this report', 'warn');
  }

  // Helper methods for print template
  totalQuantity(data?: any[]): number {
    const items = data || this.filteredSalesData;
    return items.reduce((sum, item) => sum + (item.soldQuantity || item.qty || item.quantity || 0), 0);
  }

  totalSalePrice(data?: any[]): number {
    const items = data || this.filteredSalesData;
    return items.reduce((sum, item) => {
      const qty = item.soldQuantity || item.qty || item.quantity || 0;
      const price = item.salePrice || item.price || item.unitPrice || 0;
      return sum + (qty * price);
    }, 0);
  }

  totalPurchasePrice(data?: any[]): number {
    const items = data || this.filteredSalesData;
    return items.reduce((sum, item) => {
      const qty = item.soldQuantity || item.qty || item.quantity || 0;
      const cost = item.purchasePrice || item.cost || 0;
      return sum + (qty * cost);
    }, 0);
  }

  totalProfitPrice(data?: any[]): number {
    const items = data || this.filteredSalesData;
    return items.reduce((sum, item) => {
      const qty = item.soldQuantity || item.qty || item.quantity || 0;
      const price = item.salePrice || item.price || item.unitPrice || 0;
      const cost = item.purchasePrice || item.cost || 0;
      return sum + ((price - cost) * qty);
    }, 0);
  }

  getPaymentTypeAmount(type: string): number {
    const breakdown = this.calculatePaymentBreakdown();
    // Map PAYMENT_TYPES methods to breakdown keys
    // PAYMENT_TYPES: cash, card, bkash, nagad, rocket, due, mixed
    // Breakdown keys: cash, card, visa-card, bkash, nagad, rocket (with backward compatibility)
    const typeMap: { [key: string]: string } = {
      'cash': 'cash',
      'card': 'card',
      'visa-card': 'visa-card',
      'visa card': 'visa-card',
      'bkash': 'bkash',
      'nagad': 'nagad',
      'rocket': 'rocket',
      'pay-now': 'paynow', // backward compatibility
      'paynow': 'paynow' // backward compatibility
    };
    const key = typeMap[type.toLowerCase()] || type.toLowerCase();
    return breakdown[key] || 0;
  }

  getPayAmount(): number {
    return this.payouts.reduce((sum, payout) => sum + (payout.amount || 0), 0);
  }

  getProcessedData(): number {
    return this.processedData.reduce((sum, item) => sum + (item.totalSale || 0), 0);
  }

  getProcessedDataPurchasePrice(): number {
    return this.processedData.reduce((sum, item) => sum + (item.totalPurchasePrice || 0), 0);
  }

  getProcessedDataProfit(): number {
    return this.processedData.reduce((sum, item) => sum + (item.totalProfit || 0), 0);
  }

  get currency(): string {
    return this.shopInfo?.currency || 'Dollar';
  }

  getCurrencySymbol(currencyCode?: string): string {
    // First try to get from localStorage (settings)
    const storedCurrency = this.storageService.getDataFromLocalStorage(DATABASE_KEY.currency);
    if (storedCurrency?.symbol) {
      return storedCurrency.symbol;
    }
    
    // Fallback to shopInfo currency or provided code
    const code = currencyCode || this.currency;
    switch(code) {
      case 'BDT':
        return '৳';
      case 'SGD':
        return 'S$';
      case 'Dollar':
        return '$';
      default:
        return '৳';
    }
  }

  get sellerName(): string {
    return this.shopInfo?.websiteName || this.shopInfo?.siteName || 'Sales Person';
  }

  get isDefaultFilter(): boolean {
    return !this.hasFilters;
  }

  get isCategoryFilter(): boolean {
    return this.selectedCategories.length > 0 || this.selectedBrands.length > 0;
  }

  get isPayout(): boolean {
    return false; // Set to true if you want to show only payout table
  }

  get myDate(): Date {
    return this.endDate || this.startDate || new Date();
  }
}

