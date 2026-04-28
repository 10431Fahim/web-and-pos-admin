import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AllOrderRoutingModule } from './all-order-routing.module';
import { AllOrderComponent } from './all-order.component';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {
  GalleryImageViewerComponent
} from "../../../shared/components/gallery-image-viewer/gallery-image-viewer.component";
import {LimitTextPipe} from "../../../shared/pipes/limit-text.pipe";
import {MatButtonModule} from "@angular/material/button";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule} from "@angular/material/menu";
import {NoContentComponent} from "../../../shared/components/no-content/no-content.component";
import {PageLoaderComponent} from "../../../shared/components/page-loader/page-loader.component";
import {PaginationComponent} from "../../../shared/components/pagination/pagination.component";
import {MatTooltipModule} from "@angular/material/tooltip";
import {DaysRemainingPipe} from "../../../shared/pipes/days-remaining.pipe";
import {CurrencyPipe} from "../../../shared/pipes/currency.pipe";
import {CodPipe} from "../../../shared/pipes/cod.pipe";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MatFormFieldModule} from "@angular/material/form-field";
import {PaymentStatusPipe} from '../../../shared/pipes/payment-status.pipe';
import {JoinSkusPipe} from "../../../shared/pipes/join-sku.pipe";
import { FraudCheckerComponent } from '../order-details/fraud-checker/fraud-checker.component';

@NgModule({
  declarations: [
    AllOrderComponent
  ],
    imports: [
        CommonModule,
        AllOrderRoutingModule,
        FormsModule,
        GalleryImageViewerComponent,
        LimitTextPipe,
        MatButtonModule,
        MatCheckboxModule,
        MatIconModule,
        MatMenuModule,
        NoContentComponent,
        PageLoaderComponent,
        PaginationComponent,
        MatTooltipModule,
        DaysRemainingPipe,
        CurrencyPipe,
        CodPipe,
        MatDatepickerModule,
        MatFormFieldModule,
        ReactiveFormsModule,
        PaymentStatusPipe,
        JoinSkusPipe,
        FraudCheckerComponent
    ]
})
export class AllOrderModule { }
