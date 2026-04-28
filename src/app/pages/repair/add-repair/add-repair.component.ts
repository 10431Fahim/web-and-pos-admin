import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, NgForm, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { UiService } from '../../../services/core/ui.service';
import { RepairService } from '../../../services/common/repair.service';
import { BrandService } from '../../../services/common/brand.service';
import { ModelService } from '../../../services/common/model.service';
import { ProblemService } from '../../../services/common/problem.service';
import { ProductService } from '../../../services/common/product.service';
import { CustomerService } from '../../../services/common/customer.service';
import { Customer } from '../../../interfaces/common/customer.interface';
import { UtilsService } from '../../../services/core/utils.service';
import { Product, VariationList } from '../../../interfaces/common/product.interface';
import { ReloadService } from '../../../services/core/reload.service';
import { ShopInformationService } from '../../../services/common/shop-information.service';
import { PageDataService } from '../../../services/core/page-data.service';
import { Title } from '@angular/platform-browser';
import { adminBaseMixin } from '../../../mixin/admin-base.mixin';
import { FilterData } from '../../../interfaces/gallery/filter-data';
import { MatDialog } from '@angular/material/dialog';
import { PatternLockComponent } from '../../../shared/components/pattern-lock/pattern-lock.component';
import { SaleService } from '../../../services/common/sale.service';
import { Sale } from '../../../interfaces/common/sale.interface';
import { TechnicianService } from '../../../services/common/technician.service';

@Component({
  selector: 'app-add-repair',
  templateUrl: './add-repair.component.html',
  styleUrls: ['./add-repair.component.scss']
})
export class AddRepairComponent extends adminBaseMixin(Component) implements OnInit, OnDestroy {

  @ViewChild('formElement') formElement: NgForm;
  dataForm?: FormGroup;

  id?: string;
  repair?: any;
  repairData?: any;
  shopInformation: any;
  saleId?: string; // Store sale ID for updates


  // Dropdown data
  brands: any[] = [];
  models: any[] = [];
  problems: any[] = [];
  colors: any[] = []; // For future use if ColorService is added
  technicians: any[] = [];

  // Filtered data for dropdowns
  filterBrandData: any[] = [];
  filterModelData: any[] = [];
  filterProblemData: any[] = [];
  filterColorData: any[] = [];

  // Search controls
  brandSearchControl = new FormControl('');
  modelSearchControl = new FormControl('');
  customerSearchControl = new FormControl('');

  // Customer search
  searchedCustomers: Customer[] = [];
  isSearchingCustomer: boolean = false;

  @ViewChild('brandSearchInput', { static: false }) brandSearchInput: any;
  @ViewChild('modelSearchInput', { static: false }) modelSearchInput: any;

  // Parts functionality
  parts: any[] = [];
  allProducts: Product[] = [];
  productSearchQuery: string = '';
  searchProducts: Product[] = [];
  searchResultsWithVariations: any[] = [];

  today: Date = new Date();
  isLoading: boolean = false;

  private subscriptions: Subscription[] = [];

  private readonly fb = inject(FormBuilder);
  private readonly uiService = inject(UiService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly repairService = inject(RepairService);
  private readonly brandService = inject(BrandService);
  private readonly modelService = inject(ModelService);
  private readonly problemService = inject(ProblemService);
  private readonly productService = inject(ProductService);
  private readonly customerService = inject(CustomerService);
  private readonly utilsService = inject(UtilsService);
  private readonly reloadService = inject(ReloadService);
  private readonly shopInformationService = inject(ShopInformationService);
  private readonly router = inject(Router);
  private readonly pageDataService = inject(PageDataService);
  private readonly title = inject(Title);
  private readonly dialog = inject(MatDialog);
  private readonly saleService = inject(SaleService);
  private readonly technicianService = inject(TechnicianService);

  ngOnInit(): void {
    this.initDataForm();
    this.setPageData();

    const subRoute = this.activatedRoute.paramMap.subscribe((param) => {
      this.id = param.get('id');
      if (this.id) {
        this.getRepairById();
      }
    });
    this.subscriptions.push(subRoute);

    // Reload subscriptions
    const subReload = this.reloadService.refreshData$.subscribe(() => {
      this.getAllBrand();
      this.getAllModel();
      this.getAllProblem();
      this.getAllTechnician();
    });
    this.subscriptions.push(subReload);

    this.getAllBrand();
    this.getAllModel();
    this.getAllProblem();
    this.getAllTechnician();
    this.getAllProducts();
    this.getShopInformation();
    this.setupSearch();
    this.setupBrandChangeListener();
    this.setupCustomerSearch();
    this.setupCustomerAutoListeners();
  }

  private setupSearch() {
    // Brand search
    const subBrandSearch = this.brandSearchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe((searchTerm: string) => {
        this.getAllBrand(searchTerm || '');
      });
    this.subscriptions.push(subBrandSearch);

    // Model search
    const subModelSearch = this.modelSearchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe((searchTerm: string) => {
        const selectedBrandId = this.dataForm?.value?.brand;
        this.getAllModel(selectedBrandId, searchTerm || '');
      });
    this.subscriptions.push(subModelSearch);
  }

  /**
   * Handle brand select opened - focus search input
   */
  onBrandSelectOpened() {
    setTimeout(() => {
      if (this.brandSearchInput?.nativeElement) {
        this.brandSearchInput.nativeElement.focus();
      }
    }, 100);
  }

  /**
   * Handle model select opened - focus search input
   */
  onModelSelectOpened() {
    setTimeout(() => {
      if (this.modelSearchInput?.nativeElement) {
        this.modelSearchInput.nativeElement.focus();
      }
    }, 100);
  }

  private setupBrandChangeListener() {
    const subBrandChange = this.dataForm?.get('brand')?.valueChanges
      .subscribe((brandId: string) => {
        // Reset model selection when brand changes
        this.dataForm?.patchValue({ modelNo: null });
        // Enable/disable model field based on brand selection
        if (brandId) {
          this.dataForm?.get('modelNo')?.enable();
        } else {
          this.dataForm?.get('modelNo')?.disable();
        }
        // Filter models by selected brand
        this.getAllModel(brandId, this.modelSearchControl.value || '');
      });
    if (subBrandChange) {
      this.subscriptions.push(subBrandChange);
    }

    // Set initial disabled state for modelNo
    if (!this.dataForm?.get('brand')?.value) {
      this.dataForm?.get('modelNo')?.disable();
    }
  }

  private setPageData(): void {
    const pageTitle = this.id ? 'Edit Repair' : 'Add Repair';
    this.title.setTitle(pageTitle);
    this.pageDataService.setPageData({
      title: pageTitle,
      navArray: [
        { name: 'Dashboard', url: `/dashboard` },
        { name: 'Repair', url: `/repair` },
        { name: pageTitle, url: '' },
      ]
    });
  }

  private initDataForm() {
    this.dataForm = this.fb.group({
      date: [new Date(), Validators.required],
      deliveredDate: [null],
      repairFor: [null],
      nricNo: [null],
      customerName: [null],
      phoneNo: [null, Validators.required],
      status: ['Pending'],
      brand: [null, Validators.required],
      modelNo: [{ value: null, disabled: true }, Validators.required], // Disabled by default until brand is selected
      color: [null], // Optional - ColorService not available
      imeiNo: [null],
      problem: [[], Validators.required],
      purchase: [null],
      condition: [null, Validators.required],
      password: [null],
      pattern: [null],
      amount: [null],
      description: [null],
      images: [null],
      technician: [null],
    });

    // Setup status listener for auto-date
    this.dataForm.get('status').valueChanges.subscribe(status => {
      if (status === 'Delivered') {
        if (!this.dataForm.get('deliveredDate').value) {
          this.dataForm.patchValue({ deliveredDate: new Date() });
        }
      }
    });

    // Setup listeners
  }

  /**
   * Setup customer search with autocomplete
   */
  private setupCustomerSearch() {
    const subCustomerSearch = this.customerSearchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe((searchTerm: any) => {
        // Only search if it's a string (not when customer object is selected)
        if (typeof searchTerm === 'string' && searchTerm && searchTerm.trim().length > 0) {
          console.log('Searching for customer:', searchTerm.trim());
          this.searchCustomers(searchTerm.trim());
        } else if (!searchTerm || searchTerm === '') {
          this.searchedCustomers = [];
        }
      });
    this.subscriptions.push(subCustomerSearch);
  }

  /**
   * Display name of customer in autocomplete
   */
  displayCustomerFn(customer: any): string {
    return customer && customer.name ? customer.name : '';
  }

  /**
   * Setup auto-fill and auto-add listeners
   */
  private setupCustomerAutoListeners() {
    // Listen to phone number changes for auto-fill and auto-add
    const subPhoneNo = this.dataForm?.get('phoneNo')?.valueChanges
      .pipe(
        debounceTime(800),
        distinctUntilChanged()
      )
      .subscribe((phoneNo: string) => {
        if (phoneNo && phoneNo.length >= 10) {
          this.checkAndFillCustomerByPhone(phoneNo);
          this.addCustomerIfNotExists();
        }
      });
    if (subPhoneNo) {
      this.subscriptions.push(subPhoneNo);
    }

    // Listen to name changes for auto-add
    const subName = this.dataForm?.get('customerName')?.valueChanges
      .pipe(
        debounceTime(1500),
        distinctUntilChanged()
      )
      .subscribe((name: string) => {
        if (name && name.trim().length > 2) {
          this.addCustomerIfNotExists();
        }
      });
    if (subName) {
      this.subscriptions.push(subName);
    }
  }

  /**
   * Search customers by name or phone
   */
  private searchCustomers(searchTerm: string) {
    this.isSearchingCustomer = true;

    const filter: FilterData = {
      filter: null,
      pagination: null,
      select: {
        name: 1,
        phone: 1,
        email: 1,
        address: 1,
      },
      sort: { createdAt: -1 },
    };

    const subscription = this.customerService.getAllCustomers(filter, searchTerm)
      .subscribe({
        next: (res: any) => {
          this.isSearchingCustomer = false;
          console.log('Customer search response:', res);
          if (res.success && res.data) {
            this.searchedCustomers = res.data;
            console.log('Search results count:', this.searchedCustomers.length);
          } else {
            console.log('No data or success false in search res');
            this.searchedCustomers = [];
          }
        },
        error: (error) => {
          this.isSearchingCustomer = false;
          this.searchedCustomers = [];
          console.error('Customer search error:', error);
        }
      });
    this.subscriptions.push(subscription);
  }

  /**
   * Check if customer exists by phone and auto-fill name
   */
  private checkAndFillCustomerByPhone(phoneNo: string) {
    const filter: FilterData = {
      filter: { phone: phoneNo },
      pagination: null,
      select: {
        name: 1,
        phone: 1,
        email: 1,
        address: 1,
      },
      sort: { createdAt: -1 },
    };

    const subscription = this.customerService.getAllCustomers(filter, null)
      .subscribe({
        next: (res: any) => {
          if (res.success && res.data && res.data.length > 0) {
            // Customer exists, auto-fill the name if it's currently empty
            const customer = res.data[0];
            const currentName = this.dataForm?.get('customerName')?.value;
            if (!currentName || currentName.trim() === '') {
              this.dataForm?.patchValue({
                customerName: customer.name
              });
              console.log('Customer found by phone and auto-filled:', customer.name);
            }
          }
        },
        error: (error) => {
          console.log('Error checking customer by phone:', error);
        }
      });
    this.subscriptions.push(subscription);
  }

  /**
   * Add customer to list if not exists
   */
  private addCustomerIfNotExists() {
    const phoneNo = this.dataForm?.get('phoneNo')?.value;
    const customerName = this.dataForm?.get('customerName')?.value;

    if (!phoneNo || phoneNo.length < 10 || !customerName || customerName.trim().length < 3) {
      return;
    }

    const customerData: Customer = {
      name: customerName.trim(),
      phone: phoneNo.trim(),
      customerGroup: 'General',
      walletBalance: 0,
      smsEnabled: true,
      emailEnabled: true,
    };

    const subscription = this.customerService.addCustomer(customerData)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            console.log('Customer added successfully:', res.data?.name || customerName);
          }
        },
        error: (error) => {
          // Silent fail often means customer already exists
        }
      });
    this.subscriptions.push(subscription);
  }

  /**
   * Handle customer selection from autocomplete
   */
  onCustomerSelected(event: any) {
    const customer = event.option.value;
    if (customer && typeof customer === 'object') {
      console.log('Selected customer:', customer);
      this.dataForm?.patchValue({
        customerName: customer.name,
        phoneNo: customer.phone
      }, { emitEvent: false }); // Avoid triggering auto-add immediately

      // Clear the search field after selection
      setTimeout(() => {
        this.customerSearchControl.setValue('', { emitEvent: false });
        this.searchedCustomers = [];
      }, 100);
    }
  }

  /**
   * Clear customer search
   */
  clearCustomerSearch() {
    this.customerSearchControl.setValue('', { emitEvent: false });
    this.searchedCustomers = [];
  }

  private setFormValue() {
    // First, handle the problem field separately to ensure it's always an array
    let problemValue: any[] = [];
    if (this.repair?.problem) {
      if (Array.isArray(this.repair.problem)) {
        problemValue = this.repair.problem.map((p: any) => p._id || p);
      } else {
        // Single problem - convert to array for multiple select
        const problemId = this.repair.problem._id || this.repair.problem;
        if (problemId) {
          problemValue = [problemId];
        }
      }
    }

    // Create a copy of repair object without the problem field to avoid non-array value
    const repairData = { ...this.repair };
    delete repairData.problem; // Remove problem from the object to handle separately

    const patchData: any = {};

    if (this.repair?.date) {
      patchData.date = new Date(this.repair.date);
    }
    if (this.repair?.deliveredDate) {
      patchData.deliveredDate = new Date(this.repair.deliveredDate);
    }
    if (this.repair?.pattern) {
      patchData.pattern = this.repair.pattern;
    }

    if (Object.keys(patchData).length > 0) {
      this.dataForm.patchValue(patchData);
    }
    // Patch repair data without problem field
    this.dataForm.patchValue(repairData);

    // Now set the problem field as an array
    this.dataForm.patchValue({
      problem: problemValue
    });

    if (this.repair?.brand) {
      const brandId = this.repair.brand._id || this.repair.brand;
      // Enable modelNo when brand is set
      this.dataForm?.get('modelNo')?.enable();
      this.dataForm.patchValue({
        brand: brandId
      });
      // Load models for the selected brand
      this.getAllModel(brandId);
    }

    if (this.repair?.modelNo) {
      this.dataForm.patchValue({
        modelNo: this.repair.modelNo._id || this.repair.modelNo
      });
    }


    if (this.repair?.color) {
      this.dataForm.patchValue({
        color: this.repair.color._id || this.repair.color
      });
    }
  }

  onSubmit() {
    if (this.dataForm.invalid) {
      this.uiService.message('Please fill all the required fields', 'warn');
      return;
    }

    let mData = {
      ...this.dataForm.value,
      ...{
        dateString: this.utilsService.getDateString(this.dataForm.value.date),
        month: this.utilsService.getDateMonth(false, this.dataForm.value.date),
        year: this.utilsService.getDateYear(new Date(this.dataForm.value.date)),
      }
    };

    // Set brand object
    if (this.dataForm.value.brand) {
      const selectedBrand = this.brands.find((f) => f._id === this.dataForm.value.brand);
      if (selectedBrand) {
        mData = {
          ...mData,
          brand: {
            _id: selectedBrand._id,
            name: selectedBrand.name,
          }
        };
      }
    }

    // Set model object
    if (this.dataForm.value.modelNo) {
      const selectedModel = this.models.find((f) => f._id === this.dataForm.value.modelNo);
      if (selectedModel) {
        mData = {
          ...mData,
          modelNo: {
            _id: selectedModel._id,
            name: selectedModel.name,
          }
        };
      }
    }

    // Set problem objects (handle array)
    if (this.dataForm.value.problem && Array.isArray(this.dataForm.value.problem) && this.dataForm.value.problem.length > 0) {
      const selectedProblems = this.dataForm.value.problem
        .map((problemId: string) => this.problems.find((f) => f._id === problemId))
        .filter((p: any) => p !== undefined)
        .map((p: any) => ({
          _id: p._id,
          name: p.name,
        }));

      if (selectedProblems.length > 0) {
        mData = {
          ...mData,
          problem: selectedProblems.length === 1 ? selectedProblems[0] : selectedProblems, // Single problem as object, multiple as array
        };
      }
    }

    // Set color object if available
    if (this.dataForm.value.color && this.colors.length > 0) {
      const selectedColor = this.colors.find((f) => f._id === this.dataForm.value.color);
      if (selectedColor) {
        mData = {
          ...mData,
          color: {
            _id: selectedColor._id,
            name: selectedColor.name,
          }
        };
      }
    }

    // Set technician object
    if (this.dataForm.value.technician) {
      const selectedTechnician = this.technicians.find((f) => f._id === this.dataForm.value.technician);
      if (selectedTechnician) {
        mData = {
          ...mData,
          technician: {
            _id: selectedTechnician._id,
            name: selectedTechnician.name,
          }
        };
      }
    }

    // Add parts data separately
    const partsData = this.parts.map(part => ({
      product: {
        _id: part.productId,
        name: part.product.name,
        sku: part.product.sku,
        images: part.product.images || [],
      },
      quantity: part.quantity,
      unitPrice: part.unitPrice,
      totalPrice: part.totalPrice,
    }));

    mData.parts = partsData;
    mData.partsAmount = this.getPartsTotal();

    // Only include saleId if status is 'Delivered' and parts exist
    if (this.saleId && partsData.length > 0 && this.dataForm?.get('status')?.value === 'Delivered') {
      mData.saleId = this.saleId;
    } else {
      mData.saleId = null;
    }

    if (this.id) {
      this.updateRepairById(mData);
    } else {
      this.addRepair(mData);
    }
  }

  /**
   * Get all technicians
   */
  private getAllTechnician() {
    const filter: FilterData = {
      filter: { status: 'Active' },
      pagination: null,
      select: { name: 1, phoneNo: 1 },
      sort: { name: 1 },
    };

    const subscription = this.technicianService.getAllTechniciansByShop(filter)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.technicians = res.data;
          }
        },
        error: (error) => {
          console.error('Error fetching technicians:', error);
        }
      });
    this.subscriptions.push(subscription);
  }

  private getRepairById() {
    this.isLoading = true;
    const subscription = this.repairService.getRepairById(this.id)
      .subscribe({
        next: (res: any) => {
          this.isLoading = false;
          if (res.data) {
            this.repair = res.data;
            this.parts = this.repair.parts || [];
            this.saleId = this.repair.saleId || null; // Get existing saleId
            this.setFormValue();
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.log(error);
        }
      });
    this.subscriptions.push(subscription);
  }

  private addRepair(data: any) {
    this.isLoading = true;
    const subscription = this.repairService.addRepair(data)
      .subscribe({
        next: (res: any) => {
          this.isLoading = false;
          if (res.success) {
            const repairId = res.data?._id;

            // Create sale for parts only if status is 'Delivered'
            if (this.parts && this.parts.length > 0 && this.dataForm?.get('status')?.value === 'Delivered') {
              this.createOrUpdateSaleForParts(data, repairId);
            }

            this.uiService.message(res.message || 'Repair added successfully', 'success');
            setTimeout(() => {
              this.formElement.resetForm();
              this.router.navigate(['/repair/repair-list']).then();
            }, 1000);
          } else {
            this.uiService.message(res.message || 'Failed to add repair', 'warn');
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.log(error);
        }
      });
    this.subscriptions.push(subscription);
  }

  private updateRepairById(data: any) {
    this.isLoading = true;
    const subscription = this.repairService.updateRepairById(this.repair._id, data)
      .subscribe({
        next: (res: any) => {
          this.isLoading = false;
          if (res.success) {
            // Update sale for parts only if status is 'Delivered'
            if (this.parts && this.parts.length > 0 && this.dataForm?.get('status')?.value === 'Delivered') {
              this.createOrUpdateSaleForParts(data, this.repair._id);
            } else {
              // If no parts or not delivered, delete the sale if it exists
              if (this.saleId) {
                this.deleteSaleForRepair();
              }
            }

            this.uiService.message(res.message || 'Repair updated successfully', 'success');
            this.reloadService.needRefreshData$();
            setTimeout(() => {
              this.router.navigate(['/repair/repair-list']).then();
            }, 1000);
          } else {
            this.uiService.message(res.message || 'Failed to update repair', 'warn');
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.log(error);
        }
      });
    this.subscriptions.push(subscription);
  }

  private getShopInformation() {
    const subscription = this.shopInformationService.getShopInformation()
      .subscribe({
        next: (res: any) => {
          if (res.data) {
            this.shopInformation = res.data;
          }
        },
        error: (err) => {
          console.log(err);
        }
      });
    this.subscriptions.push(subscription);
  }

  private getAllBrand(searchQuery?: string) {
    const mSelect = {
      name: 1,
    };

    const filter: FilterData = {
      filter: null,
      pagination: null,
      select: mSelect,
      sort: { createdAt: -1 },
    };

    const searchTerm = searchQuery || this.brandSearchControl.value || '';

    // Use getAllBrands1 which uses get-all endpoint (doesn't require shop parameter)
    const subscription = this.brandService.getAllBrands1(filter, searchTerm || null)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.brands = res.data || [];
            this.filterBrandData = [...this.brands];
          } else {
            console.log('Brand loading failed:', res);
          }
        },
        error: (err) => {
          console.log('Brand loading error:', err);
          // Try fallback to getAllBrands if getAllBrands1 fails
          this.brandService.getAllBrands(filter, searchTerm || null)
            .subscribe({
              next: (res: any) => {
                if (res.success) {
                  this.brands = res.data || [];
                  this.filterBrandData = [...this.brands];
                }
              },
              error: (err2) => {
                console.log('Fallback brand loading error:', err2);
              }
            });
        },
      });
    this.subscriptions.push(subscription);
  }

  private getAllModel(brandId?: string, searchQuery?: string) {
    const mSelect = {
      name: 1,
      brand: 1,
    };

    const filter: FilterData = {
      filter: brandId ? { 'brand._id': brandId } : null,
      pagination: null,
      select: mSelect,
      sort: { createdAt: -1 },
    };

    const searchTerm = searchQuery || this.modelSearchControl.value || '';

    // Use getAllModels1 which uses get-all endpoint (doesn't require shop parameter)
    const subscription = this.modelService.getAllModels1(filter, searchTerm || null)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.models = res.data || [];
            // Apply client-side filtering as backup
            this.filterModelsByBrand(brandId);
          } else {
            console.log('Model loading failed:', res);
          }
        },
        error: (err) => {
          console.log('Model loading error:', err);
          // Try fallback to getAllModels if getAllModels1 fails
          this.modelService.getAllModels(filter, searchTerm || null)
            .subscribe({
              next: (res: any) => {
                if (res.success) {
                  this.models = res.data || [];
                  // Apply client-side filtering as backup
                  this.filterModelsByBrand(brandId);
                }
              },
              error: (err2) => {
                console.log('Fallback model loading error:', err2);
              }
            });
        },
      });
    this.subscriptions.push(subscription);
  }

  private filterModelsByBrand(brandId?: string) {
    if (!brandId) {
      this.filterModelData = [...this.models];
      return;
    }

    // Filter models by brand - handle different brand object structures
    this.filterModelData = this.models.filter(model => {
      if (!model.brand) {
        return false;
      }

      // Handle brand as object with _id
      if (typeof model.brand === 'object' && model.brand._id) {
        return model.brand._id === brandId || model.brand._id.toString() === brandId;
      }

      // Handle brand as direct _id string
      if (typeof model.brand === 'string') {
        return model.brand === brandId;
      }

      return false;
    });
  }

  private getAllProblem() {
    const mSelect = {
      name: 1,
    };

    const filter: FilterData = {
      filter: null,
      pagination: null,
      select: mSelect,
      sort: { createdAt: -1 },
    };

    // Use getAllProblems1 which uses get-all endpoint (doesn't require shop parameter)
    const subscription = this.problemService.getAllProblems1(filter, null)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.problems = res.data || [];
            this.filterProblemData = [...this.problems];
          } else {
            console.log('Problem loading failed:', res);
          }
        },
        error: (err) => {
          console.log('Problem loading error:', err);
          // Try fallback to getAllProblems if getAllProblems1 fails
          this.problemService.getAllProblems(filter, null)
            .subscribe({
              next: (res: any) => {
                if (res.success) {
                  this.problems = res.data || [];
                  this.filterProblemData = [...this.problems];
                }
              },
              error: (err2) => {
                console.log('Fallback problem loading error:', err2);
              }
            });
        },
      });
    this.subscriptions.push(subscription);
  }


  /**
   * Open Pattern Lock Dialog
   */
  openPatternLock() {
    const currentPattern = this.dataForm?.get('pattern')?.value || '';
    const dialogRef = this.dialog.open(PatternLockComponent, {
      width: '450px',
      maxWidth: '90vw',
      data: { pattern: currentPattern },
      disableClose: false
    });

    dialogRef.afterClosed().subscribe((pattern: string) => {
      if (pattern) {
        this.dataForm?.patchValue({ pattern: pattern });
        this.uiService.message('Pattern saved successfully', 'success');
      }
    });
  }

  /**
   * PARTS FUNCTIONALITY
   */
  private getAllProducts() {
    const mSelect = {
      _id: 1,
      name: 1,
      sku: 1,
      salePrice: 1,
      purchasePrice: 1,
      costPrice: 1,
      quantity: 1,
      images: 1,
      isVariation: 1,
      variationList: 1,
    };

    const filter: FilterData = {
      filter: { status: { $ne: 'trash' } },
      pagination: null,
      select: mSelect,
      sort: { createdAt: -1 },
    };

    const subscription = this.productService.getAllProducts(filter, null).subscribe({
      next: (res) => {
        if (res.success) {
          this.allProducts = res.data || [];
        }
      },
      error: (err) => console.error('Error loading products:', err)
    });
    this.subscriptions.push(subscription);
  }

  onProductSearch(query: string) {
    this.productSearchQuery = query;
    if (query && query.length > 0) {
      const searchTerm = query.toLowerCase().trim();
      this.searchProducts = this.allProducts.filter(p => {
        const name = this.utilsService.getProductName(p)?.toLowerCase() || '';
        const sku = p.sku?.toLowerCase() || '';
        return name.includes(searchTerm) || sku.includes(searchTerm);
      }).slice(0, 10);

      this.searchResultsWithVariations = [];
      this.searchProducts.forEach(product => {
        if (product.variationList && product.variationList.length > 0) {
          product.variationList.forEach((variation: VariationList) => {
            this.searchResultsWithVariations.push({
              product: product,
              variation: variation,
              isVariation: true,
              displayName: `${product.name} - ${variation.name || 'Variation'}`,
              price: variation.salePrice || variation.regularPrice || product.salePrice || 0,
              stock: variation.quantity || 0,
              sku: variation.sku || product.sku,
            });
          });
        } else {
          this.searchResultsWithVariations.push({
            product: product,
            variation: null,
            isVariation: false,
            displayName: this.utilsService.getProductName(product),
            price: product.salePrice || 0,
            stock: product.quantity || 0,
            sku: product.sku,
          });
        }
      });
    } else {
      this.searchProducts = [];
      this.searchResultsWithVariations = [];
    }
  }

  onSelectSearchItem(item: any) {
    const existingIndex = this.parts.findIndex(p =>
      p.productId === item.product._id &&
      (!item.isVariation || p.selectedVariationId === item.variation._id)
    );

    if (existingIndex === -1) {
      const unitPrice = item.isVariation
        ? (item.variation.salePrice || item.variation.regularPrice || item.product.salePrice || 0)
        : (item.product.salePrice || 0);

      this.parts.push({
        productId: item.product._id,
        product: {
          _id: item.product._id,
          name: item.displayName,
          sku: item.sku,
          images: item.product.images || [],
        },
        selectedVariationId: item.isVariation ? item.variation._id : null,
        quantity: 1,
        unitPrice: unitPrice,
        totalPrice: unitPrice * 1,
      });
    } else {
      this.parts[existingIndex].quantity += 1;
      this.parts[existingIndex].totalPrice = this.parts[existingIndex].quantity * this.parts[existingIndex].unitPrice;
    }

    this.productSearchQuery = '';
    this.searchResultsWithVariations = [];
  }

  incrementPartQuantity(index: number) {
    this.parts[index].quantity += 1;
    this.parts[index].totalPrice = this.parts[index].quantity * this.parts[index].unitPrice;
  }

  decrementPartQuantity(index: number) {
    if (this.parts[index].quantity > 1) {
      this.parts[index].quantity -= 1;
      this.parts[index].totalPrice = this.parts[index].quantity * this.parts[index].unitPrice;
    }
  }

  updatePartQuantity(index: number, quantity: number) {
    if (quantity >= 1) {
      this.parts[index].quantity = quantity;
      this.parts[index].totalPrice = this.parts[index].quantity * this.parts[index].unitPrice;
    }
  }

  updatePartPrice(index: number, price: number) {
    if (price >= 0) {
      this.parts[index].unitPrice = price;
      this.parts[index].totalPrice = this.parts[index].quantity * this.parts[index].unitPrice;
    }
  }

  removePart(index: number) {
    this.parts.splice(index, 1);
  }

  getPartsTotal(): number {
    return this.parts.reduce((sum, part) => sum + (part.totalPrice || 0), 0);
  }

  getRepairAmount(): number {
    const amount = this.dataForm?.get('amount')?.value;
    return amount ? parseFloat(amount.toString()) : 0;
  }

  getTotalAmount(): number {
    const partsTotal = this.getPartsTotal();
    const repairAmount = this.getRepairAmount();
    return partsTotal + repairAmount;
  }

  /**
   * Create or update sale for repair parts
   */
  private createOrUpdateSaleForParts(repairData: any, repairId?: string) {
    // Only create/update sale if there are parts
    if (!this.parts || this.parts.length === 0) {
      // If no parts and sale exists, delete the sale
      if (this.saleId) {
        this.deleteSaleForRepair();
      }
      return;
    }

    // Convert parts to sale products format
    const saleProducts = this.parts.map(part => {
      const fullProduct = this.allProducts.find(p => p._id === part.productId);

      const productData: any = {
        _id: part.productId,
        name: part.product.name,
        sku: part.product.sku || '',
        salePrice: part.unitPrice,
        soldQuantity: part.quantity,
        saleType: 'Sale',
        itemDiscount: 0,
        itemDiscountType: 0,
        itemDiscountAmount: 0,
        purchasePrice: fullProduct?.costPrice || 0,
        costPrice: fullProduct?.costPrice || 0,
        quantity: fullProduct?.quantity || 0,
        images: part.product.images || [],
      };

      // Handle variation if exists
      if (part.selectedVariationId && fullProduct?.variationList) {
        const variation = fullProduct.variationList.find(
          (v: any) => v._id === part.selectedVariationId
        );
        if (variation) {
          productData.selectedVariationId = variation._id;
          productData.selectedVariation = variation;
          productData.variationName = variation.name;
          productData.purchasePrice = variation.costPrice || 0;
          productData.costPrice = variation.costPrice || 0;
        }
      }

      return productData;
    });

    // Calculate sale totals
    const subTotal = this.getPartsTotal();
    const totalPurchasePrice = saleProducts.reduce((sum, p) => {
      return sum + ((p.purchasePrice || 0) * (p.soldQuantity || 0));
    }, 0);

    // Prepare customer data
    const customerData = repairData.phoneNo ? {
      name: repairData.customerName || `Customer ${repairData.phoneNo}`,
      phone: repairData.phoneNo,
      address: null,
    } : null;

    // Ensure date is a Date object
    const saleDate = repairData.date
      ? (repairData.date instanceof Date ? repairData.date : new Date(repairData.date))
      : new Date();

    // Prepare sale data
    const saleData: Sale = {
      customer: customerData,
      products: saleProducts,
      soldDate: saleDate,
      soldDateString: this.utilsService.getDateString(saleDate),
      soldTime: this.utilsService.getCurrentTime(),
      discount: 0,
      discountAmount: 0,
      discountType: 0,
      usePoints: 0,
      pointsDiscount: 0,
      vatAmount: 0,
      tax: 0,
      ait: 0,
      serviceCharge: 0,
      total: subTotal,
      subTotal: subTotal,
      totalPurchasePrice: totalPurchasePrice,
      paidAmount: subTotal,
      receivedFromCustomer: subTotal,
      paymentType: 'cash',
      status: 'Sale',
      referenceNo: repairId ? `Repair #${repairId.substring(0, 8)}` : 'Repair Parts', // Show repair reference
      month: this.utilsService.getDateMonth(false, saleDate),
      year: this.utilsService.getDateYear(saleDate),
    };

    // Add repair reference to sale
    (saleData as any).repairId = repairId;

    if (this.saleId) {
      // Update existing sale
      this.updateSaleForRepair(saleData);
    } else {
      // Create new sale
      this.createSaleForRepair(saleData, repairId);
    }
  }

  /**
   * Create sale for repair parts
   */
  private createSaleForRepair(saleData: Sale, repairId?: string) {
    const subscription = this.saleService.addSale(saleData)
      .subscribe({
        next: (res: any) => {
          if (res.success && res.data) {
            this.saleId = res.data._id;
            // Update repair with saleId
            if (repairId && this.saleId) {
              this.updateRepairWithSaleId(repairId, this.saleId);
            }
            console.log('Sale created for repair parts:', res.data);
          } else {
            console.error('Failed to create sale for repair:', res.message);
          }
        },
        error: (error) => {
          console.error('Error creating sale for repair:', error);
        }
      });
    this.subscriptions.push(subscription);
  }

  /**
   * Update sale for repair parts
   */
  private updateSaleForRepair(saleData: Sale) {
    if (!this.saleId) return;

    const subscription = this.saleService.updateSaleById(this.saleId, saleData)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            console.log('Sale updated for repair parts');
          } else {
            console.error('Failed to update sale for repair:', res.message);
            // If the sale was not found, create a new one
            if (res.message === 'Sale not found') {
               this.createSaleForRepair(saleData, (saleData as any).repairId || this.id);
            }
          }
        },
        error: (error) => {
          console.error('Error updating sale for repair:', error);
          if (error && error.status === 404) {
             this.createSaleForRepair(saleData, (saleData as any).repairId || this.id);
          }
        }
      });
    this.subscriptions.push(subscription);
  }

  /**
   * Update repair with saleId
   */
  private updateRepairWithSaleId(repairId: string, saleId: string) {
    const updateData = { saleId: saleId };
    const subscription = this.repairService.updateRepairById(repairId, updateData)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            console.log('Repair updated with saleId');
          }
        },
        error: (error) => {
          console.error('Error updating repair with saleId:', error);
        }
      });
    this.subscriptions.push(subscription);
  }

  /**
   * Delete sale if parts are removed
   */
  private deleteSaleForRepair() {
    if (!this.saleId) return;

    const subscription = this.saleService.deleteSaleById(this.saleId)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.saleId = null;
            console.log('Sale deleted for repair');
          }
        },
        error: (error) => {
          console.error('Error deleting sale for repair:', error);
        }
      });
    this.subscriptions.push(subscription);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub?.unsubscribe());
  }
}
