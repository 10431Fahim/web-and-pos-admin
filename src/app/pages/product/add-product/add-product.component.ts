import { Component, inject, OnInit, ViewChild } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  NgForm,
  Validators,
} from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectChange } from '@angular/material/select';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, take } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Brand } from '../../../interfaces/common/brand.interface';
import { Category } from '../../../interfaces/common/category.interface';
import { ChildCategory } from '../../../interfaces/common/child-category.interface';
import { Product } from '../../../interfaces/common/product.interface';
import { SubCategory } from '../../../interfaces/common/sub-category.interface';
import { Tag } from '../../../interfaces/common/tag.interface';
import { Variation } from '../../../interfaces/common/variation.interface';
import { FilterData } from '../../../interfaces/gallery/filter-data';
import { BrandService } from '../../../services/common/brand.service';
import { CategoryService } from '../../../services/common/category.service';
import { ChildCategoryService } from '../../../services/common/child-category.service';
import { ProductService } from '../../../services/common/product.service';
import { SettingService } from '../../../services/common/setting.service';
import { ShopInformationService } from '../../../services/common/shop-information.service';
import { SkinConcernService } from '../../../services/common/skin-concern.service';
import { SkinTypeService } from '../../../services/common/skin-type.service';
import { SubCategoryService } from '../../../services/common/sub-category.service';
import { TagService } from '../../../services/common/tag.service';
import { PageDataService } from '../../../services/core/page-data.service';
import { ReloadService } from '../../../services/core/reload.service';
import { UiService } from '../../../services/core/ui.service';
import { VendorService } from '../../../services/vendor/vendor.service';
import { StringToSlugPipe } from '../../../shared/pipes/string-to-slug.pipe';
import { MyGalleryComponent } from '../../my-gallery/my-gallery.component';
import { AddBrandComponent } from './catalog-popup/add-brand/add-brand.component';
import { AddCategoryComponent } from './catalog-popup/add-category/add-category.component';
import { AddChildCategoryComponent } from './catalog-popup/add-child-category/add-child-category.component';
import { AddSubCategoryComponent } from './catalog-popup/add-sub-category/add-sub-category.component';
import { AddTagComponent } from './catalog-popup/add-tag/add-tag.component';
import { SkinConcernComponent } from './catalog-popup/skin-concern/skin-concern.component';
import { SkinTypeComponent } from './catalog-popup/skin-type/skin-type.component';

@Component({
  selector: 'app-add-product',
  templateUrl: './add-product.component.html',
  styleUrl: './add-product.component.scss',
  providers: [StringToSlugPipe],
})
export class AddProductComponent implements OnInit {
  allowedShopIds = ['679511745a429b7bb55421c4'];
  allowedShortDescriptionShops = [
    '68bb01e514c9d2121584329c',
    '68e9515beea7e36ac90d31f8',

    // vorosamart
    '68fcb315a8ee9fc4fadc31eb',
    // Barisal Shop
    '686ff36ecc0b58143ddff9ac',


    //Test Shop Id
    '679511745a429b7bb55421c4',
  ];

  allowedThemeIds = [
    // Local
    '673f7f29b6cb04d80d02c533',

    // Theme 7
    '67cf24acd76052426007ef94',
  ];

  themeInfo: any;

  @ViewChild('formElement') formElement: NgForm;
  @ViewChild('brandSearchInput', { static: false }) brandSearchInput: any;

  // Form Data
  dataForm?: FormGroup;

  // Gallery View
  protected isGalleryOpen: boolean = false;
  protected galleryImages: string[] = [];
  protected selectedImageIndex: number = 0;

  // Store Data
  categories: Category[] = [];
  subCategories: SubCategory[] = [];
  childCategories: ChildCategory[] = [];
  brands: Brand[] = [];
  filterBrandData: Brand[] = [];
  brandSearchControl = new FormControl('');
  skinTypes: Brand[] = [];
  skinConcerns: Brand[] = [];
  tags: Tag[] = [];
  id?: string;
  product?: Product;
  variations: Variation[] = [];
  isEnableVariation2: boolean = false;
  selectedOption: string = 'publish';
  facebookCatalog: any;
  isEnableCheckoutOrderModal: any;
  productSetting: any;
  isEnableProductKeyFeature: any;
  affiliateSetting: any;
  faqDataArray?: FormArray;

  // Image Control
  pickedImages: string[] = [];
  pickedTestimonialImages: string[] = [];
  chooseImage: string[] = [];
  isPopupVisible = false;
  popupImageUrl: string = '';
  protected shopInformation: any;

  // Form Arrays
  specificationDataArray?: FormArray;
  variationOptionsDataArray?: FormArray;
  variation2OptionsDataArray?: FormArray;
  variationListDataArray?: FormArray;
  driveLinkDataArray?: FormArray;

  // Subscriptions
  private subDataOne: Subscription;
  private subDataTwo: Subscription;
  private subDataThree: Subscription;
  private subDataFour: Subscription;
  private subDataFive: Subscription;
  private subDataSix: Subscription;
  private subDataSeven: Subscription;
  private subAutoSlug: Subscription;
  private subReload: Subscription;

  // Inject Services
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly uiService = inject(UiService);
  private readonly dialog = inject(MatDialog);
  private readonly vendorService = inject(VendorService);
  private readonly stringToSlugPipe = inject(StringToSlugPipe);
  private readonly tagService = inject(TagService);
  private readonly brandService = inject(BrandService);
  private readonly skinTypeService = inject(SkinTypeService);
  private readonly skinConcernService = inject(SkinConcernService);
  private readonly childCategoryService = inject(ChildCategoryService);
  private readonly subCategoryService = inject(SubCategoryService);
  private readonly categoryService = inject(CategoryService);
  private readonly productService = inject(ProductService);
  private readonly reloadService = inject(ReloadService);
  private readonly pageDataService = inject(PageDataService);
  private readonly shopInformationService = inject(ShopInformationService);
  private readonly title = inject(Title);
  private readonly settingService = inject(SettingService);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    const savedTheme = localStorage.getItem('themeInfo');
    if (savedTheme) {
      this.themeInfo = JSON.parse(savedTheme);
    }

    this.initDataForm();

    this.activatedRoute.paramMap.subscribe((param) => {
      this.id = param.get('id');
      if (this.id) {
        this.getProductById();
      }
    });

    this.subReload = this.reloadService.refreshData$.subscribe(() => {
      this.getAllCategories();
      this.getAllBrands();
      this.getAllConcerns();
      this.getAllTypes();
      this.getAllTags();
    });

    // Base Data
    this.setPageData();
    this.getShopInformation();
    // this.autoGenerateSlug();
    this.getAllCategories();
    this.getAllBrands();
    this.getAllConcerns();
    this.getAllTypes();
    this.getAllTags();
    this.setupBrandSearch();
    this.getSetting();
    this.monitorOptionChanges();
    this.monitorVariationOptions();
    this.monitorVariation2Options();
    this.autoSyncSeoTitle();
    this.handleAutoSlugToggle(this.dataForm.get('autoSlug').value);
    // this.getAffiliateSetting();
  }

  private initDataForm() {
    this.dataForm = this.fb.group({
      shop: [null],
      autoSlug: [true],
      name: [null, [Validators.required, Validators.minLength(10)]],
      slug: [null],
      description: [null],
      shortDescription: [null],
      affiliateDescription: [null],
      affiliateUrl: [null],
      affiliatePrice: [null],
      costPrice: [null],
      salePrice: [null],
      sku: [null],
      priority: [null],
      seoKeyword: [null],
      isCustomProduct: [null],
      seoDescription: [null],
      keyFeature: [null],
      seoTitle: [null],
      sameVariantValue: [false],
      variationCostPrice: [null],
      variationSku: [null],
      variationPrice: [null],
      variationRegularPrice: [null],
      variationQuantity: [null],
      keyWord: [null],
      skinType: [null],
      skinConcern: [null],
      warranty: [null],
      regularPrice: [null],
      weight: [],
      model: [null],
      discountType: [null],
      discountAmount: [null],
      productCondition: [null],
      images: [null],
      testimonialImages: [null],
      quantity: [null],
      category: [null, Validators.required],
      subCategory: [null],
      childCategory: [null],
      brand: [null],
      tags: [null],
      status: ['publish', Validators.required],
      videoUrl: [null],
      unit: ['Kg'],
      isFacebookCatalog: [false],
      isAffiliateProduct: [false],
      isEnablePhoneModel: [false],
      isWholesale: [false],
      isEnableDeliveryCharge: [false],
      wholesaleUnit: [null],
      minimumWholesaleQuantity: [null],
      maximumWholesaleQuantity: [null],
      wholesalePrice: [null],
      advancePayment: [null],
      insideCity: [null],
      outsideCity: [null],
      faqTitle: [null],
      faqList: this.fb?.array([]),
      specifications: this.fb.array([this.createSpecificationGroup()]),
      driveLinks: this.fb.array([this.createSpecificationGroup()]),
      isVariation: [false],
      variation: [null],
      variationOptions: this.fb.array([this.createStringElement()]),
      variation2: [null],
      variation2Options: this.fb.array([this.createStringElement()]),
      variationList: this.fb.array([]),
      variationBarcode: [null],
      // New fields
      lowStockThreshold: [10],
      expiryDate: [null],
      batchNumber: [null],
      batchDate: [null],
      barcode: [null],
      isPreOrder: [false],
    });

    this.specificationDataArray = this.dataForm.get(
      'specifications'
    ) as FormArray;
    this.driveLinkDataArray = this.dataForm.get('driveLinks') as FormArray;
    this.variationOptionsDataArray = this.dataForm.get(
      'variationOptions'
    ) as FormArray;
    this.variation2OptionsDataArray = this.dataForm.get(
      'variation2Options'
    ) as FormArray;
    this.variationListDataArray = this.dataForm.get(
      'variationList'
    ) as FormArray;
    this.faqDataArray = this.dataForm.get('faqList') as FormArray;

    this.applyConditionalValidators();
    this.dataForm.get('isVariation')?.valueChanges.subscribe(() => {
      this.applyConditionalValidators();
    });
    this.monitorSpecifications();
    this.monitorDriveLinks();
    this.applyVariationValidators();

    this.dataForm.get('isVariation').valueChanges.subscribe(() => {
      this.applyVariationValidators();
    });

    // Monitor autoSlug checkbox changes
    this.dataForm.get('autoSlug')?.valueChanges.subscribe((isAutoSlug) => {
      this.handleAutoSlugToggle(isAutoSlug);
    });
  }

  // Helper function to apply or remove required validators
  private applyConditionalValidators() {
    const isVariation = this.dataForm.get('isVariation')?.value;

    if (isVariation) {
      this.dataForm.get('salePrice')?.clearValidators();
      this.dataForm.get('regularPrice')?.clearValidators();
      this.dataForm.get('costPrice')?.clearValidators();
      this.dataForm.get('quantity')?.clearValidators();
    } else {
      this.dataForm.get('salePrice')?.setValidators(Validators.required);
      this.dataForm.get('regularPrice')?.setValidators(Validators.required);
      // this.dataForm.get('costPrice')?.setValidators(Validators.required);
      this.dataForm.get('quantity')?.setValidators(Validators.required);
    }

    this.dataForm.get('salePrice')?.updateValueAndValidity();
    this.dataForm.get('regularPrice')?.updateValueAndValidity();
    // this.dataForm.get('costPrice')?.updateValueAndValidity();
    this.dataForm.get('quantity')?.updateValueAndValidity();
  }

  private applyVariationValidators() {
    const isVariation = this.dataForm.get('isVariation').value;

    if (isVariation) {
      // Set required validators
      this.dataForm.get('variation').setValidators(Validators.required);
      this.variationOptionsDataArray.controls.forEach((control) =>
        control.setValidators(Validators.required)
      );

      if (this.isEnableVariation2) {
        this.dataForm.get('variation2').setValidators(Validators.required);
        this.variation2OptionsDataArray.controls.forEach((control) =>
          control.setValidators(Validators.required)
        );
      }
    } else {
      // Clear validators
      this.dataForm.get('variation').clearValidators();
      this.variationOptionsDataArray.controls.forEach((control) =>
        control.clearValidators()
      );

      this.dataForm.get('variation2').clearValidators();
      this.variation2OptionsDataArray.controls.forEach((control) =>
        control.clearValidators()
      );
    }

    // Update validity
    this.dataForm.get('variation').updateValueAndValidity();
    this.dataForm.get('variation2').updateValueAndValidity();
    this.variationOptionsDataArray.controls.forEach((control) =>
      control.updateValueAndValidity()
    );
    this.variation2OptionsDataArray.controls.forEach((control) =>
      control.updateValueAndValidity()
    );
  }

  private setFormValue() {
    this.dataForm.patchValue({
      ...this.product,
      ...{
        category: this.product.category._id,
      },
    });

    if (this.product.brand) {
      this.dataForm.patchValue({
        brand: this.product.brand._id,
      });
    }

    if (this.product.skinType) {
      this.dataForm.patchValue({
        skinType: this.product.skinType._id,
      });
    }

    if (this.product.skinConcern) {
      this.dataForm.patchValue({
        skinConcern: this.product.skinConcern._id,
      });
    }

    if (this.product.deliveryCharge) {
      this.dataForm.patchValue({
        insideCity: this.product.deliveryCharge.insideCity,
        outsideCity: this.product.deliveryCharge.outsideCity,
        isEnableDeliveryCharge:
          this.product.deliveryCharge.isEnableDeliveryCharge,
      });
    }

    this.dataForm.patchValue({ status: this.product?.status });
    this.selectedOption = this.product?.status;

    // Handle new fields
    if (this.product.lowStockThreshold !== undefined) {
      this.dataForm.patchValue({ lowStockThreshold: this.product.lowStockThreshold });
    }
    if (this.product.expiryDate) {
      this.dataForm.patchValue({ expiryDate: new Date(this.product.expiryDate) });
    }
    if (this.product.batchNumber) {
      this.dataForm.patchValue({ batchNumber: this.product.batchNumber });
    }
    if (this.product.batchDate) {
      this.dataForm.patchValue({ batchDate: new Date(this.product.batchDate) });
    }
    if (this.product.barcode) {
      this.dataForm.patchValue({ barcode: this.product.barcode });
    }

    if (this.product.keyWord) {
      this.dataForm.patchValue({ keyWord: this.product.keyWord });
    }

    if (this.product.subCategory) {
      this.dataForm.patchValue({
        subCategory: this.product.subCategory._id,
      });
    }

    if (this.product.childCategory) {
      this.dataForm.patchValue({
        childCategory: this.product.childCategory._id,
      });
    }

    // Tags
    if (this.product.tags && this.product.tags.length) {
      this.dataForm.patchValue({
        tags: this.product.tags.map((m) => m?._id),
      });
    }

    this.specificationDataArray.clear();
    if (this.product.specifications && this.product.specifications.length) {
      this.product.specifications.forEach((f: any) => {
        const data = this.fb.group({
          name: [f.name],
          value: [f.value],
        });
        (this.dataForm?.get('specifications') as FormArray).push(data);
      });
    }

    this.driveLinkDataArray.clear();
    if (this.product.driveLinks && this.product.driveLinks.length) {
      this.product.driveLinks.forEach((f: any) => {
        const data = this.fb.group({
          name: [f.name],
          value: [f.value],
        });
        (this.dataForm?.get('driveLinks') as FormArray).push(data);
      });
    }

    // Variations
    if (this.product?.isVariation) {
      this.isEnableVariation2 = true;

      // Clear form arrays first to avoid duplicates
      this.variationOptionsDataArray.clear();
      this.variation2OptionsDataArray.clear();

      // Push existing variation options to the form
      this.product.variationOptions.forEach((f: any) => {
        const ctrl = this.fb.control(f, Validators.required);
        this.variationOptionsDataArray.push(ctrl);
      });

      this.product.variation2Options.forEach((f: any) => {
        const ctrl = this.fb.control(f, Validators.required);
        this.variation2OptionsDataArray.push(ctrl);
      });

      // Ensure at least one blank input in `variationOptions`
      if (
        this.variationOptionsDataArray.length === 0 ||
        this.variationOptionsDataArray.at(
          this.variationOptionsDataArray.length - 1
        )?.value !== ''
      ) {
        this.variationOptionsDataArray.push(this.createStringElement());
      }

      // Ensure at least one blank input in `variation2Options`
      if (
        this.variation2OptionsDataArray.length === 0 ||
        this.variation2OptionsDataArray.at(
          this.variation2OptionsDataArray.length - 1
        )?.value !== ''
      ) {
        this.variation2OptionsDataArray.push(this.createStringElement());
      }

      this.variationListDataArray.clear();
      this.product.variationList.map((m) => {
        const f = this.fb.group({
          name: [m.name, Validators.required],
          salePrice: [m.salePrice, Validators.required],
          regularPrice: [m.regularPrice, Validators.required],
          costPrice: [m.costPrice],
          quantity: [m.quantity],
        barcode: [m.barcode || m.sku || null],
        lowStockThreshold: [
          m.lowStockThreshold !== undefined ? m.lowStockThreshold : 10,
        ],
        expiryDate: [m.expiryDate || null],
        expiryDateString: [m.expiryDateString || null],
          image: [m.image],
          sku: [m.sku],
          isPreOrder: [(m as any)?.isPreOrder || false],
          isDefault: [(m as any)?.isDefault || false],
        });
        this.variationListDataArray.push(f);
      });
    } else {
      // Ensure at least one blank input in `variationOptions` when no variation is enabled
      if (
        this.variationOptionsDataArray.length === 0 ||
        this.variationOptionsDataArray.at(
          this.variationOptionsDataArray.length - 1
        )?.value !== ''
      ) {
        this.variationOptionsDataArray.push(this.createStringElement());
      }
    }

    if (this.product.images) {
      this.pickedImages = this.product.images;
    }
    if (this.product.testimonialImages) {
      this.pickedTestimonialImages = this.product.testimonialImages;
    }

    // Get Sub Category By Category
    if (this.product.category) {
      this.getSubCategoriesByCategoryId(this.product.category._id);
    }
    if (this.product.subCategory) {
      this.getChildCategoriesBySubCategoryId(this.product.subCategory._id);
    }

    // FAQ Title
    if (this.product.faqTitle) {
      this.dataForm.patchValue({
        faqTitle: this.product.faqTitle,
      });
    }

    // FAQ List
    this.faqDataArray.clear();
    if (this.product.faqList && this.product.faqList.length) {
      this.product.faqList.forEach((f: any) => {
        const faqGroup = this.fb.group({
          question: [f.question, Validators.required],
          answer: [f.answer, Validators.required],
        });
        (this.dataForm.get('faqList') as FormArray).push(faqGroup);
      });
    }
  }

  // picked product Image
  onPickedImage(event: any) {
    this.dataForm.patchValue({ images: event });
  }
  onPickedTestimonialImage(event: any) {
    this.dataForm.patchValue({ testimonialImages: event });
  }

  //specification
  onAddNewSpecifications() {
    const f = this.fb.group({
      name: [null],
      value: [null],
    });
    (this.dataForm?.get('specifications') as FormArray).push(f);
  }

  //driveLinks
  onAddNewLink() {
    const f = this.fb.group({
      name: [null],
      value: [null],
    });
    (this.dataForm?.get('driveLinks') as FormArray).push(f);
  }

  onAddNewFaq(formControl: string) {
    const f = this.fb.group({
      question: [null],
      answer: [null],
    });
    (this.dataForm?.get(formControl) as FormArray).push(f);
  }

  private monitorSpecifications() {
    const specificationsArray = this.specificationDataArray;

    const monitorLastField = () => {
      const lastField = specificationsArray.at(specificationsArray.length - 1);
      if (lastField) {
        lastField
          .get('value')
          .valueChanges.pipe(take(1))
          .subscribe((value) => {
            if (value && value.trim() !== '') {
              specificationsArray.push(this.createSpecificationGroup());
              monitorLastField(); // Recurse to keep adding as fields are filled
            }
          });
      }
    };
    // Start monitoring
    monitorLastField();
  }

  private monitorDriveLinks() {
    const driveLinksArray = this.driveLinkDataArray;

    const monitorLastField = () => {
      const lastField = driveLinksArray.at(driveLinksArray.length - 1);
      if (lastField) {
        lastField
          .get('value')
          .valueChanges.pipe(take(1))
          .subscribe((value) => {
            if (value && value.trim() !== '') {
              driveLinksArray.push(this.createSpecificationGroup());
              monitorLastField(); // Recurse to keep adding as fields are filled
            }
          });
      }
    };
    // Start monitoring
    monitorLastField();
  }

  private createSpecificationGroup(): FormGroup {
    return this.fb.group({
      name: [null],
      value: [null],
    });
  }

  removeFormArrayField1(formControl: string, index: number) {
    let formDataArray: FormArray;
    switch (formControl) {
      case 'specifications': {
        formDataArray = this.specificationDataArray;
        break;
      }
      case 'driveLinks': {
        formDataArray = this.driveLinkDataArray;
        break;
      }
      case 'faqList': {
        formDataArray = this.faqDataArray;
        break;
      }
      default: {
        formDataArray = null;
        break;
      }
    }
    formDataArray?.removeAt(index);
  }

  /**
   * VARIATIONS LOGICS
   * onAddNewVariationObject()
   * createVariationsOptions()
   * removeVariationImage()
   * onCheckEnableVariations()
   */

  //variation

  onToggleVariation2(type: 'add' | 'remove') {
    this.isEnableVariation2 = type === 'add';

    if (type === 'remove') {
      // Get the values in variation2Options to be removed from the variation names
      const variation2Values = this.dataForm.value.variation2Options || [];

      // Loop through variationList to remove variation2Options values from the `name` field
      this.variationListDataArray.controls.forEach((group: FormGroup) => {
        let variationName = group.get('name').value;

        // Remove each variation2 option from the name
        variation2Values.forEach((value) => {
          if (variationName.includes(value)) {
            variationName = variationName
              .replace(new RegExp(`,?\\s*${value}\\b`), '')
              .trim();
          }
        });

        // Update the name without variation2 options
        group.patchValue({ name: variationName });
      });

      // Clear `variation2Options` data array and reset related form control
      this.dataForm.patchValue({ variation2: null });
      this.variation2OptionsDataArray.clear();
    } else {
      // Add an empty input for `variation2Options` when enabled
      this.onAddNewFormString('variation2Options');
      if (
        this.dataForm.value.regularPrice ||
        this.dataForm.value.salePrice ||
        this.dataForm.value.variationCostPrice
      ) {
        this.steValue();
      }
    }
  }

  steValue() {
    this.dataForm.patchValue({
      variationRegularPrice: this.dataForm.value.regularPrice,
      variationPrice: this.dataForm.value.salePrice,
      variationCostPrice: this.dataForm.value.costPrice,
      variationQuantity: this.dataForm.value.quantity,
      variationSku: this.dataForm.value.sku,
    });
  }

  // Monitor changes in variationOptions and variation2Options
  monitorOptionChanges() {
    // Monitor changes in variationOptions
    this.variationOptionsDataArray.valueChanges.subscribe(() => {
      this.updateVariationList();
    });

    // Monitor changes in variation2Options
    this.variation2OptionsDataArray.valueChanges.subscribe(() => {
      this.updateVariationList();
    });
  }

  // Update the variation list based on changes in options
  updateVariationList() {
    // Create a map of current variations with their names as keys for easy lookup
    const existingVariations = new Map<string, any>();
    this.variationListDataArray.controls.forEach((group: FormGroup) => {
      existingVariations.set(group.get('name').value, group.value);
    });

    // Clear existing variationList entries to re-populate
    this.variationListDataArray.clear();

    const variationOptions = this.dataForm.value.variationOptions || [];
    const variation2Options = this.dataForm.value.variation2Options || [];

    const validVariationOptions = variationOptions.filter(
      (v) => v && v.trim() !== ''
    );
    const validVariation2Options = variation2Options.filter(
      (v) => v && v.trim() !== ''
    );

    if (validVariationOptions.length > 0) {
      if (validVariation2Options.length > 0) {
        let variationIndex = 0;
        validVariationOptions.forEach((v1, v1Index) => {
          validVariation2Options.forEach((v2, v2Index) => {
            const variationName = `${v1}, ${v2}`;
            const existingData = existingVariations.get(variationName);

            // Generate unique barcode for new variations if not exists
            let initialBarcode = existingData ? existingData.barcode : null;
            if (!initialBarcode && existingData?.sku) {
              initialBarcode = existingData.sku;
            } else if (!initialBarcode) {
              // Generate unique barcode for this variation using index to ensure uniqueness
              const timestamp = Date.now().toString();
              const indexPart = variationIndex.toString().padStart(3, '0');
              const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
              initialBarcode = `VC${timestamp.slice(-8)}${indexPart}${random}`;
              variationIndex++;
            }

            const newVariation = this.fb.group({
              name: [variationName, Validators.required],
              barcode: [initialBarcode],
              sku: [existingData ? existingData.sku : null],
              salePrice: [
                existingData ? existingData.salePrice : null,
                Validators.required,
              ],
              costPrice: [existingData ? existingData.costPrice : null, null],
              regularPrice: [
                existingData ? existingData.regularPrice : null,
                Validators.required,
              ],
              quantity: [
                existingData ? existingData.quantity : null,
                Validators.required,
              ],
              lowStockThreshold: [
                existingData && existingData.lowStockThreshold !== undefined
                  ? existingData.lowStockThreshold
                  : 10,
              ],
              expiryDate: [existingData ? existingData.expiryDate : null],
              expiryDateString: [
                existingData ? existingData.expiryDateString : null,
              ],
              image: [existingData ? existingData.image : null],
              isPreOrder: [existingData ? existingData.isPreOrder : false],
              isDefault: [existingData ? !!existingData.isDefault : false],
            });

            this.variationListDataArray.push(newVariation);
          });
        });
      } else {
        validVariationOptions.forEach((v1, index) => {
          const existingData = existingVariations.get(v1);

          // Generate unique barcode for new variations if not exists
          let initialBarcode = existingData ? existingData.barcode : null;
          if (!initialBarcode && existingData?.sku) {
            initialBarcode = existingData.sku;
          } else if (!initialBarcode) {
            // Generate unique barcode for this variation using index to ensure uniqueness
            const timestamp = Date.now().toString();
            const indexPart = index.toString().padStart(3, '0');
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            initialBarcode = `VC${timestamp.slice(-8)}${indexPart}${random}`;
          }

          const newVariation = this.fb.group({
            name: [v1, Validators.required],
            barcode: [initialBarcode],
            sku: [existingData ? existingData.sku : null],
            salePrice: [
              existingData ? existingData.salePrice : null,
              Validators.required,
            ],
            costPrice: [existingData ? existingData.costPrice : null, null],
            regularPrice: [
              existingData ? existingData.regularPrice : null,
              Validators.required,
            ],
            quantity: [
              existingData ? existingData.quantity : null,
              Validators.required,
            ],
            lowStockThreshold: [
              existingData && existingData.lowStockThreshold !== undefined
                ? existingData.lowStockThreshold
                : 10,
            ],
            expiryDate: [existingData ? existingData.expiryDate : null],
            expiryDateString: [
              existingData ? existingData.expiryDateString : null,
            ],
            image: [existingData ? existingData.image : null],
            isPreOrder: [existingData ? existingData.isPreOrder : false],
            isDefault: [existingData ? !!existingData.isDefault : false],
          });

          this.variationListDataArray.push(newVariation);
        });
      }
    }
  }

  // Apply the form control values to all variations
  applyToAll() {
    const price = this.dataForm.get('variationPrice').value;
    const regPrice = this.dataForm.get('variationRegularPrice').value;
    const costPrice = this.dataForm.get('variationCostPrice').value;
    const sku = this.dataForm.get('variationSku').value;
    const barcode = this.dataForm.get('variationBarcode').value;
    const quantity = this.dataForm.get('variationQuantity').value;

    this.variationListDataArray.controls.forEach((group: FormGroup, index: number) => {
      if (price !== null) {
        group.get('salePrice').setValue(price);
      }
      if (regPrice !== null) {
        group.get('regularPrice').setValue(regPrice);
      }
      if (costPrice !== null) {
        group.get('costPrice').setValue(costPrice);
      }
      if (quantity !== null) {
        group.get('quantity').setValue(quantity);
      }
      if (sku !== null) {
        group.get('sku').setValue(sku);
        // If SKU is set and barcode is empty, use SKU as barcode
        if (!group.get('barcode')?.value) {
          group.get('barcode').setValue(sku);
        }
      }
      // Always ensure each variation has a unique barcode
      if (!group.get('barcode')?.value) {
        const variationSku = group.get('sku')?.value;
        if (variationSku && variationSku.trim()) {
          group.get('barcode').setValue(variationSku);
        } else {
          // Generate unique barcode for each variation using index to ensure uniqueness
          const timestamp = Date.now().toString();
          const indexPart = index.toString().padStart(3, '0');
          const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          const uniqueBarcode = `VC${timestamp.slice(-8)}${indexPart}${random}`;
          group.get('barcode').setValue(uniqueBarcode);
        }
      }
    });
  }

  // Ensure only one default variation is selected at a time
  setDefaultVariation(index: number, checked: boolean) {
    // console.log('checked',checked)
    // If user checked this one, uncheck all others; if unchecked, set this specific one to false
    if (checked) {
      this.variationListDataArray.controls.forEach(
        (group: FormGroup, i: number) => {
          group.get('isDefault').setValue(i === index);
        }
      );
    } else {
      // When unchecking, set only the specific checkbox to false
      this.variationListDataArray.at(index).get('isDefault').setValue(false);
    }
  }

  onPickImage(index: number) {
    // this.variationListDataArray.at(index).patchValue({image: 'https://cdn.softlabit.com'})
    this.openVariationGalleryDialog(index);
  }

  // Method to open the popup and display the image
  openPopup(index: number) {
    const imageUrl = this.variationListDataArray.at(index).get('image').value;
    if (imageUrl) {
      this.popupImageUrl = imageUrl;
      this.isPopupVisible = true;
    } else {
      console.log('No image available to view');
    }
  }

  /**
   * Variation Click Events
   * onToggleVariation()
   */
  onToggleVariation(isEnableVariation: boolean) {
    this.dataForm.patchValue({ isVariation: isEnableVariation });

    if (isEnableVariation) {
      // If enabling, ensure there is at least one variation option field
      if (this.variationOptionsDataArray.length === 0) {
        this.variationOptionsDataArray.push(this.createStringElement());
      }
      // Additional code to initialize any other variation-related data can go here
    } else {
      // If disabling, clear the variation options and other related fields
      this.variationOptionsDataArray.clear();
      this.variation2OptionsDataArray.clear();
      this.variationListDataArray.clear();
      this.dataForm.patchValue({
        variation: null,
        variation2: null,
      });
    }
    if (
      this.dataForm.value.regularPrice ||
      this.dataForm.value.salePrice ||
      this.dataForm.value.variationCostPrice
    ) {
      this.steValue();
    }
  }

  private monitorVariationOptions() {
    const variationOptionsArray = this.dataForm.get(
      'variationOptions'
    ) as FormArray;

    variationOptionsArray.valueChanges.subscribe(() => {
      const lastField = variationOptionsArray.at(
        variationOptionsArray.length - 1
      );

      // Only add a new blank field if the last one is non-empty
      if (lastField && lastField.value && lastField.value.trim() !== '') {
        variationOptionsArray.push(this.createStringElement());
      }
      // Remove any extra blank fields, leaving only one at the end
      for (let i = variationOptionsArray.length - 2; i >= 0; i--) {
        const field = variationOptionsArray.at(i);
        if (field && !field.value.trim()) {
          variationOptionsArray.removeAt(i);
        }
      }
    });
  }

  // Monitor `variation2Options` specifically
  private monitorVariation2Options() {
    const variation2OptionsArray = this.dataForm.get(
      'variation2Options'
    ) as FormArray;

    variation2OptionsArray.valueChanges.subscribe(() => {
      const lastField = variation2OptionsArray.at(
        variation2OptionsArray.length - 1
      );

      // Only add a new blank field if the last one is non-empty
      if (lastField && lastField.value && lastField.value.trim() !== '') {
        variation2OptionsArray.push(this.createStringElement());
      }

      // Remove any extra blank fields, leaving only one at the end
      for (let i = variation2OptionsArray.length - 2; i >= 0; i--) {
        const field = variation2OptionsArray.at(i);
        if (field && !field.value.trim()) {
          variation2OptionsArray.removeAt(i);
        }
      }
    });
  }

  createStringElement() {
    return this.fb.control('');
  }

  private onAddNewFormString(name: 'variationOptions' | 'variation2Options') {
    const formArray = this.dataForm?.get(name) as FormArray;

    // Ensure the array has at least one field to start monitoring
    if (formArray.length === 0) {
      formArray.push(this.createStringElement());
    }

    // Monitor the last field in the form array
    const monitorLastField = () => {
      const lastField = formArray.at(formArray.length - 1);
      if (lastField) {
        lastField.valueChanges.pipe(take(1)).subscribe((value) => {
          if (value && value.trim() !== '') {
            formArray.push(this.createStringElement());
            monitorLastField(); // Continue monitoring for new additions
          }
        });
      }
    };

    // Start monitoring the last field in the form array
    monitorLastField();
  }

  removeFormArrayField(
    name:
      | 'variationOptions'
      | 'variation2Options'
      | 'specifications'
      | 'variationList'
      | 'faqList',
    index: number
  ) {
    let removed = 0;

    // শুধু variationOptions / variation2Options হলে variationList থেকেও remove হবে
    if (name === 'variationOptions' || name === 'variation2Options') {
      this.dataForm.value.variationList.forEach((item, i) => {
        if (name === 'variation2Options') {
          const v2Value = (
            this.dataForm?.get('variation2Options') as FormArray
          ).at(index).value;
          const position = item.name.search(v2Value);
          if (position !== -1) {
            (this.dataForm?.get('variationList') as FormArray).removeAt(
              i - removed
            );
            removed += 1;
          }
        }

        if (name === 'variationOptions') {
          const vValue = (
            this.dataForm?.get('variationOptions') as FormArray
          ).at(index).value;
          const position = item.name.search(vValue);
          if (position !== -1) {
            (this.dataForm?.get('variationList') as FormArray).removeAt(
              i - removed
            );
            removed += 1;
          }
        }
      });
    }

    // ✅ সব case এ মূল formArray থেকে remove হবে
    (this.dataForm?.get(name) as FormArray).removeAt(index);
  }

  onSubmit() {
    if (this.dataForm.invalid) {
      this.uiService.message('Please filed all the required field', 'warn');
      this.dataForm.markAllAsTouched();
      return;
    }

    if (
      !this.categories.find((f) => f._id === this.dataForm.value.category)?.name
    ) {
      this.uiService.message('Please filed all the required field', 'warn');
      this.dataForm.get('category')?.reset();
      this.dataForm.markAllAsTouched();
      return;
    }

    // Filter non-empty and unique specifications
    const filteredSpecifications = this.specificationDataArray.controls
      .map((control) => control.value)
      .filter(
        (spec) =>
          spec.name &&
          spec.value &&
          spec.name.trim() !== '' &&
          spec.value.trim() !== ''
      )
      .reduce((uniqueSpecs, spec) => {
        const isDuplicate = uniqueSpecs.some(
          (uniqueSpec) =>
            uniqueSpec.name === spec.name && uniqueSpec.value === spec.value
        );
        if (!isDuplicate) {
          uniqueSpecs.push(spec);
        }
        return uniqueSpecs;
      }, []);

    const filteredDriveLinks = this.driveLinkDataArray.controls
      .map((control) => control.value)
      .filter(
        (spec) =>
          spec.name &&
          spec.value &&
          spec.name.trim() !== '' &&
          spec.value.trim() !== ''
      )
      .reduce((uniqueSpecs, spec) => {
        const isDuplicate = uniqueSpecs.some(
          (uniqueSpec) =>
            uniqueSpec.name === spec.name && uniqueSpec.value === spec.value
        );
        if (!isDuplicate) {
          uniqueSpecs.push(spec);
        }
        return uniqueSpecs;
      }, []);

    const filteredVariationOptions = this.variationOptionsDataArray.controls
      .filter((control) => control.value.trim() !== '')
      .map((control) => control.value);

    const filteredVariation2Options = this.variation2OptionsDataArray.controls
      .filter((control) => control.value.trim() !== '')
      .map((control) => control.value);

    // Only preserve existing default variation when editing if none selected now AND user hasn't explicitly unchecked all
    const currentHasDefault = (this.dataForm.value.variationList || []).some(
      (v: any) => v && v.isDefault
    );
    const previousDefaultNames = new Set(
      (this.product?.variationList || [])
        .filter((v: any) => v && v.isDefault)
        .map((v: any) => v.name)
    );

    // Check if user has explicitly unchecked all defaults (all variations have isDefault: false)
    const allVariationsUnchecked = this.variationListDataArray.controls.every(
      (group: FormGroup) => !group.get('isDefault').value
    );

    // Only restore previous default if user hasn't explicitly unchecked all and no default is currently selected
    if (
      this.product &&
      previousDefaultNames.size > 0 &&
      !currentHasDefault &&
      !allVariationsUnchecked
    ) {
      this.variationListDataArray.controls.forEach((group: FormGroup) => {
        const name = group.get('name').value;
        group.patchValue({ isDefault: previousDefaultNames.has(name) });
      });
    }

    // console.log('this.dataForm', this.dataForm.value);

    const mData = {
      ...this.dataForm.value,
      ...{
        category: {
          _id: this.dataForm.value.category,
          name: this.categories.find(
            (f) => f._id === this.dataForm.value.category
          )?.name,
          slug: this.categories.find(
            (f) => f._id === this.dataForm.value.category
          )?.slug,
          images: this.categories.find(
            (f) => f._id === this.dataForm.value.category
          )?.images,
        },
        variationOptions: filteredVariationOptions,
        variation2Options: filteredVariation2Options,
        specifications: filteredSpecifications,
        driveLinks: filteredDriveLinks,
        deliveryCharge: {
          insideCity: this.dataForm.value.insideCity,
          outsideCity: this.dataForm.value.outsideCity,
          isEnableDeliveryCharge: this.dataForm.value.isEnableDeliveryCharge,
        },
      },
    };

    if (this.dataForm.value.subCategory) {
      mData.subCategory = {
        _id: this.dataForm.value.subCategory,
        name: this.subCategories.find(
          (f) => f._id === this.dataForm.value.subCategory
        )?.name,
        slug: this.subCategories.find(
          (f) => f._id === this.dataForm.value.subCategory
        )?.slug,
        images: this.subCategories.find(
          (f) => f._id === this.dataForm.value.subCategory
        )?.images,
      };
    }

    if (this.dataForm.value.childCategory) {
      mData.childCategory = {
        _id: this.dataForm.value.childCategory,
        name: this.childCategories.find(
          (f) => f._id === this.dataForm.value.childCategory
        )?.name,
        slug: this.childCategories.find(
          (f) => f._id === this.dataForm.value.childCategory
        )?.slug,
        images: this.childCategories.find(
          (f) => f._id === this.dataForm.value.childCategory
        )?.images,
      };
    }

    if (this.dataForm?.value?.brand) {
      mData.brand = {
        _id: this.dataForm.value.brand,
        name: this.brands.find((f) => f._id === this.dataForm.value.brand)
          ?.name,
        slug: this.brands.find((f) => f._id === this.dataForm.value.brand)
          ?.slug,
        images: this.brands.find((f) => f._id === this.dataForm.value.brand)
          ?.images,
      };
    }

    if (this.dataForm?.value?.skinType) {
      mData.skinType = {
        _id: this.dataForm.value.skinType,
        name: this.skinTypes.find((f) => f._id === this.dataForm.value.skinType)
          ?.name,
        slug: this.skinTypes.find((f) => f._id === this.dataForm.value.skinType)
          ?.slug,
        images: this.skinTypes.find(
          (f) => f._id === this.dataForm.value.skinType
        )?.images,
      };
    }

    if (this.dataForm?.value?.skinConcern) {
      mData.skinConcern = {
        _id: this.dataForm.value.skinConcern,
        name: this.skinConcerns.find(
          (f) => f._id === this.dataForm.value.skinConcern
        )?.name,
        slug: this.skinConcerns.find(
          (f) => f._id === this.dataForm.value.skinConcern
        )?.slug,
        images: this.skinConcerns.find(
          (f) => f._id === this.dataForm.value.skinConcern
        )?.images,
      };
    }

    // Normalize variationList: ensure barcode defaults and expiryDateString formatting per variation
    if (Array.isArray(mData.variationList)) {
      mData.variationList = mData.variationList.map((v: any, idx: number) => {
        const next = { ...v };
        // fallback barcode to sku if empty
        if (!next.barcode && next.sku) {
          next.barcode = next.sku;
        } else if (!next.barcode) {
          const timestamp = Date.now().toString();
          const random = Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, '0');
          next.barcode = `VC${timestamp.slice(-8)}${idx}${random}`;
        }
        // format expiryDateString
        if (next.expiryDate && !next.expiryDateString) {
          const d = new Date(next.expiryDate);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          next.expiryDateString = `${y}-${m}-${dd}`;
        }
        return next;
      });
    }

    if (this.dataForm.value.keyWord && !this.product?.keyWord) {
      let str = this.dataForm.value.keyWord;
      let array = str.split(',');
      mData.keyWord = array;
    }

    if (this.dataForm.value.keyWord && this.product?.keyWord) {
      mData.keyWord = this.dataForm.value.keyWord;
    }

    if (this.dataForm.value.tags && this.dataForm.value.tags.length) {
      const tags: any[] = [];
      this.dataForm.value.tags.forEach((m) => {
        const fTag = this.tags.find((f) => m === f._id);
        tags.push(fTag);
      });
      mData.tags = tags;
    }

    // Handle expiry date
    if (this.dataForm.value.expiryDate) {
      const expiryDate = new Date(this.dataForm.value.expiryDate);
      // Format as YYYY-MM-DD
      const year = expiryDate.getFullYear();
      const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
      const day = String(expiryDate.getDate()).padStart(2, '0');
      mData.expiryDateString = `${year}-${month}-${day}`;
    }

    // Generate barcode if not provided
    if (!mData.barcode && mData.sku) {
      mData.barcode = mData.sku;
    } else if (!mData.barcode) {
      mData.barcode = this.generateUniqueBarcode();
    }

    // console.log(mData);
    if (this.product) {
      this.updateProductById(mData);
    } else {
      this.addProduct({ ...mData, ...{ rating: 0, approval: 'approved' } });
    }
  }

  /**
   * Generate Barcode
   */
  generateBarcode() {
    if (this.dataForm.value.sku) {
      this.dataForm.patchValue({ barcode: this.dataForm.value.sku });
    } else {
      const uniqueBarcode = this.generateUniqueBarcode();
      this.dataForm.patchValue({ barcode: uniqueBarcode });
    }
    this.uiService.message('Barcode generated successfully', 'success');
  }

  /**
   * Generate Barcode for Variation (bulk field)
   */
  generateVariationBarcode() {
    const variationSku = this.dataForm.value.variationSku;
    if (variationSku) {
      this.dataForm.patchValue({ variationBarcode: variationSku });
    } else {
      const uniqueBarcode = `VC${this.generateUniqueBarcode()}`;
      this.dataForm.patchValue({ variationBarcode: uniqueBarcode });
    }
    this.uiService.message('Variation barcode generated successfully', 'success');
  }

  /**
   * Generate barcode for a specific variation row
   */
  generateVariationBarcodeAt(index: number) {
    const group = this.variationListDataArray?.at(index) as FormGroup;
    if (!group) return;
    const sku = group.get('sku')?.value;
    let barcode: string;
    if (sku && sku.trim().length) {
      barcode = sku;
    } else {
      // Generate unique barcode with index to ensure uniqueness
      const timestamp = Date.now().toString();
      const indexPart = index.toString().padStart(3, '0');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      barcode = `VC${timestamp.slice(-8)}${indexPart}${random}`;
    }
    group.patchValue({ barcode });
    this.uiService.message('Variation barcode generated successfully', 'success');
  }

  /**
   * Generate Unique Barcode
   */
  private generateUniqueBarcode(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `BC${timestamp.slice(-8)}${random}`;
  }

  /**
   * HTTP REQ HANDLE
   * getAllCategories
   * getAllBrands
   * getAllTags
   * getAllVariations()
   * getSubCategoriesByCategoryId()
   * getProductById()
   * addProduct()
   * updateProductById()
   */
  private getAllCategories() {
    // Select
    const mSelect = {
      name: 1,
      slug: 1,
      images: 1,
    };

    const filterData: FilterData = {
      pagination: null,
      filter: null,
      select: mSelect,
      sort: { name: 1 },
    };

    this.subDataFour = this.categoryService
      .getAllCategories(filterData, null)
      .subscribe({
        next: (res) => {
          this.categories = res.data;
        },
        error: (error) => {
          console.log(error);
        },
      });
  }

  private getAllBrands() {
    // Select
    const mSelect = {
      name: 1,
      slug: 1,
      images: 1,
    };

    const filterData: FilterData = {
      pagination: null,
      filter: null,
      select: mSelect,
      sort: { name: 1 },
    };

    this.subDataFive = this.brandService
      .getAllBrands(filterData, null)
      .subscribe({
        next: (res) => {
          this.brands = res.data;
          this.filterBrandData = [...this.brands];
        },
        error: (error) => {
          console.log(error);
        },
      });
  }

  private setupBrandSearch() {
    const subBrandSearch = this.brandSearchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe((searchTerm: string) => {
        if (!searchTerm || searchTerm.trim() === '') {
          this.filterBrandData = [...this.brands];
        } else {
          const searchLower = searchTerm.toLowerCase().trim();
          this.filterBrandData = this.brands.filter((brand) =>
            brand.name?.toLowerCase().includes(searchLower)
          );
        }
      });
    this.subscriptions.push(subBrandSearch);
  }

  onBrandSelectOpened() {
    // Reset search when dropdown opens
    setTimeout(() => {
      this.brandSearchControl.setValue('', { emitEvent: false });
      this.filterBrandData = [...this.brands];
      // Focus on search input
      if (this.brandSearchInput && this.brandSearchInput.nativeElement) {
        this.brandSearchInput.nativeElement.focus();
      }
    }, 150);
  }

  focusBrandSearch() {
    setTimeout(() => {
      if (this.brandSearchInput && this.brandSearchInput.nativeElement) {
        this.brandSearchInput.nativeElement.focus();
      }
    }, 0);
  }

  private getAllTypes() {
    // Select
    const mSelect = {
      name: 1,
      slug: 1,
      images: 1,
    };

    const filterData: FilterData = {
      pagination: null,
      filter: null,
      select: mSelect,
      sort: { name: 1 },
    };

    this.subDataFive = this.skinTypeService
      .getAllSkinTypes(filterData, null)
      .subscribe({
        next: (res) => {
          this.skinTypes = res.data;
        },
        error: (error) => {
          console.log(error);
        },
      });
  }

  private getAllConcerns() {
    // Select
    const mSelect = {
      name: 1,
      slug: 1,
      images: 1,
    };

    const filterData: FilterData = {
      pagination: null,
      filter: null,
      select: mSelect,
      sort: { name: 1 },
    };

    this.subDataFive = this.skinConcernService
      .getAllSkinConcerns(filterData, null)
      .subscribe({
        next: (res) => {
          this.skinConcerns = res.data;
          console.log('this.skinConcerns', this.skinConcerns);
        },
        error: (error) => {
          console.log(error);
        },
      });
  }

  private getAllTags() {
    // Select
    const mSelect = {
      name: 1,
      slug: 1,
    };

    const filterData: FilterData = {
      pagination: null,
      filter: null,
      select: mSelect,
      sort: { name: 1 },
    };

    this.subDataSix = this.tagService.getAllTags(filterData, null).subscribe({
      next: (res) => {
        this.tags = res.data;
      },
      error: (error) => {
        console.log(error);
      },
    });
  }

  private getSubCategoriesByCategoryId(categoryId: string) {
    const select = 'name category slug images';
    this.subDataSeven = this.subCategoryService
      .getSubCategoriesByCategoryId(categoryId, select)
      .subscribe({
        next: (res) => {
          this.subCategories = res.data;
        },
        error: (error) => {
          console.log(error);
        },
      });
  }

  private getChildCategoriesBySubCategoryId(categoryId: string) {
    const select = 'name slug images';
    this.subDataSeven = this.childCategoryService
      .getChildCategoriesByCategoryId(categoryId, select)
      .subscribe({
        next: (res) => {
          this.childCategories = res.data;
        },
        error: (error) => {
          console.log(error);
        },
      });
  }

  private getProductById() {
    // const select = 'name email username phoneNo gender role permissions hasAccess'
    this.subDataTwo = this.productService.getProductById(this.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.product = res.data;
          console.log('this.product in product details', this.product);
          this.setFormValue();
        }
      },
      error: (error) => {
        console.log(error);
      },
    });
  }

  private addProduct(data: any) {
    // this.vendorID = this.vendorService.getVendorId(),

    this.subDataOne = this.productService.addProduct({ ...data }).subscribe({
      next: (res) => {
        if (res.success) {
          this.uiService.message(res.message, 'success');
          // if (this.dataForm.value.resetForm) {
          //   this.formElement.resetForm();
          //   // this.clearFormArray(this.variationsDataArray);
          // }
          this.formElement.resetForm();
          this.dataForm.reset();
          this.clearFormArray(this.specificationDataArray);
          this.clearFormArray(this.variationOptionsDataArray);
          this.clearFormArray(this.variation2OptionsDataArray);
          this.clearFormArray(this.variationListDataArray);
          this.chooseImage = [];
          this.pickedImages = [];
          this.pickedTestimonialImages = [];
          this.dataForm.patchValue({ status: 'publish' });
          this.initDataForm();
          this.autoSyncSeoTitle();
        } else {
          this.uiService.message(res.message, 'warn');
        }
      },
      error: (error) => {
        console.log(error);
      },
    });
  }

  private updateProductById(data: any) {
    this.subDataThree = this.productService
      .updateProductById(this.product._id, data)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.uiService.message(res.message, 'success');
          } else {
            this.uiService.message(res.message, 'warn');
          }
        },
        error: (error) => {
          console.log(error);
        },
      });
  }

  private getSetting() {
    const subscription = this.settingService
      .getSetting('facebookCatalog productSetting affiliate orderSetting')
      .subscribe({
        next: (res) => {
          if (res.data) {
            this.facebookCatalog = res.data.facebookCatalog;
            this.isEnableCheckoutOrderModal = res.data.orderSetting?.isEnableCheckoutOrderModal;
            this.productSetting = res.data.productSetting;
            this.isEnableProductKeyFeature =
              res.data.productSetting?.isEnableProductKeyFeature;
            this.affiliateSetting = res.data;
          }
        },
        error: (err) => {
          console.log(err);
        },
      });

    this.subscriptions.push(subscription);
  }

  // private getAffiliateSetting() {
  //   const subscription = this.settingService.getSetting('affiliate')
  //     .subscribe({
  //       next: res => {
  //         if (res.data && res.data.affiliate) {
  //           this.affiliateSetting = res.data;
  //
  //           // console.log('this.affiliateSetting', this.affiliateSetting);
  //         }
  //       },
  //       error: err => {
  //         console.log(err)
  //       }
  //     });
  //
  //   this.subscriptions.push(subscription);
  // }

  private getShopInformation() {
    const subscription = this.shopInformationService
      .getShopInformation()
      .subscribe({
        next: (res) => {
          if (res.data) {
            this.shopInformation = res.fShopDomain;
          }
        },
        error: (err) => {
          console.log(err);
        },
      });
    this.subscriptions.push(subscription);
  }

  private clearFormArray(formArray: FormArray) {
    while (formArray.length !== 0) {
      formArray.removeAt(0);
    }
  }

  /**
   * REMOVE SELECTED IMAGE
   */

  removeImage(index: number) {
    this.variationListDataArray.at(index).patchValue({ image: null });
  }

  /**
   * ON CATEGORY SELECT
   */
  onCategorySelect(event: MatSelectChange) {
    if (event.value) {
      this.getSubCategoriesByCategoryId(event.value);
    }
  }

  onSubCategorySelect(event: MatSelectChange) {
    if (event.value) {
      this.getChildCategoriesBySubCategoryId(event.value);
    }
  }

  /**
   * LOGICAL PART
   * autoGenerateSlug()
   * handleAutoSlugToggle()
   */
  autoGenerateSlug() {
    if (this.dataForm.get('autoSlug').value === true) {
      this.subAutoSlug = this.dataForm
        .get('name')
        .valueChanges.pipe
        // debounceTime(200),
        // distinctUntilChanged()
        ()
        .subscribe((d) => {
          const res = this.stringToSlugPipe.transform(d, '-');
          this.dataForm.patchValue({
            slug: res,
          });
        });
    } else {
      if (!this.subAutoSlug) {
        return;
      }
      this.subAutoSlug?.unsubscribe();
    }
  }

  private handleAutoSlugToggle(isAutoSlug: boolean) {
    const slugControl = this.dataForm.get('slug');

    if (isAutoSlug) {
      // When autoSlug is enabled, unsubscribe from any existing subscription first
      if (this.subAutoSlug) {
        this.subAutoSlug.unsubscribe();
      }

      // Remove required validator when autoSlug is enabled
      slugControl?.clearValidators();
      slugControl?.updateValueAndValidity();

      // Start auto-slug generation
      this.subAutoSlug = this.dataForm
        .get('name')
        .valueChanges.subscribe((nameValue) => {
          if (nameValue) {
            const res = this.stringToSlugPipe.transform(nameValue, '-');
            this.dataForm.patchValue({
              slug: res,
            });
          }
        });

      // If there's already a name value, generate slug immediately
      const currentName = this.dataForm.get('name').value;
      if (currentName) {
        const res = this.stringToSlugPipe.transform(currentName, '-');
        this.dataForm.patchValue({
          slug: res,
        });
      }
    } else {
      // When autoSlug is disabled, unsubscribe from auto-slug generation
      if (this.subAutoSlug) {
        this.subAutoSlug.unsubscribe();
        this.subAutoSlug = null;
      }

      // Add required validator when autoSlug is disabled
      slugControl?.setValidators([Validators.required]);
      slugControl?.updateValueAndValidity();
    }
  }

  onSlugChange() {
    const slugControl = this.dataForm.get('slug');
    if (slugControl) {
      let value = slugControl.value || '';

      // Format: remove special characters, replace spaces with dashes, and lowercase
      let formatted = value
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // remove non-alphanumeric except space/dash
        .replace(/\s+/g, '-') // replace spaces with dash
        .replace(/-+/g, '-'); // collapse multiple dashes

      // Set the formatted value back to the control
      slugControl.setValue(formatted, { emitEvent: false });
    }
  }

  private autoSyncSeoTitle(): void {
    const nameControl = this.dataForm.get('name');
    const seoTitleControl = this.dataForm.get('seoTitle');

    if (!nameControl || !seoTitleControl) return;

    nameControl.valueChanges.subscribe((nameValue: string) => {
      // Auto-set SEO Title only if the user hasn't manually edited it
      if (!seoTitleControl.dirty) {
        seoTitleControl.setValue(nameValue, { emitEvent: false });
      }
    });
  }

  // Method to close the popup
  closePopup() {
    this.isPopupVisible = false;
    this.popupImageUrl = '';
  }

  setOption(option: string): void {
    this.selectedOption = option;
    this.dataForm.patchValue({ status: this.selectedOption });
  }

  /**
   * DIALOG VIEW COMPONENT
   * openCategoryDialog()
   * openSubCategoryDialog()
   * openChildCategoryDialog()
   * openBrandDialog()
   * openTagDialog()
   */
  public openVariationGalleryDialog(index: number) {
    const dialogRef = this.dialog.open(MyGalleryComponent, {
      data: { type: 'multiple', count: 1 },
      panelClass: ['theme-dialog', 'full-screen-modal-lg'],
      width: '100%',
      minHeight: '100%',
      autoFocus: false,
      disableClose: true,
    });
    dialogRef.afterClosed().subscribe((dialogResult) => {
      if (dialogResult) {
        if (dialogResult.data && dialogResult.data.length > 0) {
          this.variationListDataArray
            .at(index)
            .patchValue({ image: dialogResult.data[0].url });
        }
      }
    });
  }

  public openCategoryDialog(event: MouseEvent) {
    event.stopPropagation();
    const dialogRef = this.dialog.open(AddCategoryComponent, {
      panelClass: ['theme-dialog', 'no-padding-dialog'],
      width: '98%',
      maxWidth: '500px',
      height: 'auto',
      maxHeight: '100vh',
      autoFocus: false,
      disableClose: false,
    });
    dialogRef.afterClosed().subscribe((dialogResult) => {
      if (dialogResult) {
        this.dataForm.patchValue({ category: dialogResult?._id });
      }
    });
  }

  public openSubCategoryDialog(event: MouseEvent) {
    event.stopPropagation();
    const dialogRef = this.dialog.open(AddSubCategoryComponent, {
      panelClass: ['theme-dialog', 'no-padding-dialog'],
      data: this.dataForm?.value?.category,
      width: '98%',
      maxWidth: '500px',
      height: 'auto',
      maxHeight: '100vh',
      autoFocus: false,
      disableClose: false,
    });
    dialogRef.afterClosed().subscribe((dialogResult) => {
      if (dialogResult && dialogResult._id) {
        this.getSubCategoriesByCategoryId(this.dataForm?.value?.category);
        this.dataForm.patchValue({ subCategory: dialogResult._id });
      }
    });
  }

  public openChildCategoryDialog(event: MouseEvent) {
    const mData = {
      subCategory: this.dataForm?.value?.subCategory,
      category: this.dataForm?.value?.category,
    };
    event.stopPropagation();
    const dialogRef = this.dialog.open(AddChildCategoryComponent, {
      panelClass: ['theme-dialog', 'no-padding-dialog'],
      width: '98%',
      data: mData,
      maxWidth: '500px',
      height: 'auto',
      maxHeight: '100vh',
      autoFocus: false,
      disableClose: false,
    });
    dialogRef.afterClosed().subscribe((dialogResult) => {
      if (dialogResult) {
        this.getChildCategoriesBySubCategoryId(
          this.dataForm?.value?.subCategory
        );
        this.dataForm.patchValue({ childCategory: dialogResult?._id });
      }
    });
  }

  public openBrandDialog(event: MouseEvent) {
    event.stopPropagation();
    const dialogRef = this.dialog.open(AddBrandComponent, {
      panelClass: ['theme-dialog', 'no-padding-dialog'],
      width: '98%',
      maxWidth: '500px',
      height: 'auto',
      maxHeight: '100vh',
      autoFocus: false,
      disableClose: false,
    });
    dialogRef.afterClosed().subscribe((dialogResult) => {
      if (dialogResult) {
        this.dataForm.patchValue({ brand: dialogResult?._id });
      }
    });
  }

  public openSkinTypeDialog(event: MouseEvent) {
    event.stopPropagation();
    const dialogRef = this.dialog.open(SkinTypeComponent, {
      panelClass: ['theme-dialog', 'no-padding-dialog'],
      width: '98%',
      maxWidth: '500px',
      height: 'auto',
      maxHeight: '100vh',
      autoFocus: false,
      disableClose: false,
    });
    dialogRef.afterClosed().subscribe((dialogResult) => {
      if (dialogResult) {
        this.dataForm.patchValue({ skinType: dialogResult?._id });
      }
    });
  }

  public openSkinConcernDialog(event: MouseEvent) {
    event.stopPropagation();
    const dialogRef = this.dialog.open(SkinConcernComponent, {
      panelClass: ['theme-dialog', 'no-padding-dialog'],
      width: '98%',
      maxWidth: '500px',
      height: 'auto',
      maxHeight: '100vh',
      autoFocus: false,
      disableClose: false,
    });
    dialogRef.afterClosed().subscribe((dialogResult) => {
      if (dialogResult) {
        this.dataForm.patchValue({ skinConcern: dialogResult?._id });
      }
    });
  }

  public openTagDialog(event: MouseEvent) {
    event.stopPropagation();
    const dialogRef = this.dialog.open(AddTagComponent, {
      panelClass: ['theme-dialog', 'no-padding-dialog'],
      width: '98%',
      maxWidth: '500px',
      height: 'auto',
      maxHeight: '100vh',
      autoFocus: false,
      disableClose: false,
    });
    dialogRef.afterClosed().subscribe((dialogResult) => {
      if (dialogResult && dialogResult.data) {
      }
    });
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
    this.router
      .navigate([], {
        queryParams: { 'gallery-image-view': true },
        queryParamsHandling: 'merge',
      })
      .then();
  }

  closeGallery(): void {
    this.isGalleryOpen = false;
    this.router
      .navigate([], {
        queryParams: { 'gallery-image-view': null },
        queryParamsHandling: 'merge',
      })
      .then();
  }

  /**
   * Page Data
   * setPageData()
   */
  private setPageData(): void {
    this.title.setTitle('Product Add');
    this.pageDataService.setPageData({
      title: 'Product',
      navArray: [
        { name: 'Dashboard', url: `/dashboard` },
        {
          name: 'Product',
          url: 'https://www.youtube.com/embed/pxIyUD4EBzY?si=dUnJ8F_kNHSL07yr',
        },
      ],
    });
  }

  // isAllowedShop(): boolean {
  //   const id = this.vendorService.getShopId();
  //   return !!id && this.allowedShopIds.includes(id);
  // }

  isAllowedShortDescriptionShop(): boolean {
    const id = this.vendorService.getShopId();
    return !!id && this.allowedShortDescriptionShops.includes(id);
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
    if (this.subDataSix) {
      this.subDataSix.unsubscribe();
    }
    if (this.subDataSeven) {
      this.subDataSeven.unsubscribe();
    }
    if (this.subAutoSlug) {
      this.subAutoSlug.unsubscribe();
    }
    this.subscriptions.forEach((sub) => sub?.unsubscribe());
  }
}
