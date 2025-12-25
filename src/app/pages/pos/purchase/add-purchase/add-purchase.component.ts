import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, NgForm, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { UiService } from '../../../../services/core/ui.service';
import { PurchaseService } from '../../../../services/common/purchase.service';
import { SupplierService } from '../../../../services/common/supplier.service';
import { ProductService } from '../../../../services/common/product.service';
import { UtilsService } from '../../../../services/core/utils.service';
import { ReloadService } from '../../../../services/core/reload.service';
import { VendorService } from '../../../../services/vendor/vendor.service';
import { ShopInformationService } from '../../../../services/common/shop-information.service';
import { ConfirmDialogComponent } from '../../../../shared/components/ui/confirm-dialog/confirm-dialog.component';
import { Purchase, PurchaseProduct } from '../../../../interfaces/common/purchase.interface';
import { Supplier } from '../../../../interfaces/common/supplier.interface';
import { Product, VariationList } from '../../../../interfaces/common/product.interface';
import { ShopInformation } from '../../../../interfaces/common/shop-information.interface';
import { Select } from '../../../../interfaces/core/select';
import { DISCOUNT_TYPES, PAYMENT_TYPES } from '../../../../core/utils/app-data';
import { FilterData } from '../../../../interfaces/gallery/filter-data';

@Component({
  selector: 'app-add-purchase',
  templateUrl: './add-purchase.component.html',
  styleUrls: ['./add-purchase.component.scss']
})
export class AddPurchaseComponent implements OnInit, OnDestroy {
  // Data Form
  @ViewChild('formElement') formElement: NgForm;
  dataForm?: FormGroup;
  disable = false;

  // Static Data
  discountTypes: Select[] = DISCOUNT_TYPES;
  paymentTypes: Select[] = PAYMENT_TYPES.filter(p => ['cash', 'bank', 'cheque', 'mobile_banking', 'due', 'partial'].includes(p.value));

  // Store Data
  isLoading: boolean = false;
  isViewMode: boolean = false;
  id?: string;
  purchase?: Purchase;

  // Supplier
  suppliers: Supplier[] = [];
  selectedSupplier: Supplier = null;
  supplierSearchQuery: string = '';
  searchSuppliers: Supplier[] = [];

  // Products
  products: PurchaseProduct[] = [];
  allProducts: Product[] = [];
  searchProducts: Product[] = [];
  searchResultsWithVariations: any[] = []; // Flattened results including variations
  productSearchQuery: string = '';

  // Purchase Details
  purchaseDate: Date = new Date();
  discount: number = 0;
  discountType: any = 'Cash'; // 'Cash' or 'Percentage'
  tax: number = 0;
  shipping: number = 0;
  paymentType: string = 'cash';
  paidAmount: number = 0;
  reference: string = '';
  notes: string = '';

  // Shop data
  shopInformation: ShopInformation;

  // Subscriptions
  private subDataOne: Subscription;
  private subDataTwo: Subscription;
  private subDataThree: Subscription;
  private subDataFour: Subscription;
  private subDataFive: Subscription;
  private subShopInfo: Subscription;

  constructor(
    private fb: FormBuilder,
    private purchaseService: PurchaseService,
    private supplierService: SupplierService,
    private productService: ProductService,
    private uiService: UiService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private utilsService: UtilsService,
    private reloadService: ReloadService,
    private vendorService: VendorService,
    private shopInformationService: ShopInformationService,
  ) {
  }

  ngOnInit(): void {
    // Get ID from route
    this.activatedRoute.paramMap.subscribe((param) => {
      this.id = param.get('id');
      if (this.id) {
        this.getPurchaseById();
      }
    });

    // GET DATA FORM QUERY PARAM
    this.activatedRoute.queryParamMap.subscribe((qParam) => {
      const isViewMode = qParam.get('view');
      this.isViewMode = isViewMode == 'true';
      this.updateFormDisabledState();
    });

    this.initDataForm();
    this.updateFormDisabledState();
    this.getAllSuppliers();
    this.getAllProducts();
    this.getShopInformation();
  }

  /**
   * UPDATE FORM DISABLED STATE
   */
  private updateFormDisabledState() {
    if (!this.dataForm) return;
    
    if (this.isViewMode) {
      this.dataForm.disable();
    } else {
      this.dataForm.enable();
    }
  }

  /**
   * INIT FORM
   */
  private initDataForm() {
    this.dataForm = this.fb.group({
      supplierId: [null, [Validators.required]],
      purchaseDate: [new Date(), [Validators.required]],
      discount: [0],
      discountType: ['Cash'],
      tax: [0],
      shipping: [0],
      paymentType: ['cash'],
      paidAmount: [0],
      reference: [null],
      notes: [null],
    });
  }

  /**
   * HTTP REQ HANDLE
   */
  private getAllSuppliers() {
    const filter: FilterData = {
      filter: null,
      pagination: null,
      select: {
        name: 1,
        phone: 1,
        email: 1,
        _id: 1,
      },
      sort: { name: 1 },
    };

    this.subDataOne = this.supplierService.getAllSuppliers(filter)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.suppliers = res.data || [];
          }
        },
        error: (err) => {
          console.error('Error loading suppliers:', err);
        }
      });
  }

  private getAllProducts() {
    const mSelect = {
      _id: 1,
      name: 1,
      sku: 1,
      salePrice: 1,
      purchasePrice: 1,
      quantity: 1,
      status: 1,
      images: 1,
      category: 1,
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


    this.subDataTwo = this.productService.getAllProducts(filter)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.allProducts = res.data || [];
          }
        },
        error: (err) => {
          console.error('Error loading products:', err);
        }
      });
  }

  private getPurchaseById() {
    this.isLoading = true;
    this.subDataThree = this.purchaseService.getPurchaseById(this.id)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success && res.data) {
            this.purchase = res.data;
            this.setFormValue();
          } else {
            this.uiService.message('Purchase not found', 'warn');
            this.router.navigate(['/pos/purchase/purchase-list']);
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error loading purchase:', err);
          this.uiService.message('Failed to load purchase', 'warn');
        }
      });
  }

  private setFormValue() {
    if (this.purchase) {
      this.selectedSupplier = this.suppliers.find(s => s._id === this.purchase.supplier._id) || null;
      this.products = this.purchase.products || [];
      this.purchaseDate = new Date(this.purchase.purchaseDate);
      this.discount = this.purchase.discount || 0;
      this.discountType = this.purchase.discountType || 'Cash';
      this.tax = this.purchase.tax || 0;
      this.shipping = this.purchase.shipping || 0;
      this.paymentType = this.purchase.paymentType || 'cash';
      this.paidAmount = this.purchase.paidAmount || 0;
      this.reference = this.purchase.reference || '';
      this.notes = this.purchase.notes || '';

      this.dataForm.patchValue({
        supplierId: this.purchase.supplier._id,
        purchaseDate: this.purchaseDate,
        discount: this.discount,
        discountType: this.discountType,
        tax: this.tax,
        shipping: this.shipping,
        paymentType: this.paymentType,
        paidAmount: this.paidAmount,
        reference: this.reference,
        notes: this.notes,
      });
      
      this.updateFormDisabledState();
    }
  }

  /**
   * SUPPLIER SEARCH
   */
  onSupplierSearch(query: string) {
    this.supplierSearchQuery = query;
    if (query && query.length > 0) {
      const searchTerm = query.toLowerCase().trim();
      this.searchSuppliers = this.suppliers.filter(s => {
        const name = s.name?.toLowerCase() || '';
        const phone = s.phone?.toLowerCase() || '';
        return name.includes(searchTerm) || phone.includes(searchTerm);
      }).slice(0, 10);
    } else {
      this.searchSuppliers = [];
    }
  }

  onSelectSupplier(supplier: Supplier) {
    this.selectedSupplier = supplier;
    this.dataForm.patchValue({ supplierId: supplier._id });
    this.supplierSearchQuery = '';
    this.searchSuppliers = [];
  }

  /**
   * PRODUCT SEARCH
   */
  onProductSearch(query: string) {
    this.productSearchQuery = query;
    if (query && query.length > 0) {
      const searchTerm = query.toLowerCase().trim();

      // First, find products that match by product name/SKU/barcode
      this.searchProducts = this.allProducts.filter(p => {
        const productName = this.utilsService.getProductName(p)?.toLowerCase() || '';
        const sku = p.sku?.toLowerCase() || '';
        const name = p.name?.toLowerCase() || '';
        const barcode = p.barcode?.toLowerCase() || '';
        return productName.includes(searchTerm) ||
               sku.includes(searchTerm) ||
               name.includes(searchTerm) ||
               barcode.includes(searchTerm);
      }).slice(0, 10);

      // Create flattened results with variations as separate items
      this.searchResultsWithVariations = [];

      // Process products that matched by product name/SKU/barcode
      this.searchProducts.forEach(product => {
        // Check if product has variations (check variationList regardless of isVariation flag)
        if (product.variationList && product.variationList.length > 0) {
          // If product matches, show ALL its variations as separate items
          product.variationList.forEach((variation: VariationList) => {
            this.searchResultsWithVariations.push({
              product: product,
              variation: variation,
              isVariation: true,
              displayName: `${product.name} - ${variation.name || 'Variation'}`,
              purchasePrice: variation.costPrice || product.purchasePrice || 0,
              salePrice: variation.salePrice || variation.regularPrice || product.salePrice || 0,
              stock: variation.quantity || 0,
              sku: variation.sku || product.sku,
              barcode: variation.barcode || product.barcode
            });
          });
        } else {
          // Add non-variation product
          this.searchResultsWithVariations.push({
            product: product,
            variation: null,
            isVariation: false,
            displayName: this.utilsService.getProductName(product),
            purchasePrice: product.purchasePrice || 0,
            salePrice: product.salePrice || 0,
            stock: product.quantity || 0,
            sku: product.sku,
            barcode: product.barcode
          });
        }
      });

      // Also check all products for matching variations (in case variation SKU/barcode matches but product doesn't)
      this.allProducts.forEach(product => {
        // Check if product has variations (check variationList regardless of isVariation flag)
        if (product.variationList && product.variationList.length > 0) {
          // Skip if product is already in searchProducts (already processed above)
          if (this.searchProducts.includes(product)) {
            return;
          }

          // Check if any variation matches
          product.variationList.forEach((variation: VariationList) => {
            const variationName = variation.name?.toLowerCase() || '';
            const variationSku = variation.sku?.toLowerCase() || '';
            const variationBarcode = variation.barcode?.toLowerCase() || '';
            const matchesVariation = variationName.includes(searchTerm) ||
                                     variationSku.includes(searchTerm) ||
                                     variationBarcode.includes(searchTerm);

            if (matchesVariation) {
              // Check if this variation is already added
              const alreadyAdded = this.searchResultsWithVariations.some(item =>
                item.product?._id === product._id && item.variation?._id === variation._id
              );

              if (!alreadyAdded) {
                this.searchResultsWithVariations.push({
                  product: product,
                  variation: variation,
                  isVariation: true,
                  displayName: `${product.name} - ${variation.name || 'Variation'}`,
                  purchasePrice: variation.costPrice || product.purchasePrice || 0,
                  salePrice: variation.salePrice || variation.regularPrice || product.salePrice || 0,
                  stock: variation.quantity || 0,
                  sku: variation.sku || product.sku,
                  barcode: variation.barcode || product.barcode
                });
              }
            }
          });
        }
      });
    } else {
      this.searchProducts = [];
      this.searchResultsWithVariations = [];
    }
  }

  onSelectProduct(product: Product) {
    // If product has variations, show variation selection dialog
    if (product.isVariation && product.variationList && product.variationList.length > 0) {
      // For purchase, we'll add the first variation or show dialog
      // For now, let's add the first variation directly
      const firstVariation = product.variationList[0];
      this.addProductToPurchase(product, firstVariation);
    } else {
      // No variations, add directly
      this.addProductToPurchase(product, null);
    }
  }

  onSelectSearchItem(item: any) {
    // Direct selection from search results (already has variation selected if applicable)
    // Check if item has variation data
    if (item.isVariation && item.variation && item.product) {
      this.addProductToPurchase(item.product, item.variation);
    } else if (item.product) {
      // No variation, add product directly
      this.addProductToPurchase(item.product, null);
    }
    // Clear search
    this.productSearchQuery = '';
    this.searchProducts = [];
    this.searchResultsWithVariations = [];
  }

  private addProductToPurchase(product: Product, selectedVariation: VariationList | null) {
    // Create unique identifier for this product instance (including variation)
    const uniqueId = selectedVariation
      ? `${product._id}_${selectedVariation._id}`
      : `${product._id}`;

    // Check if this exact product+variation combination already exists in purchase
    const fIndex = this.products.findIndex(p => {
      // First check if product ID matches
      if (p.productId !== product._id) {
        return false;
      }
      
      if (selectedVariation) {
        // For variation products, check if variation matches
        const existingVariationId = (p as any).selectedVariationId;
        const existingVariation = (p as any).selectedVariation;
        const existingSku = p.sku;
        const existingVariationName = (p as any).variationName;
        
        // Match by variation ID (most reliable)
        if (selectedVariation._id && existingVariationId) {
          if (String(existingVariationId) === String(selectedVariation._id)) {
            return true;
          }
        }
        
        // Match by SKU (from product data or variation)
        if (selectedVariation.sku) {
          if (existingSku === selectedVariation.sku) {
            return true;
          }
          if (existingVariation?.sku === selectedVariation.sku) {
            return true;
          }
        }
        
        // Match by variation name
        if (selectedVariation.name && existingVariationName) {
          if (existingVariationName === selectedVariation.name) {
            return true;
          }
        }
        
        // Match by barcode if available
        if (selectedVariation.barcode && existingVariation?.barcode) {
          if (existingVariation.barcode === selectedVariation.barcode) {
            return true;
          }
        }
        
        return false;
      } else {
        // No variation - check if product ID matches and no variation is set
        return !(p as any).selectedVariationId;
      }
    });

    if (fIndex === -1) {
      // Create product data with variation info
      const purchasePrice = selectedVariation ? (selectedVariation.costPrice || product.purchasePrice || 0) : (product.purchasePrice || 0);
      const salePrice = selectedVariation ? (selectedVariation.salePrice || selectedVariation.regularPrice || product.salePrice || 0) : (product.salePrice || 0);
      const displayName = selectedVariation
        ? `${product.name} - ${selectedVariation.name || 'Variation'}`
        : this.utilsService.getProductName(product);

      const productData: PurchaseProduct & any = {
        productId: product._id,
        name: displayName,
        sku: selectedVariation ? (selectedVariation.sku || product.sku) : product.sku,
        quantity: 1,
        purchasePrice: purchasePrice,
        salePrice: salePrice,
        total: purchasePrice * 1,
      };

      // If variation selected, store variation info
      if (selectedVariation) {
        productData.selectedVariationId = selectedVariation._id;
        productData.selectedVariation = selectedVariation;
        productData.variationName = selectedVariation.name;
      }

      this.products.push(productData);
    } else {
      // Product+variation already in purchase, increase quantity
      this.products[fIndex].quantity += 1;
      this.products[fIndex].total = this.products[fIndex].quantity * this.products[fIndex].purchasePrice;
    }

    this.productSearchQuery = '';
    this.searchProducts = [];
    this.searchResultsWithVariations = [];
  }

  /**
   * PRODUCT QUANTITY & PRICE MANAGEMENT
   */
  incrementQuantity(index: number) {
    this.products[index].quantity += 1;
    this.products[index].total = this.products[index].quantity * this.products[index].purchasePrice;
  }

  decrementQuantity(index: number) {
    if (this.products[index].quantity > 1) {
      this.products[index].quantity -= 1;
      this.products[index].total = this.products[index].quantity * this.products[index].purchasePrice;
    }
  }

  updateQuantity(index: number, quantity: number) {
    if (quantity > 0) {
      this.products[index].quantity = quantity;
      this.products[index].total = this.products[index].quantity * this.products[index].purchasePrice;
    }
  }

  updatePurchasePrice(index: number, price: number) {
    if (price >= 0) {
      this.products[index].purchasePrice = price;
      this.products[index].total = this.products[index].quantity * price;
    }
  }

  updateSalePrice(index: number, price: number) {
    if (price >= 0) {
      this.products[index].salePrice = price;
    }
  }

  removeProduct(index: number) {
    this.products.splice(index, 1);
  }

  /**
   * CALCULATIONS
   */
  get subTotal(): number {
    return this.products.reduce((sum, p) => sum + (p.total || 0), 0);
  }

  get finalDiscount(): number {
    if (!this.discount || this.discount <= 0) return 0;
    if (this.discountType === 'Percentage') {
      // Percentage
      return (this.subTotal * this.discount) / 100;
    } else {
      // Cash
      return this.discount;
    }
  }

  get grandTotal(): number {
    return this.subTotal - this.finalDiscount + (this.tax || 0) + (this.shipping || 0);
  }

  get dueAmount(): number {
    return this.grandTotal - (this.paidAmount || 0);
  }

  /**
   * SUBMIT
   */
  onSubmit() {
    if (this.dataForm.invalid) {
      this.uiService.message('Please fill all required fields', 'warn');
      this.dataForm.markAllAsTouched();
      return;
    }

    if (!this.selectedSupplier) {
      this.uiService.message('Please select a supplier', 'warn');
      return;
    }

    if (this.products.length === 0) {
      this.uiService.message('Please add at least one product', 'warn');
      return;
    }

    const purchaseData = {
      supplierId: this.selectedSupplier._id,
      purchaseDate: this.purchaseDate,
      purchaseDateString: this.utilsService.getDateString(this.purchaseDate),
      products: this.products.map(p => ({
        productId: p.productId,
        quantity: p.quantity,
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        selectedVariationId: (p as any).selectedVariationId || null,
      })),
      discount: this.discount || 0,
      discountType: this.discountType || 'Cash',
      tax: this.tax || 0,
      shipping: this.shipping || 0,
      total: this.grandTotal,
      paidAmount: this.paidAmount || 0,
      paymentType: this.paymentType,
      paymentMethod: this.paymentType,
      reference: this.reference || null,
      notes: this.notes || null,
    };

    if (this.id) {
      this.updatePurchaseById(purchaseData);
    } else {
      this.addPurchase(purchaseData);
    }
  }

  private addPurchase(data: any) {
    this.isLoading = true;
    this.subDataFour = this.purchaseService.addPurchase(data)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.uiService.message(res.message || 'Purchase added successfully', 'success');
            this.reloadService.needRefreshCustomer$();
            this.router.navigate(['/pos/purchase/purchase-list']);
          } else {
            this.uiService.message(res.message || 'Failed to add purchase', 'warn');
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error adding purchase:', err);
          this.uiService.message('Failed to add purchase', 'warn');
        }
      });
  }

  private updatePurchaseById(data: any) {
    this.isLoading = true;
    this.subDataFive = this.purchaseService.updatePurchaseById(this.id, data)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.uiService.message(res.message || 'Purchase updated successfully', 'success');
            this.reloadService.needRefreshCustomer$();
            this.router.navigate(['/pos/purchase/purchase-list']);
          } else {
            this.uiService.message(res.message || 'Failed to update purchase', 'warn');
          }
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error updating purchase:', err);
          this.uiService.message('Failed to update purchase', 'warn');
        }
      });
  }

  /**
   * GET SHOP INFORMATION
   */
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

  onCancel() {
    this.router.navigate(['/pos/purchase/purchase-list']);
  }

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
  }
}

