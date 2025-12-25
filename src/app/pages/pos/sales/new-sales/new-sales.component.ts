import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, NgForm, Validators} from '@angular/forms';
import {UiService} from '../../../../services/core/ui.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {SaleService} from '../../../../services/common/sale.service';
import {Product} from '../../../../interfaces/common/product.interface';
import {ProductService} from '../../../../services/common/product.service';
import {MatDialog} from '@angular/material/dialog';
import {UtilsService} from '../../../../services/core/utils.service';
import {Sale} from '../../../../interfaces/common/sale.interface';
import {PaymentBreakdown} from '../../../../interfaces/common/sale.interface';
import {Select} from '../../../../interfaces/core/select';
import {DISCOUNT_TYPES, PAYMENT_TYPES} from '../../../../core/utils/app-data';
import {VendorService} from '../../../../services/vendor/vendor.service';
import {ShopInformation} from '../../../../interfaces/common/shop-information.interface';
import {ShopInformationService} from '../../../../services/common/shop-information.service';
import {FilterData} from '../../../../interfaces/gallery/filter-data';
import {ConfirmDialogComponent} from '../../../../shared/components/ui/confirm-dialog/confirm-dialog.component';
import {SplitPaymentDialogComponent} from '../split-payment-dialog/split-payment-dialog.component';
import {ReprintBillComponent} from '../reprint-bill/reprint-bill.component';
import {ExchangeDialogComponent} from '../exchange-dialog/exchange-dialog.component';
import {CustomerService} from '../../../../services/common/customer.service';
import {Customer} from '../../../../interfaces/common/customer.interface';
import {ThermalPrinterService} from '../../../../services/common/thermal-printer.service';
import {PrinterSettingsService} from '../../../../services/common/printer-settings.service';
import {SettingService} from '../../../../services/common/setting.service';
import {VariationSelectionDialogComponent} from '../variation-selection-dialog/variation-selection-dialog.component';
import {VariationList} from '../../../../interfaces/common/product.interface';

@Component({
  selector: 'app-new-sales',
  templateUrl: './new-sales.component.html',
  styleUrls: ['./new-sales.component.scss']
})
export class NewSalesComponent implements OnInit, OnDestroy {

  // Vendor Base Data
  vendor: any = null;

  // Data Form
  @ViewChild('formElement') formElement: NgForm;
  dataForm?: FormGroup;
  disable = false;

  // Static Data
  discountTypes: Select[] = DISCOUNT_TYPES;
  paymentTypes: Select[] = PAYMENT_TYPES;

  // Store Data
  isLoading: boolean = false;
  isViewMode: boolean = false;
  id?: string;
  sale?: Sale;
  customer: Customer = null;
  customerInfo = false;
  search = false;
  customerSearchQuery: string = '';
  searchedCustomer: Customer = null;
  discountType: number = null;
  discountAmount: number = null;
  vat: number = null;
  tax: number = null; // Tax amount
  ait: number = null; // Advance Income Tax
  serviceCharge: number = null; // Service charge
  usePoints: number = null;
  pointsDiscount: number = 0;
  soldDate: Date = new Date();
  paymentType: string = 'cash';
  receivedFromCustomer: number = null;
  saleData: Sale = null;
  openDialog = false;
  showBarcodeScanner: boolean = false;
  // Multiple payments
  payments: PaymentBreakdown[] = [];
  useSplitPayment: boolean = false;
  // Hold & Draft
  isHoldBill: boolean = false;
  isDraftBill: boolean = false;
  // Exchange
  isExchange: boolean = false;
  exchangeFromSaleId: string = null;

  // Shop data
  shopInformation: ShopInformation;
  printerSettings: any = null;
  posSettings: any = null; // POS settings for VAT/Tax

  //Store Components Data
  products: Product[] = [];
  allProducts: Product[] = [];
  searchProducts: Product[] = [];
  searchResultsWithVariations: any[] = []; // Flattened results including variations
  productSearchQuery: string = '';

  // Subscriptions
  private subDataOne: Subscription;
  private subDataTwo: Subscription;
  private subDataThree: Subscription;
  private subDataFour: Subscription;
  private subDataFive: Subscription;
  private subShopInfo: Subscription;
  private subCustomerSearch: Subscription;

  constructor(
    private fb: FormBuilder,
    private uiService: UiService,
    private activatedRoute: ActivatedRoute,
    private productService: ProductService,
    private newSalesService: SaleService,
    private router: Router,
    private dialog: MatDialog,
    public utilsService: UtilsService,
    private vendorService: VendorService,
    private shopInformationService: ShopInformationService,
    private customerService: CustomerService,
    private thermalPrinterService: ThermalPrinterService,
    private printerSettingsService: PrinterSettingsService,
    private settingService: SettingService,
  ) {
  }

  ngOnInit(): void {
    // Init Data Form
    this.initDataForm();

    // GET ID FORM PARAM
    this.activatedRoute.paramMap.subscribe((param) => {
      this.id = param.get('id');
      if (this.id) {
        this.getSaleById();
      }
    });

    // GET DATA FORM QUERY PARAM
    this.activatedRoute.queryParamMap.subscribe((qParam) => {
      const isViewMode = qParam.get('view');
      this.isViewMode = isViewMode == 'true';
    });

    // Base Data
    this.getVendorData();
    this.getShopInformation();
    this.getAllProducts();
    this.loadPrinterSettings();
    this.loadPosSettings();
  }

  /**
   * Vendor Data
   */
  private getVendorData() {
    const vendorId = this.vendorService.getUserId();
    let vendorName = 'Admin';

    // First try to get from sessionStorage (cached)
    const cachedName = sessionStorage.getItem('vendor-name');
    if (cachedName) {
      vendorName = cachedName;
      this.vendor = { _id: vendorId, name: vendorName };
      return;
    }

    // Try to get vendor name from API
    this.subDataTwo = this.vendorService.getLoggedInVendorData()
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            // Try to get name from vendor data
            vendorName = res.data.name ||
                        res.data.username ||
                        this.vendorService.getUserRole() ||
                        'Admin';
            // Cache the name
            if (vendorName !== 'Admin') {
              sessionStorage.setItem('vendor-name', vendorName);
            }
            this.vendor = { _id: vendorId, name: vendorName };
          } else {
            // Fallback to role
            vendorName = this.vendorService.getUserRole() || 'Admin';
            this.vendor = { _id: vendorId, name: vendorName };
          }
        },
        error: (err) => {
          console.warn('Failed to fetch vendor name, using role:', err);
          // Fallback to role
          vendorName = this.vendorService.getUserRole() || 'Admin';
          this.vendor = { _id: vendorId, name: vendorName };
        }
      });
  }

  /**
   * FORM METHODS
   */
  private initDataForm() {
    this.dataForm = this.fb.group({
      name: [null],
      phone: [null],
      address: [null],
      userPoints: [null],
      birthdate: [null],
    });
  }

  private setFormValue() {
    if (this?.sale?.customer?.phone) {
      this.dataForm.patchValue({...this.sale.customer});
      this.customerInfo = true;
    }

    if (this.sale.pointsDiscount) {
      this.pointsDiscount = this.sale.pointsDiscount;
    }

    if (this.sale.usePoints) {
      this.usePoints = this.sale.usePoints;
    }

    this.dataForm.patchValue(this.sale);
  }

  onSubmit() {
    if (!this.sale && !this.products.length) {
      this.uiService.message('Please Add some products to continue sales', 'warn');
      return;
    }

    if (this.customerInfo && this.dataForm.invalid) {
      this.uiService.message('Please add customer phone number', 'warn');
      this.dataForm.markAllAsTouched();
      return;
    }

    // Map products to ensure purchasePrice is included (costPrice is purchasePrice in product schema)
    const mappedProducts = this.products.map(product => ({
      ...product,
      purchasePrice: product.purchasePrice || product.costPrice || 0
    }));

    this.saleData = {
      customer: this.dataForm.valid ? {...this.dataForm.value} : null,
      products: mappedProducts,
      soldDate: this.soldDate,
      soldDateString: this.utilsService.getDateString(this.soldDate),
      soldTime: this.utilsService.getCurrentTime(),
      discount: this.discount ?? 0,
      discountAmount: this.discountType ? (this.discountAmount ?? 0) : 0,
      discountType: this.discountType ?? 0,
      usePoints: this.pointsDiscount ? this.usePoints : 0,
      pointsDiscount: this.pointsDiscount ?? 0,
      vatAmount: this.vat ?? 0,
      total: this.grandTotal,
      subTotal: this.subTotal,
      paidAmount: this.useSplitPayment
        ? this.splitPaymentTotal
        : (this.receivedFromCustomer ? this.receivedFromCustomer : this.grandTotal),
      totalPurchasePrice: this.purchaseTotalAmount,
      month: this.utilsService.getDateMonth(false, new Date()),
      year: new Date().getFullYear(),
      status: this.isHoldBill ? 'Hold' : (this.isDraftBill ? 'Draft' : (this.isExchange ? 'Exchange' : 'Sale')),
      receivedFromCustomer: this.useSplitPayment
        ? this.splitPaymentTotal
        : (this.receivedFromCustomer ? this.receivedFromCustomer : this.grandTotal),
      paymentType: this.paymentType,
      payments: this.useSplitPayment && this.payments.length > 0 ? this.payments : undefined,
      returnTotal: this.returnTotal,
      tax: this.tax || 0,
      ait: this.ait || 0,
      serviceCharge: this.serviceCharge || 0,
      exchangeFrom: this.isExchange && this.exchangeFromSaleId ? this.exchangeFromSaleId : undefined,
      salesman: this.vendor && this.vendor._id ? {
        _id: this.vendor._id,
        name: this.vendor.name || 'Admin'
      } : (this.sale?.salesman ? this.sale.salesman : {
        _id: this.vendorService.getUserId(),
        name: this.vendorService.getUserRole() || 'Admin'
      })
    };

    if (this.sale) {
      if (this.sale.customer) {
        this.saleData = {
          ...this.saleData,
          ...{
            customer: {...this.sale.customer, ...this.dataForm.value}
          }
        };
      }
      this.updateSaleById();
    } else {
      this.openConfirmDialog();
    }
  }

  customerInfoToggle() {
    this.customerInfo = !this.customerInfo;
  }

  /**
   * Handle Customer Search by Phone Number
   */
  onCustomerSearch(query: string) {
    this.customerSearchQuery = query;
    
    if (!query || query.trim().length === 0) {
      this.searchedCustomer = null;
      this.customer = null;
      if (this.dataForm) {
        this.dataForm.reset();
      }
      return;
    }

    // Unsubscribe from previous search if exists
    if (this.subCustomerSearch) {
      this.subCustomerSearch.unsubscribe();
    }

    // Search customers by phone number
    const filterData: FilterData = {
      filter: null,
      pagination: null,
      select: {
        name: 1,
        phone: 1,
        address: 1,
        userPoints: 1,
        totalDue: 1,
        walletBalance: 1,
        customerGroup: 1,
        birthdate: 1
      },
      sort: { createdAt: -1 }
    };

    this.subCustomerSearch = this.customerService.getAllCustomers(filterData, query.trim())
      .subscribe({
        next: (res) => {
          if (res.success && res.data && res.data.length > 0) {
            // Find exact phone match first
            const exactMatch = res.data.find((c: Customer) => 
              c.phone && c.phone.toString().trim() === query.trim()
            );
            
            if (exactMatch) {
              this.searchedCustomer = exactMatch;
              this.customer = exactMatch;
              // Auto-fill the form
              this.dataForm.patchValue({
                name: exactMatch.name || null,
                phone: exactMatch.phone || null,
                address: exactMatch.address || null,
                userPoints: exactMatch.userPoints || null,
                birthdate: exactMatch.birthdate ? new Date(exactMatch.birthdate) : null
              });
              this.customerInfo = false; // Hide the form, show customer card
            } else if (res.data.length === 1) {
              // If only one result, use it
              this.searchedCustomer = res.data[0];
              this.customer = res.data[0];
              this.dataForm.patchValue({
                name: res.data[0].name || null,
                phone: res.data[0].phone || null,
                address: res.data[0].address || null,
                userPoints: res.data[0].userPoints || null,
                birthdate: res.data[0].birthdate ? new Date(res.data[0].birthdate) : null
              });
              this.customerInfo = false;
            } else {
              // Multiple results, show first one but don't auto-fill
              this.searchedCustomer = res.data[0];
              this.customer = res.data[0];
            }
          } else {
            this.searchedCustomer = null;
            this.customer = null;
          }
        },
        error: (err) => {
          console.error('Error searching customer:', err);
          this.searchedCustomer = null;
          this.customer = null;
        }
      });
  }

  /**
   * HTTP REQ HANDLE
   */
  private addSale() {
    this.isLoading = true;
    this.subDataFive = this.newSalesService.addSale(this.saleData).subscribe({
        next: (res) => {
          if (res.success) {
            const message = this.isHoldBill
              ? 'Bill held successfully'
              : (this.isDraftBill
                ? 'Draft saved successfully'
                : (res.message || 'Sale added successfully'));
            this.uiService.message(message, 'success');
            this.saleData = {...this.saleData, ...{invoiceNo: res.data.invoiceNo}};

            // Reset form
            this.formElement?.resetForm();
            this.products = [];
            this.customer = null;
            this.vat = 0;
            this.tax = 0;
            this.ait = 0;
            this.serviceCharge = 0;
            this.usePoints = 0;
            this.pointsDiscount = 0;
            this.discountType = null;
            this.discountAmount = null;
            this.receivedFromCustomer = null;
            this.paymentType = 'cash';
            this.payments = [];
            this.useSplitPayment = false;
            const wasHold = this.isHoldBill;
            const wasDraft = this.isDraftBill;
            this.isHoldBill = false;
            this.isDraftBill = false;
            this.openDialog = false;
            this.isLoading = false;

            // Print only if not hold or draft
            if (!wasHold && !wasDraft) {
              setTimeout(() => {
                if (this.saleData && this.saleData.invoiceNo) {
                  this.onPrint();
                }
              }, 300);

              setTimeout(() => {
                this.router.navigate(['/pos/sales/sale-list']);
              }, 1500);
            } else {
              // Navigate to list for hold/draft
              setTimeout(() => {
                this.router.navigate(['/pos/sales/sale-list']);
              }, 500);
            }
          } else {
            this.isLoading = false;
            this.uiService.message(res.message || 'Failed to add sale', 'warn');
          }
        },
      error: (error) => {
        this.isLoading = false;
        console.error('Error adding sale:', error);
        const errorMessage = error?.error?.message ||
                            error?.message ||
                            'Failed to add sale. Please check your connection and try again.';
        this.uiService.message(errorMessage, 'warn');
      },
    });
  }

  private getAllProducts() {
    // Select fields needed for sales
    const mSelect = {
      _id: 1,
      name: 1,
      sku: 1,
      salePrice: 1,
      purchasePrice: 1,
      costPrice: 1,
      quantity: 1,
      status: 1,
      images: 1,
      category: 1,
      subCategory: 1,
      brand: 1,
      sizes: 1,
      colors: 1,
      model: 1,
      others: 1,
      isVariation: 1,
      regularPrice: 1,
      variation: 1,
      variation2: 1,
      discountType: 1,
      variationOptions: 1,
      variation2Options: 1,
      variationList: 1,
      discountAmount: 1,
      minimumWholesaleQuantity: 1,
      wholesalePrice: 1,
    };

    // Filter for active products only
    const filter: FilterData = {
      filter: {
        status: {$ne: 'trash'}
      },
      pagination: null,
      select: mSelect,
      sort: {createdAt: -1},
    };

    this.subDataOne = this.productService.getAllProducts(filter, null)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.allProducts = res.data || [];
            console.log('Products loaded:', this.allProducts.length);
          } else {
            console.warn('Failed to load products:', res);
            this.allProducts = [];
          }
        },
        error: (err) => {
          console.error('Error loading products:', err);
          this.allProducts = [];
        }
      });
  }

  private getSaleById() {
    this.subDataThree = this.newSalesService.getSaleById(this.id)
      .subscribe({
        next: (res => {
          if (res.data) {
            this.sale = res.data;
            this.soldDate = new Date(this.sale.soldDate);
            this.products = this.sale.products;
            this.discountType = this.sale.discountType;
            this.discountAmount = this.sale.discountAmount;
            this.vat = this.sale.vatAmount;
            this.tax = this.sale.tax || 0;
            this.ait = this.sale.ait || 0;
            this.serviceCharge = this.sale.serviceCharge || 0;
            this.receivedFromCustomer = this.sale.receivedFromCustomer || this.sale.paidAmount || this.sale.total;
            this.paymentType = this.sale.paymentType;
            
            // Load split payments if paymentType is mixed
            if (this.sale.paymentType === 'mixed' && this.sale.payments && this.sale.payments.length > 0) {
              this.payments = this.sale.payments;
              this.useSplitPayment = true;
            } else {
              this.payments = [];
              this.useSplitPayment = false;
            }
            
            this.setFormValue();
          }
        }),
        error: (error => {
          console.log(error);
        })
      });
  }

  private updateSaleById() {
    this.isLoading = true;
    this.subDataFour = this.newSalesService.updateSaleById(this.sale._id, this.saleData)
      .subscribe({
        next: (res => {
          this.isLoading = false;
          if (res.success) {
            this.uiService.message(res.message || 'Sale updated successfully', 'success');
            this.router.navigate(['/pos/sales/sale-list']);
          } else {
            this.uiService.message(res.message || 'Failed to update sale', 'warn');
          }
        }),
        error: (error => {
          this.isLoading = false;
          console.log(error);
        })
      });
  }

  private getShopInformation() {
    this.subShopInfo = this.shopInformationService.getShopInformation()
      .subscribe({
        next: res => {
          this.shopInformation = res.data;
        },
        error: err => {
          console.log(err);
        }
      });
  }

  /**
   * Load Printer Settings
   */
  private loadPrinterSettings() {
    this.printerSettingsService.getPrinterSettings().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.printerSettings = res.data;
          console.log('Printer settings loaded:', this.printerSettings);
        } else {
          console.warn('No printer settings found, using defaults');
          this.printerSettings = null;
        }
      },
      error: (err) => {
        console.error('Error loading printer settings:', err);
        this.printerSettings = null;
      }
    });
  }

  /**
   * Load POS Settings for VAT/Tax
   */
  private loadPosSettings() {
    this.settingService.getSetting('posSettings').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.posSettings = res.data.posSettings || null;
          // Auto-calculate VAT and Tax if enabled
          this.autoCalculateVatAndTax();
        }
      },
      error: (err) => {
        console.error('Error loading POS settings:', err);
      }
    });
  }

  /**
   * Auto-calculate VAT and Tax based on settings
   */
  autoCalculateVatAndTax() {
    if (!this.posSettings) return;

    const subtotalAfterDiscount = this.subTotal - (this.discount || 0) - (this.pointsDiscount || 0);

    // Auto-calculate VAT
    if (this.posSettings.isAutoCalculateVat && this.posSettings.vatPercentage > 0) {
      this.vat = Number(((subtotalAfterDiscount * this.posSettings.vatPercentage) / 100).toFixed(2));
    }

    // Auto-calculate Tax
    if (this.posSettings.isAutoCalculateTax && this.posSettings.taxPercentage > 0) {
      this.tax = Number(((subtotalAfterDiscount * this.posSettings.taxPercentage) / 100).toFixed(2));
    }
  }

  /**
   * Handle discount change
   */
  onDiscountChange() {
    this.autoCalculateVatAndTax();
  }

  /**
   * Handle Product Search & Product Table Action
   */
  onProductSearch(query: string) {
    this.productSearchQuery = query;
    if (query && query.length > 0) {
      const searchTerm = query.toLowerCase().trim();
      this.searchProducts = this.allProducts.filter(p => {
        const productName = this.utilsService.getProductName(p)?.toLowerCase() || '';
        const sku = (p.sku?.toString() || '').toLowerCase();
        const name = p.name?.toLowerCase() || '';
        const barcode = (p.barcode?.toString() || '').toLowerCase();
        const productId = (p.productId?.toString() || '').toLowerCase();
        return productName.includes(searchTerm) ||
               sku.includes(searchTerm) ||
               name.includes(searchTerm) ||
               barcode.includes(searchTerm) ||
               productId.includes(searchTerm);
      }).slice(0, 10);

      // Create flattened results with variations as separate items
      this.searchResultsWithVariations = [];
      this.searchProducts.forEach(product => {
        if (product.isVariation && product.variationList && product.variationList.length > 0) {
          // Add each variation as a separate item
          product.variationList.forEach((variation: VariationList) => {
            // Also check if search term matches variation name, SKU, or barcode
            const variationName = variation.name?.toLowerCase() || '';
            const variationSku = (variation.sku?.toString() || '').toLowerCase();
            const variationBarcode = (variation.barcode?.toString() || '').toLowerCase();
            const matchesVariation = variationName.includes(searchTerm) ||
                                     variationSku.includes(searchTerm) ||
                                     variationBarcode.includes(searchTerm);

            // Include if product matches OR variation matches
            if (matchesVariation || this.searchProducts.includes(product)) {
              this.searchResultsWithVariations.push({
                product: product,
                variation: variation,
                isVariation: true,
                displayName: `${product.name} - ${variation.name || 'Variation'}`,
                price: variation.salePrice || variation.regularPrice || 0,
                regularPrice: variation.regularPrice || product.regularPrice || 0,
                costPrice: variation.costPrice || product.costPrice || 0,
                stock: variation.quantity || 0,
                sku: variation.sku || product.sku,
                barcode: variation.barcode || product.barcode
              });
            }
          });
        } else {
          // Add non-variation product
          this.searchResultsWithVariations.push({
            product: product,
            variation: null,
            isVariation: false,
            displayName: this.utilsService.getProductName(product),
            price: product.salePrice || 0,
            regularPrice: product.regularPrice || 0,
            costPrice: product.costPrice || 0,
            stock: product.quantity || 0,
            sku: product.sku,
            barcode: product.barcode
          });
        }
      });

      // Also check for products where only variation barcode/SKU matches (not the main product)
      // This handles cases where user searches by variation barcode/SKU but main product doesn't match
      if (this.searchResultsWithVariations.length === 0) {
        this.allProducts.forEach(product => {
          if (product.isVariation && product.variationList && product.variationList.length > 0) {
            product.variationList.forEach((variation: VariationList) => {
              const variationSku = (variation.sku?.toString() || '').toLowerCase();
              const variationBarcode = (variation.barcode?.toString() || '').toLowerCase();
              const matchesVariation = variationSku.includes(searchTerm) ||
                                       variationBarcode.includes(searchTerm);

              if (matchesVariation) {
                this.searchResultsWithVariations.push({
                  product: product,
                  variation: variation,
                  isVariation: true,
                  displayName: `${product.name} - ${variation.name || 'Variation'}`,
                  price: variation.salePrice || variation.regularPrice || 0,
                  regularPrice: variation.regularPrice || product.regularPrice || 0,
                  costPrice: variation.costPrice || product.costPrice || 0,
                  stock: variation.quantity || 0,
                  sku: variation.sku || product.sku,
                  barcode: variation.barcode || product.barcode
                });
              }
            });
          }
        });
        // Limit results to 10
        this.searchResultsWithVariations = this.searchResultsWithVariations.slice(0, 10);
      }
    } else {
      this.searchProducts = [];
      this.searchResultsWithVariations = [];
    }
  }

  onSelectProduct(data: Product) {
    // If product has variations, show variation selection dialog
    if (data.isVariation && data.variationList && data.variationList.length > 0) {
      const dialogRef = this.dialog.open(VariationSelectionDialogComponent, {
        width: '600px',
        maxHeight: '80vh',
        data: { product: data }
      });

      dialogRef.afterClosed().subscribe((selectedVariation: VariationList) => {
        if (selectedVariation) {
          this.addProductToCart(data, selectedVariation);
        }
      });
    } else {
      // No variations, add directly
      this.addProductToCart(data, null);
    }
  }

  onSelectSearchItem(item: any) {
    // Direct selection from search results (already has variation selected if applicable)
    // Use regularPrice when adding from search results
    if (item.isVariation && item.variation) {
      this.addProductToCart(item.product, item.variation, item.regularPrice);
    } else {
      this.addProductToCart(item.product, null, item.regularPrice);
    }
    this.productSearchQuery = '';
    this.searchProducts = [];
    this.searchResultsWithVariations = [];
  }

  private addProductToCart(product: Product, selectedVariation: VariationList | null, useRegularPrice?: number) {
    // Create a unique identifier for this product instance (including variation)
    const uniqueId = selectedVariation
      ? `${product._id}_${selectedVariation._id}_${Date.now()}`
      : `${product._id}_${Date.now()}`;

    // Check if this exact product+variation combination already exists in cart
    const fIndex = this.products.findIndex(p => {
      if (selectedVariation) {
        return p._id === product._id && (p as any).selectedVariationId === selectedVariation._id;
      } else {
        return p._id === product._id && !(p as any).selectedVariationId;
      }
    });

    if (fIndex === -1) {
      // Create product data with variation info
      const productData: any = {
        ...product,
        uniqueId: uniqueId,
        soldQuantity: 1,
        saleType: 'Sale',
        itemDiscount: 0,
        itemDiscountType: 0,
        itemDiscountAmount: 0,
        // Ensure brand and subcategory are included for saving in sale
        brand: product.brand ? {
          _id: (product.brand as any)._id || (typeof product.brand === 'object' && product.brand !== null ? (product.brand as any)._id : null),
          name: (product.brand as any).name || (typeof product.brand === 'string' ? product.brand : '')
        } : undefined,
        subcategory: product.subCategory ? {
          _id: (product.subCategory as any)._id || (typeof product.subCategory === 'object' && product.subCategory !== null ? (product.subCategory as any)._id : null),
          name: (product.subCategory as any).name || (typeof product.subCategory === 'string' ? product.subCategory : '')
        } : undefined
      };

      // If variation selected, update product data with variation info
      if (selectedVariation) {
        productData.selectedVariationId = selectedVariation._id;
        productData.selectedVariation = selectedVariation;
        // Use regularPrice if provided (from search results), otherwise use salePrice or regularPrice
        productData.salePrice = useRegularPrice !== undefined && useRegularPrice > 0 
          ? useRegularPrice 
          : (selectedVariation.salePrice || selectedVariation.regularPrice || product.salePrice);
        productData.regularPrice = selectedVariation.regularPrice || product.regularPrice;
        productData.costPrice = selectedVariation.costPrice || product.costPrice;
        // Set purchasePrice from variation costPrice (costPrice is purchasePrice in product schema)
        productData.purchasePrice = selectedVariation.costPrice || product.costPrice || 0;
        productData.quantity = selectedVariation.quantity || 0;
        productData.sku = selectedVariation.sku || product.sku;
        productData.barcode = selectedVariation.barcode || product.barcode;
        // Add variation name to product name for display
        productData.variationName = selectedVariation.name;
      } else {
        // For non-variation products, use regularPrice if provided (from search results)
        if (useRegularPrice !== undefined && useRegularPrice > 0) {
          productData.salePrice = useRegularPrice;
        }
        // For non-variation products, purchasePrice = costPrice (costPrice is purchasePrice in product schema)
        productData.purchasePrice = product.costPrice || 0;
      }

      const availableQty = selectedVariation ? (selectedVariation.quantity || 0) : (product.quantity || 0);

      if (availableQty > 0) {
        productData.soldQuantity = 1;
      } else {
        productData.soldQuantity = 0;
      }

      this.products.push(productData);
    } else {
      // Product+variation already in cart, increase quantity
      const availableQty = selectedVariation ? (selectedVariation.quantity || 0) : (product.quantity || 0);
      if (this.products[fIndex].soldQuantity < availableQty) {
        this.products[fIndex].soldQuantity += 1;
      } else {
        this.uiService.message('Sorry! No Available Quantity', 'warn');
      }
    }

    this.productSearchQuery = '';
    this.searchProducts = [];
    // Auto-calculate VAT and Tax after adding product
    this.autoCalculateVatAndTax();
  }

  /**
   * Barcode Scanner Methods
   */
  openBarcodeScanner() {
    this.showBarcodeScanner = true;
  }

  onBarcodeScanned(barcode: string) {
    this.showBarcodeScanner = false;

    // Set the search query in the product search field
    this.productSearchQuery = barcode;

    // Trigger product search to show results in dropdown
    this.onProductSearch(barcode);

    // Wait a bit for search to complete, then try to find and select product
    setTimeout(() => {
      let foundProduct: Product = null;
      let foundVariation: VariationList = null;

      // First, check if barcode matches any variation barcode
      for (const product of this.allProducts) {
        if (product.isVariation && product.variationList && product.variationList.length > 0) {
          const variation = product.variationList.find((v: VariationList) =>
            v.barcode === barcode ||
            v.sku === barcode ||
            v.barcode?.toLowerCase() === barcode.toLowerCase() ||
            v.sku?.toLowerCase() === barcode.toLowerCase()
          );
          if (variation) {
            foundProduct = product;
            foundVariation = variation;
            break;
          }
        }
      }

      // If not found in variations, check product barcode/SKU
      if (!foundProduct) {
        foundProduct = this.searchProducts.find(p =>
          p.sku === barcode ||
          p.barcode === barcode ||
          p.productId === barcode ||
          p.sku?.toLowerCase() === barcode.toLowerCase() ||
          p.barcode?.toLowerCase() === barcode.toLowerCase()
        );

        // If not in search results, check in all products
        if (!foundProduct) {
          foundProduct = this.allProducts.find(p =>
            p.sku === barcode ||
            p.barcode === barcode ||
            p.productId === barcode ||
            p.sku?.toLowerCase() === barcode.toLowerCase() ||
            p.barcode?.toLowerCase() === barcode.toLowerCase()
          );
        }
      }

      if (foundProduct) {
        // If variation was found, add directly with that variation
        if (foundVariation) {
          this.addProductToCart(foundProduct, foundVariation);
          this.uiService.message('Product variation found and added to cart', 'success');
        } else {
          // Product found - add to cart (will show variation dialog if needed)
          this.onSelectProduct(foundProduct);
          this.uiService.message('Product found and added to cart', 'success');
        }
        // Clear search after adding
        setTimeout(() => {
          this.productSearchQuery = '';
          this.searchProducts = [];
        }, 500);
      } else {
        // Product not found - keep search query visible so user can see it
        this.uiService.message('Product not found with this barcode/SKU. Please check the search results.', 'warn');
      }
    }, 300);
  }

  closeBarcodeScanner() {
    this.showBarcodeScanner = false;
  }

  /**
   * Reprint Bill Dialog
   */
  openReprintDialog() {
    this.dialog.open(ReprintBillComponent, {
      width: '600px',
      maxHeight: '80vh',
      data: {}
    });
  }

  /**
   * Split Payment Dialog
   */
  openSplitPaymentDialog() {
    if (this.grandTotal <= 0) {
      this.uiService.message('Please add products first', 'warn');
      return;
    }

    const dialogRef = this.dialog.open(SplitPaymentDialogComponent, {
      width: '600px',
      maxHeight: '80vh',
      data: {
        grandTotal: this.grandTotal,
        paymentTypes: this.paymentTypes.filter(p => p.value !== 'due' && p.value !== 'mixed'),
        payments: this.payments.length > 0 ? [...this.payments] : [
          { method: 'cash', amount: 0 },
          { method: 'cash', amount: 0 }
        ]
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.payments) {
        this.payments = result.payments;
        this.useSplitPayment = true;
        this.paymentType = 'mixed';
        // Calculate total received from split payments
        this.receivedFromCustomer = this.splitPaymentTotal;
        this.uiService.message('Split payment configured', 'success');
      }
    });
  }

  /**
   * Exchange Dialog
   */
  openExchangeDialog() {
    if (!this.products.length) {
      this.uiService.message('Please add products for exchange', 'warn');
      return;
    }

    const dialogRef = this.dialog.open(ExchangeDialogComponent, {
      width: '700px',
      maxHeight: '80vh',
      data: {
        currentProducts: this.products,
        allProducts: this.allProducts
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.exchangeFromSaleId = result.originalSaleId;
        this.isExchange = true;
        // Add exchange products to cart
        if (result.exchangeProducts && result.exchangeProducts.length > 0) {
          result.exchangeProducts.forEach((product: Product) => {
            const existingIndex = this.products.findIndex(p => p._id === product._id);
            if (existingIndex >= 0) {
              this.products[existingIndex].soldQuantity = (this.products[existingIndex].soldQuantity || 0) + (product.soldQuantity || 1);
            } else {
              this.products.push({
                ...product,
                soldQuantity: product.soldQuantity || 1,
                saleType: 'Sale'
              });
            }
          });
        }
        this.uiService.message('Exchange products added to cart', 'success');
      }
    });
  }

  incrementQuantity(index: number, data: Product) {
    if (data.quantity > this.products[index].soldQuantity) {
      this.products[index].soldQuantity++;
    } else {
      this.uiService.message("You can't add more quantity", 'warn');
    }
  }

  decrementQuantity(index: number) {
    if (this.products[index].soldQuantity > 1) {
      this.products[index].soldQuantity--;
    } else {
      this.uiService.message("You can't decrease more quantity", 'warn');
    }
  }

  deleteProduct(index: number) {
    this.products.splice(index, 1);
    // Auto-calculate VAT and Tax after removing product
    this.autoCalculateVatAndTax();
  }

  /**
   * Mark Product as Return
   */
  markAsReturn(index: number) {
    if (this.products[index]) {
      this.products[index].saleType = 'Return';
      this.uiService.message('Product marked as return', 'success');
    }
  }

  /**
   * Mark Product as Sale (undo return)
   */
  markAsSale(index: number) {
    if (this.products[index]) {
      this.products[index].saleType = 'Sale';
      this.uiService.message('Product marked as sale', 'success');
    }
  }

  onPaymentTypeChanged(event: any) {
    if (event === 'mixed') {
      // If mixed payment is selected, open split payment dialog
      this.openSplitPaymentDialog();
    } else if (event === 'due') {
      this.useSplitPayment = false;
      this.payments = [];
      this.receivedFromCustomer = null;
    } else {
      this.useSplitPayment = false;
      this.payments = [];
      if (event !== 'cash') {
        this.receivedFromCustomer = this.grandTotal;
      } else {
        this.receivedFromCustomer = null;
      }
    }
  }

  /**
   * Hold Bill
   */
  holdBill() {
    if (!this.products.length) {
      this.uiService.message('Please add products to hold bill', 'warn');
      return;
    }

    this.isHoldBill = true;
    this.isDraftBill = false;
    this.onSubmit();
  }

  /**
   * Save Draft
   */
  saveDraft() {
    if (!this.products.length) {
      this.uiService.message('Please add products to save draft', 'warn');
      return;
    }

    this.isDraftBill = true;
    this.isHoldBill = false;
    this.onSubmit();
  }

  /**
   * COMPONENT DIALOG VIEW
   */
  public openConfirmDialog() {
    this.openDialog = true;
    const currencySymbol = this.getCurrencySymbol();
    const totalAmount = this.grandTotal.toLocaleString('bn-BD');
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      maxWidth: '500px',
      data: {
        title: 'Confirm Sale',
        message: `Are you sure you want to create this sale? Total Amount: ${currencySymbol}${totalAmount}`,
        confirmText: 'Confirm & Print',
        cancelText: 'Cancel'
      },
    });
    dialogRef.afterClosed().subscribe((dialogResult) => {
      this.openDialog = false;
      if (dialogResult) {
        this.addSale();
      }
    });
  }

  /**
   * Get Currency Symbol
   */
  private getCurrencySymbol(): string {
    if (!this.shopInformation?.currency) {
      return '৳';
    }
    switch(this.shopInformation.currency) {
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

  /**
   * ON PRINT - Opens invoice in new tab and triggers print
   */
  private onPrint() {
    try {
      // Ensure saleData has invoiceNo before printing
      if (!this.saleData || !this.saleData.invoiceNo) {
        console.warn('Sale data or invoice number missing, cannot print');
        this.uiService.message('Invoice data not available for printing', 'warn');
        return;
      }

      // Always reload printer settings to get latest values
      this.printerSettingsService.getPrinterSettings().subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.printerSettings = res.data;
            console.log('Printer settings loaded for print:', this.printerSettings);
            this.handlePrint();
          } else {
            console.warn('No printer settings found, using defaults');
            this.printerSettings = null;
            // No settings found, use default HTML print
            this.printInvoiceHTML();
          }
        },
        error: (err) => {
          console.error('Error loading printer settings:', err);
          this.printerSettings = null;
          // Fallback to HTML print
          this.printInvoiceHTML();
        }
      });
    } catch (error) {
      console.error('Print error:', error);
      this.uiService.message('Failed to open invoice for printing', 'warn');
    }
  }

  /**
   * Handle Print based on settings
   */
  private handlePrint() {
    const settings = this.printerSettings || {};
    const printType = settings.printType || 'pos'; // Default to POS if not set
    
    console.log('Handle print - Settings:', settings);
    console.log('Handle print - Print Type:', printType);

    // If A4 print is selected, use HTML print (A4 format)
    if (printType === 'a4') {
      console.log('Using A4 print');
      this.printInvoiceHTML();
      return;
    }
    
    // If Label print is selected, use HTML print (Label format)
    if (printType === 'label') {
      console.log('Using Label print');
      this.printInvoiceHTML();
      return;
    }

    // For POS print, check if thermal printing is enabled
    if (printType === 'pos' && settings.printWithoutPreview) {
      this.thermalPrinterService.printDirect(this.saleData, this.shopInformation).subscribe({
        next: (success) => {
          if (success) {
            this.uiService.message('Receipt printed successfully', 'success');
          } else {
            // Fallback to HTML print (POS format)
            this.printInvoiceHTML();
          }
        },
        error: (err) => {
          console.error('Thermal print error:', err);
          // Fallback to HTML print (POS format)
          this.printInvoiceHTML();
        }
      });
    } else {
      // Use HTML print with preview (POS format)
      this.printInvoiceHTML();
    }
  }

  /**
   * Print invoice using HTML (with preview)
   */
  private printInvoiceHTML() {
    try {
      // Generate print content
      const printContent = this.generatePrintContent();

      if (!printContent || printContent.includes('Error:')) {
        console.error('Failed to generate print content');
        this.uiService.message('Failed to generate invoice content', 'warn');
        return;
      }

      // Create a new window/tab for invoice
      const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');

      if (printWindow && !printWindow.closed) {
        // Write content to new window
        printWindow.document.open();
        printWindow.document.write(printContent);
        printWindow.document.close();

        // Wait for content to load, then focus and print
        const printTimeout = setTimeout(() => {
          try {
            if (printWindow && !printWindow.closed) {
              printWindow.focus();
              // Trigger print dialog
              printWindow.print();
            }
          } catch (printError) {
            console.error('Print trigger error:', printError);
            // If print fails, at least the invoice is visible in the new tab
            printWindow.focus();
          }
        }, 1000);

        // Clear timeout if window is closed
        printWindow.addEventListener('beforeunload', () => {
          clearTimeout(printTimeout);
        });
      } else {
        // If popup blocked, show error message
        console.error('Print window blocked by browser');
        this.uiService.message('Please allow popups to print invoice. Invoice will open in new tab.', 'warn');

        // Try alternative: create a blob URL and open it
        const blob = new Blob([printContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const altWindow = window.open(url, '_blank');
        if (altWindow) {
          setTimeout(() => {
            altWindow.print();
            URL.revokeObjectURL(url);
          }, 1000);
        }
      }
    } catch (error) {
      console.error('HTML print error:', error);
      this.uiService.message('Failed to open invoice for printing', 'warn');
    }
  }

  /**
   * Generate Print Content
   */
  private generatePrintContent(): string {
    const shopInfo = this.shopInformation;
    const sale = this.saleData;
    const settings = this.printerSettings || {};
    const date = new Date();
    const currencySymbol = this.getCurrencySymbol();
    const printType = settings.printType || 'pos'; // Default to POS if not set
    
    console.log('Generate print content - Settings:', settings);
    console.log('Generate print content - Print Type:', printType);
    console.log('Generate print content - Paper Size:', settings.paperSize);
    console.log('Generate print content - Label Size:', settings.labelSize);
    console.log('Generate print content - Orientation:', settings.orientation);

    // Debug: Check if data is available
    if (!sale) {
      console.error('Sale data is missing for print');
      return '<html><body><h1>Error: Sale data not available</h1></body></html>';
    }

    if (!shopInfo) {
      console.warn('Shop information is missing for print');
    }

    // Format values - Shop Information
    const shopName = shopInfo?.siteName || shopInfo?.websiteName || 'Shop Name';
    const shopAddress = shopInfo?.addresses?.[0]?.value || '';
    const shopPhone = shopInfo?.phones?.[0]?.value || '';
    const shopEmail = shopInfo?.emails?.[0]?.value || '';
    const shopWebsite = (shopInfo as any)?.website || '';
    
    // Invoice Information
    const invoiceNo = sale?.invoiceNo || 'N/A';
    const saleDate = this.utilsService.getDateString(sale?.soldDate || new Date());
    const saleTime = sale?.soldTime || '';
    
    // Customer Information
    const customerName = sale?.customer?.name || '';
    const customerPhone = sale?.customer?.phone || '';
    const customerEmail = sale?.customer?.email || '';
    const customerAddress = sale?.customer?.address || '';
    const customerCity = sale?.customer?.city || '';
    const customerPostCode = sale?.customer?.postCode || '';
    
    // Salesman Information
    const salesmanName = sale?.salesman?.name || this.vendor?.name || 'N/A';
    const salesmanPhone = sale?.salesman?.phone || '';

    // Paper size - A4 or POS or Label
    const isA4Print = printType === 'a4';
    const isLabelPrint = printType === 'label';
    const paperSize = isA4Print ? 'A4' : (isLabelPrint ? (settings.labelSize || '3in 10in') : (settings.paperSize || '58mm'));
    const orientation = settings.orientation || 'portrait'; // portrait, landscape, portrait-180, landscape-180
    
    // Calculate paper width for POS thermal printers
    let calculatedPaperWidth = '58mm';
    if (!isA4Print && !isLabelPrint) {
      calculatedPaperWidth = paperSize === '80mm' ? '80mm' : '58mm';
    } else if (isLabelPrint) {
      // For label printers, use the custom size
      calculatedPaperWidth = paperSize;
    }

    // Generate products table rows
    let productsRows = '';
    if (sale?.products && sale.products.length > 0) {
      productsRows = sale.products.map(p => {
        const productName = this.utilsService?.getProductName?.(p) || p?.name || 'Unknown Product';
        const qty = p.soldQuantity || 0;
        const price = (p.salePrice || 0).toFixed(2);
        const total = ((p.salePrice || 0) * qty).toFixed(2);
        return `
        <tr>
          <td>${productName}</td>
          <td>${qty}</td>
          <td>${currencySymbol}${price}</td>
          <td>${currencySymbol}${total}</td>
        </tr>`;
      }).join('');
    }

    // Format totals
    const subTotal = (sale?.subTotal || 0).toLocaleString('bn-BD');
    const discountAmount = sale?.discountAmount || sale?.discount || 0;
    const discount = discountAmount > 0 ? discountAmount.toLocaleString('bn-BD') : '0';
    const vatAmount = (sale?.vatAmount || 0).toLocaleString('bn-BD');
    const grandTotal = (sale?.total || 0).toLocaleString('bn-BD');
    const totalAmount = sale?.total || 0;
    // Paid amount should be receivedFromCustomer if available, otherwise paidAmount, otherwise total (for full payment)
    const paidAmount = sale?.receivedFromCustomer || sale?.paidAmount || (sale?.paymentType === 'cash' && !sale?.receivedFromCustomer ? sale?.total : 0);
    const dueAmount = totalAmount - paidAmount;
    const due = dueAmount > 0 ? dueAmount.toLocaleString('bn-BD') : '0';
    const received = paidAmount > 0 ? paidAmount.toLocaleString('bn-BD') : (sale?.total || 0).toLocaleString('bn-BD');
    const change = sale?.receivedFromCustomer && sale?.receivedFromCustomer > sale?.total
      ? (sale.receivedFromCustomer - sale.total).toFixed(2)
      : '0.00';

    // Custom CSS from settings
    const customCss = settings.customCss || '';

    // A4 Invoice Template (Compact One-Page Design)
    if (isA4Print) {
      return `<!DOCTYPE html>
<html>
<head>
  <title>Invoice - ${invoiceNo}</title>
  <meta charset="utf-8">
  <style>
    @media print {
      @page { 
        margin: 8mm; 
        size: A4;
      }
      body { margin: 0; }
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 10px;
      max-width: 210mm;
      margin: 0 auto;
      background: #fff;
      color: #333;
      line-height: 1.4;
      font-size: 11px;
    }
    .invoice-container {
      background: #fff;
      padding: 15px;
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 2px solid #4CAF50;
    }
    .shop-info {
      flex: 1;
    }
    .shop-logo-container {
      margin-bottom: 5px;
    }
    .shop-logo {
      max-width: 60px;
      max-height: 60px;
      display: ${settings.showShopLogo && (shopInfo as any)?.logo ? 'block' : 'none'};
    }
    .shop-name {
      font-size: 18px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 4px;
      display: ${(settings.showShopLogo && (shopInfo as any)?.logo) ? 'none' : (settings.showShopName !== false ? 'block' : 'none')};
    }
    .shop-details {
      color: #666;
      font-size: 10px;
      line-height: 1.3;
    }
    .shop-address {
      display: ${settings.showShopAddress !== false ? 'block' : 'none'};
      margin-bottom: 2px;
    }
    .shop-phone {
      display: ${settings.showShopPhone !== false ? 'block' : 'none'};
      margin-bottom: 2px;
    }
    .shop-email {
      display: ${shopEmail ? 'block' : 'none'};
      margin-bottom: 2px;
    }
    .shop-website {
      display: ${shopWebsite ? 'block' : 'none'};
      margin-bottom: 2px;
    }
    .invoice-title {
      text-align: right;
      flex: 1;
    }
    .invoice-title h1 {
      font-size: 24px;
      color: #4CAF50;
      margin-bottom: 5px;
      font-weight: 700;
    }
    .invoice-title .invoice-number {
      font-size: 12px;
      color: #666;
      display: ${settings.showInvoiceNumber !== false ? 'block' : 'none'};
    }
    .invoice-meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 4px;
      font-size: 10px;
    }
    .invoice-meta-section {
      flex: 1;
    }
    .invoice-meta-section h3 {
      font-size: 11px;
      color: #4CAF50;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    .invoice-meta-section p {
      margin: 3px 0;
      color: #333;
      font-size: 10px;
    }
    .invoice-meta-section strong {
      color: #2c3e50;
      display: inline-block;
      min-width: 70px;
    }
    .products-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      background: #fff;
      display: ${settings.showProductTable !== false ? 'table' : 'none'};
      font-size: 10px;
    }
    .products-table thead {
      background: #4CAF50;
      color: #fff;
    }
    .products-table th {
      padding: 6px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
    }
    .products-table td {
      padding: 5px 8px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 10px;
    }
    .products-table tbody tr:last-child td {
      border-bottom: none;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .totals-section {
      margin-top: 10px;
      display: flex;
      justify-content: flex-end;
      display: ${settings.showTotals !== false ? 'flex' : 'none'};
    }
    .totals-box {
      width: 280px;
      background: #f8f9fa;
      padding: 10px;
      border-radius: 4px;
      border: 1px solid #e0e0e0;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #e0e0e0;
      font-size: 11px;
    }
    .total-row:last-child {
      border-bottom: none;
    }
    .total-label {
      font-weight: 600;
      color: #333;
    }
    .total-value {
      font-weight: 600;
      color: #2c3e50;
    }
    .grand-total {
      font-size: 14px;
      font-weight: 700;
      color: #4CAF50;
      padding-top: 6px;
      margin-top: 4px;
      border-top: 2px solid #4CAF50;
    }
    .grand-total .total-value {
      color: #4CAF50;
      font-size: 16px;
    }
    .payment-section {
      margin-top: 10px;
      padding: 10px;
      background: #e8f5e9;
      border-radius: 4px;
      border-left: 3px solid #4CAF50;
      display: ${settings.showPaymentInfo !== false ? 'block' : 'none'};
      font-size: 10px;
    }
    .payment-section h3 {
      font-size: 11px;
      color: #2c3e50;
      margin-bottom: 6px;
      font-weight: 600;
    }
    .payment-info {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .payment-info-item {
      flex: 1;
      min-width: 120px;
    }
    .payment-info-item strong {
      display: block;
      color: #666;
      font-size: 9px;
      margin-bottom: 3px;
      text-transform: uppercase;
    }
    .payment-info-item span {
      font-size: 11px;
      color: #2c3e50;
      font-weight: 600;
    }
    .footer-section {
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      color: #666;
      font-size: 9px;
      display: ${settings.footerText ? 'block' : 'none'};
    }
    .footer-section p {
      margin: 3px 0;
    }
    .thank-you {
      font-size: 12px;
      color: #4CAF50;
      font-weight: 600;
      margin-bottom: 5px;
    }
    .signature-section {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      display: ${settings.showSignatureArea !== false ? 'flex' : 'none'};
    }
    .signature-box {
      width: 200px;
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #333;
      margin: 30px 0 5px 0;
    }
    .signature-label {
      font-size: 10px;
      color: #666;
      font-weight: 600;
    }
    ${customCss}
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="invoice-header">
      <div class="shop-info">
        ${settings.showShopLogo && (shopInfo as any)?.logo ? `
        <div class="shop-logo-container">
          <img src="${(shopInfo as any).logo}" alt="Logo" class="shop-logo">
        </div>
        ` : ''}
        ${(!settings.showShopLogo || !(shopInfo as any)?.logo) && settings.showShopName !== false ? `<div class="shop-name">${shopName}</div>` : ''}
        <div class="shop-details">
          ${settings.showShopAddress !== false ? `<div class="shop-address">${shopAddress}</div>` : ''}
          ${settings.showShopPhone !== false ? `<div class="shop-phone">${shopPhone}</div>` : ''}
          ${shopEmail ? `<div class="shop-email">${shopEmail}</div>` : ''}
          ${shopWebsite ? `<div class="shop-website">${shopWebsite}</div>` : ''}
        </div>
      </div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        ${settings.showInvoiceNumber !== false ? `<div class="invoice-number">#${invoiceNo}</div>` : ''}
      </div>
    </div>

    <!-- Invoice Meta Information -->
    <div class="invoice-meta">
      <div class="invoice-meta-section">
        <h3>Bill To</h3>
        ${customerName ? `<p><strong>Name:</strong> ${customerName}</p>` : '<p><strong>Name:</strong> Walk-in Customer</p>'}
        ${customerPhone ? `<p><strong>Phone:</strong> ${customerPhone}</p>` : ''}
        ${customerEmail ? `<p><strong>Email:</strong> ${customerEmail}</p>` : ''}
        ${customerAddress ? `<p><strong>Address:</strong> ${customerAddress}</p>` : ''}
        ${customerCity || customerPostCode ? `<p><strong>City/Post:</strong> ${customerCity || ''}${customerPostCode ? (customerCity ? ' - ' : '') + customerPostCode : ''}</p>` : ''}
      </div>
      <div class="invoice-meta-section">
        <h3>Invoice Details</h3>
        ${settings.showInvoiceNumber !== false ? `<p><strong>Invoice #:</strong> ${invoiceNo}</p>` : ''}
        ${settings.showDate !== false ? `<p><strong>Date:</strong> ${saleDate}</p>` : ''}
        ${settings.showTime !== false && saleTime ? `<p><strong>Time:</strong> ${saleTime}</p>` : ''}
        ${settings.showSalesmanInfo !== false ? `<p><strong>Salesman:</strong> ${salesmanName}${salesmanPhone ? ' (' + salesmanPhone + ')' : ''}</p>` : ''}
      </div>
    </div>

    <!-- Products Table -->
    ${settings.showProductTable !== false ? `
    <table class="products-table">
      <thead>
        <tr>
          <th>Item Description</th>
          <th class="text-center">Quantity</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${productsRows}
      </tbody>
    </table>
    ` : ''}

    <!-- Totals Section -->
    ${settings.showTotals !== false ? `
    <div class="totals-section">
      <div class="totals-box">
        <div class="total-row">
          <span class="total-label">Sub Total:</span>
          <span class="total-value">${currencySymbol}${subTotal}</span>
        </div>
        ${discountAmount > 0 ? `
        <div class="total-row">
          <span class="total-label">Discount:</span>
          <span class="total-value" style="color: #f44336;">-${currencySymbol}${discount}</span>
        </div>
        ` : ''}
        ${(sale?.vatAmount || 0) > 0 ? `
        <div class="total-row">
          <span class="total-label">VAT:</span>
          <span class="total-value">${currencySymbol}${vatAmount}</span>
        </div>
        ` : ''}
        <div class="total-row grand-total">
          <span class="total-label">Grand Total:</span>
          <span class="total-value">${currencySymbol}${grandTotal}</span>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Payment Information -->
    ${settings.showPaymentInfo !== false ? `
    <div class="payment-section">
      <h3>Payment Information</h3>
      <div class="payment-info">
        <div class="payment-info-item">
          <strong>Payment Method</strong>
          <span>${sale?.paymentType || 'Cash'}</span>
        </div>
        <div class="payment-info-item">
          <strong>Total Amount</strong>
          <span>${currencySymbol}${grandTotal}</span>
        </div>
        <div class="payment-info-item">
          <strong>Amount Paid</strong>
          <span>${currencySymbol}${received}</span>
        </div>
        ${dueAmount > 0 ? `
        <div class="payment-info-item">
          <strong>Due Amount</strong>
          <span style="color: #f44336; font-weight: 700;">${currencySymbol}${due}</span>
        </div>
        ` : ''}
        ${parseFloat(change) > 0 ? `
        <div class="payment-info-item">
          <strong>Change</strong>
          <span>${currencySymbol}${change}</span>
        </div>
        ` : ''}
      </div>
    </div>
    ` : ''}

    <!-- Signature Section -->
    ${settings.showSignatureArea !== false ? `
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Customer Signature</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Authorized Signature</div>
      </div>
    </div>
    ` : ''}

    <!-- Footer -->
    ${settings.footerText ? `
    <div class="footer-section">
      <div class="thank-you">Thank You for Your Business!</div>
      <p>${settings.footerText}</p>
      ${settings.showReturnPolicy !== false && settings.returnPolicyText ? `
      <p style="margin-top: 15px; font-size: 12px; color: #999;">
        <strong>Return Policy:</strong> ${settings.returnPolicyText}
      </p>
      ` : ''}
    </div>
    ` : ''}
  </div>
${isLabelPrint ? '</div>' : ''}
</body>
</html>`;
    }

    // Paper size specific styles
    const paperWidth = isA4Print ? '210mm' : (isLabelPrint ? calculatedPaperWidth : (paperSize === '80mm' ? '80mm' : '58mm'));

    return `<!DOCTYPE html>
<html>
<head>
  <title>Invoice - ${invoiceNo}</title>
  <style>
    @media print {
      @page { 
        margin: ${isA4Print ? '10mm' : (isLabelPrint ? '0mm' : '5mm')} !important; 
        size: ${isA4Print ? 'A4' : (isLabelPrint ? paperSize : paperWidth)} !important;
        ${isLabelPrint && orientation === 'landscape' ? 'size: landscape !important;' : ''}
        ${isLabelPrint && orientation === 'portrait-180' ? 'size: portrait !important;' : ''}
        ${isLabelPrint && orientation === 'landscape-180' ? 'size: landscape !important;' : ''}
        page-break-inside: avoid !important;
        orphans: 0 !important;
        widows: 0 !important;
      }
      body { 
        margin: 0 !important;
        padding: 0 !important;
        height: 100% !important;
        max-height: 100% !important;
        ${isLabelPrint && (orientation === 'portrait-180' || orientation === 'landscape-180') ? 'transform: rotate(180deg);' : ''}
        overflow: hidden !important;
        page-break-inside: avoid !important;
      }
      /* Prevent page breaks for all invoice sections */
      .header, .invoice-info, .customer-info, .salesman-info, .total-section, .payment-section, .footer, .return-policy, .signature-area, .qr-code, .barcode {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      table {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      thead {
        display: table-header-group;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      tbody {
        display: table-row-group;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      td, th {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      ${isLabelPrint ? `
      * {
        page-break-inside: avoid !important;
        page-break-after: avoid !important;
        page-break-before: avoid !important;
        break-inside: avoid !important;
        break-after: avoid !important;
        break-before: avoid !important;
      }
      html, body, div, p, span, table, thead, tbody, tr, td, th, .header, .invoice-info, .customer-info, .salesman-info, .total-section, .payment-section, .footer {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
        page-break-before: avoid !important;
        break-before: avoid !important;
      }
      ` : ''}
      ${isLabelPrint ? `
      * {
        page-break-inside: avoid !important;
        page-break-after: avoid !important;
        page-break-before: avoid !important;
      }
      html, body {
        height: 100% !important;
        max-height: 100% !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      body > * {
        max-height: 100% !important;
        overflow: hidden !important;
      }
      .invoice-container {
        height: 100% !important;
        max-height: 100% !important;
        overflow: hidden !important;
        display: flex;
        flex-direction: column;
      }
      table {
        max-height: 40% !important;
        overflow: hidden !important;
      }
      table tbody {
        display: block;
        max-height: 200px;
        overflow-y: auto;
      }
      ` : ''}
    }
    body {
      font-family: Arial, sans-serif;
      padding: ${isA4Print ? '20px' : (isLabelPrint ? '0px' : (paperSize === '80mm' ? '15px' : '10px'))};
      max-width: ${isA4Print ? '210mm' : paperWidth};
      margin: 0;
      font-size: ${isA4Print ? '14px' : (isLabelPrint ? '4px' : (paperSize === '80mm' ? '14px' : '12px'))};
      line-height: ${isLabelPrint ? '1' : '1.4'};
      ${isLabelPrint ? 'height: 100vh; overflow: hidden; max-height: 100vh;' : ''}
    }
    .invoice-wrapper {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      ${isLabelPrint ? 'height: 100vh; overflow: hidden; max-height: 100vh;' : ''}
    }
    .header {
      text-align: center;
      border-bottom: ${isLabelPrint ? '0.3px' : '2px'} solid #000;
      padding-bottom: ${isLabelPrint ? '0px' : (settings.showShopName !== false ? '15px' : '10px')};
      margin-bottom: ${isLabelPrint ? '0px' : '15px'};
      ${settings.showShopLogo && (shopInfo as any)?.logo ? '' : ''}
    }
    .shop-logo {
      max-width: ${isLabelPrint ? '15px' : '80px'};
      max-height: ${isLabelPrint ? '15px' : '80px'};
      margin-bottom: ${isLabelPrint ? '0px' : '10px'};
      display: ${settings.showShopLogo && (shopInfo as any)?.logo ? 'block' : 'none'};
    }
    .shop-name {
      font-size: ${isA4Print ? '24px' : (isLabelPrint ? '5px' : (paperSize === '80mm' ? '20px' : '18px'))};
      font-weight: bold;
      margin-bottom: ${isLabelPrint ? '0px' : '8px'};
      line-height: ${isLabelPrint ? '1' : '1.4'};
      display: ${settings.showShopName !== false ? 'block' : 'none'};
    }
    .shop-address {
      display: ${settings.showShopAddress !== false ? 'block' : 'none'};
      margin: ${isLabelPrint ? '0px' : '5px 0'};
      font-size: ${isLabelPrint ? '4px' : 'inherit'};
      line-height: ${isLabelPrint ? '1' : '1.4'};
    }
    .shop-phone {
      display: ${settings.showShopPhone !== false ? 'block' : 'none'};
      margin: ${isLabelPrint ? '0px' : '5px 0'};
      font-size: ${isLabelPrint ? '4px' : 'inherit'};
      line-height: ${isLabelPrint ? '1' : '1.4'};
    }
    .invoice-info {
      margin-bottom: ${isLabelPrint ? '0px' : '15px'};
      font-size: ${isA4Print ? '14px' : (isLabelPrint ? '4px' : (paperSize === '80mm' ? '13px' : '11px'))};
      line-height: ${isLabelPrint ? '1' : '1.4'};
      ${isLabelPrint ? 'page-break-inside: avoid !important; break-inside: avoid !important;' : ''}
    }
    .invoice-info div {
      margin: ${isLabelPrint ? '0px' : '3px 0'};
    }
    .invoice-no {
      display: ${settings.showInvoiceNumber !== false ? 'block' : 'none'};
    }
    .invoice-date {
      display: ${settings.showDate !== false ? 'block' : 'none'};
    }
    .invoice-time {
      display: ${settings.showTime !== false ? 'block' : 'none'};
    }
    .customer-info {
      margin-bottom: ${isLabelPrint ? '0px' : '15px'};
      display: ${settings.showCustomerInfo !== false && (customerName || customerPhone) ? 'block' : 'none'};
      font-size: ${isLabelPrint ? '4px' : 'inherit'};
      line-height: ${isLabelPrint ? '1' : '1.4'};
    }
    .salesman-info {
      margin-bottom: ${isLabelPrint ? '0px' : '15px'};
      display: ${settings.showSalesmanInfo !== false ? 'block' : 'none'};
      font-size: ${isLabelPrint ? '4px' : 'inherit'};
      line-height: ${isLabelPrint ? '1' : '1.4'};
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: ${isLabelPrint ? '0px' : '15px 0'};
      display: ${settings.showProductTable !== false ? 'table' : 'none'};
      font-size: ${isA4Print ? '13px' : (isLabelPrint ? '4px' : (paperSize === '80mm' ? '12px' : '10px'))};
      line-height: ${isLabelPrint ? '1' : '1.4'};
      ${isLabelPrint ? 'table-layout: fixed; max-height: 40vh !important; overflow: hidden !important; page-break-inside: avoid !important; break-inside: avoid !important;' : ''}
    }
    th, td {
      border: ${isLabelPrint ? '0.2px' : '1px'} solid #ddd;
      padding: ${isLabelPrint ? '0px 1px' : '5px'};
      text-align: left;
      ${isLabelPrint ? 'height: auto !important; max-height: 5px !important; overflow: hidden !important; vertical-align: top !important;' : ''}
    }
    ${isLabelPrint ? `
    tr {
      height: auto !important;
      min-height: 0 !important;
      max-height: 5px !important;
      overflow: hidden !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    tbody {
      max-height: 35vh !important;
      overflow: hidden !important;
      display: block;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    tbody tr {
      display: table-row;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    thead {
      display: table-header-group;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    th, td {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    ` : ''}
    ${isLabelPrint ? `
    tr {
      height: auto !important;
      min-height: 0 !important;
    }
    ` : ''}
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    .total-section {
      margin-top: ${isLabelPrint ? '0px' : '15px'};
      text-align: right;
      display: ${settings.showTotals !== false ? 'block' : 'none'};
      font-size: ${isLabelPrint ? '4px' : 'inherit'};
      line-height: ${isLabelPrint ? '1' : '1.4'};
      ${isLabelPrint ? 'page-break-inside: avoid !important; break-inside: avoid !important;' : ''}
    }
    .total-row {
      margin: ${isLabelPrint ? '0px' : '4px 0'};
    }
    .total-row {
      display: flex;
      justify-content: flex-end;
      margin: 4px 0;
    }
    .total-label {
      width: ${isA4Print ? '150px' : (paperSize === '80mm' ? '120px' : '100px')};
      font-weight: bold;
      text-align: left;
    }
    .total-value {
      width: ${isA4Print ? '120px' : (paperSize === '80mm' ? '100px' : '80px')};
      text-align: right;
    }
    .grand-total {
      font-size: ${isA4Print ? '18px' : (paperSize === '80mm' ? '16px' : '14px')};
      font-weight: bold;
      border-top: 2px solid #000;
      padding-top: 8px;
    }
    .payment-info {
      margin-top: 15px;
      display: ${settings.showPaymentInfo !== false ? 'block' : 'none'};
    }
    .qr-code {
      text-align: center;
      margin: ${isLabelPrint ? '1px 0' : '15px 0'};
      display: ${settings.showQRCode !== false ? 'block' : 'none'};
    }
    .qr-code img {
      max-width: ${isLabelPrint ? '50px' : '150px'};
      height: auto;
    }
    .barcode {
      text-align: center;
      margin: ${isLabelPrint ? '1px 0' : '15px 0'};
      display: ${settings.showBarcode !== false ? 'block' : 'none'};
    }
    .barcode img {
      max-width: ${isLabelPrint ? '80%' : '100%'};
      height: auto;
    }
    .return-policy {
      margin-top: 15px;
      font-size: ${paperSize === '80mm' ? '11px' : '9px'};
      display: ${settings.showReturnPolicy !== false && settings.returnPolicyText ? 'block' : 'none'};
    }
    .return-policy-title {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .signature-area {
      margin-top: ${isLabelPrint ? '1px' : '30px'};
      display: ${settings.showSignatureArea !== false ? 'block' : 'none'};
    }
    .signature-line {
      border-top: ${isLabelPrint ? '0.3px' : '1px'} solid #000;
      margin-top: ${isLabelPrint ? '2px' : '40px'};
      margin-bottom: ${isLabelPrint ? '1px' : '5px'};
    }
    .signature-label {
      font-size: ${isLabelPrint ? '5px' : (paperSize === '80mm' ? '11px' : '9px')};
      text-align: center;
      line-height: ${isLabelPrint ? '1.1' : '1.4'};
    }
    .footer {
      margin-top: ${isLabelPrint ? '1px' : '20px'};
      text-align: center;
      font-size: ${isLabelPrint ? '5px' : (paperSize === '80mm' ? '11px' : '9px')};
      color: #666;
      display: ${settings.footerText ? 'block' : 'none'};
      line-height: ${isLabelPrint ? '1.1' : '1.4'};
    }
    .divider {
      border-top: ${isLabelPrint ? '0.2px' : '1px'} dashed #000;
      margin: ${isLabelPrint ? '0px' : '10px 0'};
      height: ${isLabelPrint ? '0px' : 'auto'};
    }
    ${isLabelPrint ? `
    .payment-section, .footer, .return-policy, .signature-area {
      margin-top: 0px !important;
      margin-bottom: 0px !important;
      font-size: 4px !important;
      line-height: 1 !important;
      padding: 0px !important;
    }
    .payment-section div, .footer div {
      margin: 0px !important;
      padding: 0px !important;
    }
    ` : ''}
    ${customCss}
    ${isLabelPrint ? `
    @media print {
      html, body {
        height: 100% !important;
        max-height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      body > * {
        max-height: 100% !important;
        overflow: hidden !important;
      }
      @page {
        size: ${paperSize} !important;
        margin: 0mm !important;
        page-break-inside: avoid !important;
        orphans: 0 !important;
        widows: 0 !important;
      }
    }
    ` : ''}
  </style>
</head>
<body${isLabelPrint ? ' style="height: 100vh; overflow: hidden; margin: 0; padding: 0; max-height: 100vh !important; box-sizing: border-box; page-break-inside: avoid !important; break-inside: avoid !important;"' : ' style="page-break-inside: avoid !important; break-inside: avoid !important;"'}>
<div class="invoice-wrapper"${isLabelPrint ? ' style="height: 100vh; overflow: hidden; max-height: 100vh !important; display: flex; flex-direction: column; box-sizing: border-box; position: relative; page-break-inside: avoid !important; break-inside: avoid !important;"' : ' style="page-break-inside: avoid !important; break-inside: avoid !important;"'}>
  ${(settings.showShopName !== false || settings.showShopAddress !== false || settings.showShopPhone !== false) ? `
  <div class="header">
    ${settings.showShopLogo && (shopInfo as any)?.logo ? `<img src="${(shopInfo as any).logo}" alt="Logo" class="shop-logo">` : ''}
    ${settings.showShopName !== false ? `<div class="shop-name">${shopName}</div>` : ''}
    ${settings.showShopAddress !== false ? `<div class="shop-address">${shopAddress}</div>` : ''}
    ${settings.showShopPhone !== false ? `<div class="shop-phone">Phone: ${shopPhone}</div>` : ''}
  </div>
  <div class="divider"></div>
  ` : ''}

  <div class="invoice-info">
    ${settings.showInvoiceNumber !== false ? `<div class="invoice-no"><strong>Invoice:</strong> ${invoiceNo}</div>` : ''}
    ${settings.showDate !== false ? `<div class="invoice-date"><strong>Date:</strong> ${saleDate}</div>` : ''}
    ${settings.showTime !== false && saleTime ? `<div class="invoice-time"><strong>Time:</strong> ${saleTime}</div>` : ''}
  </div>

  ${settings.showCustomerInfo !== false && (customerName || customerPhone) ? `
  <div class="customer-info">
    ${customerName ? `<div><strong>Customer:</strong> ${customerName}</div>` : ''}
    ${customerPhone ? `<div><strong>Phone:</strong> ${customerPhone}</div>` : ''}
  </div>
  ` : ''}

  ${settings.showSalesmanInfo !== false ? `
  <div class="salesman-info">
    <div><strong>Salesman:</strong> ${salesmanName}</div>
  </div>
  ` : ''}

  ${settings.showProductTable !== false ? `
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${productsRows}
    </tbody>
  </table>
  <div class="divider"></div>
  ` : ''}

  ${settings.showTotals !== false ? `
  <div class="total-section">
    <div class="total-row">
      <div class="total-label">Sub Total:</div>
      <div class="total-value">${currencySymbol}${subTotal}</div>
    </div>
    ${discountAmount > 0 ? `
    <div class="total-row">
      <div class="total-label">Discount:</div>
      <div class="total-value">-${currencySymbol}${discount}</div>
    </div>
    ` : ''}
    ${(sale?.vatAmount || 0) > 0 ? `
    <div class="total-row">
      <div class="total-label">VAT:</div>
      <div class="total-value">${currencySymbol}${vatAmount}</div>
    </div>
    ` : ''}
    <div class="total-row grand-total">
      <div class="total-label">Total:</div>
      <div class="total-value">${currencySymbol}${grandTotal}</div>
    </div>
  </div>
  ` : ''}

  ${settings.showPaymentInfo !== false ? `
  <div class="payment-info">
    <div><strong>Payment:</strong> ${sale?.paymentType || 'Cash'}</div>
    <div><strong>Total:</strong> ${currencySymbol}${grandTotal}</div>
    <div><strong>Received:</strong> ${currencySymbol}${received}</div>
    ${dueAmount > 0 ? `<div><strong>Due:</strong> <span style="color: #f44336; font-weight: 700;">${currencySymbol}${due}</span></div>` : ''}
    ${parseFloat(change) > 0 ? `<div><strong>Change:</strong> ${currencySymbol}${change}</div>` : ''}
  </div>
  ` : ''}

  ${settings.showQRCode !== false ? `
  <div class="divider"></div>
  <div class="qr-code">
    <!-- QR Code will be generated by receipt template component -->
  </div>
  ` : ''}

  ${settings.showBarcode !== false ? `
  <div class="barcode">
    <!-- Barcode will be generated by receipt template component -->
  </div>
  ` : ''}

  ${settings.showReturnPolicy !== false && settings.returnPolicyText ? `
  <div class="divider"></div>
  <div class="return-policy">
    <div class="return-policy-title"><strong>Return Policy:</strong></div>
    <div class="return-policy-text">${settings.returnPolicyText}</div>
  </div>
  ` : ''}

  ${settings.showSignatureArea !== false ? `
  <div class="signature-area">
    <div class="signature-line"></div>
    <div class="signature-label">${settings.signatureLabel || 'Customer Signature'}</div>
  </div>
  ` : ''}

  ${settings.footerText ? `
  <div class="footer">
    <div>${settings.footerText}</div>
  </div>
  ` : ''}
</div>
</body>
</html>`;
  }

  /**
   * Calculation Area
   */
  get subTotal() {
    if (this.id) {
      // Calculate sale amount (excluding returns) with item discounts
      const saleAmount = Number(
        this.products.filter(f => f.saleType === 'Sale' || !f.saleType).map(t => {
          const itemTotal = t.salePrice * t.soldQuantity;
          const itemDisc = this.getItemDiscount(t);
          return itemTotal - itemDisc;
        }).reduce((acc, value) => acc + value, 0).toFixed(2)
      );

      // Calculate return amount
      const returnAmount = Number(
        this.products.filter(f => f.saleType === 'Return').map(t => {
          return (t.salePrice * t.soldQuantity);
        }).reduce((acc, value) => acc + value, 0).toFixed(2)
      );

      // Subtract return amount from sale amount
      return Number((saleAmount - returnAmount).toFixed(2));
    } else {
      // Calculate with item discounts
      const amount = Number(
        this.products.filter(f => f.saleType === 'Sale' || !f.saleType).map(t => {
          const itemTotal = t.salePrice * t.soldQuantity;
          const itemDisc = this.getItemDiscount(t);
          return itemTotal - itemDisc;
        }).reduce((acc, value) => acc + value, 0).toFixed(2)
      );
      return Number((amount).toFixed(2));
    }
  }

  /**
   * Handle price change for a product
   */
  onPriceChange(index: number, product: Product) {
    // Ensure price is valid (non-negative)
    if (product.salePrice < 0) {
      product.salePrice = 0;
      this.uiService.message('Price cannot be negative', 'warn');
    }
    
    // Recalculate item discount if it exists (percentage discount depends on price)
    if (product.itemDiscount && product.itemDiscount > 0 && product.itemDiscountType === 0) {
      // Percentage discount - will be recalculated automatically in getItemDiscount
    }
    
    // Force change detection to update totals
    this.products[index] = { ...product };
    // Auto-calculate VAT and Tax after updating product
    this.autoCalculateVatAndTax();
  }

  /**
   * Calculate item-wise discount
   */
  getItemDiscount(product: Product): number {
    if (!product.itemDiscount || product.itemDiscount === 0) {
      return 0;
    }

    const itemTotal = product.salePrice * product.soldQuantity;

    if (product.itemDiscountType === 0) {
      // Percentage discount
      return Number((itemTotal * product.itemDiscount / 100).toFixed(2));
    } else {
      // Flat discount
      return Number((product.itemDiscount).toFixed(2));
    }
  }

  /**
   * Get total item discounts
   */
  get totalItemDiscounts() {
    return Number(
      this.products
        .filter(p => p.saleType === 'Sale' || !p.saleType)
        .map(p => this.getItemDiscount(p))
        .reduce((acc, value) => acc + value, 0)
        .toFixed(2)
    );
  }

  get returnTotal() {
    if (this.id) {
      // First check if sale has totalReturnedAmount from backend
      if (this.sale?.totalReturnedAmount > 0) {
        return this.sale.totalReturnedAmount;
      }
      // Fallback: calculate from products with returnedQty
      const fromReturnedQty = this.products
        .filter(f => (f.returnedQty || 0) > 0)
        .map(t => (t.salePrice || 0) * (t.returnedQty || 0))
        .reduce((acc, value) => acc + value, 0);
      
      if (fromReturnedQty > 0) {
        return Number(fromReturnedQty.toFixed(2));
      }
      
      // Legacy: check saleType === 'Return'
      return Number(
        this.products.filter(f => f.saleType === 'Return').map(t => {
          return (t.salePrice * t.soldQuantity);
        }).reduce((acc, value) => acc + value, 0).toFixed(2)
      );
    }
    return 0;
  }

  get discount() {
    let dis;
    const discountTypeValue = this.discountTypes.find(d => d.value === this.discountType);
    if (discountTypeValue?.viewValue === 'Cash') {
      dis = this.discountAmount;
    } else if (discountTypeValue?.viewValue === 'Percentage') {
      dis = Number(((this.discountAmount / 100) * this.subTotal).toFixed(2));
    } else {
      dis = 0;
    }
    return dis;
  }

  get grandTotal() {
    const baseTotal = this.subTotal;
    const billDiscount = this.discount || 0;
    const pointsDisc = this.pointsDiscount || 0;
    const taxAmount = this.tax || 0;
    const vatAmount = this.vat || 0;
    const aitAmount = this.ait || 0;
    const serviceChargeAmount = this.serviceCharge || 0;

    // Calculation order:
    // 1. Sub Total (after item discounts)
    // 2. Bill Discount
    // 3. Points Discount
    // 4. Tax
    // 5. VAT
    // 6. AIT
    // 7. Service Charge
    const total = baseTotal - billDiscount - pointsDisc + taxAmount + vatAmount + aitAmount + serviceChargeAmount;

    return Number(total.toFixed(2));
  }

  /**
   * Net total after returns (for view mode)
   */
  get netTotal() {
    return Number((this.grandTotal - this.returnTotal).toFixed(2));
  }

  /**
   * Get total split payment amount
   */
  get splitPaymentTotal() {
    if (!this.payments || this.payments.length === 0) {
      return 0;
    }
    return this.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }

  /**
   * Get payment method view value
   */
  getPaymentMethodViewValue(method: string): string {
    const paymentType = this.paymentTypes.find(p => p.value === method);
    return paymentType ? paymentType.viewValue : method;
  }

  /**
   * Get Customer Group Badge Class
   */
  getCustomerGroupBadgeClass(group: string): string {
    switch (group) {
      case 'VIP':
        return 'vip-badge';
      case 'Wholesale':
        return 'wholesale-badge';
      default:
        return 'general-badge';
    }
  }

  get purchaseTotalAmount() {
    return Number(this.products.map(t => {
      return (t.purchasePrice * t.soldQuantity);
    }).reduce((acc, value) => acc + value, 0).toFixed(2));
  }

  get totalProfit() {
    if (this.sale) {
      const tProfit = this.sale?.products?.map(m => {
        if (m.saleType === 'Sale') {
          return (m.purchasePrice) * (m.soldQuantity);
        } else {
          return -(m.salePrice * m.soldQuantity);
        }
      }).reduce((acc, value) => acc + value, 0);
      return ((this.sale?.total - this.sale?.vatAmount) - tProfit);
    } else {
      return 0;
    }
  }

  /**
   * ON DESTROY
   */
  ngOnDestroy() {
    if (this.subDataOne) {
      this.subDataOne.unsubscribe();
    }
    if (this.subDataTwo) {
      this.subDataTwo.unsubscribe();
    }
    if (this.subDataThree) {
      this.subDataThree.unsubscribe();
    }
    if (this.subDataFour) {
      this.subDataFour.unsubscribe();
    }
    if (this.subDataFive) {
      this.subDataFive.unsubscribe();
    }
    if (this.subShopInfo) {
      this.subShopInfo.unsubscribe();
    }
    if (this.subCustomerSearch) {
      this.subCustomerSearch.unsubscribe();
    }
  }
}

