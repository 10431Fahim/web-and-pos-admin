import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';

import { UiService } from '../../../services/core/ui.service';
import { PriceHistoryService } from '../../../services/common/price-history.service';
import { ReloadService } from '../../../services/core/reload.service';
import { UtilsService } from '../../../services/core/utils.service';
import { FilterData } from '../../../interfaces/gallery/filter-data';
import { PriceHistory } from '../../../interfaces/common/price-history.interface';

@Component({
  selector: 'app-price-history',
  templateUrl: './price-history.component.html',
  styleUrls: ['./price-history.component.scss']
})
export class PriceHistoryComponent implements OnInit, OnDestroy {
  // Store Data
  isLoading: boolean = true;
  priceHistory: PriceHistory[] = [];
  totalHistory = 0;
  historyPerPage = 10;
  currentPage = 0;
  productId: string = null;

  // Filter
  searchCtrl = new FormControl('');
  startDate: Date;
  endDate: Date = new Date();
  
  // Date Range Filter
  today = new Date();
  dataFormDateRange = new FormGroup({
    start: new FormControl(),
    end: new FormControl(),
  });

  // Subscriptions
  private subDataOne: Subscription;
  private subReload: Subscription;
  private subSearch: Subscription;

  constructor(
    private priceHistoryService: PriceHistoryService,
    private uiService: UiService,
    private activatedRoute: ActivatedRoute,
    private reloadService: ReloadService,
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
    // Get product ID from route if provided
    this.activatedRoute.queryParams.subscribe(params => {
      this.productId = params['productId'] || null;
      this.loadPriceHistory();
    });

    // Initial load if no query params
    if (!this.productId) {
      this.loadPriceHistory();
    }

    // Reload trigger
    this.subReload = this.reloadService.refreshData$.subscribe(() => {
      this.loadPriceHistory();
    });

    // Search Control
    this.subSearch = this.searchCtrl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        this.currentPage = 0;
        this.loadPriceHistory(term);
        return EMPTY;
      })
    ).subscribe();
  }

  loadPriceHistory(searchQuery?: string): void {
    this.isLoading = true;

    if (this.productId) {
      // Load history for specific product
      this.subDataOne = this.priceHistoryService.getPriceHistoryByProduct(this.productId).subscribe({
        next: (res) => {
          if (res.success) {
            this.priceHistory = res.data || [];
            this.totalHistory = res.count || 0;
            this.isLoading = false;
          } else {
            this.uiService.message('Failed to load price history', 'warn');
            this.isLoading = false;
          }
        },
        error: (err) => {
          console.error(err);
          this.uiService.message('Failed to load price history', 'warn');
          this.isLoading = false;
        }
      });
    } else {
      // Load all price history
      // Build date filter properly
      const dateFilter: any = {};
      if (this.startDate && this.endDate) {
        const start = new Date(this.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(this.endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$gte = start;
        dateFilter.$lte = end;
      }
      
      const filter: FilterData = {
        pagination: {
          pageSize: this.historyPerPage,
          currentPage: this.currentPage
        },
        filter: Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {},
        sort: { date: -1 }
      };

      console.log('Loading Price History with filter:', filter);
      console.log('Search Query:', searchQuery);
      console.log('Date Range:', { startDate: this.startDate, endDate: this.endDate });
      
      this.subDataOne = this.priceHistoryService.getAllPriceHistory(filter, searchQuery).subscribe({
        next: (res) => {
          console.log('Price History API Response:', res);
          if (res.success) {
            this.priceHistory = res.data || [];
            this.totalHistory = res.count || 0;
            console.log('Price History loaded:', {
              count: this.priceHistory.length,
              total: this.totalHistory,
              data: this.priceHistory
            });
            this.isLoading = false;
            if (this.priceHistory.length === 0) {
              this.uiService.message('No price history found for the selected date range', 'warn');
            }
          } else {
            console.error('Price History API returned success=false:', res);
            this.uiService.message(res.message || 'Failed to load price history', 'warn');
            this.isLoading = false;
          }
        },
        error: (err) => {
          console.error('Error loading price history:', err);
          console.error('Error details:', JSON.stringify(err, null, 2));
          this.uiService.message('Failed to load price history. Please check console for details.', 'warn');
          this.isLoading = false;
        }
      });
    }
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
        this.currentPage = 0;
        this.loadPriceHistory();
      }
    }
  }

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadPriceHistory(this.searchCtrl.value);
  }

  onPageChange(event: any): void {
    this.currentPage = event.pageIndex;
    this.historyPerPage = event.pageSize;
    this.loadPriceHistory(this.searchCtrl.value);
  }

  getPriceChange(history: PriceHistory): { type: string, amount: number, percentage: number } {
    const prev = history.previousPrice;
    const newPrice = history.newPrice;
    let change = { type: '', amount: 0, percentage: 0 };

    if (history.priceChangeType === 'costPrice') {
      change.amount = (newPrice.costPrice || 0) - (prev.costPrice || 0);
      change.type = 'Cost Price';
      if (prev.costPrice > 0) {
        change.percentage = (change.amount / prev.costPrice) * 100;
      }
    } else if (history.priceChangeType === 'salePrice') {
      change.amount = (newPrice.salePrice || 0) - (prev.salePrice || 0);
      change.type = 'Sale Price';
      if (prev.salePrice > 0) {
        change.percentage = (change.amount / prev.salePrice) * 100;
      }
    } else if (history.priceChangeType === 'regularPrice') {
      change.amount = (newPrice.regularPrice || 0) - (prev.regularPrice || 0);
      change.type = 'Regular Price';
      if (prev.regularPrice > 0) {
        change.percentage = (change.amount / prev.regularPrice) * 100;
      }
    } else {
      // All prices changed - show sale price change
      change.amount = (newPrice.salePrice || 0) - (prev.salePrice || 0);
      change.type = 'All Prices';
      if (prev.salePrice > 0) {
        change.percentage = (change.amount / prev.salePrice) * 100;
      }
    }

    return change;
  }

  ngOnDestroy(): void {
    if (this.subDataOne) {
      this.subDataOne.unsubscribe();
    }
    if (this.subReload) {
      this.subReload.unsubscribe();
    }
    if (this.subSearch) {
      this.subSearch.unsubscribe();
    }
  }
}

