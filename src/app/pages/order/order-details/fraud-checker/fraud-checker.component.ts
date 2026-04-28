import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from "@angular/router";
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { OrderService } from "../../../../services/common/order.service";
import { Subscription } from "rxjs";
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fraud-checker',
  templateUrl: './fraud-checker.component.html',
  styleUrl: './fraud-checker.component.scss',
  standalone: true,
  imports: [CommonModule]
})
export class FraudCheckerComponent implements OnInit {
  order1?: any;
  id?: string;



  private subscriptions: Subscription[] = [];

  constructor(
    private activatedRoute: ActivatedRoute,
    private orderService: OrderService,
    private dialogRef: MatDialogRef<FraudCheckerComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
  }

  ngOnInit() {
  }

  closeDialog() {
    this.dialogRef.close();
  }

}
