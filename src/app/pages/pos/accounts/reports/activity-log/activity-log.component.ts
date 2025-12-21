import { Component, OnInit } from '@angular/core';
import { ReportsService } from '../../../../../services/common/reports.service';
import { UiService } from '../../../../../services/core/ui.service';
import { ExportPrintService } from '../../../../../services/core/export-print.service';
import { DatePipe } from '@angular/common';
import { MatTableDataSource } from '@angular/material/table';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { UtilsService } from '../../../../../services/core/utils.service';

@Component({
  selector: 'app-activity-log',
  templateUrl: './activity-log.component.html',
  styleUrls: ['./activity-log.component.scss'],
  providers: [DatePipe]
})
export class ActivityLogComponent implements OnInit {
  isLoading: boolean = false;
  reportData: any[] = [];
  dataSource = new MatTableDataSource<any>([]);
  summary: any = {
    totalActivities: 0,
    byType: {
      sale: 0,
      purchase: 0,
      cashTransaction: 0
    }
  };
  startDate: Date | null = null;
  endDate: Date | null = null;
  selectedUserId: string | null = null;
  selectedSubjectType: string = 'All';
  users: any[] = [];
  userSearchControl = new FormControl('');
  
  // Date Range Filter
  today = new Date();
  dataFormDateRange = new FormGroup({
    start: new FormControl(),
    end: new FormControl(),
  });

  subjectTypes: string[] = ['All', 'Sell', 'Purchase', 'Contact', 'User', 'CashTransaction'];

  displayedColumns: string[] = [
    'date',
    'subjectType',
    'action',
    'by',
    'note'
  ];

  constructor(
    private reportsService: ReportsService,
    private uiService: UiService,
    private exportPrintService: ExportPrintService,
    private datePipe: DatePipe,
    private utilsService: UtilsService
  ) {}

  ngOnInit(): void {
    // Set default date range (current year)
    const today = new Date();
    this.endDate = today;
    const startDate = new Date(today.getFullYear(), 0, 1); // January 1st of current year
    this.startDate = startDate;
    
    // Initialize date range form
    this.dataFormDateRange.patchValue({
      start: startDate,
      end: today
    });
    
    this.selectedUserId = 'All';
    this.selectedSubjectType = 'All';
    
    this.loadUsers();
    this.loadReport();
    
    // Setup user search
    this.userSearchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        // Filter is handled by getter
      });
  }

  loadUsers() {
    this.reportsService.getActivityLogUsers()
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.users = res.data || [];
          }
        },
        error: (err) => {
          // Silently fail if server is not available
          console.warn('Could not load users for activity log filter. Server may not be running.');
          this.users = []; // Set empty array to prevent errors
        }
      });
  }

  loadReport() {
    this.isLoading = true;
    const startDateStr = this.startDate ? this.startDate.toISOString().split('T')[0] : undefined;
    const endDateStr = this.endDate ? this.endDate.toISOString().split('T')[0] : undefined;
    const userId = this.selectedUserId && this.selectedUserId !== 'All' ? this.selectedUserId : undefined;
    const subjectType = this.selectedSubjectType && this.selectedSubjectType !== 'All' ? this.selectedSubjectType : undefined;

    this.reportsService.getActivityLog(startDateStr, endDateStr, userId, subjectType)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.reportData = res.data?.report || [];
            this.dataSource.data = this.reportData;
            this.summary = res.data?.summary || {};
            console.log('Activity Log loaded:', {
              count: this.reportData.length,
              summary: this.summary,
              data: this.reportData
            });
            if (this.reportData.length === 0) {
              this.uiService.message('No activity data found', 'warn');
            }
          } else {
            this.uiService.message(res.message || 'Failed to load report', 'warn');
          }
        },
        error: (err) => {
          this.isLoading = false;
          if (err.status === 0) {
            // Connection refused - server not running
            this.uiService.message('Backend server is not running. Please start the server.', 'warn');
          } else {
            console.error('Error loading activity log:', err);
            this.uiService.message('Failed to load report', 'warn');
          }
          this.reportData = [];
          this.dataSource.data = [];
        }
      });
  }

  onDateChange() {
    // Date change doesn't auto-load, user needs to click "Load Report" button
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
        this.loadReport();
      } else {
        this.startDate = null;
        this.endDate = null;
        this.loadReport();
      }
    }
  }

  onFilterChange() {
    this.loadReport();
  }

  get filteredUsers(): any[] {
    const searchTerm = (this.userSearchControl.value || '').toLowerCase();
    if (!searchTerm) {
      return this.users;
    }
    return this.users.filter(user => 
      (user.name || '').toLowerCase().includes(searchTerm)
    );
  }

  getDateRangeDisplay(): string {
    if (this.startDate && this.endDate) {
      const start = this.datePipe.transform(this.startDate, 'dd-MM-yyyy');
      const end = this.datePipe.transform(this.endDate, 'dd-MM-yyyy');
      return `${start} - ${end}`;
    }
    return '';
  }

  setDateRange(range: string) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    switch (range) {
      case 'today':
        this.startDate = new Date(today);
        this.startDate.setHours(0, 0, 0, 0);
        this.endDate = today;
        break;
      case 'week':
        this.startDate = new Date(today);
        this.startDate.setDate(today.getDate() - 7);
        this.startDate.setHours(0, 0, 0, 0);
        this.endDate = today;
        break;
      case 'month':
        this.startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        this.endDate = today;
        break;
      case 'year':
        this.startDate = new Date(today.getFullYear(), 0, 1);
        this.endDate = today;
        break;
    }
    this.onFilterChange();
  }

  exportCSV() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Date', 'Time', 'Action', 'User', 'Details', 'Type'];
    const csvData = this.reportData.map(item => ({
      'Date': this.datePipe.transform(item.date, 'shortDate') || '',
      'Time': item.time || '',
      'Action': item.action || '',
      'User': item.user || '',
      'Details': item.details || '',
      'Type': item.type || ''
    }));

    this.exportPrintService.exportCSV(csvData, 'Activity_Log', headers);
    this.uiService.message('CSV exported successfully', 'success');
  }

  exportExcel() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const excelData = this.reportData.map(item => ({
      'Date': this.datePipe.transform(item.date, 'shortDate') || '',
      'Time': item.time || '',
      'Action': item.action || '',
      'User': item.user || '',
      'Details': item.details || '',
      'Type': item.type || ''
    }));

    this.exportPrintService.exportExcel(excelData, 'Activity_Log', 'Activity Log');
    this.uiService.message('Excel exported successfully', 'success');
  }

  exportPDF() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to export', 'warn');
      return;
    }

    const headers = ['Date', 'Time', 'Action', 'User', 'Details', 'Type'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.reportData.map(item => ({
        'Date': this.datePipe.transform(item.date, 'shortDate') || '',
        'Time': item.time || '',
        'Action': item.action || '',
        'User': item.user || '',
        'Details': item.details || '',
        'Type': item.type || ''
      })),
      headers,
      'Activity Log'
    );

    const summaryHTML = `
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <h3>Summary</h3>
        <p><strong>Total Activities:</strong> ${this.summary.totalActivities || 0}</p>
        <p><strong>By Type:</strong></p>
        <ul>
          <li>Sales: ${this.summary.byType?.sale || 0}</li>
          <li>Purchases: ${this.summary.byType?.purchase || 0}</li>
          <li>Cash Transactions: ${this.summary.byType?.cashTransaction || 0}</li>
        </ul>
      </div>
    `;

    this.exportPrintService.exportPDF(summaryHTML + htmlContent, 'Activity_Log');
    this.uiService.message('PDF exported successfully', 'success');
  }

  printReport() {
    if (this.reportData.length === 0) {
      this.uiService.message('No data to print', 'warn');
      return;
    }

    const headers = ['Date', 'Time', 'Action', 'User', 'Details', 'Type'];
    const htmlContent = this.exportPrintService.generateHTMLTable(
      this.reportData.map(item => ({
        'Date': this.datePipe.transform(item.date, 'shortDate') || '',
        'Time': item.time || '',
        'Action': item.action || '',
        'User': item.user || '',
        'Details': item.details || '',
        'Type': item.type || ''
      })),
      headers,
      'Activity Log'
    );

    const summaryHTML = `
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <h3>Summary</h3>
        <p><strong>Total Activities:</strong> ${this.summary.totalActivities || 0}</p>
        <p><strong>By Type:</strong></p>
        <ul>
          <li>Sales: ${this.summary.byType?.sale || 0}</li>
          <li>Purchases: ${this.summary.byType?.purchase || 0}</li>
          <li>Cash Transactions: ${this.summary.byType?.cashTransaction || 0}</li>
        </ul>
      </div>
    `;

    this.exportPrintService.printReport(summaryHTML + htmlContent, 'Activity Log');
  }

  showColumnsInfo() {
    this.uiService.message('Column visibility is not applicable for Activity Log', 'warn');
  }
}

