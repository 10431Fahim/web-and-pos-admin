import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormControl, FormGroup, NgForm } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  Subscription,
} from 'rxjs';
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_TYPES,
  TABLE_TAB_ORDER_DATA,
} from '../../../core/utils/app-data';
import { Order } from '../../../interfaces/common/order.interface';
import { Pagination } from '../../../interfaces/core/pagination';
import { Select } from '../../../interfaces/core/select';
import { FilterData } from '../../../interfaces/gallery/filter-data';
import { DataTableSelectionBase } from '../../../mixin/data-table-select-base.mixin';
import { OrderService } from '../../../services/common/order.service';
import { SettingService } from '../../../services/common/setting.service';
import { CountryService } from '../../../services/core/country.service';
import { FilterStateService } from '../../../services/core/filter-state.service';
import { PageDataService } from '../../../services/core/page-data.service';
import { ReloadService } from '../../../services/core/reload.service';
import { UiService } from '../../../services/core/ui.service';
import { UtilsService } from '../../../services/core/utils.service';
import { VendorService } from '../../../services/vendor/vendor.service';
import { ConfirmDialogComponent } from '../../../shared/components/ui/confirm-dialog/confirm-dialog.component';
import { CourierSelectionDialogComponent } from '../../../shared/dialog-view/courier-selection-dialog/courier-selection-dialog.component';
import { NoteDialogComponent } from '../../../shared/dialog-view/note-dialog/note-dialog.component';
import { ProductSummaryDialogComponent } from '../../../shared/dialog-view/product-summary-dialog/product-summary-dialog.component';
import { TableDetailsDialogComponent } from '../../../shared/dialog-view/table-details-dialog/table-details-dialog.component';
import { JoinSkusPipe } from '../../../shared/pipes/join-sku.pipe';
import { FraudCheckerComponent } from '../order-details/fraud-checker/fraud-checker.component';

@Component({
  selector: 'app-all-order',
  templateUrl: './all-order.component.html',
  styleUrl: './all-order.component.scss',
  providers: [DatePipe, JoinSkusPipe],
})
export class AllOrderComponent
  extends DataTableSelectionBase(Component)
  implements AfterViewInit, OnDestroy, OnInit
{
  // Decorator
  @ViewChild('searchForm', { static: true }) private searchForm: NgForm;

  // Store Data
  override allTableData: Order[] = [];
  protected productSummary: any[] = [];
  protected orderStatus: Select[] = ORDER_STATUS;
  protected paymentType: Select[] = PAYMENT_TYPES;
  protected paymentStatus: Select[] = PAYMENT_STATUS;
  protected tableTabData: Select[] = TABLE_TAB_ORDER_DATA;
  protected selectedTab: string =
    this.getStoredTabState() || this.tableTabData[0].value;
  protected adminRole: any;
  public invoiceSetting: any;
  selectedPagination = 0;

  // Gallery View
  protected isGalleryOpen: boolean = false;
  protected galleryImages: string[] = [];
  protected selectedImageIndex: number = 0;

  // Pagination
  protected currentPage = 1;
  protected totalData = 0;
  protected dataPerPage = 10;

  // Date Filter
  today = new Date();
  dataFormDateRange = new FormGroup({
    start: new FormControl(),
    end: new FormControl(),
  });

  dataFormDateRangeCourier = new FormGroup({
    start: new FormControl(),
    end: new FormControl(),
  });

  // Filter
  filter: any = null;
  selectedTabTrash: any = null;
  defaultFilter: any = null;
  searchQuery = null;
  private sortQuery = { createdAt: -1 };
  private readonly select: any = {
    name: 1,
    orderId: 1,
    phoneNo: 1,
    shippingAddress: 1,
    city: 1,
    paymentType: 1,
    grandTotal: 1,
    deleteDateString: 1,
    checkoutDate: 1,
    orderStatus: 1,
    customerNotes: 1,
    paymentStatus: 1,
    deliveryDate: 1,
    orderedItems: 1,
    orderTimeline: 1,
    preferredDate: 1,
    preferredTime: 1,
    preferredDateString: 1,
    deliveryDateString: 1,
    user: 1,
    orderedFrom: 1,
    createdAt: 1,
    status: 1,
    priority: 1,
    providerName: 1,
    advancePayment: 1,
    courierData: 1,
    previousOrderCount: 1,
  };

  orderSetting: any;
  // Loading
  isLoading: boolean = true;

  // Active Data Store
  activeSort: number = null;
  activeFilter1: number = null;
  activeFilter2: number = null;
  activeFilter3: number = null;

  // Subscriptions
  private subscriptions: Subscription[] = [];
  private suppressQueryParamsOnce: boolean = false;

  // Cache fraud summaries per phone number
  protected fraudSummaries: Map<
    string,
    { success_ratio: number; total_parcel: number } | null | undefined
  > = new Map();

  // Inject
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly uiService = inject(UiService);
  public override readonly utilsService = inject(UtilsService);
  private readonly reloadService = inject(ReloadService);
  private readonly clipboard = inject(Clipboard);
  private readonly pageDataService = inject(PageDataService);
  private readonly title = inject(Title);
  private readonly orderService = inject(OrderService);
  private readonly vendorService = inject(VendorService);
  private readonly datePipe = inject(DatePipe);
  private readonly settingService = inject(SettingService);
  private readonly countryService = inject(CountryService);
  public readonly filterStateService = inject(FilterStateService);

  ngOnInit() {
    // If page is reloaded, clear all filters and query params to show ALL data
    this.handleReloadReset();

    this.countryService.getShopCountryInfo().subscribe((setting) => {
      this.orderSetting = setting?.orderSetting;
    });

    this.adminRole = this.vendorService.getUserRole();

    // Load saved filter state
    this.loadSavedFilterState();

    // Sync component state with URL params on init
    this.syncStateWithUrlParams();

    // Reload Data
    const subReload = this.reloadService.refreshData$.subscribe(() => {
      this.getAllOrders();
    });
    this.subscriptions.push(subReload);

    // Initial data load after state sync
    setTimeout(() => {
      this.getAllOrders();
    }, 0);

    // Get Data from Param
    const subActivateRoute = this.activatedRoute.queryParamMap.subscribe(
      (qParam) => {
        if (qParam && qParam.get('page')) {
          this.currentPage = Number(qParam.get('page'));
        } else {
          this.currentPage = 1;
        }
        if (qParam && qParam.get('search')) {
          this.searchQuery = qParam.get('search');
        }

        if (qParam.get('orderType')) {
          this.selectedTab = qParam.get('orderType');
          this.filter = { orderStatus: this.selectedTab };
        }

        // Use startDate and endDate from query params if present
        const startDateParam = qParam.get('startDate');
        const endDateParam = qParam.get('endDate');

        if (startDateParam && endDateParam) {
          const startDate =
            startDateParam || this.utilsService.getDateString(new Date());
          const endDate =
            endDateParam || this.utilsService.getDateString(new Date());

          // Parse to Date object and adjust the time
          const gteDate = new Date(startDate);
          const lteDate = new Date(endDate);
          gteDate.setHours(0, 0, 0, 0);
          lteDate.setHours(23, 59, 59, 999);

          const orderType = qParam.get('orderType');
          // Apply the adjusted filter
          let dateField = '';
          switch (orderType) {
            case 'cancelled':
              this.filter = {
                'orderTimeline.cancelled.date': {
                  $gte: startDate,
                  $lte: endDate,
                },
                orderStatus: orderType,
              };
              break;
            case 'delivered':
              this.filter = {
                'orderTimeline.delivered.date': {
                  $gte: startDate,
                  $lte: endDate,
                },
                orderStatus: orderType,
              };
              break;
            case 'shipped':
              this.filter = {
                'orderTimeline.delivered.date': {
                  $gte: startDate,
                  $lte: endDate,
                },
                orderStatus: orderType,
              };
              break;

            case 'returned':
              this.filter = {
                'orderTimeline.returned.date': {
                  $gte: startDate,
                  $lte: endDate,
                },
                orderStatus: orderType,
              };
              break;
            case 'refunded':
              this.filter = {
                'orderTimeline.refunded.date': {
                  $gte: startDate,
                  $lte: endDate,
                },
                orderStatus: orderType,
              };
              break;
            case 'on_hold':
              dateField = `orderTimeline.onHold.date`;
              this.filter = {
                [dateField]: { $gte: gteDate, $lte: lteDate },
                orderStatus: orderType,
              };
              break;

            case 'confirmed':
              this.filter = {
                'orderTimeline.confirmed.date': {
                  $gte: startDate,
                  $lte: endDate,
                },
                orderStatus: orderType,
              };
              break;
            case 'pending':
              this.filter = {
                'orderTimeline.pending.date': {
                  $gte: startDate,
                  $lte: endDate,
                },
                orderStatus: orderType,
              };
              break;

            default:
              this.filter = {
                checkoutDate: { $gte: gteDate, $lte: lteDate },
              };
              break;
          }
        }

        if (qParam.get('courier')) {
          const startDate =
            startDateParam || this.utilsService.getDateString(new Date());
          const endDate =
            endDateParam || this.utilsService.getDateString(new Date());
          this.filter = {
            'courierData.createdAt': { $gte: startDate, $lte: endDate },
            orderStatus: { $nin: ['cancelled', 'on_hold'] }, // Use $nin with an array of excluded values
          };
        }

        // If only date params are present (no checkoutDate/courier/orderType), filter by checkoutDate
        if (
          startDateParam &&
          endDateParam &&
          !qParam.get('courier') &&
          !qParam.get('orderType')
        ) {
          this.filter = {
            checkoutDate: { $gte: startDateParam, $lte: endDateParam },
            orderStatus: { $ne: 'cancelled' },
          };
        }

        this.getAllOrders();
      }
    );
    this.subscriptions.push(subActivateRoute);

    // Base Data
    this.setPageData();
    // Fetch orders happens via queryParam subscription above to ensure correct tab/filter
    this.initImageGalleryView();
    this.getSetting();
  }

  /**
   * Detect hard reload and reset filters + query params
   */
  private handleReloadReset(): void {
    try {
      const navEntries: any = (performance as any).getEntriesByType?.(
        'navigation'
      );
      const isReload =
        (navEntries && navEntries[0]?.type === 'reload') ||
        ((performance as any).navigation &&
          (performance as any).navigation.type === 1);

      // Only reset if it's actually a reload AND there are no query params
      const hasQueryParams =
        Object.keys(this.activatedRoute.snapshot.queryParams).length > 0;

      if (isReload && !hasQueryParams) {
        // Clear persisted filter state
        this.filterStateService.clearAllFilters();

        // Reset component/local state
        this.searchQuery = null;
        this.filter = null;
        this.selectedTab = this.tableTabData[0].value;
        this.dataFormDateRange.reset();
        this.dataFormDateRangeCourier.reset();

        // Also clear stored tab state
        try {
          localStorage.removeItem('orderSelectedTab');
        } catch {}

        // Tell queryParam subscription to ignore the first emission after reload
        this.suppressQueryParamsOnce = true;

        // Strip all query params (keep only page=1) so we land on ALL data
        this.router
          .navigate([], {
            queryParams: { page: 1 },
            queryParamsHandling: '',
          })
          .then();
      }
    } catch (e) {
      // No-op: if performance API not available, skip
    }
  }

  ngAfterViewInit(): void {
    const formValue = this.searchForm.valueChanges;
    const subSearch = formValue
      .pipe(
        map((t: any) => t['searchTerm']),
        filter(() => this.searchForm.valid),
        debounceTime(300), // Reduced debounce time for faster response
        distinctUntilChanged()
      )
      .subscribe((searchTerm: string) => {
        // Update search query immediately
        this.searchQuery = searchTerm;

        if (searchTerm && searchTerm.trim()) {
          // Save search query to filter state
          this.filterStateService.setFilterState(
            'searchQuery',
            searchTerm.trim()
          );

          // Update query params with the new search term and reset page to 1
          this.router
            .navigate([], {
              queryParams: { search: searchTerm.trim(), page: 1 },
              queryParamsHandling: 'merge',
            })
            .then(() => {
              // Trigger search immediately after URL update
              this.getAllOrders();
            });
        } else {
          // Clear search query from filter state
          this.filterStateService.clearFilter('searchQuery');
          this.searchQuery = null;

          // Remove search query param when input is empty and reset page to 1
          this.router
            .navigate([], {
              queryParams: { search: null, page: 1 },
              queryParamsHandling: 'merge',
            })
            .then(() => {
              // Trigger search immediately after URL update
              this.getAllOrders();
            });
        }
      });

    this.subscriptions.push(subSearch);
  }

  endChangeRegDateRange(event: MatDatepickerInputEvent<any>) {
    if (event.value) {
      const startDate = this.utilsService.getDateString(
        this.dataFormDateRange.value.start
      );
      const endDate = this.utilsService.getDateString(
        this.dataFormDateRange.value.end
      );

      // Save filter state
      this.filterStateService.setDateFilter(
        this.dataFormDateRange.value.start,
        this.dataFormDateRange.value.end,
        startDate,
        endDate
      );

      // Preserve current tab's order status when applying date filter
      const baseFilter = { checkoutDate: { $gte: startDate, $lte: endDate } };

      if (this.selectedTab === 'all') {
        this.filter = baseFilter;
      } else if (this.selectedTab === 'trash') {
        this.filter = { ...baseFilter, status: 'trash' };
      } else {
        this.filter = { ...baseFilter, orderStatus: this.selectedTab };
      }

      // Reset to page 1 when filter is applied, but preserve URL page if it exists
      const urlPage = this.activatedRoute.snapshot.queryParams['page'];
      this.currentPage = urlPage ? Number(urlPage) : 1;
      // Re fetch Data
      this.getAllOrders();
    }
  }

  endChangeRegDateRangeCourier(event: MatDatepickerInputEvent<any>) {
    if (event.value) {
      const startDate = this.utilsService.getDateString(
        this.dataFormDateRangeCourier.value.start
      );
      const endDate = this.utilsService.getDateString(
        this.dataFormDateRangeCourier.value.end
      );

      // Save courier filter state
      this.filterStateService.setCourierDateFilter(
        this.dataFormDateRangeCourier.value.start,
        this.dataFormDateRangeCourier.value.end,
        startDate,
        endDate
      );

      // Preserve current tab's order status when applying courier date filter
      const baseFilter = {
        'courierData.createdAt': { $gte: startDate, $lte: endDate },
      };

      if (this.selectedTab === 'all') {
        this.filter = baseFilter;
      } else if (this.selectedTab === 'trash') {
        this.filter = { ...baseFilter, status: 'trash' };
      } else {
        this.filter = { ...baseFilter, orderStatus: this.selectedTab };
      }

      // Reset to page 1 when filter is applied, but preserve URL page if it exists
      const urlPage = this.activatedRoute.snapshot.queryParams['page'];
      this.currentPage = urlPage ? Number(urlPage) : 1;
      // Re fetch Data
      this.getAllOrders();
    }
  }

  get dateFilterTitle() {
    if (
      this.dataFormDateRange.get('start').value &&
      this.dataFormDateRange.get('end').value
    ) {
      const startDate = this.datePipe.transform(
        this.dataFormDateRange.get('start').value,
        'mediumDate'
      );
      const endDate = this.datePipe.transform(
        this.dataFormDateRange.get('end').value,
        'mediumDate'
      );
      if (startDate === endDate) {
        return endDate;
      } else {
        return startDate + '-' + endDate;
      }
    } else {
      return 'Filter in Date';
    }
  }

  /**
   * Base Init Methods
   * initImageGalleryView()
   */
  private initImageGalleryView() {
    const subGalleryImageView = this.activatedRoute.queryParamMap.subscribe(
      (qParam) => {
        if (!qParam.get('gallery-image-view')) {
          this.closeGallery();
        }
      }
    );
    this.subscriptions.push(subGalleryImageView);
  }

  /**
   * Page Data
   * setPageData()
   */
  private setPageData(): void {
    this.title.setTitle('Order');
    this.pageDataService.setPageData({
      title: 'Order',
      navArray: [
        { name: 'Dashboard', url: `/dashboard` },
        { name: 'Order', url: 'https://www.youtube.com/embed/kd2YjeLYohE' },
      ],
    });
  }

  /**
   * Handle Tab
   * onTabChange()
   */
  onTabChange(data: string) {
    this.selectedTab = data;
    // Save selected tab to localStorage for persistence
    this.saveTabState(data);
    // Save selected tab to filter state service
    this.filterStateService.setFilterState('selectedTab', data);

    // Apply tab filter using the extracted method
    this.applyTabFilter(data);

    this.onClearSelection();
    this.onClearSearch();
    // Reset to page 1 when tab changes
    this.currentPage = 1;
    // this.onClearDataQuery(this.filter);
    // Re fetch Data
    this.reFetchData();
  }

  getOrderedItemsImages(orderData: any): string[] {
    return orderData?.orderedItems?.map((item: any) => item?.image);
  }

  displayImages(data: any) {
    const images = this.getOrderedItemsImages(data);
    return images;
  }
  /**
   * HTTP REQ HANDLE
   * getAllOrders()
   * updateMultipleOrderById()
   * deleteMultipleOrderById()
   */

  private getAllOrders() {
    const pagination: Pagination = {
      pageSize: Number(this.dataPerPage),
      currentPage: Number(this.currentPage) - 1,
    };

    const filterData: FilterData = {
      pagination: pagination,
      filter: {
        ...this.filter,
        ...(this.filter?.status ? {} : { status: { $ne: 'trash' } }),
      },
      select: this.select,
      sort: this.sortQuery,
    };

    const subscription = this.orderService
      .getAllOrders(filterData, this.searchQuery)
      .subscribe({
        next: (res) => {
          this.allTableData = res.data;
          this.productSummary = res.productSummary;
          this.totalData = res.count ?? 0;

          if (this.allTableData && this.allTableData.length) {
            this.allTableData.forEach((m, i) => {
              const index = this.selectedIds.findIndex((f) => f === m._id);
              this.allTableData[i].select = index !== -1;
            });
            this.checkSelectionData();

            // Prefetch fraud summaries for current page phone numbers
            const uniquePhones = new Set<string>(
              this.allTableData.map((o) => o?.phoneNo).filter((p) => !!p)
            );
            uniquePhones.forEach((phone) => {
              if (!this.fraudSummaries.has(phone)) {
                // mark as loading
                this.fraudSummaries.set(phone, undefined);
                const subFraud = this.orderService
                  .checkedFraudOrder(phone)
                  .subscribe({
                    next: (r) => {
                      const s = r?.data?.courierData?.summary;
                      if (s && s.total_parcel != null) {
                        this.fraudSummaries.set(phone, {
                          success_ratio: s.success_ratio ?? 0,
                          total_parcel: s.total_parcel ?? 0,
                        });
                      } else {
                        this.fraudSummaries.set(phone, null);
                      }
                    },
                    error: () => {
                      this.fraudSummaries.set(phone, null);
                    },
                  });
                this.subscriptions.push(subFraud);
              }
            });

          }
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          console.log(err);
        },
      });
    this.subscriptions.push(subscription);
  }

  private getSetting() {
    const subscription = this.settingService
      .getSetting('invoiceSetting orderSetting')
      .subscribe({
        next: (res) => {
          if (res.data) {
            this.invoiceSetting = res.data?.invoiceSetting;
            this.orderSetting = res.data?.orderSetting;
          }
        },
        error: (err) => {
          console.log(err);
        },
      });

    this.subscriptions.push(subscription);
  }

  getInvoiceRoute(orderId: string): string[] {
    const selected = this.invoiceSetting?.selectedInvoice || 'invoice1';
    return ['/order-invoice', selected, orderId];
  }

  private updateMultipleOrderById(data: any) {
    const subscription = this.orderService
      .updateMultipleOrderById(this.selectedIds, data)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.selectedIds = [];
            this.checkAndUpdateSelect();
            this.reloadService.needRefreshData$();
            this.uiService.message(res.message, 'success');
          } else {
            this.uiService.message(res.message, 'wrong');
          }
        },
        error: (err) => {
          console.log(err);
        },
      });
    this.subscriptions.push(subscription);
  }

  private deleteMultipleOrderById() {
    const subscription = this.orderService
      .deleteMultipleOrderById(this.selectedIds)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.selectedIds = [];
            this.uiService.message(res.message, 'success');
            this.checkAndUpdateSelect();
            // fetch Data
            if (this.currentPage > 1) {
              this.router.navigate([], { queryParams: { page: 1 } }).then();
            } else {
              this.reloadService.needRefreshData$();
            }
          } else {
            this.uiService.message(res.message, 'warn');
          }
        },
        error: (err) => {
          console.log(err);
        },
      });
    this.subscriptions.push(subscription);
  }

  private deleteMultipleOrdersById() {
    const subscription = this.orderService
      .deleteMultipleOrdersById(this.selectedIds)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.selectedIds = [];
            this.uiService.message(res.message, 'success');
            this.checkAndUpdateSelect();
            // fetch Data
            if (this.currentPage > 1) {
              this.router.navigate([], { queryParams: { page: 1 } }).then();
            } else {
              this.reloadService.needRefreshData$();
            }
          } else {
            this.uiService.message(res.message, 'warn');
          }
        },
        error: (err) => {
          console.log(err);
        },
      });
    this.subscriptions.push(subscription);
  }

  private deleteAllTrashByShop() {
    const subscription = this.orderService.deleteAllTrashByShop().subscribe({
      next: (res) => {
        if (res.success) {
          this.uiService.message(res.message, 'success');
          this.checkAndUpdateSelect();
          // fetch Data
          if (this.currentPage > 1) {
            this.router.navigate([], { queryParams: { page: 1 } }).then();
          } else {
            this.reloadService.needRefreshData$();
            // this.filter = {status: 'trash'}
          }
          this.selectedTab = 'all';
          this.filter = null;
        } else {
          this.uiService.message(res.message, 'warn');
        }
      },
      error: (err) => {
        console.log(err);
      },
    });
    this.subscriptions.push(subscription);
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
    // Always call getAllOrders directly, let it handle the current page from URL
    this.getAllOrders();
  }

  sortData(query: any, type: number) {
    if (this.activeSort === type) {
      this.sortQuery = { createdAt: -1 };
      this.activeSort = null;
    } else {
      this.sortQuery = query;
      this.activeSort = type;
    }
    this.getAllOrders();
  }

  filterData(value: any, type: any, index: number) {
    switch (type) {
      case 'payment-type': {
        if (value) {
          this.filter = { ...this.filter, ...{ paymentType: value } };
          this.activeFilter1 = index;
        } else {
          delete this.filter['paymentType'];
          this.activeFilter1 = null;
        }

        break;
      }
      case 'payment-status': {
        if (value) {
          this.filter = { ...this.filter, ...{ paymentStatus: value } };
          this.activeFilter2 = index;
        } else {
          delete this.filter['paymentStatus'];
          this.activeFilter2 = null;
        }

        break;
      }
      case 'order-status': {
        if (value) {
          this.filter = { ...this.filter, ...{ orderStatus: value } };
          this.activeFilter3 = index;
        } else {
          delete this.filter['orderStatus'];
          this.activeFilter3 = null;
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
    this.selectedTab = 'all';
    this.activeSort = null;
    this.activeFilter1 = null;
    this.activeFilter2 = null;
    this.activeFilter3 = null;
    this.sortQuery = { createdAt: -1 };
    this.filter = filter ?? null;
    this.dataFormDateRange.reset();
    this.dataFormDateRangeCourier.reset();
    // Reset to page 1 when clearing filters
    this.currentPage = 1;
    // ✅ URL থেকে query param clear
    this.router.navigate([], {
      queryParams: { page: 1 },
      queryParamsHandling: '',
    });
    // Re fetch Data
    this.reFetchData();
  }

  onClearSearch() {
    this.searchForm.reset();
    this.searchQuery = null;
    // Clear search query from filter state
    this.filterStateService.clearFilter('searchQuery');
    this.router.navigate([], { queryParams: { search: null, page: 1 } }).then();
  }

  /**
   * Clear all filters and reset to default state
   */
  onClearAllFilters() {
    // Clear all filter states
    this.filterStateService.clearAllFilters();

    // Reset form controls
    this.dataFormDateRange.reset();
    this.dataFormDateRangeCourier.reset();
    this.searchForm.reset();

    // Reset component properties
    this.searchQuery = null;
    this.filter = null;
    this.selectedTab = this.tableTabData[0].value;
    this.currentPage = 1;

    // Reset active filters
    this.activeSort = null;
    this.activeFilter1 = null;
    this.activeFilter2 = null;
    this.activeFilter3 = null;
    this.sortQuery = { createdAt: -1 };

    // Save default tab state
    this.saveTabState(this.selectedTab);

    // Navigate with cleared query params - clear ALL possible query parameters
    this.router
      .navigate([], {
        queryParams: {
          page: 1,
        },
        queryParamsHandling: '',
      })
      .then();

    // Refresh data
    this.getAllOrders();
  }

  get isFilterChange(): boolean {
    if (!this.filter) {
      return false;
    } else {
      return !this.utilsService.checkObjectDeepEqual(
        this.defaultFilter ?? {},
        this.filter ?? {},
        'status'
      );
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
            message: 'Are you sure you want delete this data?',
          },
        });
        dialogRef.afterClosed().subscribe((dialogResult) => {
          if (dialogResult) {
            this.deleteMultipleOrderById();
          }
        });
      } else {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
          maxWidth: '400px',
          data: {
            title: 'Confirm Delete',
            message: 'Are you sure you want delete this data?',
          },
        });
        dialogRef.afterClosed().subscribe((dialogResult) => {
          if (dialogResult) {
            this.deleteMultipleOrdersById();
          }
        });
      }
    } else if (type === 'edit') {
      if (data?.orderStatus !== 'sent to courier') {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
          maxWidth: '400px',
          data: {
            title: 'Confirm Edit',
            message: 'Are you sure you want edit this data?',
          },
        });
        dialogRef.afterClosed().subscribe((dialogResult) => {
          if (dialogResult) {
            this.updateMultipleOrderById(data);
          }
        });
      } else {
        this.openCourierDialog(data);
      }
    } else if (type === 'restore') {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        maxWidth: '800px',
        data: {
          title: 'Confirm restore from trash',
          message: 'Are you sure you want restore from trash this data?',
        },
      });
      dialogRef.afterClosed().subscribe((dialogResult) => {
        if (dialogResult) {
          const mData = {
            status: 'restore',
          };

          this.updateMultipleOrderById(mData);
        }
      });
    } else if (type === 'trash') {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        maxWidth: '400px',
        data: {
          title: 'Confirm Edit',
          message: 'Are you sure you want clean this data?',
        },
      });
      dialogRef.afterClosed().subscribe((dialogResult) => {
        if (dialogResult) {
          this.deleteAllTrashByShop();
        }
      });
    }
  }

  openDetailsDialog(_id: string): void {
    const fData = this.allTableData.find((f) => f._id === _id);
    this.dialog.open(TableDetailsDialogComponent, {
      data: fData,
      maxWidth: '800px',
      height: 'auto',
      maxHeight: '90vh',
    });
  }

  openNoteDialog(id: any) {
    this.dialog.open(NoteDialogComponent, {
      width: '600px',
      data: id,
    });
  }

  openCourierDialog(data: any) {
    const dialogRef = this.dialog.open(CourierSelectionDialogComponent, {
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // এখানে API Call করো বা Order Create করো:
        this.updateMultipleOrderById(data);
      } else {
      }
    });
  }
  /**
   * PAGINATION CHANGE
   * onPageChanged()
   */
  public onPageChanged(event: any) {
    // Update current page
    this.currentPage = event;

    // Build query params with current filters
    const queryParams: any = { page: event };

    // Add search query if exists
    if (this.searchQuery) {
      queryParams.search = this.searchQuery;
    }

    // Add selected tab if not default
    if (this.selectedTab && this.selectedTab !== this.tableTabData[0].value) {
      queryParams.orderType = this.selectedTab;
    }

    // Add date filter if exists
    const dateFilter = this.filterStateService.getDateFilter();
    if (dateFilter?.startDateString && dateFilter?.endDateString) {
      queryParams.startDate = dateFilter.startDateString;
      queryParams.endDate = dateFilter.endDateString;
    }

    // Add courier date filter if exists
    const courierDateFilter = this.filterStateService.getCourierDateFilter();
    if (
      courierDateFilter?.startDateString &&
      courierDateFilter?.endDateString
    ) {
      queryParams.courierStartDate = courierDateFilter.startDateString;
      queryParams.courierEndDate = courierDateFilter.endDateString;
    }

    // Navigate with merge to preserve existing query params
    this.router
      .navigate([], {
        queryParams,
        queryParamsHandling: 'merge',
      })
      .then(() => {
        // Fetch data after URL update
        this.getAllOrders();
      });
  }

  /**
   * Gallery Image View
   * openGallery()
   * closeGallery()
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
    // let text:any;
    //     if (data.courierData && data.courierData.providerName === 'Steadfast Courier'){
    //     text = `https://steadfast.com.bd/t/${data.courierData.consignmentId}`;
    //     }else {
    //       text = `https://merchant.pathao.com/tracking?consignment_id=${data.courierData.consignmentId}&phone=${data.phoneNo}`;
    //     }

    this.clipboard.copy(text);
    // this.uiService.message('Tracking link copied successfully.', 'success');
    this.uiService.message('Consignment id copied successfully.', 'success');
  }

  trackingLink(data: any): string {
    if (
      data?.courierData &&
      data.courierData.providerName === 'Steadfast Courier'
    ) {
      return `https://steadfast.com.bd/t/${data.courierData.trackingId}`;
    } else {
      return `https://merchant.pathao.com/tracking?consignment_id=${data.courierData.consignmentId}&phone=${data.phoneNo}`;
    }
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
   * Download all orders
   */
  openProductSummary() {
    this.dialog.open(ProductSummaryDialogComponent, {
      width: '600px',
      data: { summary: this.productSummary },
    });
  }

  /**
   * Print all orders
   */

  invoicePrint() {
    // যদি single select থাকে তাহলে তাও কাজ করবে
    if (!this.selectedIds?.length) {
      // UI তে বলতে পারো: কমপক্ষে ১টা order select করুন
      return;
    } // যদি single select থাকে তাহলে তাও কাজ করবে
    if (
      this.invoiceSetting?.selectedInvoice !== 'invoice1' &&
      this.invoiceSetting?.selectedInvoice !== 'invoice6'
    ) {
      // UI তে বলতে পারো: কমপক্ষে ১টা order select করুন
      this.uiService.message(
        'Only multiple invoice print option available for invoice 1',
        'wrong'
      );
      return;
    }

    const selected = this.invoiceSetting?.selectedInvoice || 'invoice1';
    if (selected === 'invoice1') {
      // state দিয়ে ids পাঠাই
      this.router.navigate(['/order-invoice/multiple-invoice-prints'], {
        state: {
          ids: this.selectedIds,
          selectedInvoice: selected,
        },
      });
    } else {
      // state দিয়ে ids পাঠাই
      this.router.navigate(['/order-invoice/multiple-sticker-prints'], {
        state: {
          ids: this.selectedIds,
          selectedInvoice: selected,
        },
      });
    }
  }

  /**
   * Download all orders
   */
  public downloadFiles(): void {
    // If there are selected IDs, filter allTableData to only those
    if (this.selectedIds && this.selectedIds.length) {
      let dataToDownload = this.allTableData.filter((order) =>
        this.selectedIds.includes(order._id)
      );
      if (!dataToDownload || !dataToDownload.length) {
        this.uiService.message('No order data to download.', 'warn');
        return;
      }
      this.generateAndDownloadFiles(dataToDownload);
    } else {
      // Download all orders (fetch without pagination)
      this.fetchAllDataForDownload();
    }
  }

  // Fetch all orders without pagination download
  private fetchAllDataForDownload(): void {
    const filterData: FilterData = {
      pagination: {
        pageSize: 1000000, // Large number to get all data
        currentPage: 0,
      },
      filter: {
        ...this.filter,
        ...(this.filter?.status ? {} : { status: { $ne: 'trash' } }),
      },
      select: this.select,
      sort: this.sortQuery,
    };

    const subscription = this.orderService
      .getAllOrders(filterData, this.searchQuery)
      .subscribe({
        next: (res) => {
          if (res.data && res.data.length) {
            this.generateAndDownloadFiles(res.data);
          } else {
            this.uiService.message('No order data to download.', 'warn');
          }
        },
        error: (err) => {
          console.log(err);
          this.uiService.message('Error fetching orders for download.', 'warn');
        },
      });
    this.subscriptions.push(subscription);
  }

  // Generate and download CSV from order data
  // private generateAndDownloadFiles(dataToDownload: Order[]): void {
  //   const fields = [
  //     { label: 'Order ID', value: 'orderId' },
  //     { label: 'Name', value: 'name' },
  //     { label: 'Phone No', value: 'phoneNo' },
  //     { label: 'Address', value: 'shippingAddress' },
  //     { label: 'Order From', value: 'orderedFrom' },
  //     { label: 'Order Date', value: 'checkoutDate' },
  //     { label: 'Order Time', value: 'createdAt' },
  //     { label: 'Payment Type', value: 'providerName' },
  //     { label: 'Payment Status', value: 'paymentStatus' },
  //     { label: 'Order Status', value: 'orderStatus' },
  //     { label: 'Grand Total', value: 'grandTotal' }
  //   ];
  //   const csvRows = [fields.map(f => f.label).join(',')].concat(
  //     dataToDownload.map(order => {
  //       return fields.map(f => {
  //         let val;
  //         switch (f.value) {
  //           case 'checkoutDate':
  //             val = order.checkoutDate ? this.datePipe.transform(order.checkoutDate, 'yyyy-MM-dd') : '';
  //             break;
  //           case 'createdAt':
  //             val = order.createdAt ? this.datePipe.transform(order.createdAt, 'HH:mm') : '';
  //             break;
  //           default:
  //             val = order[f.value] ?? '';
  //         }
  //         if (typeof val === 'string') {
  //           val = '"' + val.replace(/"/g, '""') + '"';
  //         }
  //         return val;
  //       }).join(',');
  //     })
  //   );
  //   const csvContent = csvRows.join('\n');
  //   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  //   const url = URL.createObjectURL(blob);
  //   const a = document.createElement('a');
  //   a.href = url;
  //   a.download = 'orders.csv';
  //   document.body.appendChild(a);
  //   a.click();
  //   document.body.removeChild(a);
  //   URL.revokeObjectURL(url);
  // }

  // Generate and download CSV from order data
  // private generateAndDownloadFiles(dataToDownload: Order[]): void {
  //   const fields = [
  //     { label: 'Order ID', value: 'orderId' },
  //     { label: 'Name', value: 'name' },
  //     { label: 'Phone No', value: 'phoneNo' },
  //     { label: 'Address', value: 'shippingAddress' },
  //     { label: 'Products Name', value: 'orderedItems.names' },
  //     { label: 'Images', value: 'orderedItems.images' },
  //     { label: 'Order From', value: 'orderedFrom' },
  //     { label: 'Order Date', value: 'checkoutDate' },
  //     { label: 'Order Time', value: 'createdAt' },
  //     { label: 'Payment Type', value: 'providerName' },
  //     { label: 'Payment Status', value: 'paymentStatus' },
  //     { label: 'Order Status', value: 'orderStatus' },
  //     { label: 'Grand Total', value: 'grandTotal' },
  //   ];
  //
  //   // Add BOM (Byte Order Mark) for UTF-8 to handle Bangla text
  //   const BOM = '\uFEFF';
  //   const csvRows = [fields.map(f => f.label).join(',')];
  //
  //
  //   const getPathValue = (obj: any, path: string): any => {
  //     if (!obj || !path) return '';
  //
  //     if (path === 'orderedItems.names') {
  //       const items = Array.isArray(obj.orderedItems) ? obj.orderedItems : [];
  //       // ✅ এক লাইনের বদলে প্রতিটি নাম নতুন লাইনে যাবে
  //       return items
  //         .map((it) => it?.name ?? '')
  //         .filter(Boolean)
  //         .join('\n');
  //     }
  //
  //     if (path === 'orderedItems.images') {
  //       const items = Array.isArray(obj.orderedItems) ? obj.orderedItems : [];
  //       return items
  //         .map((it) => it?.image ?? '')
  //         .filter(Boolean)
  //         .join('\n'); // ✅ ইমেজগুলাও আলাদা লাইনে
  //     }
  //
  //     return (
  //       path
  //         .split('.')
  //         .reduce((acc, key) => (acc ? acc[key] : undefined), obj) ?? ''
  //     );
  //   };
  //
  //   const escapeCsv = (val: any): string => {
  //     if (val === null || val === undefined) return '';
  //     let str = String(val);
  //     // ✅ লাইন ব্রেক সহ কন্টেন্ট এক সেলেই দেখাতে Excel-safe quote
  //     return '"' + str.replace(/"/g, '""') + '"';
  //   };
  //
  //   const header = fields.map((f) => f.label).join(',');
  //   const rows = dataToDownload.map((order) =>
  //     fields
  //       .map((f) => {
  //         let val: any;
  //         switch (f.value) {
  //           case 'checkoutDate':
  //             val = order.checkoutDate
  //               ? this.datePipe.transform(order.checkoutDate, 'yyyy-MM-dd')
  //               : '';
  //             break;
  //           case 'createdAt':
  //             val = order.createdAt
  //               ? this.datePipe.transform(order.createdAt, 'HH:mm')
  //               : '';
  //             break;
  //           default:
  //             val = getPathValue(order, f.value);
  //         }
  //         return escapeCsv(val);
  //       })
  //       .join(',')
  //   );
  //
  //   const csvContent = [header, ...rows].join('\n');
  //   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  //   const url = URL.createObjectURL(blob);
  //   const a = document.createElement('a');
  //   a.href = url;
  //   a.download = 'orders.csv';
  //   document.body.appendChild(a);
  //   a.click();
  //   document.body.removeChild(a);
  //   URL.revokeObjectURL(url);
  // }

  // Generate and download CSV from order data
  private generateAndDownloadFiles(dataToDownload: Order[]): void {
    const fields = [
      { label: 'Order ID', value: 'orderId' },
      { label: 'Name', value: 'name' },
      { label: 'Phone No', value: 'phoneNo' },
      { label: 'Address', value: 'shippingAddress' },
      { label: 'Products Name', value: 'orderedItems' },
      { label: 'Images', value: 'orderedItems.images' },
      { label: 'Order From', value: 'orderedFrom' },
      { label: 'Order Date', value: 'checkoutDate' },
      { label: 'Order Time', value: 'createdAt' },
      { label: 'Payment Type', value: 'providerName' },
      { label: 'Payment Status', value: 'paymentStatus' },
      { label: 'Order Status', value: 'orderStatus' },
      { label: 'Grand Total', value: 'grandTotal' },
    ];

    // Add BOM (Byte Order Mark) for UTF-8 to handle Bangla text
    const BOM = '\uFEFF';
    const csvRows = [fields.map((f) => f.label).join(',')];

    dataToDownload.forEach((order) => {
      const row = fields.map((f) => {
        let val;
        switch (f.value) {
          case 'checkoutDate':
            val = order.checkoutDate
              ? this.datePipe.transform(order.checkoutDate, 'yyyy-MM-dd')
              : '';
            break;

          case 'createdAt':
            val = order.createdAt
              ? this.datePipe.transform(order.createdAt, 'HH:mm')
              : '';
            break;

          case 'shippingAddress':
            // Preserve Bangla text in address
            val = [
              order?.shippingAddress,
              order?.zone,
              order?.area,
              order?.division,
            ]
              .filter(Boolean)
              .join(', ');
            break;

          case 'phoneNo':
            // Preserve leading zeros in phone numbers by treating as text
            val = order.phoneNo ? `="${order.phoneNo}"` : '';
            break;

          case 'orderedItems':
            val = Array.isArray(order?.orderedItems)
              ? order.orderedItems
                  .map((item) => item?.name)
                  .filter(Boolean)
                  .join(', ')
              : '';
            break;
          case 'orderedItems.images':
            // val = Array.isArray(order?.orderedItems)
            //   ? order.orderedItems.map(item => item?.name).filter(Boolean).join(', ')
            //   : '';
            const items = Array.isArray(order.orderedItems)
              ? order.orderedItems
              : [];
            val = items
              .map((it) => it?.image ?? '')
              .filter(Boolean)
              .join('\n'); // ✅ ইমেজগুলাও আলাদা লাইনে
            break;

          default:
            val = order[f.value] ?? '';
        }

        // Escape quotes and wrap in quotes if it's a string
        if (typeof val === 'string' && f.value !== 'phoneNo') {
          val = `"${val.replace(/"/g, '""')}"`;
        }

        return val;
      });

      csvRows.push(row.join(','));
    });

    // Create CSV content with BOM for proper UTF-8 encoding
    const csvContent = BOM + csvRows.join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  whatsAppLink(rawPhone: string): string {
    const num = this.normalizeBdPhone(rawPhone);
    return `https://wa.me/${num}`;
  }

  private normalizeBdPhone(p: string): string {
    // Keep digits only
    let n = (p || '').replace(/\D/g, '');
    // If starts with 880... keep; if starts with 0, convert to 880...
    if (n.startsWith('880')) return n;
    if (n.startsWith('0')) return '88' + n; // 0XXXXXXXXXX -> 880XXXXXXXXXX
    // If already without leading zero but local, prepend 880
    if (n.length === 10 || n.length === 11) return '88' + n;
    return n;
  }

  callLink(rawPhone: string): string {
    const num = this.normalizeBdPhone(rawPhone);
    return `tel:${num}`;
  }
  /**
   * Tab State Management
   * saveTabState()
   * getStoredTabState()
   */
  private saveTabState(tab: string): void {
    try {
      localStorage.setItem('orderSelectedTab', tab);
    } catch (error) {
      console.warn('Could not save tab state to localStorage:', error);
    }
  }

  private getStoredTabState(): string | null {
    try {
      return localStorage.getItem('orderSelectedTab');
    } catch (error) {
      console.warn('Could not retrieve tab state from localStorage:', error);
      return null;
    }
  }

  /**
   * Sync component state with URL parameters
   */
  private syncStateWithUrlParams(): void {
    const urlParams = this.activatedRoute.snapshot.queryParams;

    // Sync page - always sync from URL
    if (urlParams['page']) {
      this.currentPage = Number(urlParams['page']);
    } else {
      this.currentPage = 1; // Default to page 1 if no page param
    }

    // Sync search query
    if (urlParams['search']) {
      this.searchQuery = urlParams['search'];
    }

    // Sync selected tab and apply filter
    if (urlParams['orderType']) {
      this.selectedTab = urlParams['orderType'];
      // Apply tab filter
      this.applyTabFilter(this.selectedTab);
    }

    // Handle checkoutDate parameter from dashboard cards
    if (urlParams['checkoutDate']) {
      this.handleCheckoutDateFilter(urlParams['checkoutDate']);
    }

    // Sync date filter
    if (urlParams['startDate'] && urlParams['endDate']) {
      const startDate = new Date(urlParams['startDate']);
      const endDate = new Date(urlParams['endDate']);
      this.dataFormDateRange.patchValue({
        start: startDate,
        end: endDate,
      });
      // Save to filter state service
      this.filterStateService.setDateFilter(
        startDate,
        endDate,
        urlParams['startDate'],
        urlParams['endDate']
      );

      // Apply the date filter
      this.applyDateFilterFromParams(
        urlParams['startDate'],
        urlParams['endDate']
      );
    }

    // Sync courier date filter
    if (urlParams['courierStartDate'] && urlParams['courierEndDate']) {
      const startDate = new Date(urlParams['courierStartDate']);
      const endDate = new Date(urlParams['courierEndDate']);
      this.dataFormDateRangeCourier.patchValue({
        start: startDate,
        end: endDate,
      });
      // Save to filter state service
      this.filterStateService.setCourierDateFilter(
        startDate,
        endDate,
        urlParams['courierStartDate'],
        urlParams['courierEndDate']
      );
    }
  }

  /**
   * Apply date filter from URL parameters
   */
  private applyDateFilterFromParams(
    startDateString: string,
    endDateString: string
  ): void {
    // Apply the date filter based on current tab
    const baseFilter = {
      checkoutDate: { $gte: startDateString, $lte: endDateString },
    };

    if (this.selectedTab === 'all') {
      this.filter = baseFilter;
    } else if (this.selectedTab === 'trash') {
      this.filter = { ...baseFilter, status: 'trash' };
    } else {
      this.filter = { ...baseFilter, orderStatus: this.selectedTab };
    }
  }

  /**
   * Handle checkoutDate filter from dashboard cards
   */
  private handleCheckoutDateFilter(checkoutDate: string): void {
    let startDate: string, endDate: string;
    const today = new Date();

    switch (checkoutDate) {
      case 'Today':
        startDate = this.utilsService.getDateString(new Date());
        endDate = this.utilsService.getDateString(new Date());
        break;
      default:
        // If it's a specific date string, use it
        if (checkoutDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          startDate = checkoutDate;
          endDate = checkoutDate;
        } else {
          // Default to today
          startDate = this.utilsService.getDateString(new Date());
          endDate = this.utilsService.getDateString(new Date());
        }
        break;
    }

    // Set the date range form values
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    this.dataFormDateRange.patchValue({
      start: startDateObj,
      end: endDateObj,
    });

    // Save to filter state service
    this.filterStateService.setDateFilter(
      startDateObj,
      endDateObj,
      startDate,
      endDate
    );

    // Apply the date filter
    const baseFilter = { checkoutDate: { $gte: startDate, $lte: endDate } };

    if (this.selectedTab === 'all') {
      this.filter = baseFilter;
    } else if (this.selectedTab === 'trash') {
      this.filter = { ...baseFilter, status: 'trash' };
    } else {
      this.filter = { ...baseFilter, orderStatus: this.selectedTab };
    }
  }

  /**
   * Apply tab filter (extracted from onTabChange for reuse)
   */
  private applyTabFilter(tab: string): void {
    // Always respect current date range filter (if present) across all tabs
    const activeDateFilter = this.filterStateService.getDateFilter();
    const dateClause =
      activeDateFilter?.startDateString && activeDateFilter?.endDateString
        ? {
            checkoutDate: {
              $gte: activeDateFilter.startDateString,
              $lte: activeDateFilter.endDateString,
            },
          }
        : null;

    if (tab === 'all') {
      this.filter = dateClause ? { ...dateClause } : null;
    } else if (tab === 'trash') {
      this.filter = dateClause
        ? { ...dateClause, status: 'trash' }
        : { status: 'trash' };
    } else {
      this.filter = dateClause
        ? { ...dateClause, orderStatus: tab }
        : { orderStatus: tab };
    }
  }

  /**
   * Load saved filter state from service
   */
  private loadSavedFilterState(): void {
    // Load current page from URL params first
    const urlPage = this.activatedRoute.snapshot.queryParams['page'];
    if (urlPage) {
      this.currentPage = Number(urlPage);
    }

    // Load date filter
    const dateFilter = this.filterStateService.getDateFilter();
    if (dateFilter?.startDate && dateFilter?.endDate) {
      this.dataFormDateRange.patchValue({
        start: dateFilter.startDate,
        end: dateFilter.endDate,
      });
    }

    // Load courier date filter
    const courierDateFilter = this.filterStateService.getCourierDateFilter();
    if (courierDateFilter?.startDate && courierDateFilter?.endDate) {
      this.dataFormDateRangeCourier.patchValue({
        start: courierDateFilter.startDate,
        end: courierDateFilter.endDate,
      });
    }

    // Load search query
    const searchQuery = this.filterStateService.getFilterState('searchQuery');
    if (searchQuery) {
      this.searchQuery = searchQuery;
    }

    // Load selected tab
    const selectedTab = this.filterStateService.getFilterState('selectedTab');
    if (selectedTab) {
      this.selectedTab = selectedTab;
    }
  }


  // Expose cached summary for template usage
  public getFraudSummary(
    phone: string
  ): { success_ratio: number; total_parcel: number } | null | undefined {
    return this.fraudSummaries.get(phone);
  }

  openFraudCheckerDialog(event: Event, phoneNo: string) {
    event.stopPropagation();
    if (!phoneNo) return;

    this.isLoading = true;
    const subscription = this.orderService
      .checkedFraudOrder(phoneNo)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            const courierData = res.data?.courierData;
            const dialogRef = this.dialog.open(FraudCheckerComponent, {
              maxWidth: "900px",
              width: "100%",
              height: "auto",
              panelClass: 'custom-dialog-container',
              data: { 
                mobile: phoneNo,
                courierData: courierData,
              }
            });

            dialogRef.afterClosed().subscribe(result => {
              if (result) {
                this.reloadService.needRefreshData$();
              }
            });
          } else {
            this.uiService.message(res.message, 'warn');
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.log(error);
        },
      });
    this.subscriptions.push(subscription);
  }

  /**
   * ON Destroy
   */
  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub?.unsubscribe());
  }
}
