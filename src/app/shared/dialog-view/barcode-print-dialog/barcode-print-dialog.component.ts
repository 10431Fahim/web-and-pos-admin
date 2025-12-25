import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import JsBarcode from 'jsbarcode';
import { PrinterSettingsService } from '../../../services/common/printer-settings.service';
import { ShopInformationService } from '../../../services/common/shop-information.service';
import { ShopInformation } from '../../../interfaces/common/shop-information.interface';

export interface BarcodePrintData {
  products: any[];
}

@Component({
  selector: 'app-barcode-print-dialog',
  templateUrl: './barcode-print-dialog.component.html',
  styleUrls: ['./barcode-print-dialog.component.scss']
})
export class BarcodePrintDialogComponent implements OnInit, OnDestroy {
  allProducts: any[] = []; // All products passed to dialog
  selectedProducts: any[] = []; // Products selected for printing
  productSelection: Map<string, boolean> = new Map(); // Track which products are selected
  barcodeSelection: Map<string, boolean> = new Map(); // Track which individual barcodes are selected (key: productId:variationId or productId:base)
  printCount: number = 1;
  showPrice: boolean = true;
  shopInformation: ShopInformation | null = null;
  barcodeDataUrls: Map<string, string> = new Map(); // For preview (canvas images)
  barcodeSvgs: Map<string, string> = new Map(); // For print (SVG strings)
  selectedVariationByProduct: Record<string, string> = {};
  showProductSelection: boolean = true; // Show/hide product selection list
  
  // Barcode label settings from printer settings
  barcodeSettings: any = {
    showProductName: true,
    showVariationName: true,
    showPrice: true,
    showSkuAndVariant: false,
    showBarcodeAndVariant: false,
    useBarcodeOrSku: 'barcode', // 'barcode' or 'sku'
    useSalePrice: true,
    showShopName: true,
    showBarcodeCode: true,
    barcodeWidth: 2.5,
    barcodeHeight: 60
  };
  
  private subDataOne: Subscription;
  private subShopInfo: Subscription;

  constructor(
    public dialogRef: MatDialogRef<BarcodePrintDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: BarcodePrintData,
    private printerSettingsService: PrinterSettingsService,
    private shopInformationService: ShopInformationService,
  ) {
    this.allProducts = data.products || [];
    // Initially select all products
    this.allProducts.forEach(product => {
      this.productSelection.set(product._id, true);
    });
    this.updateSelectedProducts();
  }

  ngOnInit(): void {
    this.loadShopInformation();
    this.loadBarcodeSettings();
  }

  private loadShopInformation(): void {
    this.subShopInfo = this.shopInformationService
      .getShopInformation('siteName websiteName currency')
      .subscribe({
        next: (res) => {
          if (res?.success && res.data) {
            this.shopInformation = res.data;
          } else {
            this.shopInformation = { currency: '৳' } as any;
          }
        },
        error: (err) => {
          console.error('Error loading shop information for barcode dialog:', err);
          this.shopInformation = { currency: '৳' } as any;
        }
      });
  }

  loadBarcodeSettings(): void {
    this.printerSettingsService.getPrinterSettings().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.barcodeSettings = {
            showProductName: res.data.barcodeLabelShowProductName !== undefined ? res.data.barcodeLabelShowProductName : true,
            showVariationName: res.data.barcodeLabelShowVariationName !== undefined ? res.data.barcodeLabelShowVariationName : true,
            showPrice: res.data.barcodeLabelShowPrice !== undefined ? res.data.barcodeLabelShowPrice : true,
            // Default to TRUE so SKU & Variant shows by default if not configured
            showSkuAndVariant: res.data.barcodeLabelShowSkuAndVariant !== undefined ? res.data.barcodeLabelShowSkuAndVariant : true,
            showBarcodeAndVariant: res.data.barcodeLabelShowBarcodeAndVariant !== undefined ? res.data.barcodeLabelShowBarcodeAndVariant : false,
            useBarcodeOrSku: res.data.barcodeLabelUseBarcodeOrSku || 'barcode', // 'barcode' or 'sku'
            useSalePrice: res.data.barcodeLabelUseSalePrice !== undefined ? res.data.barcodeLabelUseSalePrice : true,
            showShopName: res.data.barcodeLabelShowShopName !== undefined ? res.data.barcodeLabelShowShopName : true,
            showBarcodeCode: res.data.barcodeLabelShowBarcodeCode !== undefined ? res.data.barcodeLabelShowBarcodeCode : true,
            barcodeWidth: res.data.barcodeWidth || 2.5,
            barcodeHeight: res.data.barcodeHeight || 60
          };
          console.log(this.barcodeSettings);
          
          // Update showPrice checkbox based on settings
          this.showPrice = this.barcodeSettings.showPrice;
          // Regenerate barcodes with new settings
          this.generateBarcodes();
        }
      },
      error: (err) => {
        console.error('Error loading barcode settings:', err);
        // Use defaults and generate barcodes
        this.generateBarcodes();
      }
    });
  }

  /**
   * Resolve barcode value for a product, preferring product barcode, then SKU,
   * then variation-level barcode/SKU, avoiding fallback to _id to keep labels clean.
   */
  private getSelectedVariation(product: any): any {
    if (!product?.variationList?.length) return null;
    const selectedId = this.selectedVariationByProduct[product._id];
    return product.variationList.find((v: any) => v?._id === selectedId) || product.variationList[0];
  }

  onVariationChange(product: any): void {
    this.generateBarcodes();
  }

  private getVariationKey(product: any): string {
    const variation = this.getSelectedVariation(product);
    return variation ? `${product._id}:${variation._id}` : `${product._id}:base`;
  }

  private getBarcodeValue(product: any): string {
    if (!product) {
      return '';
    }
    const useBarcodeOrSku = this.barcodeSettings?.useBarcodeOrSku || 'barcode';
    const variation = this.getSelectedVariation(product);
    
    if (variation) {
      if (useBarcodeOrSku === 'sku') {
        // Prefer SKU over barcode
        if (variation.sku) return variation.sku;
        if (variation.barcode) return variation.barcode;
      } else {
        // Prefer barcode over SKU (default)
        if (variation.barcode) return variation.barcode;
        if (variation.sku) return variation.sku;
      }
    }
    
    if (useBarcodeOrSku === 'sku') {
      // Prefer SKU over barcode
      if (product.sku) return product.sku;
      if (product.productId) return product.productId;
      if (product.barcode) return product.barcode;
    } else {
      // Prefer barcode over SKU (default)
      if (product.barcode) return product.barcode;
      if (product.sku) return product.sku;
      if (product.productId) return product.productId;
    }
    
    // Fallback: check variation list
    if (product.variationList?.length) {
      if (useBarcodeOrSku === 'sku') {
        const variationSku = product.variationList.find((v: any) => v?.sku)?.sku;
        if (variationSku) return variationSku;
        const variationBarcode = product.variationList.find((v: any) => v?.barcode)?.barcode;
        if (variationBarcode) return variationBarcode;
      } else {
        const variationBarcode = product.variationList.find((v: any) => v?.barcode)?.barcode;
        if (variationBarcode) return variationBarcode;
        const variationSku = product.variationList.find((v: any) => v?.sku)?.sku;
        if (variationSku) return variationSku;
      }
    }
    
    return '';
  }

  getDisplayBarcode(product: any): string {
    return this.getBarcodeValue(product);
  }

  private getPriceValue(product: any): number {
    const variation = this.getSelectedVariation(product);
    if (variation) {
      if (this.barcodeSettings?.useSalePrice) {
        // Prefer sale price, then regular/price
        return variation.salePrice ?? variation.regularPrice ?? variation.price ?? 0;
      }
      // Prefer regular price, then price, then sale price
      return variation.regularPrice ?? variation.price ?? variation.salePrice ?? 0;
    }
    if (this.barcodeSettings?.useSalePrice) {
      return product.salePrice ?? product.regularPrice ?? product.price ?? 0;
    }
    return product.regularPrice ?? product.price ?? product.salePrice ?? 0;
  }

  private getVariationPrice(variation: any, product: any): number {
    if (!variation) {
      return this.getPriceValue(product);
    }
    if (this.barcodeSettings?.useSalePrice) {
      return variation.salePrice ?? variation.regularPrice ?? variation.price ?? 0;
    }
    return variation.regularPrice ?? variation.price ?? variation.salePrice ?? 0;
  }

  generateBarcodes(): void {
    this.barcodeDataUrls.clear();
    this.barcodeSvgs.clear();
    // Initialize all barcodes as selected when generating
    this.barcodeSelection.clear();
    this.selectedProducts.forEach(product => {
      // If product has variations, generate barcode for each variation
      if (product?.variationList?.length) {
        product.variationList.forEach((variation: any) => {
          const barcodeValue = this.getVariationBarcode(variation);
          if (barcodeValue) {
            try {
              // Generate SVG for print (crystal clear, vector-based)
              const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
              JsBarcode(svg, barcodeValue, {
                format: 'CODE128',
                width: this.barcodeSettings.barcodeWidth,
                height: this.barcodeSettings.barcodeHeight,
                displayValue: false,
                fontSize: 0,
                font: 'Arial',
                textMargin: 0,
                margin: 8,
                background: '#ffffff',
                lineColor: '#000000',
                valid: function(valid) {
                  return valid;
                }
              });
              const key = `${product._id}:${variation._id}`;
              // Store SVG string for print
              this.barcodeSvgs.set(key, svg.outerHTML);
              // Initialize as selected
              this.barcodeSelection.set(key, true);
              
              // Also generate canvas for preview with dynamic size
              const canvas = document.createElement('canvas');
              // Calculate canvas size based on barcode height and width
              const canvasWidth = Math.max(400, this.barcodeSettings.barcodeWidth * 50);
              const canvasHeight = Math.max(100, this.barcodeSettings.barcodeHeight + 20);
              canvas.width = canvasWidth;
              canvas.height = canvasHeight;
              JsBarcode(canvas, barcodeValue, {
                format: 'CODE128',
                width: this.barcodeSettings.barcodeWidth,
                height: this.barcodeSettings.barcodeHeight,
                displayValue: false,
                fontSize: 0,
                font: 'Arial',
                textMargin: 0,
                margin: 8,
                background: '#ffffff',
                lineColor: '#000000'
              });
              this.barcodeDataUrls.set(key, canvas.toDataURL('image/png', 1.0));
            } catch (err) {
              console.error('Barcode generation error for variation:', variation._id, err);
            }
          }
        });
      } else {
        // If no variations, generate barcode for product
        const barcodeValue = this.getBarcodeValue(product);
        if (barcodeValue) {
            try {
              // Generate SVG for print (crystal clear, vector-based)
              const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
              JsBarcode(svg, barcodeValue, {
                format: 'CODE128',
                width: this.barcodeSettings.barcodeWidth,
                height: this.barcodeSettings.barcodeHeight,
                displayValue: false,
                fontSize: 0,
                font: 'Arial',
                textMargin: 0,
                margin: 8,
                background: '#ffffff',
                lineColor: '#000000',
                valid: function(valid) {
                  return valid;
                }
              });
              const key = `${product._id}:base`;
              // Store SVG string for print
              this.barcodeSvgs.set(key, svg.outerHTML);
              // Initialize as selected
              this.barcodeSelection.set(key, true);
              
              // Also generate canvas for preview with dynamic size
              const canvas = document.createElement('canvas');
              // Calculate canvas size based on barcode height and width
              const canvasWidth = Math.max(400, this.barcodeSettings.barcodeWidth * 50);
              const canvasHeight = Math.max(100, this.barcodeSettings.barcodeHeight + 20);
              canvas.width = canvasWidth;
              canvas.height = canvasHeight;
              JsBarcode(canvas, barcodeValue, {
                format: 'CODE128',
                width: this.barcodeSettings.barcodeWidth,
                height: this.barcodeSettings.barcodeHeight,
                displayValue: false,
                fontSize: 0,
                font: 'Arial',
                textMargin: 0,
                margin: 8,
                background: '#ffffff',
                lineColor: '#000000'
              });
              this.barcodeDataUrls.set(key, canvas.toDataURL('image/png', 1.0));
            } catch (err) {
              console.error('Barcode generation error for product:', product._id, err);
            }
        }
      }
    });
  }

  getVariationBarcode(variation: any): string {
    if (!variation) return '';
    const useBarcodeOrSku = this.barcodeSettings?.useBarcodeOrSku || 'barcode';
    
    if (useBarcodeOrSku === 'sku') {
      // Prefer SKU over barcode
      if (variation.sku) return variation.sku;
      if (variation.barcode) return variation.barcode;
    } else {
      // Prefer barcode over SKU (default)
      if (variation.barcode) return variation.barcode;
      if (variation.sku) return variation.sku;
    }
    return '';
  }

  onPrintCountChange(): void {
    if (this.printCount < 1) {
      this.printCount = 1;
    }
  }

  onGenerate(): void {
    this.generateBarcodes();
  }

  onPrint(): void {
    const printContent = document.getElementById('barcode-print-section');
    if (!printContent) {
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      return;
    }

    const shopName =
      this.shopInformation?.siteName ||
      this.shopInformation?.websiteName ||
      'Shop';
    const currency = this.shopInformation?.currency || '৳';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Print</title>
        <style>
          @media print {
            @page {
              size: 1.5in 1in;
              margin: 0;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 0;
            }
            html, body {
              height: auto;
              overflow: visible;
            }
            .barcode-wrapper {
              display: block;
            }
            .barcode-container {
              page-break-after: always;
              page-break-inside: avoid;
              break-after: page;
              break-inside: avoid;
            }
            .barcode-container:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            img, .barcode-image, .barcode-svg, .barcode-svg svg {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .barcode-svg svg {
              shape-rendering: crispEdges;
            }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 0;
            margin: 0;
          }
          .barcode-wrapper {
            display: block;
            width: 100%;
          }
          .barcode-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 1.5in;
            height: 1in;
            border: none;
            padding: 1.5mm;
            margin: 0 auto;
            text-align: center;
            page-break-inside: avoid;
            page-break-after: always;
            break-inside: avoid;
            break-after: page;
            box-sizing: border-box;
            overflow: hidden;
          }
          .barcode-container:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .product-name {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 1px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 100%;
            line-height: 1.1;
            flex-shrink: 0;
            color: #000;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }
          .variation-name {
            font-size: 9px;
            color: #000;
            margin-bottom: 0.5px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 100%;
            line-height: 1.1;
            flex-shrink: 0;
            font-weight: 600;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }
          .barcode-image, .barcode-svg {
            max-width: 100%;
            width: 100%;
            height: auto;
            max-height: 50px;
            min-height: 40px;
            margin: 1px 0;
            object-fit: contain;
            flex-shrink: 1;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .barcode-svg {
            display: block;
            margin: 1px auto;
          }
          .barcode-svg svg {
            width: 100%;
            height: auto;
            max-height: 50px;
          }
          .barcode-text {
            font-size: 9px;
            font-weight: bold;
            margin-top: 1px;
            color: #000;
            font-family: 'Courier New', monospace;
            letter-spacing: 0.5px;
            word-break: break-all;
            line-height: 1.2;
            flex-shrink: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .price-info {
            font-size: 10px;
            font-weight: bold;
            margin-top: 1px;
            color: #000;
            line-height: 1.2;
            flex-shrink: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }
          .shop-name {
            font-size: 8px;
            color: #000;
            margin-top: 1px;
            line-height: 1.2;
            flex-shrink: 0;
            font-weight: 600;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }
        </style>
      </head>
      <body>
        <div class="barcode-wrapper">
          ${this.generatePrintHTML(currency, shopName)}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  private generatePrintHTML(currency: string, shopName: string): string {
    let html = '';
    for (let i = 0; i < this.printCount; i++) {
      this.selectedProducts.forEach(product => {
        // If product has variations, print selected variations only
        if (product?.variationList?.length) {
          product.variationList.forEach((variation: any) => {
            const key = `${product._id}:${variation._id}`;
            // Only print if this barcode is selected
            if (!this.isBarcodeSelected(key)) {
              return; // Skip this variation
            }
            const barcodeSvg = this.barcodeSvgs.get(key);
            const barcodeValue = this.getVariationBarcode(variation);
            if (barcodeSvg && barcodeValue) {
              const productName = (product.name || 'Product').substring(0, 30);
              const variationName = variation.name || '';
              const price = this.showPrice ? this.getVariationPrice(variation, product) : null;
          
              html += `
                <div class="barcode-container">
                  ${this.barcodeSettings.showProductName ? `<div class="product-name">${this.escapeHtml(productName)}</div>` : ''}
                  ${
                    this.barcodeSettings.showSkuAndVariant
                      ? (() => {
                          const displaySku =
                            (variation && (variation as any).sku) ||
                            (product && (product as any).sku) ||
                            (product && (product as any).productId) ||
                            '';
                          const hasSku = !!displaySku;
                          const hasVar = !!variationName;
                          const line =
                            (hasSku ? `${displaySku}` : '') +
                            (hasSku && hasVar ? ' / ' : '') +
                            (hasVar ? ` ${variationName}` : '');
                          return line
                            ? `<div class="variation-name">${this.escapeHtml(line)}</div>`
                            : '';
                        })()
                      : ''
                  }
                  <div class="barcode-svg">${barcodeSvg}</div>
                  ${
                    this.barcodeSettings.showBarcodeAndVariant
                      ? (() => {
                          const hasBarcode = !!barcodeValue;
                          const hasVar = !!variationName;
                          const line =
                            (hasBarcode ? `${barcodeValue}` : '') +
                            (hasBarcode && hasVar ? ' / ' : '') +
                            (hasVar ? ` ${variationName}` : '');
                          return line
                            ? `<div class="variation-name">${this.escapeHtml(line)}</div>`
                            : '';
                        })()
                      : this.barcodeSettings.showBarcodeCode
                      ? `<div class="barcode-text">${this.escapeHtml(barcodeValue)}</div>`
                      : ''
                  }
       
                  ${this.barcodeSettings.showPrice && price !== null ? `<div class="price-info">${currency} ${price.toFixed(2)}</div>` : ''}
                  ${this.barcodeSettings.showShopName ? `<div class="shop-name">${this.escapeHtml(shopName)}</div>` : ''}
                </div>
              `;
            }
          });
        } else {
          // If no variations, print product barcode (only if selected)
          const key = `${product._id}:base`;
          // Only print if this barcode is selected
          if (this.isBarcodeSelected(key)) {
            const barcodeSvg = this.barcodeSvgs.get(key);
            const barcodeValue = this.getBarcodeValue(product);
            if (barcodeSvg && barcodeValue) {
              const productName = (product.name || 'Product').substring(0, 30);
              const price = this.showPrice ? this.getPriceValue(product) : null;
              const displaySku =
                (product && (product as any).sku) ||
                (product && (product as any).productId) ||
                '';
            
              html += `
                <div class="barcode-container">
                  ${this.barcodeSettings.showProductName ? `<div class="product-name">${this.escapeHtml(productName)}</div>` : ''}
                  ${
                    this.barcodeSettings.showSkuAndVariant && displaySku
                      ? `<div class="variation-name">${this.escapeHtml(`${displaySku}`)}</div>`
                      : ''
                  }
                  <div class="barcode-svg">${barcodeSvg}</div>
                  ${
                    this.barcodeSettings.showBarcodeAndVariant
                      ? `<div class="variation-name">${this.escapeHtml(barcodeValue)}</div>`
                      : this.barcodeSettings.showBarcodeCode
                      ? `<div class="barcode-text">${this.escapeHtml(barcodeValue)}</div>`
                      : ''
                  }

                  ${this.barcodeSettings.showPrice && price !== null ? `<div class="price-info">${currency} ${price.toFixed(2)}</div>` : ''}
                  ${this.barcodeSettings.showShopName ? `<div class="shop-name">${this.escapeHtml(shopName)}</div>` : ''}
                </div>
              `;
            }
          }
        }
      });
    }
    return html;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update selected products based on selection map
   */
  updateSelectedProducts(): void {
    this.selectedProducts = this.allProducts.filter(product => 
      this.productSelection.get(product._id) === true
    );
    // Regenerate barcodes when selection changes
    if (this.selectedProducts.length > 0) {
      this.generateBarcodes();
    } else {
      this.barcodeDataUrls.clear();
      this.barcodeSvgs.clear();
    }
  }

  /**
   * Toggle product selection
   */
  toggleProductSelection(productId: string): void {
    const currentValue = this.productSelection.get(productId) || false;
    this.productSelection.set(productId, !currentValue);
    this.updateSelectedProducts();
  }

  /**
   * Select all products
   */
  selectAllProducts(): void {
    this.allProducts.forEach(product => {
      this.productSelection.set(product._id, true);
    });
    this.updateSelectedProducts();
  }

  /**
   * Unselect all products
   */
  unselectAllProducts(): void {
    this.allProducts.forEach(product => {
      this.productSelection.set(product._id, false);
    });
    this.updateSelectedProducts();
  }

  /**
   * Check if product is selected
   */
  isProductSelected(productId: string): boolean {
    return this.productSelection.get(productId) === true;
  }

  /**
   * Get count of selected products
   */
  getSelectedCount(): number {
    return this.selectedProducts.length;
  }

  /**
   * Get count of selected barcodes
   */
  getSelectedBarcodeCount(): number {
    let count = 0;
    this.barcodeSelection.forEach((selected) => {
      if (selected) count++;
    });
    return count;
  }

  /**
   * Toggle individual barcode selection
   */
  toggleBarcodeSelection(key: string): void {
    const currentValue = this.barcodeSelection.get(key) || false;
    this.barcodeSelection.set(key, !currentValue);
  }

  /**
   * Check if barcode is selected
   */
  isBarcodeSelected(key: string): boolean {
    return this.barcodeSelection.get(key) === true;
  }

  /**
   * Select all barcodes
   */
  selectAllBarcodes(): void {
    this.barcodeSelection.forEach((value, key) => {
      this.barcodeSelection.set(key, true);
    });
  }

  /**
   * Unselect all barcodes
   */
  unselectAllBarcodes(): void {
    this.barcodeSelection.forEach((value, key) => {
      this.barcodeSelection.set(key, false);
    });
  }

  /**
   * Check if all barcodes are selected
   */
  areAllBarcodesSelected(): boolean {
    if (this.barcodeSelection.size === 0) return false;
    let allSelected = true;
    this.barcodeSelection.forEach((selected) => {
      if (!selected) allSelected = false;
    });
    return allSelected;
  }

  /**
   * Check if all products are selected
   */
  areAllSelected(): boolean {
    return this.allProducts.length > 0 && 
           this.allProducts.every(product => this.productSelection.get(product._id) === true);
  }

  onClose(): void {
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    if (this.subDataOne) {
      this.subDataOne.unsubscribe();
    }
  }
}

