import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ResponsePayload } from '../../interfaces/core/response-payload.interface';
import { FilterData } from '../../interfaces/gallery/filter-data';
import { Supplier } from '../../interfaces/common/supplier.interface';
import { VendorService } from '../vendor/vendor.service';

const API_SUPPLIER = environment.apiBaseLink + '/api/supplier/';

@Injectable({
  providedIn: 'root'
})
export class SupplierService {

  constructor(
    private httpClient: HttpClient,
    private vendorService: VendorService
  ) {
  }

  /**
   * Get Shop ID from Vendor Service
   */
  private getShopId(): string | null {
    const shopId = this.vendorService.getShopId();
    if (!shopId) {
      console.error('❌ Shop ID is required for supplier operations');
    }
    return shopId;
  }

  /**
   * ADD SUPPLIER
   */
  addSupplier(data: Supplier): Observable<ResponsePayload> {
    let params = new HttpParams();
    const shopId = this.getShopId();
    
    if (shopId) {
      params = params.append('shop', shopId);
    }
    
    return this.httpClient.post<ResponsePayload>(API_SUPPLIER + 'add', data, { params });
  }

  /**
   * GET ALL SUPPLIERS
   */
  getAllSuppliers(filterData: FilterData, searchQuery?: string): Observable<ResponsePayload> {
    let params = new HttpParams();
    const shopId = this.getShopId();
    
    if (shopId) {
      params = params.append('shop', shopId);
    }
    
    if (searchQuery) {
      params = params.append('q', searchQuery);
    }
    
    return this.httpClient.post<ResponsePayload>(API_SUPPLIER + 'get-all', filterData, { params });
  }

  /**
   * GET SUPPLIER BY ID
   */
  getSupplierById(id: string, select?: string): Observable<ResponsePayload> {
    let params = new HttpParams();
    const shopId = this.getShopId();
    
    if (shopId) {
      params = params.append('shop', shopId);
    }
    
    if (select) {
      params = params.append('select', select);
    }
    
    return this.httpClient.get<ResponsePayload>(API_SUPPLIER + id, { params });
  }

  /**
   * UPDATE SUPPLIER BY ID
   */
  updateSupplierById(id: string, data: Partial<Supplier>): Observable<ResponsePayload> {
    let params = new HttpParams();
    const shopId = this.getShopId();
    
    if (shopId) {
      params = params.append('shop', shopId);
    }
    
    return this.httpClient.put<ResponsePayload>(API_SUPPLIER + 'update/' + id, data, { params });
  }

  /**
   * DELETE SUPPLIER BY ID
   */
  deleteSupplierById(id: string, checkUsage: boolean = false): Observable<ResponsePayload> {
    let params = new HttpParams();
    const shopId = this.getShopId();
    
    if (shopId) {
      params = params.append('shop', shopId);
    }
    
    params = params.append('checkUsage', checkUsage.toString());
    
    return this.httpClient.delete<ResponsePayload>(API_SUPPLIER + 'delete/' + id, { params });
  }

  /**
   * DELETE MULTIPLE SUPPLIERS BY ID
   */
  deleteMultipleSupplierById(ids: string[], checkUsage: boolean = false): Observable<ResponsePayload> {
    let params = new HttpParams();
    const shopId = this.getShopId();
    
    if (shopId) {
      params = params.append('shop', shopId);
    }
    
    params = params.append('checkUsage', checkUsage.toString());
    
    return this.httpClient.post<ResponsePayload>(API_SUPPLIER + 'delete-multiple', { ids }, { params });
  }

  /**
   * UPDATE SUPPLIER DUE
   */
  updateSupplierDue(id: string, amount: number, type: 'add' | 'subtract'): Observable<ResponsePayload> {
    let params = new HttpParams();
    const shopId = this.getShopId();
    
    if (shopId) {
      params = params.append('shop', shopId);
    }
    
    return this.httpClient.put<ResponsePayload>(
      API_SUPPLIER + 'update-due/' + id,
      { amount, type },
      { params }
    );
  }

  /**
   * ADD SUPPLIER PAYMENT
   */
  addSupplierPayment(
    id: string,
    amount: number,
    paymentMethod?: string,
    reference?: string,
    notes?: string
  ): Observable<ResponsePayload> {
    let params = new HttpParams();
    const shopId = this.getShopId();
    
    if (shopId) {
      params = params.append('shop', shopId);
    }
    
    return this.httpClient.post<ResponsePayload>(
      API_SUPPLIER + 'add-payment/' + id,
      { amount, paymentMethod, reference, notes },
      { params }
    );
  }

  /**
   * GET SUPPLIER LEDGER
   */
  getSupplierLedger(id: string): Observable<ResponsePayload> {
    let params = new HttpParams();
    const shopId = this.getShopId();
    
    if (shopId) {
      params = params.append('shop', shopId);
    }
    
    return this.httpClient.post<ResponsePayload>(API_SUPPLIER + 'ledger/' + id, {}, { params });
  }

  /**
   * GET SUPPLIER STATS
   */
  getSupplierStats(id: string): Observable<ResponsePayload> {
    let params = new HttpParams();
    const shopId = this.getShopId();
    
    if (shopId) {
      params = params.append('shop', shopId);
    }
    
    return this.httpClient.get<ResponsePayload>(API_SUPPLIER + 'stats/' + id, { params });
  }

  /**
   * GET SUPPLIER TRANSACTIONS
   */
  getSupplierTransactions(id: string, startDate?: string, endDate?: string): Observable<ResponsePayload> {
    let params = new HttpParams();
    const shopId = this.getShopId();
    
    if (shopId) {
      params = params.append('shop', shopId);
    }
    
    if (startDate) {
      params = params.append('startDate', startDate);
    }
    
    if (endDate) {
      params = params.append('endDate', endDate);
    }
    
    return this.httpClient.get<ResponsePayload>(API_SUPPLIER + 'transactions/' + id, { params });
  }

  /**
   * GET SUPPLIERS WITH DUE
   */
  getSuppliersWithDue(): Observable<ResponsePayload> {
    let params = new HttpParams();
    const shopId = this.getShopId();
    
    if (shopId) {
      params = params.append('shop', shopId);
    }
    
    return this.httpClient.post<ResponsePayload>(API_SUPPLIER + 'get-with-due', {}, { params });
  }
}

