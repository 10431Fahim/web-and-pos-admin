import {AfterViewInit, Component, inject, OnDestroy, ViewChild} from '@angular/core';
import {DataTableSelectionBase} from "../../../mixin/data-table-select-base.mixin";
import {FormBuilder, FormGroup, NgForm} from "@angular/forms";
import {Category} from "../../../interfaces/common/category.interface";
import {SubCategory} from "../../../interfaces/common/sub-category.interface";
import {Select} from "../../../interfaces/core/select";
import {DATA_STATUS, TABLE_TAB_DATA} from "../../../core/utils/app-data";
import {debounceTime, distinctUntilChanged, filter, map, Subscription} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {MatDialog} from "@angular/material/dialog";
import {UiService} from "../../../services/core/ui.service";
import {ReloadService} from "../../../services/core/reload.service";
import {SubCategoryService} from "../../../services/common/sub-category.service";
import {Clipboard} from "@angular/cdk/clipboard";
import {CategoryService} from "../../../services/common/category.service";
import {PageDataService} from "../../../services/core/page-data.service";
import {Title} from "@angular/platform-browser";
import {ProductService} from "../../../services/common/product.service";
import {FilterData} from "../../../interfaces/core/filter-data";
import {Pagination} from "../../../interfaces/core/pagination";
import {ConfirmDialogComponent} from "../../../shared/components/ui/confirm-dialog/confirm-dialog.component";
import {
  TableDetailsDialogComponent
} from "../../../shared/dialog-view/table-details-dialog/table-details-dialog.component";
import {BarcodePrintDialogComponent} from "../../../shared/dialog-view/barcode-print-dialog/barcode-print-dialog.component";
import {ShopService} from "../../../services/common/shop.service";
import {Shop} from "../../../interfaces/common/shop.interface";
import {DATABASE_KEY} from "../../../core/utils/global-variable";
import {StorageService} from "../../../services/core/storage.service";
import {Tag} from "../../../interfaces/common/tag.interface";
import {TagService} from "../../../services/common/tag.service";
import {VendorService} from "../../../services/vendor/vendor.service";
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-all-product',
  templateUrl: './all-product.component.html',
  styleUrl: './all-product.component.scss'
})
export class AllProductComponent extends DataTableSelectionBase(Component) implements AfterViewInit, OnDestroy {

  // Decorator
  @ViewChild('searchForm', {static: true}) private searchForm: NgForm;
  isPopupVisible = false;
  // Form Data
  dataForm?: FormGroup;
  // Store Data
  override allTableData: any[] = [];
  protected categories: Category[] = [];
  protected subCategories: SubCategory[] = [];
  protected dataStatus: Select[] = DATA_STATUS;
  protected tableTabData: Select[] = TABLE_TAB_DATA;
  protected selectedTab: string = this.tableTabData[0].value;
  protected shopId?: string;
  protected shop?: Shop;
  protected tags: Tag[] = [];
  protected adminRole: any;
  protected adminShopId: any;

  // Gallery View
  protected isGalleryOpen: boolean = false;
  protected galleryImages: string[] = [];
  protected selectedImageIndex: number = 0;

  // Pagination
  protected currentPage = 1;
  protected totalData = 0;
  protected dataPerPage = 10;
  selectedPagination = 0;
  // Filter
  filter: any = null;
  defaultFilter: any = null;
  searchQuery = null;
  private sortQuery = {createdAt: -1};
  private readonly select: any = {
    name: 1,
    slug: 1,
    sku: 1,
    variation: 1,
    variationOptions: 1,
    variationList: 1,
    regularPrice: 1,
    variation2: 1,
    variation2Options: 1,
    isVariation: 1,
    salePrice: 1,
    category: 1,
    subCategory: 1,
    images: 1,
    barcode: 1,
    brand: 1,
    costPrice: 1,
    deleteDateString: 1,
    discountType: 1,
    discountAmount: 1,
    quantity: 1,
    status: 1,
    priority: 1,
    totalSold: 1,
    tags: 1,
    createdAt: 1,
  }

  // Loading
  isLoading: boolean = true;

  // Active Data Store
  activeSort: number = null;
  activeFilter1: number = null;
  activeFilter2: number = null;

  importResults: any = null;
  showImportResults = false;


  // Subscriptions
  private subscriptions: Subscription[] = [];
  private subDataOne: Subscription;

  // Inject
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly uiService = inject(UiService);
  private readonly reloadService = inject(ReloadService);
  private readonly subCategoryService = inject(SubCategoryService);
  private readonly clipboard = inject(Clipboard);
  private readonly categoryService = inject(CategoryService);
  // private readonly childCategoryService = inject(ChildCategoryService);
  private readonly pageDataService = inject(PageDataService);
  private readonly title = inject(Title);
  private readonly productService = inject(ProductService);
  private readonly shopService = inject(ShopService);
  private readonly storageService = inject(StorageService);
  private readonly tagService = inject(TagService);
  private readonly fb = inject(FormBuilder);
  private readonly vendorService = inject(VendorService);

  ngOnInit() {
    this.adminRole = this.vendorService.getUserRole();
    this.adminShopId = this.vendorService.getShopId();


    this.initDataForm();
    // Reload Data
    const subReload = this.reloadService.refreshData$.subscribe(() => {
      this.getAllProducts();
    });
    this.subscriptions.push(subReload);

    // Get Data from Param
    const subActivateRoute = this.activatedRoute.queryParamMap.subscribe(qParam => {
      if (qParam && qParam.get('page')) {
        this.currentPage = Number(qParam.get('page'));
      } else {
        this.currentPage = 1;
      }
      if (qParam && qParam.get('search')) {
        this.searchQuery = qParam.get('search');
      }

      this.getAllProducts();
    });

    this.subscriptions.push(subActivateRoute);

    // Base Data
    this.setPageData();
    this.getAllCategories();
    this.getAllSubCategories();
    this.getAllProducts();
    this.initImageGalleryView();
    this.getAllTags();


    this.shopId = this.storageService.getDataFromEncryptLocal(
      DATABASE_KEY.encryptShop
    )?.shop;
    if (this.shopId) {
      this.getShopById();
    }

  }

  private initDataForm() {
    this.dataForm = this.fb.group({
      tags: [null],
    });
  }

  onSubmit() {

    const mData = {
      ...this.dataForm.value,
    }

    if (this.dataForm.value.tags && this.dataForm.value.tags.length) {
      const tags: any[] = [];
      this.dataForm.value.tags.forEach(m => {
        const fTag = this.tags.find(f => m === f._id);
        tags.push(fTag);
      })
      mData.tags = tags
    }
    this.updateMultipleProductById(mData);

    this.isPopupVisible = false;
  }


  ngAfterViewInit(): void {

    const formValue = this.searchForm.valueChanges;
    const subSearch = formValue.pipe(
      map((t: any) => t['searchTerm']),
      filter(() => this.searchForm.valid),
      debounceTime(500),
      distinctUntilChanged(),
    ).subscribe((searchTerm: string) => {
      if (searchTerm) {
        // Update query params with the new search term
        this.router.navigate([], {
          queryParams: {search: searchTerm},
          queryParamsHandling: 'merge'
        }).then();
      } else {
        // Remove search query param when input is empty
        this.router.navigate([], {
          queryParams: {search: null},
          queryParamsHandling: 'merge'
        }).then();
      }
    });

    this.subscriptions.push(subSearch);
  }

  /**
   * Base Init Methods
   * initImageGalleryView()
   */
  private initImageGalleryView() {
    const subGalleryImageView = this.activatedRoute.queryParamMap.subscribe((qParam) => {
      if (!qParam.get('gallery-image-view')) {
        this.closeGallery();
      }
    });
    this.subscriptions.push(subGalleryImageView);
  }

  openPopup() {
    this.isPopupVisible = true;
  }

  closePopup() {
    this.isPopupVisible = false;
  }

  /**
   * Page Data
   * setPageData()
   */
  private setPageData(): void {
    this.title.setTitle('Product');
    this.pageDataService.setPageData({
      title: 'Product',
      navArray: [
        {name: 'Dashboard', url: `/dashboard`},
        {name: 'Product', url: 'https://www.youtube.com/embed/ByDFUgBgBeE?si=tfXJO-lz7l8eCWnC'},
      ]
    })
  }


  /**
   * Handle Tab
   * onTabChange()
   */
  onTabChange(data: string) {
    this.selectedTab = data;
    if (data === 'all') {
      this.filter = null;
    } else {
      this.filter = {status: data}
    }
    this.onClearSelection();
    this.onClearDataQuery(this.filter);
  }

  handleProductNameLinkable(event: any) {
    event?.stopPropagation();
    // const url = `https://${this.shop?.domain}/product-details/${slug}`;
    // window.location.href = url;
  }


  /**
   * HTTP REQ HANDLE
   * getAllCategories()
   * getAllSubCategories()
   * deleteMultipleProductById()
   * updateMultipleUserById()
   */

  private getAllCategories() {
    const filterData: FilterData = {
      pagination: null,
      filter: null,
      select: {
        name: 1,
      },
      sort: {name: 1}
    }
    const subscription = this.categoryService.getAllCategories(filterData, null)
      .subscribe({
        next: res => {
          this.categories = res.data;
        },
        error: error => {
          console.log(error);
        }
      });
    this.subscriptions.push(subscription);
  }

  private getAllSubCategories() {
    const filterData: FilterData = {
      pagination: null,
      filter: null,
      select: {
        name: 1,
      },
      sort: {name: 1}
    }
    const subscription = this.subCategoryService.getAllSubCategories(filterData, null)
      .subscribe({
        next: res => {
          this.subCategories = res.data;
        },
        error: error => {
          console.log(error);
        }
      });
    this.subscriptions.push(subscription);
  }


  private getAllProducts() {
    // console.log('getAllSubCategories')
    const pagination: Pagination = {
      pageSize: Number(this.dataPerPage),
      currentPage: Number(this.currentPage) - 1
    };

    const filterData: FilterData = {
      pagination: pagination,
      filter: {
        ...this.filter,
        ...(this.filter?.status ? {} : {status: {$ne: 'trash'}})
      },
      select: this.select,
      sort: this.sortQuery
    }

    const subscription = this.productService.getAllProducts(filterData, this.searchQuery)
      .subscribe({
        next: res => {
          this.allTableData = res.data;
          this.totalData = res.count ?? 0;
          if (this.allTableData && this.allTableData.length) {
            this.allTableData.forEach((m, i) => {
              const index = this.selectedIds.findIndex(f => f === m._id);
              this.allTableData[i].select = index !== -1;
            });
            this.checkSelectionData();
          }
          this.isLoading = false;
        },
        error: err => {
          this.isLoading = false;
          console.log(err)
        }
      });
    this.subscriptions.push(subscription);
  }

  private getShopById() {
    const subscription = this.shopService.getShopById(this.shopId).subscribe({
      next: (res) => {
        if (res.data) {
          this.shop = res.data;
        }
      },
      error: (error) => {
        console.log(error);
      },
    });
    this.subscriptions.push(subscription);
  }

  private getAllTags() {
    // Select
    const mSelect = {
      name: 1,
      slug: 1
    }

    const filterData: FilterData = {
      pagination: null,
      filter: null,
      select: mSelect,
      sort: {name: 1}
    }


    const subscription = this.tagService.getAllTags(filterData, null)
      .subscribe({
        next: (res) => {
          this.tags = res.data;
        }, error: (error) => {
          console.log(error);
        },
      });
    this.subscriptions.push(subscription);
  }

  private deleteMultipleProductById() {
    const subscription = this.productService.deleteMultipleProductById(this.selectedIds)
      .subscribe({
        next: res => {
          if (res.success) {
            this.selectedIds = [];
            this.uiService.message(res.message, 'success');
            this.checkAndUpdateSelect();
            // fetch Data
            if (this.currentPage > 1) {
              this.router.navigate([], {queryParams: {page: 1}}).then();
            } else {
              this.reloadService.needRefreshData$();
            }
          } else {
            this.uiService.message(res.message, 'warn')
          }
        },
        error: err => {
          console.log(err)
        }
      });
    this.subscriptions.push(subscription);
  }

  private deleteMultipleProductsById() {
    const subscription = this.productService.deleteMultipleProductsById(this.selectedIds)
      .subscribe({
        next: res => {
          if (res.success) {
            this.selectedIds = [];
            this.uiService.message(res.message, 'success');
            this.checkAndUpdateSelect();
            // fetch Data
            if (this.currentPage > 1) {
              this.router.navigate([], {queryParams: {page: 1}}).then();
            } else {
              this.reloadService.needRefreshData$();
            }
          } else {
            this.uiService.message(res.message, 'warn')
          }
        },
        error: err => {
          console.log(err)
        }
      });
    this.subscriptions.push(subscription);
  }

  private updateMultipleProductById(data: any) {
    const subscription = this.productService.updateMultipleProductById(this.selectedIds, data)
      .subscribe({
        next: res => {
          if (res.success) {
            this.selectedIds = [];
            this.checkAndUpdateSelect();
            this.reloadService.needRefreshData$();
            this.uiService.message(res.message, 'success');
            this.dataForm.reset()
          } else {
            this.uiService.message(res.message, 'wrong')
          }
        },
        error: err => {
          console.log(err)
        }
      });
    this.subscriptions.push(subscription);
  }

  /**
   * Product Import from csv
   * onFileSelect()
   * autoGenerateSlugValue()
   */

  // onFileSelect(event: any) {
  //   const file = event.target.files[0];
  //
  //   if (!file) {
  //     this.uiService.message('No file selected.', 'warn');
  //     return;
  //   }
  //
  //   if (!file.name.endsWith('.csv')) {
  //     this.uiService.message('Please upload a valid CSV file.', 'warn');
  //     return;
  //   }
  //
  //   const reader = new FileReader();
  //
  //   reader.onload = (e: any) => {
  //     const csvText = e.target.result;
  //     const lines = csvText.split('\n').filter(line => line.trim() !== '');
  //
  //     const headers = lines[0].split(',').map(h => h.trim());
  //
  //     const parsedData = lines.slice(1).map(line => {
  //       const values = line.split(',').map(v => v.trim());
  //       const obj: any = {};
  //       headers.forEach((header, index) => {
  //         obj[header] = values[index];
  //       });
  //
  //       return {
  //         name: obj.name?.trim(),
  //         slug: this.autoGenerateSlugValue(obj.name),
  //         category: obj.category,
  //         subCategory: obj.subCategory,
  //         costPrice: +obj.costPrice,
  //         salePrice: +obj.salePrice,
  //         regularPrice: +obj.regularPrice,
  //         quantity: +obj.quantity,
  //       };
  //     });
  //
  //     this.productService.bulkImportProducts(parsedData)
  //       .subscribe({
  //         next: (res) => {
  //           if (res.success) {
  //             this.uiService.message('Products imported successfully!', 'success');
  //             setTimeout(() => {
  //               location.reload();
  //             }, 500);
  //           } else {
  //             this.uiService.message(res.message || 'Import failed!', 'warn');
  //           }
  //         },
  //         error: (err) => {
  //           console.error('Error importing products:', err);
  //           this.uiService.message('Something went wrong while importing.', 'warn');
  //         },
  //       });
  //   };
  //
  //   reader.readAsText(file);
  // }

  // onFileSelect(event: any) {
  //   const file = event.target.files[0];
  //   if (!file) return this.uiService.message('No file selected.', 'warn');
  //
  //   const reader = new FileReader();
  //   reader.onload = (e: any) => {
  //     const csvData = e.target.result;
  //     const workbook = XLSX.read(csvData, {type: 'string'}); // CSV as string
  //
  //     const sheetName = workbook.SheetNames[0];
  //     const worksheet = workbook.Sheets[sheetName];
  //     const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
  //
  //     const parsedData = jsonData.map(obj => ({
  //       name: obj['name']?.trim(),
  //       slug: obj['slug']?.trim() || this.autoGenerateSlugValue(obj['name']),
  //       description: obj['description']?.trim() || '',
  //       keyFeature: obj['short_description']?.trim() || '',
  //       category: obj['category']?.toString()?.trim(),
  //       subCategory: obj['sub_category']?.trim(),
  //       childCategory: obj['child_category']?.trim(),
  //       brand: obj['brand']?.trim(),
  //       tags: obj['tags'] ? obj['tags'].split(',').map(t => t.trim()) : [],
  //       costPrice: +obj['unit_price'] || 0,
  //       salePrice: +obj['unit_price'] || 0,
  //       regularPrice: +obj['unit_price'] || 0,
  //       quantity: +obj['current_stock'] || 0,
  //       sku: obj['sku'] || '',
  //       seoTitle: obj['meta_title'] || '',
  //       seoDescription: obj['meta_description'] || '',
  //       photos: obj['photos']?.trim() || '',
  //     }));
  //
  //     this.productService.bulkImportProducts(parsedData).subscribe({
  //       next: (res) => {
  //         if (res.success) {
  //           // this.uiService.message(`✅ Imported: ${res.insertedCount}, ❌ Failed: ${res.failedCount}`, 'success');
  //           // Optional reload:
  //           // setTimeout(() => location.reload(), 500);
  //         } else {
  //           this.uiService.message(res.message || 'Import failed!', 'warn');
  //         }
  //       },
  //       error: (err) => {
  //         console.error('Error importing products:', err);
  //         this.uiService.message('Something went wrong.', 'warn');
  //       },
  //     });
  //   };
  //
  //   reader.readAsText(file); // For CSV
  // }



  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      this.uiService.message('No file selected.','warn');
      return;
    }

    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const csvText = (e.target?.result as string) || '';

        // CSV string -> workbook
        const workbook = XLSX.read(csvText, { type: 'string' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // defval: '' দিলে খালি সেল undefined থাকে না
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        // ---------- helpers ----------
        const trim = (v: any): string => {
          if (v === null || v === undefined) return '';
          return typeof v === 'string' ? v.trim() : String(v).trim();
        };

        const toNum = (v: any, def = 0): number => {
          const n = Number(v);
          return Number.isFinite(n) ? n : def;
        };

        const get = (o: any, ...keys: string[]): any => {
          for (const k of keys) {
            const val = o?.[k];
            if (val !== undefined && val !== null && trim(val) !== '') return val;
          }
          return '';
        };

        // Images/Photos comma / newline / pipe separated হলে এক লাইনে একটি করে normalize
        const normalizeMulti = (v: any): string => {
          const s = trim(v);
          if (!s) return '';
          return s
            .split(/[\n,|]+/)
            .map(x => trim(x))
            .filter(Boolean)
            .join('\n');
        };

        const normalizeTags = (v: any): string[] => {
          const s = trim(v);
          if (!s) return [];
          return s
            .split(/[\n,|,]+/)
            .map(t => trim(t))
            .filter(Boolean);
        };

        // ফাঁকা স্ট্রিংকে null করা (number অপরিবর্তিত, tags খালি হলে [])
        const nullifyEmptyFields = (obj: any) => {
          const out: any = {};
          for (const [key, val] of Object.entries(obj)) {
            if (Array.isArray(val)) {
              out[key] = val.length ? val : [];
            } else if (typeof val === 'string') {
              const t = val.trim();
              out[key] = t === '' ? null : t;
            } else if (val === undefined) {
              out[key] = null;
            } else {
              out[key] = val; // number / boolean / object 그대로
            }
          }
          return out;
        };
        // -----------------------------

        const parsedData = jsonData.map((obj) => {
          const name = trim(get(
            obj,
            'name', 'Name', 'title', 'Title', 'Product_Name', 'product_name'
          ));

          const slugSrc = trim(get(obj, 'slug', 'Slug'));

          const description = trim(get(
            obj,
            'description', 'Description', 'desc', 'Desc', 'long_description'
          ));

          const keyFeature = trim(get(
            obj,
            'short_description', 'Short_Description','Short description', 'keyFeature', 'key_feature'
          ));

          const category = trim(get(obj, 'category', 'Category', 'Categories'));
          const subCategory = trim(get(obj, 'sub_category', 'SubCategory', 'Sub Category'));
          const childCategory = trim(get(obj, 'child_category', 'ChildCategory', 'Child Category'));
          const brand = trim(get(obj, 'brand', 'Brand', 'Company'));

          const tagsArr = normalizeTags(get(obj, 'tags', 'Tags'));

          const unitPrice = toNum(get(obj, 'unit_price', 'UnitPrice', 'price', 'Price', 'salePrice', 'Sale Price'), 0);
          const salePriceCsv = toNum(get(obj, 'Sale price'), NaN);
          const regularPriceCsv = toNum(get(obj, 'Regular price'), NaN);

          const qty = toNum(get(obj, 'current_stock', 'quantity', 'qty', 'Quantity','In stock','In stock?', 'Stock'), 0);
          const sku = trim(get(obj, 'sku', 'SKU'));
          const seoTitle = trim(get(obj, 'meta_title','Meta: rank_math_focus_keyword', 'seoTitle', 'SEO Title'));
          const seoDescription = trim(get(obj, 'meta_description','Meta: rank_math_description', 'seoDescription', 'SEO Description'));
          const seoKeyword = trim(get(obj, 'Meta: rank_math_focus_keyword', ' SeoKeyword', 'Keyword'));

          // photos / images normalize (one URL per line)
          const photos = normalizeMulti(get(obj, 'photos', 'Photos', 'images', 'Images', 'image', 'Image', 'image_urls'));

          // base object
          const base = {
            name,
            slug: slugSrc || this.autoGenerateSlugValue?.(name),
            description,
            shortDescription: keyFeature,
            keyFeature,
            category,
            subCategory,
            childCategory,
            brand,
            tags: tagsArr,                 // [] থাকলে থাকবে
            costPrice: unitPrice,          // চাইলে আলাদা কলাম ম্যাপ করতে পারবে
            salePrice: Number.isFinite(salePriceCsv) ? salePriceCsv : unitPrice,
            regularPrice: Number.isFinite(regularPriceCsv) ? regularPriceCsv : unitPrice,
            quantity: qty,                 // number
            sku,
            seoTitle,
            seoDescription,
            seoKeyword,
            photos,
            images: photos,
          };

          // ফাঁকা স্ট্রিংগুলো null করে রিটার্ন
          return nullifyEmptyFields(base);
        });

        // নাম ছাড়া রো বাদ
        const finalData = parsedData.filter(p => !!p.name);
        console.log('finalData', finalData);

        this.productService.bulkImportProducts(finalData).subscribe({
          next: (res) => {
            console.log('res',res)
            if (res?.success) {
              this.importResults = res;
              this.showImportResults = true;
              this.uiService.message(res.message || 'Products imported successfully.','success');
              this.reloadService?.needRefreshData$?.();
            } else {
              this.uiService.message(res?.message || 'Import failed!','warn');
            }
            if (input) input.value = '';
          },
          error: (err) => {
            console.error('Error importing products:', err);
            this.uiService.message('Something went wrong.','warn');
            if (input) input.value = '';
          },
        });
      } catch (err) {
        console.error('Parse error:', err);
        this.uiService.message('Invalid file format.','warn');
        if (input) input.value = '';
      }
    };

    reader.onerror = () => {
      this.uiService.message('Failed to read file.','warn');
      if (input) input.value = '';
    };

    // CSV পড়ছি
    reader.readAsText(file);
  }


  // onFileSelect(event: any) {
  //   const file = event.target.files[0];
  //   if (!file) return this.uiService.message('No file selected.', 'warn');
  //
  //   const reader = new FileReader();
  //   reader.onload = (e: any) => {
  //     const data = new Uint8Array(e.target.result);
  //     const workbook = XLSX.read(data, { type: 'array' });
  //     const sheetName = workbook.SheetNames[0];
  //     const worksheet = workbook.Sheets[sheetName];
  //     const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
  //
  //     const parsedData = jsonData.map(obj => ({
  //       name: obj['name']?.trim(),
  //       slug: obj['slug']?.trim() || this.autoGenerateSlugValue(obj['name']),
  //       description: obj['description']?.trim() || '',
  //       keyFeature: obj['short_description']?.trim() || '',
  //       category: obj['category']?.toString()?.trim(),
  //       subCategory: obj['sub_category']?.trim(),
  //       childCategory: obj['child_category']?.trim(),
  //       brand: obj['brand']?.trim(),
  //       tags: obj['tags'] ? obj['tags'].split(',').map(t => t.trim()) : [],
  //       costPrice: +obj['unit_price'] || 0,
  //       salePrice: +obj['unit_price'] || 0,
  //       regularPrice: +obj['unit_price'] || 0,
  //       quantity: +obj['current_stock'] || 0,
  //       sku: obj['sku'] || '',
  //       seoTitle: obj['meta_title'] || '',
  //       seoDescription: obj['meta_description'] || '',
  //       photos: obj['photos']?.trim() || '',
  //     }));
  //
  //     this.productService.bulkImportProducts(parsedData).subscribe({
  //       next: (res) => {
  //         if (res.success) {
  //           // this.uiService.message(
  //           //   `✅ Imported: ${res.insertedCount}, ❌ Failed: ${res.failedCount}`,
  //           //   'success'
  //           // );
  //           // setTimeout(() => location.reload(), 500);
  //         } else {
  //           this.uiService.message(res.message || 'Import failed!', 'warn');
  //         }
  //       },
  //       error: (err) => {
  //         console.error('Error importing products:', err);
  //         this.uiService.message('Something went wrong.', 'warn');
  //       },
  //     });
  //   };
  //
  //   reader.readAsArrayBuffer(file);
  // }


  autoGenerateSlugValue(value: string): string {
    if (!value) return '';

    return value
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')  // remove non-alphanumeric except space/dash
      .replace(/\s+/g, '-')      // replace spaces with dash
      .replace(/-+/g, '-')       // collapse multiple dashes
      .replace(/^-+|-+$/g, '');  // remove starting/ending dashes
  }


  /**
   * Filter & Sort Methods
   * reFetchData()
   * sortData()
   * filterData()
   * onClearDataQuery()
   * onClearSearch()
   * isFilterChange()
   */

  private reFetchData() {
    if (this.currentPage > 1) {
      this.router.navigate([], {queryParams: {page: 1}}).then();
    } else {
      this.getAllProducts();
    }
  }

  sortData(query: any, type: number) {
    if (this.activeSort === type) {
      this.sortQuery = {createdAt: -1};
      this.activeSort = null;
    } else {
      this.sortQuery = query;
      this.activeSort = type;
    }
    this.getAllProducts();
  }

  filterData(value: any, type: any, index: number,) {
    switch (type) {
      case 'category': {
        if (value) {
          this.filter = {...this.filter, ...{'category._id': value}};
          this.activeFilter1 = index;
        } else {
          delete this.filter['category._id'];
          this.activeFilter1 = null;
        }
        break;
      }
      case 'subCategory': {
        if (value) {
          this.filter = {...this.filter, ...{'subCategory._id': value}};
          this.activeFilter2 = index;
        } else {
          delete this.filter['subCategory._id'];
          this.activeFilter2 = null;
        }
        break;
      }
      default: {
        break;
      }
    }
    // Re fetch Data
    this.reFetchData();
  }

  onClearDataQuery(filter?: any) {
    this.activeSort = null;
    this.activeFilter1 = null;
    this.sortQuery = {createdAt: -1};
    this.filter = filter ?? null;
    // Re fetch Data
    this.reFetchData();
  }

  onClearSearch() {
    this.searchForm.reset();
    this.searchQuery = null;
    this.router.navigate([], {queryParams: {search: null}}).then();
  }

  get isFilterChange(): boolean {
    if (!this.filter) {
      return false;
    } else {
      return !this.utilsService.checkObjectDeepEqual(this.defaultFilter ?? {}, this.filter ?? {}, 'status');
    }
  }


  /**
   * COMPONENT DIALOG VIEW
   * openConfirmDialog()
   * openDetailsDialog()
   */
  public openConfirmDialog(type: string, data?: any) {
    if (type === 'delete') {
      if (this.selectedTab !== 'trash') {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
          maxWidth: '400px',
          data: {
            title: 'Confirm Delete',
            message: 'Are you sure you want delete this data?'
          }
        });
        dialogRef.afterClosed().subscribe(dialogResult => {
          if (dialogResult) {

            this.deleteMultipleProductsById();
          }
        });
      } else {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
          maxWidth: '400px',
          data: {
            title: 'Confirm Delete',
            message: 'Are you sure you want delete this data?'
          }
        });
        dialogRef.afterClosed().subscribe(dialogResult => {
          if (dialogResult) {
            this.deleteMultipleProductsById();
          }
        });
      }

    } else if (type === 'edit') {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        maxWidth: '400px',
        data: {
          title: 'Confirm Edit',
          message: 'Are you sure you want edit this data?'
        }
      });
      dialogRef.afterClosed().subscribe(dialogResult => {
        if (dialogResult) {
          this.updateMultipleProductById(data);
        }
      });
    } else if (type === 'trash') {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        maxWidth: '400px',
        data: {
          title: 'Confirm Edit',
          message: 'Are you sure you want clean this data?'
        }
      });
      dialogRef.afterClosed().subscribe(dialogResult => {
        if (dialogResult) {
          this.deleteAllTrashByShop();
        }
      });
    } else if (type === 'clone') {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        maxWidth: '400px',
        data: {
          title: 'Confirm Clone',
          message: 'Are you sure you want clone this data?'
        }
      });
      dialogRef.afterClosed().subscribe(dialogResult => {
        if (dialogResult) {
          this.cloneSingleProduct(data);
        }
      });
    } else if (type === 'syncProduct') {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        maxWidth: '400px',
        data: {
          title: 'Confirm sync product',
          message: 'Are you sure you want sync product from api?'
        }
      });
      dialogRef.afterClosed().subscribe(dialogResult => {
        if (dialogResult) {
          this.syncProduct();
        }
      });
    }
  }

  openBarcodePrintDialog(products?: any[]): void {
    // If specific products are passed, use those; otherwise use all products
    // User can select/deselect in the dialog
    const productsToShow = products || this.allTableData;

    if (!productsToShow || productsToShow.length === 0) {
      this.uiService.message('No products available', 'warn');
      return;
    }

    const dialogRef = this.dialog.open(BarcodePrintDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        products: productsToShow
      },
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      // Handle dialog close if needed
    });
  }

  openDetailsDialog(_id: string): void {
    const fData = this.allTableData.find(f => f._id === _id);
    this.dialog.open(TableDetailsDialogComponent, {
      data: fData,
      maxWidth: '800px',
      height: 'auto',
      maxHeight: '90vh'
    });
  }

  private deleteAllTrashByShop() {
    const subscription = this.productService.deleteAllTrashByShop()
      .subscribe({
        next: res => {
          if (res.success) {
            this.uiService.message(res.message, 'success');
            this.checkAndUpdateSelect();
            // fetch Data
            if (this.currentPage > 1) {
              this.router.navigate([], {queryParams: {page: 1}}).then();
            } else {
              this.reloadService.needRefreshData$();
              // this.filter = {status: 'trash'}
            }
            this.selectedTab = 'all';
            this.filter = null;
          } else {
            this.uiService.message(res.message, 'warn')
          }
        },
        error: err => {
          console.log(err)
        }
      });
    this.subscriptions.push(subscription);
  }

  private cloneSingleProduct(id: string) {
    const subscription = this.productService.cloneSingleProduct(id)
      .subscribe({
        next: res => {
          if (res.success) {
            this.uiService.message(res.message, 'success');
            this.reloadService.needRefreshData$();
          } else {
            this.uiService.message(res.message, 'warn');
          }
        }, error: err => {
          console.log(err)
        }
      });
    this.subscriptions.push(subscription);
  }


  /**
   * PAGINATION CHANGE
   * onPageChanged()
   */
  public onPageChanged(event: any) {
    this.currentPage = event;
    this.router.navigate([], {queryParams: {page: event}}).then();
  }

  /**
   * Gallery Image View
   * openGallery()
   * closeGallery()
   * copyToClipboard()
   */
  openGallery(event: any, images: string[], index?: number): void {
    event.stopPropagation();
    if (index) {
      this.selectedImageIndex = index;
    }
    this.galleryImages = images;
    this.isGalleryOpen = true;
    this.router.navigate([], {queryParams: {'gallery-image-view': true}, queryParamsHandling: 'merge'}).then();
  }

  closeGallery(): void {
    this.isGalleryOpen = false;
    this.router.navigate([], {queryParams: {'gallery-image-view': null}, queryParamsHandling: 'merge'}).then();
  }

  onCloseImportResults() {
    this.showImportResults = false;
    this.importResults = null;
  }

  /**
   * Ui Essential
   * getStatusClass()
   * copyToClipboard()
   */
  getStatusClass(status: string) {
    if (status === 'publish') {
      return 'capsule-green';
    } else if (status === 'draft') {
      return 'capsule-orange';
    } else {
      return 'capsule-red';
    }
  }


  copyToClipboard($event: any, text: any): void {
    $event.stopPropagation();
    this.clipboard.copy(text);
    this.uiService.message('Text copied successfully.', 'success');
  }

  public SelectChange(data: any) {
    this.dataPerPage = data;
    this.selectedPagination = data;
  }

  /**
   * Change per page size
   */
  public onChangePerPage(value: number) {
    this.dataPerPage = Number(value);
    this.currentPage = 1;
    this.selectedPagination = value;
    this.reFetchData();
  }

  /**
   * ON Destroy
   */
  ngOnDestroy() {
    if (this.subDataOne) {
      this.subDataOne.unsubscribe();
    }
    this.subscriptions.forEach(sub => sub?.unsubscribe());
  }

  // protected readonly event = event;

  syncProduct() {

    this.subDataOne = this.productService.refreshProducts(this.shopId, true)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.uiService.message(res.message, 'success');
            // reset form or any UI updates
          } else {
            this.uiService.message(res.message, 'warn');
          }
        },
        error: (err) => {
          console.error(err);
          this.uiService.message('Failed to refresh products', 'warn');
        }
      });


  }


}
